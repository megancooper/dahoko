/**
 * Applies pending Postgres migrations and exits. Used by CI on pushes to
 * main: DATABASE_URL=... node dist/migrate-cli.js
 */
import { runMigrations } from "./migrations.js";

const databaseUrl = process.env.DATABASE_URL?.trim();
if (!databaseUrl) {
  console.error("DATABASE_URL must be set.");
  process.exit(1);
}

const { PgStore } = await import("./pg-store.js");
const store = new PgStore(databaseUrl);
try {
  const applied = await runMigrations(store);
  console.log(
    applied.length > 0
      ? `Applied: ${applied.join(", ")}`
      : "Already up to date.",
  );
} finally {
  await store.close();
}
