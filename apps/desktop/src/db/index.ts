import type { Repo } from "./repo";

export type {
  Completion,
  NewTask,
  Repo,
  RepoSnapshot,
  Subtask,
  TaskPatch,
  Workspace,
  WorkspaceBundleSnapshot,
  WorkspaceSnapshot,
} from "./repo";

export function isTauri(): boolean {
  return "__TAURI_INTERNALS__" in window;
}

let repo: Repo | null = null;

export async function getRepo(): Promise<Repo> {
  if (repo) return repo;
  if (isTauri()) {
    const { SqliteRepo } = await import("./sqlite");
    repo = new SqliteRepo();
  } else {
    const { MemoryRepo } = await import("./memory");
    repo = new MemoryRepo();
  }
  await repo.init();
  return repo;
}
