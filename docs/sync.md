# Encrypted sync

Dahoko sync is optional, offline-first, and end-to-end encrypted. The desktop
app remains the source of usable data. A sync server stores one opaque encrypted
document per account and coordinates revisions between devices. Every
workspace travels inside that document, so another device discovers the same
workspace switcher without revealing workspace names to the host.

The reference server is open source and is the same server intended for both
self-hosting and a Dahoko-hosted service.

## Privacy boundary

Content encrypted before upload includes:

- workspace names, colors, and membership;
- tasks and notes;
- lists, statuses, tags, priorities, and dates;
- subtasks;
- recurrence and completion history;
- deletion tombstones required to keep devices consistent.

The sync host cannot decrypt that content. The host can still observe:

- a keyed, normalized account identifier;
- IP addresses while requests are in flight;
- request timing, ciphertext size, and revision count;
- session creation and authentication failures.

The server does not store plaintext email addresses, account passwords,
encryption passphrases, session tokens, or task content. Email lookup uses a
keyed HMAC so a database-only leak cannot be searched with a list of likely
addresses. Session tokens are stored as SHA-256 hashes. Account passwords use
scrypt with a unique random salt. The encryption passphrase is never sent to
the server and is retained only in desktop-app memory for the current app
session. The desktop device keeps the selected server and email locally for
convenience, but persists neither secret.

Use a different account password and encryption passphrase. A modified or
malicious hosted server can see the account password during a TLS request, but
it never receives the separate encryption passphrase.

## Cryptographic design

- Key derivation: PBKDF2-HMAC-SHA-256, 600,000 iterations, 256-bit per-account
  random salt.
- Content encryption: AES-256-GCM with a fresh 96-bit nonce for every upload.
- Integrity: AES-GCM authentication plus account-specific additional
  authenticated data prevents undetected modification or cross-account blob
  substitution.
- Transport: HTTPS is required by the desktop app except for loopback
  development addresses.

If the encryption passphrase is lost, the server copy cannot be recovered.
Exporting a local Dahoko backup remains the recommended recovery path.

## Conflict handling

Each entity is a last-writer-wins encrypted register using a hybrid logical
timestamp and a stable device ID. Deleted records become encrypted tombstones.
Devices:

1. compare the current local database with the last locally observed encrypted
   document;
2. stamp local edits and deletions;
3. download and decrypt the server document;
4. merge records deterministically and validate all relationships;
5. upload with an optimistic base revision;
6. retry against the latest encrypted document if another device wrote first.

This preserves independent offline changes and propagates deletions. If two
devices concurrently edit the same entity, the deterministic later stamp wins.

## Run locally

Node 22 or newer is required.

```bash
pnpm install
pnpm --filter @dahoko/sync-server build

DAHOKO_ACCOUNT_HASH_KEY="$(openssl rand -hex 32)" \
DAHOKO_SYNC_ORIGINS="tauri://localhost,http://tauri.localhost" \
DAHOKO_SYNC_DATABASE="./data/dahoko-sync.sqlite" \
pnpm --filter @dahoko/sync-server start
```

That inline key is suitable for a disposable development account. Save and
reuse the same value when keeping the local database.

For local desktop testing, enter `http://127.0.0.1:8787` in Settings. Plain
HTTP is intentionally rejected for non-loopback servers.

## Run with Docker

```bash
openssl rand -hex 32
# Save that output as DAHOKO_ACCOUNT_HASH_KEY in a local .env file, then:
docker compose -f compose.sync.yaml up -d --build
```

Published releases and changes on `main` also build
`ghcr.io/megancooper/dahoko-sync`. After making the GitHub package public, a
self-host can run the exact released server without cloning the repository:

```bash
docker run -d --name dahoko-sync \
  -p 127.0.0.1:8787:8787 \
  -v dahoko-sync-data:/data \
  -e DAHOKO_SYNC_ORIGINS="tauri://localhost,http://tauri.localhost" \
  -e DAHOKO_ACCOUNT_HASH_KEY="your-stable-random-secret" \
  ghcr.io/megancooper/dahoko-sync:latest
```

Put the server behind a TLS reverse proxy and expose only the proxy publicly.
The reference SQLite deployment is intentionally a single-instance service.
Use one replica with a persistent volume; multiple replicas must not share the
SQLite file.

Environment variables:

| Variable | Default | Purpose |
| --- | --- | --- |
| `HOST` | `127.0.0.1` | Listen address; the Docker image sets `0.0.0.0` |
| `PORT` | `8787` | Listen port |
| `DAHOKO_SYNC_DATABASE` | `./data/dahoko-sync.sqlite` | Persistent SQLite path |
| `DAHOKO_SYNC_ORIGINS` | Tauri and local development origins | Exact comma-separated CORS allowlist |
| `DAHOKO_TRUST_PROXY` | `false` | Trust `X-Forwarded-For`; enable only behind a proxy that replaces this header |
| `DAHOKO_ACCOUNT_HASH_KEY` | required | Stable random secret used only to obscure account email lookup keys at rest |

The server does not terminate TLS. Your proxy or container platform must
provide HTTPS. Keep `DAHOKO_ACCOUNT_HASH_KEY` in the platform's secret manager
and back it up separately; changing it makes existing accounts undiscoverable.

## Hosted Dahoko option

Deploy the same container as a single instance with a persistent volume and
regular volume backups. Configure:

```text
HOST=0.0.0.0
PORT=8787
DAHOKO_SYNC_DATABASE=/data/dahoko-sync.sqlite
DAHOKO_SYNC_ORIGINS=tauri://localhost,http://tauri.localhost
DAHOKO_TRUST_PROXY=true
DAHOKO_ACCOUNT_HASH_KEY=<stable secret from your platform secret manager>
```

Enable `DAHOKO_TRUST_PROXY` only if the hosting proxy removes user-supplied
forwarded headers. Point a TLS hostname at the service.

Set the GitHub repository variable `DAHOKO_SYNC_URL` to that public HTTPS URL.
Desktop release builds expose it as the one-click “Dahoko Cloud” choice.
Custom server URLs remain available.

## Backups and deletion

Back up the persistent SQLite volume. For a simple consistent file backup,
stop the container, copy the volume contents, and restart it. Test restores
regularly.

Users can delete their server account from Settings after re-entering the
account password. Deletion removes the account, active sessions, revision
history, and encrypted blob. Local tasks remain on the device.

## HTTP API

All responses are JSON and use `Cache-Control: no-store`.

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/health` | Protocol health check |
| `POST` | `/v1/auth/register` | Create an account and encryption salt |
| `POST` | `/v1/auth/login` | Create a 30-day bearer session |
| `POST` | `/v1/auth/logout` | Invalidate the current session |
| `GET` | `/v1/sync` | Read the caller’s encrypted blob and revision |
| `PUT` | `/v1/sync` | Compare-and-swap an encrypted blob |
| `DELETE` | `/v1/account` | Re-authenticate and delete the server account |

Authentication and deletion are rate-limited. Every sync read and write derives
the account exclusively from the bearer session; client-supplied account IDs
are never trusted.

## Threat-model limits

End-to-end encryption protects content confidentiality and detects ciphertext
modification. It does not prevent a server from withholding data, deleting an
account, serving an older valid ciphertext revision, or observing traffic
metadata. It also does not protect data on an already compromised device while
the app is unlocked.

Future protocol versions can add signed revision checkpoints for stronger
rollback detection without changing the opaque-storage server model.
