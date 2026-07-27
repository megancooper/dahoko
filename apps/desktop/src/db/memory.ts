import type { List, Status, Task } from "@dahoko/core";
import { DEFAULT_STATUSES } from "@dahoko/core";
import type { NewTask, Repo, Subtask, TaskPatch } from "./repo";
import { newId, nowIso } from "./repo";

function isoDate(offsetDays: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * In-memory repo used when the app runs in a plain browser (UI development
 * without a Rust build). Seeds a handful of sample tasks; nothing persists.
 */
export class MemoryRepo implements Repo {
  private tasks: Task[] = [];
  private lists: List[] = [];
  private statuses: Status[] = [];
  private subtasks: Subtask[] = [];

  async init(): Promise<void> {
    this.statuses = DEFAULT_STATUSES.map((s, i) => ({
      ...s,
      id: `status-${i}`,
    }));
    this.lists = [
      { id: "list-work", name: "Work", color: "#A3D0FF", sortOrder: 0 },
      { id: "list-personal", name: "Personal", color: "#FFD3A3", sortOrder: 1 },
    ];
    const mk = (
      title: string,
      overrides: Partial<Task>,
    ): Task => ({
      id: newId(),
      title,
      notes: "",
      dueAt: null,
      hasDueTime: false,
      priority: 0,
      listId: null,
      statusId: "status-0",
      tags: [],
      completedAt: null,
      sortOrder: this.tasks.length + 1,
      createdAt: nowIso(),
      updatedAt: nowIso(),
      ...overrides,
    });
    this.tasks = [
      mk("Renew car insurance", {
        dueAt: isoDate(-2),
        priority: 3,
        tags: ["errand"],
      }),
      mk("Ship v0.1 landing page copy", {
        dueAt: isoDate(0),
        priority: 3,
        listId: "list-work",
        statusId: "status-1",
        tags: ["work"],
      }),
      mk("Review Tauri SQLite migration plan", {
        dueAt: isoDate(0),
        priority: 2,
        listId: "list-work",
        statusId: "status-1",
        tags: ["work"],
      }),
      mk("Water the plants", {
        dueAt: isoDate(0),
        listId: "list-personal",
        tags: ["home"],
      }),
      mk("Draft README for dahoko repo", {
        dueAt: isoDate(2),
        listId: "list-work",
        tags: ["work"],
      }),
      mk("Set up pnpm workspace", {
        statusId: "status-2",
        completedAt: nowIso(),
      }),
    ];
  }

  async listTasks(): Promise<Task[]> {
    return this.tasks.map((t) => ({ ...t, tags: [...t.tags] }));
  }

  async createTask(input: NewTask): Promise<Task> {
    const task: Task = {
      id: newId(),
      title: input.title,
      notes: input.notes ?? "",
      dueAt: input.dueAt ?? null,
      hasDueTime: input.hasDueTime ?? false,
      priority: input.priority ?? 0,
      listId: input.listId ?? null,
      statusId: input.statusId ?? this.statuses[0].id,
      tags: input.tags ?? [],
      completedAt: null,
      sortOrder: Math.max(0, ...this.tasks.map((t) => t.sortOrder)) + 1,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    this.tasks.push(task);
    return { ...task };
  }

  async updateTask(id: string, patch: TaskPatch): Promise<void> {
    const task = this.tasks.find((t) => t.id === id);
    if (!task) return;
    Object.assign(task, patch, { updatedAt: nowIso() });
  }

  async deleteTask(id: string): Promise<void> {
    this.tasks = this.tasks.filter((t) => t.id !== id);
    this.subtasks = this.subtasks.filter((s) => s.taskId !== id);
  }

  async listLists(): Promise<List[]> {
    return [...this.lists];
  }

  async createList(name: string, color: string): Promise<List> {
    const list: List = {
      id: newId(),
      name,
      color,
      sortOrder: this.lists.length,
    };
    this.lists.push(list);
    return { ...list };
  }

  async listStatuses(): Promise<Status[]> {
    return [...this.statuses];
  }

  async listSubtasks(taskId: string): Promise<Subtask[]> {
    return this.subtasks.filter((s) => s.taskId === taskId);
  }

  async createSubtask(taskId: string, title: string): Promise<Subtask> {
    const subtask: Subtask = {
      id: newId(),
      taskId,
      title,
      done: false,
      sortOrder: this.subtasks.filter((s) => s.taskId === taskId).length + 1,
    };
    this.subtasks.push(subtask);
    return { ...subtask };
  }

  async updateSubtask(
    id: string,
    patch: { title?: string; done?: boolean },
  ): Promise<void> {
    const subtask = this.subtasks.find((s) => s.id === id);
    if (subtask) Object.assign(subtask, patch);
  }

  async deleteSubtask(id: string): Promise<void> {
    this.subtasks = this.subtasks.filter((s) => s.id !== id);
  }
}
