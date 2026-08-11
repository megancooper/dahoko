/**
 * Postgres schema migrations, embedded so the compiled server and the CI
 * migration runner share one source of truth without shipping .sql files.
 * Append-only: never edit an entry that has reached any shared database —
 * add a new one.
 */

export interface Migration {
  id: string;
  sql: string;
}

export const MIGRATIONS: Migration[] = [
  {
    id: "0001_init",
    sql: `
      CREATE TABLE IF NOT EXISTS accounts (
        id TEXT PRIMARY KEY,
        email_hash TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        encryption_salt TEXT NOT NULL,
        revision BIGINT NOT NULL DEFAULT 0,
        blob_json TEXT,
        created_at BIGINT NOT NULL,
        updated_at BIGINT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS sessions (
        token_hash TEXT PRIMARY KEY,
        account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        expires_at BIGINT NOT NULL,
        created_at BIGINT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS sessions_account_id ON sessions(account_id);
      CREATE INDEX IF NOT EXISTS sessions_expires_at ON sessions(expires_at);

      CREATE TABLE IF NOT EXISTS billing_customers (
        account_id TEXT PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
        stripe_customer_id TEXT NOT NULL UNIQUE,
        created_at BIGINT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS billing_state (
        stripe_customer_id TEXT PRIMARY KEY,
        sub_json TEXT NOT NULL,
        updated_at BIGINT NOT NULL
      );
    `,
  },
];

interface Queryable {
  query(
    text: string,
    values?: unknown[],
  ): Promise<{ rows: Array<Record<string, unknown>> }>;
}

/**
 * Applies pending migrations inside one advisory lock so concurrent
 * deploys (or server start racing CI) cannot interleave.
 */
export async function runMigrations(client: Queryable): Promise<string[]> {
  await client.query("SELECT pg_advisory_lock(727185)");
  const applied: string[] = [];
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
    const seen = new Set(
      (
        await client.query("SELECT id FROM schema_migrations")
      ).rows.map((row) => String(row.id)),
    );
    for (const migration of MIGRATIONS) {
      if (seen.has(migration.id)) continue;
      await client.query("BEGIN");
      try {
        await client.query(migration.sql);
        await client.query(
          "INSERT INTO schema_migrations (id) VALUES ($1)",
          [migration.id],
        );
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      }
      applied.push(migration.id);
    }
  } finally {
    await client.query("SELECT pg_advisory_unlock(727185)");
  }
  return applied;
}
