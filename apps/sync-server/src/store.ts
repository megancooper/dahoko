import { randomUUID } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import type { SubscriptionCache } from "./billing.js";

/**
 * Storage behind the sync server. Two implementations exist: SQLite for
 * self-hosting and local development, Postgres (Neon) for hosted Dahoko
 * Cloud. Every method is async so the two stay interchangeable.
 */

export interface AccountRow {
  id: string;
  password_hash: string;
  encryption_salt: string;
}

export interface AuthenticatedAccount {
  id: string;
  encryptionSalt: string;
}

export interface EncryptedBlob {
  version: 1;
  algorithm: "AES-256-GCM";
  kdf: "PBKDF2-SHA256";
  iterations: 600_000;
  salt: string;
  nonce: string;
  ciphertext: string;
}

export interface SyncState {
  revision: number;
  blob: EncryptedBlob | null;
}

export interface Store {
  close(): Promise<void>;
  createAccount(
    emailHash: string,
    passwordHash: string,
    encryptionSalt: string,
    now: number,
  ): Promise<string | null>;
  accountByEmailHash(emailHash: string): Promise<AccountRow | null>;
  accountById(accountId: string): Promise<AccountRow | null>;
  deleteAccount(accountId: string): Promise<void>;
  createSession(
    accountId: string,
    tokenHash: string,
    expiresAt: number,
    now: number,
  ): Promise<void>;
  accountForSession(
    tokenHash: string,
    now: number,
  ): Promise<AuthenticatedAccount | null>;
  deleteSession(tokenHash: string): Promise<void>;
  cleanupSessions(now: number): Promise<void>;
  syncState(accountId: string): Promise<SyncState | null>;
  compareAndSwapSync(
    accountId: string,
    baseRevision: number,
    blob: EncryptedBlob,
    now: number,
  ): Promise<{ saved: boolean; state: SyncState }>;
  // Billing bindings (see billing.ts for the flow they support).
  stripeCustomerIdForAccount(accountId: string): Promise<string | null>;
  bindStripeCustomer(
    accountId: string,
    stripeCustomerId: string,
    now: number,
  ): Promise<void>;
  accountIdForStripeCustomer(
    stripeCustomerId: string,
  ): Promise<string | null>;
  saveSubscriptionCache(
    stripeCustomerId: string,
    cache: SubscriptionCache,
    now: number,
  ): Promise<void>;
  subscriptionCacheForCustomer(
    stripeCustomerId: string,
  ): Promise<SubscriptionCache | null>;
}

export class SqliteStore implements Store {
  private readonly database: DatabaseSync;

  constructor(path: string) {
    this.database = new DatabaseSync(path);
    this.database.exec("PRAGMA foreign_keys = ON");
    this.database.exec("PRAGMA busy_timeout = 5000");
    if (path !== ":memory:") this.database.exec("PRAGMA journal_mode = WAL");
    this.database.exec(`
      CREATE TABLE IF NOT EXISTS accounts (
        id TEXT PRIMARY KEY,
        email_hash TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        encryption_salt TEXT NOT NULL,
        revision INTEGER NOT NULL DEFAULT 0,
        blob_json TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS sessions (
        token_hash TEXT PRIMARY KEY,
        account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        expires_at INTEGER NOT NULL,
        created_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS sessions_account_id
        ON sessions(account_id);
      CREATE INDEX IF NOT EXISTS sessions_expires_at
        ON sessions(expires_at);
      CREATE TABLE IF NOT EXISTS billing_customers (
        account_id TEXT PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
        stripe_customer_id TEXT NOT NULL UNIQUE,
        created_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS billing_state (
        stripe_customer_id TEXT PRIMARY KEY,
        sub_json TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      );
    `);
  }

  async close(): Promise<void> {
    this.database.close();
  }

  async createAccount(
    emailHash: string,
    passwordHash: string,
    encryptionSalt: string,
    now: number,
  ): Promise<string | null> {
    const id = randomUUID();
    try {
      this.database
        .prepare(
          `INSERT INTO accounts (
             id, email_hash, password_hash, encryption_salt, created_at, updated_at
           ) VALUES (?, ?, ?, ?, ?, ?)`,
        )
        .run(id, emailHash, passwordHash, encryptionSalt, now, now);
      return id;
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.includes("UNIQUE constraint failed: accounts.email_hash")
      ) {
        return null;
      }
      throw error;
    }
  }

  async accountByEmailHash(emailHash: string): Promise<AccountRow | null> {
    return (
      (this.database
        .prepare(
          "SELECT id, password_hash, encryption_salt FROM accounts WHERE email_hash = ?",
        )
        .get(emailHash) as AccountRow | undefined) ?? null
    );
  }

  async accountById(accountId: string): Promise<AccountRow | null> {
    return (
      (this.database
        .prepare(
          "SELECT id, password_hash, encryption_salt FROM accounts WHERE id = ?",
        )
        .get(accountId) as AccountRow | undefined) ?? null
    );
  }

  async deleteAccount(accountId: string): Promise<void> {
    this.database.prepare("DELETE FROM accounts WHERE id = ?").run(accountId);
  }

  async createSession(
    accountId: string,
    tokenHash: string,
    expiresAt: number,
    now: number,
  ): Promise<void> {
    this.database
      .prepare(
        "INSERT INTO sessions (token_hash, account_id, expires_at, created_at) VALUES (?, ?, ?, ?)",
      )
      .run(tokenHash, accountId, expiresAt, now);
  }

  async accountForSession(
    tokenHash: string,
    now: number,
  ): Promise<AuthenticatedAccount | null> {
    const row = this.database
      .prepare(
        `SELECT accounts.id, accounts.encryption_salt, sessions.expires_at
         FROM sessions
         JOIN accounts ON accounts.id = sessions.account_id
         WHERE sessions.token_hash = ?`,
      )
      .get(tokenHash) as
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
    this.database
      .prepare("DELETE FROM sessions WHERE token_hash = ?")
      .run(tokenHash);
  }

  async cleanupSessions(now: number): Promise<void> {
    this.database
      .prepare("DELETE FROM sessions WHERE expires_at <= ?")
      .run(now);
  }

  async syncState(accountId: string): Promise<SyncState | null> {
    const row = this.database
      .prepare("SELECT revision, blob_json FROM accounts WHERE id = ?")
      .get(accountId) as
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
    this.database.exec("BEGIN IMMEDIATE");
    try {
      const result = this.database
        .prepare(
          `UPDATE accounts
           SET blob_json = ?, revision = revision + 1, updated_at = ?
           WHERE id = ? AND revision = ?`,
        )
        .run(JSON.stringify(blob), now, accountId, baseRevision);
      const state = await this.syncState(accountId);
      this.database.exec("COMMIT");
      if (!state) throw new Error("The account disappeared during sync.");
      return { saved: Number(result.changes) === 1, state };
    } catch (error) {
      this.database.exec("ROLLBACK");
      throw error;
    }
  }

  async stripeCustomerIdForAccount(accountId: string): Promise<string | null> {
    const row = this.database
      .prepare(
        "SELECT stripe_customer_id FROM billing_customers WHERE account_id = ?",
      )
      .get(accountId) as { stripe_customer_id: string } | undefined;
    return row?.stripe_customer_id ?? null;
  }

  async bindStripeCustomer(
    accountId: string,
    stripeCustomerId: string,
    now: number,
  ): Promise<void> {
    this.database
      .prepare(
        `INSERT INTO billing_customers (account_id, stripe_customer_id, created_at)
         VALUES (?, ?, ?)
         ON CONFLICT(account_id) DO NOTHING`,
      )
      .run(accountId, stripeCustomerId, now);
  }

  async accountIdForStripeCustomer(
    stripeCustomerId: string,
  ): Promise<string | null> {
    const row = this.database
      .prepare(
        "SELECT account_id FROM billing_customers WHERE stripe_customer_id = ?",
      )
      .get(stripeCustomerId) as { account_id: string } | undefined;
    return row?.account_id ?? null;
  }

  async saveSubscriptionCache(
    stripeCustomerId: string,
    cache: SubscriptionCache,
    now: number,
  ): Promise<void> {
    this.database
      .prepare(
        `INSERT INTO billing_state (stripe_customer_id, sub_json, updated_at)
         VALUES (?, ?, ?)
         ON CONFLICT(stripe_customer_id) DO UPDATE
           SET sub_json = excluded.sub_json, updated_at = excluded.updated_at`,
      )
      .run(stripeCustomerId, JSON.stringify(cache), now);
  }

  async subscriptionCacheForCustomer(
    stripeCustomerId: string,
  ): Promise<SubscriptionCache | null> {
    const row = this.database
      .prepare(
        "SELECT sub_json FROM billing_state WHERE stripe_customer_id = ?",
      )
      .get(stripeCustomerId) as { sub_json: string } | undefined;
    if (!row) return null;
    try {
      return JSON.parse(row.sub_json) as SubscriptionCache;
    } catch {
      return null;
    }
  }
}
