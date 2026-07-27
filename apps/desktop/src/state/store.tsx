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
import { getRepo, type NewTask, type Repo, type TaskPatch } from "@/db";

interface StoreValue {
  ready: boolean;
  tasks: Task[];
  lists: List[];
  statuses: Status[];
  /** All tags currently in use, sorted */
  tags: string[];
  addTask: (input: NewTask) => Promise<void>;
  updateTask: (id: string, patch: TaskPatch) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;
  toggleComplete: (id: string) => Promise<void>;
  moveToStatus: (id: string, statusId: string) => Promise<void>;
  addList: (name: string) => Promise<void>;
  repo: () => Promise<Repo>;
}

const StoreContext = createContext<StoreValue | null>(null);

const LIST_COLORS = ["#A3D0FF", "#FFD3A3", "#7EC8A8", "#E2B25A", "#C9E3FC"];

export function StoreProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [lists, setLists] = useState<List[]>([]);
  const [statuses, setStatuses] = useState<Status[]>([]);
  const repoRef = useRef<Repo | null>(null);

  const repo = useCallback(async () => {
    if (!repoRef.current) repoRef.current = await getRepo();
    return repoRef.current;
  }, []);

  const refresh = useCallback(async () => {
    const r = await repo();
    const [nextTasks, nextLists, nextStatuses] = await Promise.all([
      r.listTasks(),
      r.listLists(),
      r.listStatuses(),
    ]);
    setTasks(nextTasks);
    setLists(nextLists);
    setStatuses(nextStatuses);
  }, [repo]);

  useEffect(() => {
    let cancelled = false;
    refresh()
      .then(() => {
        if (!cancelled) setReady(true);
      })
      .catch((error) => {
        console.error("dahoko: failed to load database", error);
      });
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  const addTask = useCallback(
    async (input: NewTask) => {
      const r = await repo();
      await r.createTask(input);
      await refresh();
    },
    [repo, refresh],
  );

  const updateTask = useCallback(
    async (id: string, patch: TaskPatch) => {
      const r = await repo();
      await r.updateTask(id, patch);
      await refresh();
    },
    [repo, refresh],
  );

  const deleteTask = useCallback(
    async (id: string) => {
      const r = await repo();
      await r.deleteTask(id);
      await refresh();
    },
    [repo, refresh],
  );

  const toggleComplete = useCallback(
    async (id: string) => {
      const task = tasks.find((t) => t.id === id);
      if (!task) return;
      const r = await repo();
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
    },
    [tasks, statuses, repo, refresh],
  );

  const moveToStatus = useCallback(
    async (id: string, statusId: string) => {
      const status = statuses.find((s) => s.id === statusId);
      const task = tasks.find((t) => t.id === id);
      if (!status || !task) return;
      const r = await repo();
      const patch: TaskPatch = { statusId };
      if (status.isDone && !task.completedAt) {
        patch.completedAt = new Date().toISOString();
      } else if (!status.isDone && task.completedAt) {
        patch.completedAt = null;
      }
      await r.updateTask(id, patch);
      await refresh();
    },
    [tasks, statuses, repo, refresh],
  );

  const addList = useCallback(
    async (name: string) => {
      const r = await repo();
      const color = LIST_COLORS[lists.length % LIST_COLORS.length];
      await r.createList(name, color);
      await refresh();
    },
    [lists.length, repo, refresh],
  );

  const tags = useMemo(() => {
    const set = new Set<string>();
    for (const task of tasks) for (const tag of task.tags) set.add(tag);
    return [...set].sort();
  }, [tasks]);

  const value = useMemo(
    () => ({
      ready,
      tasks,
      lists,
      statuses,
      tags,
      addTask,
      updateTask,
      deleteTask,
      toggleComplete,
      moveToStatus,
      addList,
      repo,
    }),
    [
      ready,
      tasks,
      lists,
      statuses,
      tags,
      addTask,
      updateTask,
      deleteTask,
      toggleComplete,
      moveToStatus,
      addList,
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
