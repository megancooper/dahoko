# dahoko

An open-source task manager (a TickTick alternative), built with Tauri v2, React 19, and SQLite.

## Layout

| Path | What it is |
| --- | --- |
| `apps/desktop` | The Tauri v2 desktop app (React 19 + Vite + TanStack Router, SQLite via `tauri-plugin-sql`) |
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
```

The desktop frontend also runs in a plain browser (`pnpm --filter @dahoko/desktop dev`)
with an in-memory database — handy for UI work without a Rust build.

## Views

Tasks live in one SQLite database and can be viewed as:

- **List** — grouped by due date (Overdue / Today / Upcoming / Someday)
- **Swimlanes** — user-defined status columns, drag to move
- **By tag** — grouped by tag, list, or priority

## License

MIT
