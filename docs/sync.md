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
| `DATABASE_URL` | unset | Postgres connection string (e.g. Neon). Setting it switches storage from SQLite to Postgres |
| `STRIPE_SECRET_KEY` | unset | Stripe API key. Setting it enables billing; leaving it unset runs the server with no billing at all |
| `STRIPE_WEBHOOK_SECRET` | required with billing | Signing secret for `/v1/stripe/webhook` |
| `STRIPE_PRICE_ID_PRO_MONTHLY` | required with billing | Price ID for the monthly Dahoko Cloud plan |
| `STRIPE_PRICE_ID_PRO_YEARLY` | required with billing | Price ID for the yearly plan |
| `DAHOKO_BILLING_SUCCESS_URL` | required with billing | Where Stripe returns the browser after checkout |
| `DAHOKO_BILLING_CANCEL_URL` | required with billing | Where Stripe returns the browser after an abandoned checkout |
| `DAHOKO_BILLING_REQUIRED` | `true` | Whether sync uploads require an active subscription. Downloads are never gated |

The billing variables are all-or-nothing: setting `STRIPE_SECRET_KEY` without
the rest fails startup rather than half-enabling checkout. A self-hosted server
that never sets `STRIPE_SECRET_KEY` responds `404` to every billing route, and
the desktop app hides its plan card in response.

## Postgres storage (hosted)

Self-hosting keeps the zero-setup SQLite default. The hosted service sets
`DATABASE_URL` (a Neon Postgres connection string with `sslmode=require`),
which switches every table — accounts, sessions, sync blobs, billing — to
Postgres.

Schema migrations are embedded in the server
(`apps/sync-server/src/migrations.ts`, append-only) and apply three ways,
all idempotent and serialized by a Postgres advisory lock:

- **CI**: `.github/workflows/migrate-database.yml` runs
  `pnpm --filter @dahoko/sync-server migrate` on every push to `main` that
  touches migration files. It reads `DATABASE_URL` from one of two places
  (repository Settings → Secrets and variables → Actions):
  - an **Infisical machine identity** — add `INFISICAL_CLIENT_ID` and
    `INFISICAL_CLIENT_SECRET` secrets (Infisical → Access Control →
    Machine Identities, universal auth, read access to the project), and
    optionally an `INFISICAL_ENV` repository *variable* for the
    environment slug (defaults to `prod`); or
  - a plain `DATABASE_URL` secret, which takes precedence when present.
- **Server start**: a Postgres-backed server applies pending migrations
  before listening, so a deploy that outruns CI still works.
- **Manually**: `DATABASE_URL=... pnpm --filter @dahoko/sync-server migrate`.

## Website account area

`dahoko.com/account` lets a user sign in with their sync email and
password to manage their subscription (upgrade, Stripe portal) and see
what the server stores: revision and encrypted size. They can optionally
enter their encryption passphrase to view workspaces and tasks —
decryption happens entirely in the browser with the same
PBKDF2/AES-256-GCM parameters as the app, and the passphrase is never
transmitted. The build needs `VITE_DAHOKO_SYNC_URL` pointing at the sync
server, and the server's `DAHOKO_SYNC_ORIGINS` must include the site
origin (e.g. `https://dahoko.com`).

## Billing

Hosted Dahoko Cloud uses Stripe. The design deliberately avoids the "split
brain" where purchase state lives partly in Stripe and partly in the app
database:

- A Stripe customer is created and bound to the sync account *before* any
  checkout session exists, so a purchase can never arrive without a known owner.
- One function, `syncStripeDataToDb(customerId)`, is the only writer of
  subscription state. Both the post-checkout call from the app and every
  webhook funnel into it.
- Webhooks are trusted only for their signature and customer ID. Nothing else
  in the event payload is read; the subscription is always re-fetched from
  Stripe.

Only sync *uploads* are gated on an active subscription. Downloads and account
deletion keep working after a subscription lapses, so no one's data is held
behind a payment.

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/v1/billing` | Read the caller's plan state |
| `POST` | `/v1/billing/sync` | Re-fetch plan state from Stripe (post-checkout) |
| `POST` | `/v1/billing/checkout` | Create a Stripe Checkout session |
| `POST` | `/v1/billing/portal` | Create a Stripe billing portal session |
| `POST` | `/v1/stripe/webhook` | Signature-verified Stripe events |

### Test billing locally

Stripe accepts `http://localhost` return URLs in test mode, so the whole loop
runs on this machine. Use **test-mode** keys and price IDs throughout.

Set these in the development secret environment:

```text
DAHOKO_BILLING_SUCCESS_URL=http://localhost:5102/?checkout=success
DAHOKO_BILLING_CANCEL_URL=http://localhost:5102/#cloud
```

In production these become `https://dahoko.com/?checkout=success` and
`https://dahoko.com/#cloud`. The success URL is only where the browser lands;
the app refreshes its own plan state when its window regains focus, so nothing
about the purchase depends on that page loading.

Leave `DAHOKO_BILLING_REQUIRED` unset so the upload gate stays on and the
paywall is actually exercised.

Run three processes:

```bash
# 1. Forward Stripe events and print a local signing secret
pnpm stripe:listen

# 2. Sync server, with the webhook secret that `stripe listen` just printed
STRIPE_WEBHOOK_SECRET=whsec_from_stripe_listen pnpm dev:sync

# 3. Desktop app
pnpm dev:desktop
```

`stripe listen` mints its own signing secret that differs from the dashboard
endpoint secret. The forwarded events fail verification unless the server uses
the printed value, so override it locally rather than storing it as the shared
secret.

In the app, open Settings → Sync, enter `http://127.0.0.1:8787`, and create an
account. Sync reports that uploads need a plan and the Dahoko Cloud card offers
both intervals. Choose one, pay with test card `4242 4242 4242 4242` and any
future expiry, then return to the app window: the plan refreshes on focus and
sync succeeds. "Manage billing" opens the Stripe portal, where cancelling
should flip the app back to Free on the next refresh.

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
