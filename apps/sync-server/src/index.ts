import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { createSyncServer } from "./server.js";

process.umask(0o077);

const port = Number(process.env.PORT ?? 8787);
const host = process.env.HOST ?? "127.0.0.1";
const databasePath = resolve(
  process.env.DAHOKO_SYNC_DATABASE ?? "./data/dahoko-sync.sqlite",
);
const allowedOrigins = (
  process.env.DAHOKO_SYNC_ORIGINS ??
  "tauri://localhost,http://tauri.localhost,http://localhost:5103,http://127.0.0.1:5103"
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
if (databasePath !== ":memory:") {
  mkdirSync(dirname(databasePath), { recursive: true, mode: 0o700 });
}

const syncServer = createSyncServer({
  databasePath,
  allowedOrigins,
  accountHashKey,
  trustProxy: process.env.DAHOKO_TRUST_PROXY === "true",
});

syncServer.server.listen(port, host, () => {
  console.log(
    JSON.stringify({
      event: "sync_server_started",
      host,
      port,
      databasePath,
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
