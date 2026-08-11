import pg from "pg";
import type { SubscriptionCache } from "./billing.js";
import type {
  AccountRow,
  AuthenticatedAccount,
  EncryptedBlob,
  Store,
  SyncState,
} from "./store.js";

const { Pool, types } = pg;

// BIGINT (int8) arrives as a string by default; every bigint column here
// holds a millisecond timestamp or revision counter, both safe as numbers.
types.setTypeParser(20, (value: string) => Number(value));

export class PgStore implements Store {
  private readonly pool: pg.Pool;

  constructor(databaseUrl: string) {
    this.pool = new Pool({
      connectionString: databaseUrl,
      max: 10,
      // Neon and most managed Postgres providers require TLS; local
      // postgres:// URLs without sslmode stay plain.
      ssl: /sslmode=(require|verify)/.test(databaseUrl)
        ? { rejectUnauthorized: true }
        : undefined,
    });
  }

  query(
    text: string,
    values?: unknown[],
  ): Promise<{ rows: Array<Record<string, unknown>>; rowCount: number | null }> {
    return this.pool.query(text, values);
  }

  async close(): Promise<void> {
    await this.pool.end();
  }

  async createAccount(
    emailHash: string,
    passwordHash: string,
    encryptionSalt: string,
    now: number,
  ): Promise<string | null> {
    const { randomUUID } = await import("node:crypto");
    const id = randomUUID();
    const result = await this.pool.query(
      `INSERT INTO accounts (
         id, email_hash, password_hash, encryption_salt, created_at, updated_at
       ) VALUES ($1, $2, $3, $4, $5, $5)
       ON CONFLICT (email_hash) DO NOTHING
       RETURNING id`,
      [id, emailHash, passwordHash, encryptionSalt, now],
    );
    return result.rowCount === 1 ? id : null;
  }

  async accountByEmailHash(emailHash: string): Promise<AccountRow | null> {
    const result = await this.pool.query(
      "SELECT id, password_hash, encryption_salt FROM accounts WHERE email_hash = $1",
      [emailHash],
    );
    return (result.rows[0] as AccountRow | undefined) ?? null;
  }

  async accountById(accountId: string): Promise<AccountRow | null> {
    const result = await this.pool.query(
      "SELECT id, password_hash, encryption_salt FROM accounts WHERE id = $1",
      [accountId],
    );
    return (result.rows[0] as AccountRow | undefined) ?? null;
  }

  async deleteAccount(accountId: string): Promise<void> {
    await this.pool.query("DELETE FROM accounts WHERE id = $1", [accountId]);
  }

  async createSession(
    accountId: string,
    tokenHash: string,
    expiresAt: number,
    now: number,
  ): Promise<void> {
    await this.pool.query(
      "INSERT INTO sessions (token_hash, account_id, expires_at, created_at) VALUES ($1, $2, $3, $4)",
      [tokenHash, accountId, expiresAt, now],
    );
  }

  async accountForSession(
    tokenHash: string,
    now: number,
  ): Promise<AuthenticatedAccount | null> {
    const result = await this.pool.query(
      `SELECT accounts.id, accounts.encryption_salt, sessions.expires_at
       FROM sessions
       JOIN accounts ON accounts.id = sessions.account_id
       WHERE sessions.token_hash = $1`,
      [tokenHash],
    );
    const row = result.rows[0] as
      | { id: string; encryption_salt: string; expires_at: number }
      | undefined;
    if (!row) return null;
    if (row.expires_at <= now) {
      await this.deleteSession(tokenHash);
      return null;
    }
    return { id: row.id, encryptionSalt: row.encryption_salt };
  }

  async deleteSession(tokenHash: string): Promise<void> {
    await this.pool.query("DELETE FROM sessions WHERE token_hash = $1", [
      tokenHash,
    ]);
  }

  async cleanupSessions(now: number): Promise<void> {
    await this.pool.query("DELETE FROM sessions WHERE expires_at <= $1", [
      now,
    ]);
  }

  async syncState(accountId: string): Promise<SyncState | null> {
    const result = await this.pool.query(
      "SELECT revision, blob_json FROM accounts WHERE id = $1",
      [accountId],
    );
    const row = result.rows[0] as
      | { revision: number; blob_json: string | null }
      | undefined;
    if (!row) return null;
    return {
      revision: row.revision,
      blob: row.blob_json
        ? (JSON.parse(row.blob_json) as EncryptedBlob)
        : null,
    };
  }

  async compareAndSwapSync(
    accountId: string,
    baseRevision: number,
    blob: EncryptedBlob,
    now: number,
  ): Promise<{ saved: boolean; state: SyncState }> {
    // A single conditional UPDATE is the compare-and-swap; no explicit
    // transaction is needed because losing the race simply re-reads.
    const updated = await this.pool.query(
      `UPDATE accounts
       SET blob_json = $1, revision = revision + 1, updated_at = $2
       WHERE id = $3 AND revision = $4
       RETURNING revision, blob_json`,
      [JSON.stringify(blob), now, accountId, baseRevision],
    );
    if (updated.rowCount === 1) {
      const row = updated.rows[0] as {
        revision: number;
        blob_json: string | null;
      };
      return {
        saved: true,
        state: {
          revision: row.revision,
          blob: row.blob_json
            ? (JSON.parse(row.blob_json) as EncryptedBlob)
            : null,
        },
      };
    }
    const state = await this.syncState(accountId);
    if (!state) throw new Error("The account disappeared during sync.");
    return { saved: false, state };
  }

  async stripeCustomerIdForAccount(accountId: string): Promise<string | null> {
    const result = await this.pool.query(
      "SELECT stripe_customer_id FROM billing_customers WHERE account_id = $1",
      [accountId],
    );
    const row = result.rows[0] as
      | { stripe_customer_id: string }
      | undefined;
    return row?.stripe_customer_id ?? null;
  }

  async bindStripeCustomer(
    accountId: string,
    stripeCustomerId: string,
    now: number,
  ): Promise<void> {
    await this.pool.query(
      `INSERT INTO billing_customers (account_id, stripe_customer_id, created_at)
       VALUES ($1, $2, $3)
       ON CONFLICT (account_id) DO NOTHING`,
      [accountId, stripeCustomerId, now],
    );
  }

  async accountIdForStripeCustomer(
    stripeCustomerId: string,
  ): Promise<string | null> {
    const result = await this.pool.query(
      "SELECT account_id FROM billing_customers WHERE stripe_customer_id = $1",
      [stripeCustomerId],
    );
    const row = result.rows[0] as { account_id: string } | undefined;
    return row?.account_id ?? null;
  }

  async saveSubscriptionCache(
    stripeCustomerId: string,
    cache: SubscriptionCache,
    now: number,
  ): Promise<void> {
    await this.pool.query(
      `INSERT INTO billing_state (stripe_customer_id, sub_json, updated_at)
       VALUES ($1, $2, $3)
       ON CONFLICT (stripe_customer_id) DO UPDATE
         SET sub_json = excluded.sub_json, updated_at = excluded.updated_at`,
      [stripeCustomerId, JSON.stringify(cache), now],
    );
  }

  async subscriptionCacheForCustomer(
    stripeCustomerId: string,
  ): Promise<SubscriptionCache | null> {
    const result = await this.pool.query(
      "SELECT sub_json FROM billing_state WHERE stripe_customer_id = $1",
      [stripeCustomerId],
    );
    const row = result.rows[0] as { sub_json: string } | undefined;
    if (!row) return null;
    try {
      return JSON.parse(row.sub_json) as SubscriptionCache;
    } catch {
      return null;
    }
  }
}
