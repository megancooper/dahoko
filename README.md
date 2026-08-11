# dahoko

An open-source task manager (a TickTick alternative), built with Tauri v2, React 19, and SQLite.

## Layout

| Path | What it is |
| --- | --- |
| `apps/desktop` | The Tauri v2 desktop app (React 19 + Vite + TanStack Router, SQLite via `tauri-plugin-sql`) |
| `apps/android` | Native Android app (Kotlin + Jetpack Compose + Room) with the same encrypted sync protocol |
| `apps/sync-server` | Optional privacy-focused encrypted sync server (Node + SQLite) |
| `apps/www` | Landing page (Vite + React) |
| `packages/ui` | Shared component library (Radix + Tailwind) |
| `packages/core` | Task domain types, quick-add parser, grouping/view logic |
| `packages/typescript-config` | Shared tsconfig bases |

## Development

Requires Node ≥ 22, pnpm 8, and Rust ≥ 1.77 (for the desktop app).

```bash
pnpm install

# Desktop app (opens a native window; frontend also served on :5103)
pnpm tauri dev

# Landing page on :5102
pnpm dev:www

# Optional encrypted sync server on 127.0.0.1:8787
pnpm --filter @dahoko/sync-server build
DAHOKO_ACCOUNT_HASH_KEY="$(openssl rand -hex 32)" \
  pnpm --filter @dahoko/sync-server start
```

The desktop frontend also runs in a plain browser (`pnpm --filter @dahoko/desktop dev`)
with an in-memory database — handy for UI work without a Rust build.

## Encrypted device sync

Sync is optional and remains offline-first. Workspace and task data is
encrypted in the desktop app with a separate passphrase before it is uploaded.
The server stores an opaque authenticated-encryption blob and cannot read
workspace names, task titles, notes, lists, tags, dates, subtasks, or
completion history.

The same MIT-licensed server can be self-hosted with Docker, deployed to a
container host, or used for a hosted Dahoko service. Official desktop builds
can prefill the hosted endpoint with the `DAHOKO_SYNC_URL` GitHub repository
variable; users can always enter another HTTPS server in Settings.

See [docs/sync.md](docs/sync.md) for the threat model, deployment instructions,
backups, API, and cryptographic design.

## Desktop updates

Signed desktop releases check
`https://github.com/megancooper/dahoko/releases/latest/download/latest.json` on
startup. Users can also check manually and install the update from Settings;
the app shows download progress and relaunches after installation.

Tauri requires every updater artifact to be signed. Generate the updater key
pair once and keep the private key somewhere durable and private:

```bash
pnpm tauri signer generate -w ~/.tauri/dahoko.key
```

Add these GitHub Actions secrets before publishing:

- `TAURI_SIGNING_PRIVATE_KEY` — the private key contents
- `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` — its password, if one was set
- `TAURI_UPDATER_PUBKEY` — the contents of `~/.tauri/dahoko.key.pub`

Releases are generated from Conventional Commit messages pushed to `main`.
The release controller verifies the workspace, determines the next semantic
version, synchronizes the package/Tauri/Cargo versions, creates an `app-v*`
tag and GitHub release notes, then calls the signed desktop build for macOS
(Apple silicon and Intel), Windows, and Linux.

| Commit | Release |
| --- | --- |
| `fix:`, `perf:`, `chore:`, `ci:`, `docs:`, `refactor:`, `test:`, `build:`, `style:`, `revert:` | Patch |
| `feat:` | Minor |
| `type!:` or a `BREAKING CHANGE:` / `BREAKING:` footer | Major |

The desktop workflow can also be run manually with an exact existing SemVer
for release recovery. It validates and applies that version before packaging,
so artifacts, the app badge, the tag, and `latest.json` stay aligned. To use
another update service, change the updater endpoint in
`apps/desktop/src-tauri/tauri.conf.json`.

## Views

Tasks live in one SQLite database and can be viewed as:

- **List** — grouped by due date (Overdue / Today / Upcoming / Someday)
- **Swimlanes** — user-defined status columns, drag to move
- **By tag** — grouped by tag, list, or priority

## Workspaces

The sidebar workspace switcher keeps Personal, Work, or project-specific task
sets isolated inside the same local database. Creating a workspace seeds its
own workflow statuses, switching is remembered on the device, and encrypted
sync carries every workspace to connected devices without exposing workspace
names to the server.

## License

MIT
