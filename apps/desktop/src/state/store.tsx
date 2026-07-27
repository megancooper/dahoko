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
} from "@/db";

interface StoreValue {
  ready: boolean;
  tasks: Task[];
  lists: List[];
  statuses: Status[];
  /** All subtasks across tasks; filter by taskId */
  subtasks: Subtask[];
  /** Completion history of recurring tasks */
  completions: Completion[];
  /** All tags currently in use, sorted */
  tags: string[];
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

export function StoreProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [lists, setLists] = useState<List[]>([]);
  const [statuses, setStatuses] = useState<Status[]>([]);
  const [subtasks, setSubtasks] = useState<Subtask[]>([]);
  const [completions, setCompletions] = useState<Completion[]>([]);
  const repoRef = useRef<Repo | null>(null);

  const repo = useCallback(async () => {
    if (!repoRef.current) repoRef.current = await getRepo();
    return repoRef.current;
  }, []);

  const refresh = useCallback(async () => {
    const r = await repo();
    const [nextTasks, nextLists, nextStatuses, nextSubtasks, nextCompletions] =
      await Promise.all([
        r.listTasks(),
        r.listLists(),
        r.listStatuses(),
        r.listAllSubtasks(),
        r.listCompletions(),
      ]);
    setTasks(nextTasks);
    setLists(nextLists);
    setStatuses(nextStatuses);
    setSubtasks(nextSubtasks);
    setCompletions(nextCompletions);
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

  const updateList = useCallback(
    async (id: string, patch: { name?: string; color?: string }) => {
      const r = await repo();
      await r.updateList(id, patch);
      await refresh();
    },
    [repo, refresh],
  );

  const deleteList = useCallback(
    async (id: string) => {
      const r = await repo();
      await r.deleteList(id);
      await refresh();
    },
    [repo, refresh],
  );

  const addSubtask = useCallback(
    async (taskId: string, title: string) => {
      const r = await repo();
      await r.createSubtask(taskId, title);
      await refresh();
    },
    [repo, refresh],
  );

  const updateSubtask = useCallback(
    async (id: string, patch: { title?: string; done?: boolean }) => {
      const r = await repo();
      await r.updateSubtask(id, patch);
      await refresh();
    },
    [repo, refresh],
  );

  const deleteSubtask = useCallback(
    async (id: string) => {
      const r = await repo();
      await r.deleteSubtask(id);
      await refresh();
    },
    [repo, refresh],
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
      subtasks,
      completions,
      tags,
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
      repo,
    }),
    [
      ready,
      tasks,
      lists,
      statuses,
      subtasks,
      completions,
      tags,
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
