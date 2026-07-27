import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { List, Status, Task } from "@dahoko/core";
import { nextOccurrence } from "@dahoko/core";
import {
  getRepo,
  type Completion,
  type NewTask,
  type Repo,
  type Subtask,
  type TaskPatch,
  type Workspace,
  type WorkspaceBundleSnapshot,
} from "@/db";
import {
  createBackup,
  type DahokoBackup,
} from "@/db/backup";
import { createCoalescedRunner } from "./coalesced-runner";

interface StoreValue {
  ready: boolean;
  workspaces: Workspace[];
  activeWorkspace: Workspace | null;
  tasks: Task[];
  lists: List[];
  statuses: Status[];
  /** All subtasks across tasks; filter by taskId */
  subtasks: Subtask[];
  /** Completion history of recurring tasks */
  completions: Completion[];
  /** All tags currently in use, sorted */
  tags: string[];
  switchWorkspace: (id: string) => Promise<void>;
  addWorkspace: (name: string) => Promise<void>;
  addTask: (input: NewTask) => Promise<void>;
  updateTask: (id: string, patch: TaskPatch) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;
  toggleComplete: (id: string) => Promise<void>;
  moveToStatus: (id: string, statusId: string) => Promise<void>;
  addList: (name: string) => Promise<void>;
  updateList: (
    id: string,
    patch: { name?: string; color?: string },
  ) => Promise<void>;
  deleteList: (id: string) => Promise<void>;
  addSubtask: (taskId: string, title: string) => Promise<void>;
  updateSubtask: (
    id: string,
    patch: { title?: string; done?: boolean },
  ) => Promise<void>;
  deleteSubtask: (id: string) => Promise<void>;
  createDataBackup: () => DahokoBackup;
  restoreDataBackup: (backup: DahokoBackup) => Promise<void>;
  captureDataForSync: () => Promise<{
    snapshot: WorkspaceBundleSnapshot;
    version: number;
  }>;
  applySyncedDataIfUnchanged: (
    snapshot: WorkspaceBundleSnapshot,
    expectedVersion: number,
    replaceData: boolean,
  ) => Promise<boolean>;
  repo: () => Promise<Repo>;
}

const StoreContext = createContext<StoreValue | null>(null);

export const LIST_COLORS = [
  "#A3D0FF", // blue
  "#FFD3A3", // peach
  "#7EC8A8", // green
  "#E2B25A", // gold
  "#C9E3FC", // sky
  "#F2B8C6", // pink
  "#C7B9F2", // lavender
  "#F2A0A0", // coral
  "#8FD8D2", // teal
  "#B0B8C4", // slate
];

export const WORKSPACE_COLORS = [
  "#A3D0FF",
  "#FFD3A3",
  "#7EC8A8",
  "#C7B9F2",
  "#F2B8C6",
  "#8FD8D2",
] as const;

const ACTIVE_WORKSPACE_KEY = "dahoko.active-workspace";

export function StoreProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [activeWorkspace, setActiveWorkspace] = useState<Workspace | null>(
    null,
  );
  const [tasks, setTasks] = useState<Task[]>([]);
  const [lists, setLists] = useState<List[]>([]);
  const [statuses, setStatuses] = useState<Status[]>([]);
  const [subtasks, setSubtasks] = useState<Subtask[]>([]);
  const [completions, setCompletions] = useState<Completion[]>([]);
  const repoRef = useRef<Repo | null>(null);
  const dataVersionRef = useRef(0);
  const writeQueueRef = useRef<Promise<void>>(Promise.resolve());

  const repo = useCallback(async () => {
    if (!repoRef.current) repoRef.current = await getRepo();
    return repoRef.current;
  }, []);

  const loadSnapshot = useCallback(async () => {
    const r = await repo();
    const [
      nextWorkspaces,
      nextTasks,
      nextLists,
      nextStatuses,
      nextSubtasks,
      nextCompletions,
    ] = await Promise.all([
      r.listWorkspaces(),
      r.listTasks(),
      r.listLists(),
      r.listStatuses(),
      r.listAllSubtasks(),
      r.listCompletions(),
    ]);
    const nextActiveWorkspace =
      nextWorkspaces.find(
        (workspace) => workspace.id === r.getActiveWorkspaceId(),
      ) ?? nextWorkspaces[0] ?? null;
    setWorkspaces(nextWorkspaces);
    setActiveWorkspace(nextActiveWorkspace);
    setTasks(nextTasks);
    setLists(nextLists);
    setStatuses(nextStatuses);
    setSubtasks(nextSubtasks);
    setCompletions(nextCompletions);
  }, [repo]);
  const loadSnapshotRef = useRef(loadSnapshot);
  loadSnapshotRef.current = loadSnapshot;
  const refreshRunnerRef = useRef<(() => Promise<void>) | null>(null);
  if (!refreshRunnerRef.current) {
    refreshRunnerRef.current = createCoalescedRunner(() =>
      loadSnapshotRef.current(),
    );
  }
  const refresh = useCallback(() => refreshRunnerRef.current!(), []);
  const enqueueOperation = useCallback(
    <T,>(operation: () => Promise<T>): Promise<T> => {
      const scheduled = writeQueueRef.current.then(operation, operation);
      writeQueueRef.current = scheduled.then(
        () => undefined,
        () => undefined,
      );
      return scheduled;
    },
    [],
  );
  const enqueueLocalMutation = useCallback(
    <T,>(operation: () => Promise<T>): Promise<T> => {
      dataVersionRef.current += 1;
      return enqueueOperation(operation);
    },
    [enqueueOperation],
  );

  useEffect(() => {
    let cancelled = false;
    enqueueOperation(async () => {
      const r = await repo();
      const available = await r.listWorkspaces();
      let savedWorkspaceId: string | null = null;
      try {
        savedWorkspaceId = window.localStorage.getItem(ACTIVE_WORKSPACE_KEY);
      } catch {
        // The first workspace remains the safe local fallback.
      }
      if (
        savedWorkspaceId &&
        available.some((workspace) => workspace.id === savedWorkspaceId)
      ) {
        await r.setActiveWorkspace(savedWorkspaceId);
      }
      await refresh();
    })
      .then(() => {
        if (!cancelled) setReady(true);
      })
      .catch((error) => {
        console.error("dahoko: failed to load database", error);
      });
    return () => {
      cancelled = true;
    };
  }, [enqueueOperation, repo, refresh]);

  const persistActiveWorkspace = useCallback((id: string) => {
    try {
      window.localStorage.setItem(ACTIVE_WORKSPACE_KEY, id);
    } catch {
      // Workspace switching still works for this session.
    }
  }, []);

  const switchWorkspace = useCallback(
    (id: string) =>
      enqueueOperation(async () => {
        const r = await repo();
        if (r.getActiveWorkspaceId() === id) return;
        await r.setActiveWorkspace(id);
        persistActiveWorkspace(id);
        await refresh();
      }),
    [enqueueOperation, persistActiveWorkspace, repo, refresh],
  );

  const addWorkspace = useCallback(
    (name: string) =>
      enqueueLocalMutation(async () => {
        const r = await repo();
        const workspace = await r.createWorkspace(
          name,
          WORKSPACE_COLORS[workspaces.length % WORKSPACE_COLORS.length],
        );
        await r.setActiveWorkspace(workspace.id);
        persistActiveWorkspace(workspace.id);
        await refresh();
      }),
    [
      enqueueLocalMutation,
      persistActiveWorkspace,
      repo,
      refresh,
      workspaces.length,
    ],
  );

  const addTask = useCallback(
    (input: NewTask) =>
      enqueueLocalMutation(async () => {
        const r = await repo();
        await r.createTask(input);
        await refresh();
      }),
    [enqueueLocalMutation, repo, refresh],
  );

  const updateTask = useCallback(
    (id: string, patch: TaskPatch) =>
      enqueueLocalMutation(async () => {
        const r = await repo();
        await r.updateTask(id, patch);
        await refresh();
      }),
    [enqueueLocalMutation, repo, refresh],
  );

  const deleteTask = useCallback(
    (id: string) =>
      enqueueLocalMutation(async () => {
        const r = await repo();
        await r.deleteTask(id);
        await refresh();
      }),
    [enqueueLocalMutation, repo, refresh],
  );

  const toggleComplete = useCallback(
    (id: string) => {
      const task = tasks.find((t) => t.id === id);
      if (!task) return Promise.resolve();
      return enqueueLocalMutation(async () => {
        const r = await repo();
        if (task.recurrence && !task.completedAt) {
          // Recurring: log this occurrence and roll the due date forward
          // instead of closing the task.
          const today = new Date();
          const todayIso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
          const dueDate = task.dueAt ? task.dueAt.slice(0, 10) : todayIso;
          await r.addCompletion(task.id, dueDate);
          const nextDate = nextOccurrence(dueDate, task.recurrence);
          const dueAt =
            task.dueAt && task.dueAt.length > 10
              ? `${nextDate}${task.dueAt.slice(10)}`
              : nextDate;
          await r.updateTask(id, { dueAt });
          await refresh();
          return;
        }
        if (task.completedAt) {
          const firstOpen = statuses.find((s) => !s.isDone);
          await r.updateTask(id, {
            completedAt: null,
            statusId: firstOpen?.id ?? task.statusId,
          });
        } else {
          const done = statuses.find((s) => s.isDone);
          await r.updateTask(id, {
            completedAt: new Date().toISOString(),
            statusId: done?.id ?? task.statusId,
          });
        }
        await refresh();
      });
    },
    [tasks, statuses, enqueueLocalMutation, repo, refresh],
  );

  const moveToStatus = useCallback(
    (id: string, statusId: string) => {
      const status = statuses.find((s) => s.id === statusId);
      const task = tasks.find((t) => t.id === id);
      if (!status || !task || task.statusId === statusId) {
        return Promise.resolve();
      }
      const patch: TaskPatch = { statusId };
      if (status.isDone && !task.completedAt) {
        patch.completedAt = new Date().toISOString();
      } else if (!status.isDone && task.completedAt) {
        patch.completedAt = null;
      }
      // Move first in memory so the card lands immediately. The database
      // refresh confirms the result; failures revert to persisted state.
      setTasks((current) =>
        current.map((candidate) =>
          candidate.id === id
            ? {
                ...candidate,
                ...patch,
                updatedAt: new Date().toISOString(),
              }
            : candidate,
        ),
      );
      return enqueueLocalMutation(async () => {
        const r = await repo();
        try {
          await r.updateTask(id, patch);
          await refresh();
        } catch (error) {
          await refresh();
          throw error;
        }
      });
    },
    [tasks, statuses, enqueueLocalMutation, repo, refresh],
  );

  const addList = useCallback(
    (name: string) =>
      enqueueLocalMutation(async () => {
        const r = await repo();
        const color = LIST_COLORS[lists.length % LIST_COLORS.length];
        await r.createList(name, color);
        await refresh();
      }),
    [lists.length, enqueueLocalMutation, repo, refresh],
  );

  const updateList = useCallback(
    (id: string, patch: { name?: string; color?: string }) =>
      enqueueLocalMutation(async () => {
        const r = await repo();
        await r.updateList(id, patch);
        await refresh();
      }),
    [enqueueLocalMutation, repo, refresh],
  );

  const deleteList = useCallback(
    (id: string) =>
      enqueueLocalMutation(async () => {
        const r = await repo();
        await r.deleteList(id);
        await refresh();
      }),
    [enqueueLocalMutation, repo, refresh],
  );

  const addSubtask = useCallback(
    (taskId: string, title: string) =>
      enqueueLocalMutation(async () => {
        const r = await repo();
        await r.createSubtask(taskId, title);
        await refresh();
      }),
    [enqueueLocalMutation, repo, refresh],
  );

  const updateSubtask = useCallback(
    (id: string, patch: { title?: string; done?: boolean }) =>
      enqueueLocalMutation(async () => {
        const r = await repo();
        await r.updateSubtask(id, patch);
        await refresh();
      }),
    [enqueueLocalMutation, repo, refresh],
  );

  const deleteSubtask = useCallback(
    (id: string) =>
      enqueueLocalMutation(async () => {
        const r = await repo();
        await r.deleteSubtask(id);
        await refresh();
      }),
    [enqueueLocalMutation, repo, refresh],
  );

  const tags = useMemo(() => {
    const set = new Set<string>();
    for (const task of tasks) for (const tag of task.tags) set.add(tag);
    return [...set].sort();
  }, [tasks]);

  const createDataBackup = useCallback(
    () =>
      createBackup({
        tasks,
        lists,
        statuses,
        subtasks,
        completions,
      }),
    [tasks, lists, statuses, subtasks, completions],
  );

  const restoreDataBackup = useCallback(
    (backup: DahokoBackup) =>
      enqueueLocalMutation(async () => {
        const r = await repo();
        await r.replaceData(backup.data);
        await refresh();
      }),
    [enqueueLocalMutation, repo, refresh],
  );

  const captureDataForSync = useCallback(
    () =>
      enqueueOperation(async () => {
        const version = dataVersionRef.current;
        const r = await repo();
        return {
          snapshot: await r.exportWorkspaceBundle(),
          version,
        };
      }),
    [enqueueOperation, repo],
  );

  const applySyncedDataIfUnchanged = useCallback(
    (
      snapshot: WorkspaceBundleSnapshot,
      expectedVersion: number,
      replaceData: boolean,
    ) =>
      enqueueOperation(async () => {
        const r = await repo();
        if (dataVersionRef.current !== expectedVersion) return false;
        if (replaceData) {
          await r.replaceWorkspaceBundle(snapshot);
          persistActiveWorkspace(r.getActiveWorkspaceId());
          await refresh();
        }
        return true;
      }),
    [enqueueOperation, persistActiveWorkspace, repo, refresh],
  );

  const value = useMemo(
    () => ({
      ready,
      workspaces,
      activeWorkspace,
      tasks,
      lists,
      statuses,
      subtasks,
      completions,
      tags,
      switchWorkspace,
      addWorkspace,
      addTask,
      updateTask,
      deleteTask,
      toggleComplete,
      moveToStatus,
      addList,
      updateList,
      deleteList,
      addSubtask,
      updateSubtask,
      deleteSubtask,
      createDataBackup,
      restoreDataBackup,
      captureDataForSync,
      applySyncedDataIfUnchanged,
      repo,
    }),
    [
      ready,
      workspaces,
      activeWorkspace,
      tasks,
      lists,
      statuses,
      subtasks,
      completions,
      tags,
      switchWorkspace,
      addWorkspace,
      addTask,
      updateTask,
      deleteTask,
      toggleComplete,
      moveToStatus,
      addList,
      updateList,
      deleteList,
      addSubtask,
      updateSubtask,
      deleteSubtask,
      createDataBackup,
      restoreDataBackup,
      captureDataForSync,
      applySyncedDataIfUnchanged,
      repo,
    ],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreValue {
  const value = useContext(StoreContext);
  if (!value) throw new Error("useStore must be used within StoreProvider");
  return value;
}
