# Dahoko for Android

Native Android app: Kotlin, Jetpack Compose (Material 3), Room, and a
wire-compatible port of the desktop app's end-to-end encrypted sync client.

## Features

- Today / Upcoming / All views, lists, custom statuses, tags, priorities
- Quick-add with the desktop's natural-language syntax
  (`Pay rent tomorrow 9:00 #home !high every month`)
- Recurring tasks with per-occurrence completion history
- Subtasks, multiple workspaces (populated via sync)
- Optional encrypted sync against the same `@dahoko/sync-server`:
  PBKDF2-HMAC-SHA-256 (600k iterations) + AES-256-GCM, LWW merge on a
  hybrid logical clock, compare-and-swap revisions. The account password
  and encryption passphrase are held in memory only, like the desktop app.

## Build & run

Requires JDK 17+ and the Android SDK (compileSdk 35). Put the SDK path in
`local.properties` (`sdk.dir=...`), then:

```bash
./gradlew assembleDebug
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

For sync against a locally running sync-server, the emulator reaches the
host machine at `http://10.0.2.2:<port>` (plain HTTP is allowed only for
loopback-style development hosts; everything else requires HTTPS).

## Wire-format invariants

The sync document JSON is shared with the desktop app (`apps/desktop/src/sync`).
Keep these in lockstep when changing either side:

- Every entity field is present in JSON; nullable fields serialize as `null`
  (the `Json { encodeDefaults = true }` setting is load-bearing — the desktop
  parser rejects documents with missing `format`/`version`/collection maps).
- AES-GCM additional authenticated data is `"<iterations>\u0000<saltBase64>"`.
- Completion dedup keys and account keys use `\u0000` separators.
