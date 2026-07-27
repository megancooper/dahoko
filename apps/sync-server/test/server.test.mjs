import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { afterEach, describe, it } from "node:test";
import { createSyncServer } from "../dist/server.js";

const origin = "http://localhost:5103";
const servers = [];
const temporaryDirectories = [];

async function startServer(databasePath = ":memory:") {
  const syncServer = createSyncServer({
    databasePath,
    allowedOrigins: [origin],
    accountHashKey: "test-only-account-lookup-key-32-bytes",
    scryptCost: 1_024,
  });
  servers.push(syncServer);
  await new Promise((resolve) => {
    syncServer.server.listen(0, "127.0.0.1", resolve);
  });
  const address = syncServer.server.address();
  if (!address || typeof address === "string") throw new Error("No test port");
  return `http://127.0.0.1:${address.port}`;
}

async function request(baseUrl, path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: options.method ?? "GET",
    headers: {
      Origin: options.requestOrigin ?? origin,
      ...(options.token
        ? { Authorization: `Bearer ${options.token}` }
        : {}),
      ...(options.body === undefined
        ? {}
        : { "Content-Type": "application/json" }),
    },
    body:
      options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  return {
    status: response.status,
    body: await response.json(),
  };
}

async function register(baseUrl, email) {
  const result = await request(baseUrl, "/v1/auth/register", {
    method: "POST",
    body: { email, password: "a safe account password" },
  });
  assert.equal(result.status, 200);
  return result.body;
}

function blob(salt, marker) {
  return {
    version: 1,
    algorithm: "AES-256-GCM",
    kdf: "PBKDF2-SHA256",
    iterations: 600_000,
    salt,
    nonce: Buffer.alloc(12, marker).toString("base64"),
    ciphertext: Buffer.alloc(32, marker).toString("base64"),
  };
}

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => server.close()));
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("dahoko sync server", () => {
  it("registers, authenticates, and stores only the opaque encrypted blob", async () => {
    const baseUrl = await startServer();
    const account = await register(baseUrl, "user@example.com");
    const encrypted = blob(account.encryptionSalt, 7);

    const put = await request(baseUrl, "/v1/sync", {
      method: "PUT",
      token: account.token,
      body: { baseRevision: 0, blob: encrypted },
    });
    const get = await request(baseUrl, "/v1/sync", {
      token: account.token,
    });

    assert.equal(put.status, 200);
    assert.equal(put.body.revision, 1);
    assert.deepEqual(get.body, { revision: 1, blob: encrypted });
  });

  it("stores a keyed account lookup value instead of a reusable email hash", async () => {
    const directory = mkdtempSync(join(tmpdir(), "dahoko-sync-test-"));
    temporaryDirectories.push(directory);
    const databasePath = join(directory, "sync.sqlite");
    const baseUrl = await startServer(databasePath);
    await register(baseUrl, "private@example.com");

    const database = new DatabaseSync(databasePath, { readOnly: true });
    const row = database
      .prepare("SELECT email_hash FROM accounts")
      .get();
    database.close();
    const plainHash = createHash("sha256")
      .update("private@example.com")
      .digest("hex");

    assert.equal(typeof row?.email_hash, "string");
    assert.notEqual(row.email_hash, plainHash);
  });

  it("enforces account isolation and optimistic concurrency", async () => {
    const baseUrl = await startServer();
    const first = await register(baseUrl, "first@example.com");
    const second = await register(baseUrl, "second@example.com");
    await request(baseUrl, "/v1/sync", {
      method: "PUT",
      token: first.token,
      body: {
        baseRevision: 0,
        blob: blob(first.encryptionSalt, 1),
      },
    });

    const secondRead = await request(baseUrl, "/v1/sync", {
      token: second.token,
    });
    const conflict = await request(baseUrl, "/v1/sync", {
      method: "PUT",
      token: first.token,
      body: {
        baseRevision: 0,
        blob: blob(first.encryptionSalt, 2),
      },
    });

    assert.deepEqual(secondRead.body, { revision: 0, blob: null });
    assert.equal(conflict.status, 409);
    assert.equal(conflict.body.revision, 1);
  });

  it("rejects unauthenticated access, salt substitution, and unknown origins", async () => {
    const baseUrl = await startServer();
    const account = await register(baseUrl, "privacy@example.com");
    const unauthorized = await request(baseUrl, "/v1/sync");
    const wrongSalt = await request(baseUrl, "/v1/sync", {
      method: "PUT",
      token: account.token,
      body: {
        baseRevision: 0,
        blob: blob(Buffer.alloc(32, 9).toString("base64"), 1),
      },
    });
    const badOrigin = await request(baseUrl, "/health", {
      requestOrigin: "https://attacker.example",
    });

    assert.equal(unauthorized.status, 401);
    assert.equal(wrongSalt.status, 400);
    assert.equal(badOrigin.status, 403);
  });

  it("uses generic login failures and invalidates sessions on logout", async () => {
    const baseUrl = await startServer();
    const account = await register(baseUrl, "login@example.com");
    const wrongPassword = await request(baseUrl, "/v1/auth/login", {
      method: "POST",
      body: { email: "login@example.com", password: "the wrong password!" },
    });
    const missingAccount = await request(baseUrl, "/v1/auth/login", {
      method: "POST",
      body: { email: "missing@example.com", password: "the wrong password!" },
    });
    await request(baseUrl, "/v1/auth/logout", {
      method: "POST",
      token: account.token,
      body: {},
    });
    const afterLogout = await request(baseUrl, "/v1/sync", {
      token: account.token,
    });

    assert.deepEqual(wrongPassword, missingAccount);
    assert.equal(wrongPassword.status, 401);
    assert.equal(afterLogout.status, 401);
  });

  it("lets an authenticated user permanently delete the server account", async () => {
    const baseUrl = await startServer();
    const account = await register(baseUrl, "delete@example.com");
    const wrongPassword = await request(baseUrl, "/v1/account", {
      method: "DELETE",
      token: account.token,
      body: { password: "the wrong password!" },
    });
    const deleted = await request(baseUrl, "/v1/account", {
      method: "DELETE",
      token: account.token,
      body: { password: "a safe account password" },
    });
    const loginAfterDelete = await request(baseUrl, "/v1/auth/login", {
      method: "POST",
      body: {
        email: "delete@example.com",
        password: "a safe account password",
      },
    });

    assert.equal(wrongPassword.status, 401);
    assert.deepEqual(deleted.body, { ok: true });
    assert.equal(loginAfterDelete.status, 401);
  });
});
