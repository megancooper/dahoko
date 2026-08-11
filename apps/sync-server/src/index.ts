import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { billingOptionsFromEnv } from "./billing.js";
import { runMigrations } from "./migrations.js";
import { createSyncServer } from "./server.js";
import type { Store } from "./store.js";

process.umask(0o077);

const port = Number(process.env.PORT ?? 8787);
const host = process.env.HOST ?? "127.0.0.1";
const databaseUrl = process.env.DATABASE_URL?.trim() ?? "";
const configuredDatabase =
  process.env.DAHOKO_SYNC_DATABASE ?? "./data/dahoko-sync.sqlite";
// Resolving the in-memory sentinel would turn it into a real file path.
const databasePath =
  configuredDatabase === ":memory:"
    ? configuredDatabase
    : resolve(configuredDatabase);
const allowedOrigins = (
  process.env.DAHOKO_SYNC_ORIGINS ??
  "tauri://localhost,http://tauri.localhost,http://localhost:5103,http://127.0.0.1:5103,http://localhost:5102,http://127.0.0.1:5102"
)
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
const accountHashKey = process.env.DAHOKO_ACCOUNT_HASH_KEY ?? "";

if (!Number.isSafeInteger(port) || port < 1 || port > 65_535) {
  throw new Error("PORT must be a valid TCP port.");
}
if (Buffer.byteLength(accountHashKey, "utf8") < 32) {
  throw new Error(
    "DAHOKO_ACCOUNT_HASH_KEY must be set to a stable secret of at least 32 bytes.",
  );
}

// DATABASE_URL selects Postgres (hosted Dahoko Cloud on Neon); without it
// the server keeps its self-host default of a local SQLite file.
let store: Store | undefined;
if (databaseUrl) {
  const { PgStore } = await import("./pg-store.js");
  const pgStore = new PgStore(databaseUrl);
  // CI applies migrations on deploy; running them here as well is an
  // idempotent safety net serialized by an advisory lock.
  const applied = await runMigrations(pgStore);
  console.log(
    JSON.stringify({ event: "sync_server_migrations", applied }),
  );
  store = pgStore;
} else if (databasePath !== ":memory:") {
  mkdirSync(dirname(databasePath), { recursive: true, mode: 0o700 });
}

const billing = billingOptionsFromEnv(process.env);

const syncServer = createSyncServer({
  databasePath,
  store,
  allowedOrigins,
  accountHashKey,
  trustProxy: process.env.DAHOKO_TRUST_PROXY === "true",
  billing,
});

syncServer.server.listen(port, host, () => {
  console.log(
    JSON.stringify({
      event: "sync_server_started",
      host,
      port,
      database: databaseUrl ? "postgres" : databasePath,
    }),
  );
});

let stopping = false;
const stop = async () => {
  if (stopping) return;
  stopping = true;
  await syncServer.close();
};

process.on("SIGINT", () => void stop());
process.on("SIGTERM", () => void stop());
