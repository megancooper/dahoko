import type { List, Status, Task } from "@dahoko/core";
import { DEFAULT_STATUSES } from "@dahoko/core";
import type { Completion, NewTask, Repo, Subtask, TaskPatch } from "./repo";
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
  private completions: Completion[] = [];

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
      recurrence: null,
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
      mk("File expense report", {
        dueAt: isoDate(-4),
        priority: 2,
        listId: "list-work",
        tags: ["work"],
      }),
      mk("Reply to accountant", {
        dueAt: isoDate(-10),
        priority: 1,
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
      mk("Morning run", {
        dueAt: isoDate(0),
        recurrence: "daily",
        listId: "list-personal",
        tags: ["home"],
        createdAt: `${isoDate(-45)}T08:00:00.000Z`,
      }),
      mk("Review inbox", {
        dueAt: isoDate(0),
        recurrence: "weekdays",
        listId: "list-work",
        tags: ["work"],
        createdAt: `${isoDate(-21)}T08:00:00.000Z`,
      }),
      mk("Water the plants", {
        dueAt: isoDate(0),
        recurrence: "weekly",
        listId: "list-personal",
        tags: ["home"],
        createdAt: `${isoDate(-56)}T08:00:00.000Z`,
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
    this.seedCompletions();
    const shipTask = this.tasks.find((t) =>
      t.title.startsWith("Ship v0.1"),
    )!;
    this.subtasks = [
      {
        id: newId(),
        taskId: shipTask.id,
        title: "Draft hero copy",
        done: true,
        sortOrder: 1,
      },
      {
        id: newId(),
        taskId: shipTask.id,
        title: "Review with Sam",
        done: false,
        sortOrder: 2,
      },
    ];
  }

  /** Deterministic completion history so the metrics view has data in dev. */
  private seedCompletions() {
    const byTitle = (title: string) =>
      this.tasks.find((t) => t.title === title)!;
    const add = (taskId: string, dueDate: string, completedDate: string) => {
      this.completions.push({
        id: newId(),
        taskId,
        dueDate,
        completedAt: `${completedDate}T07:30:00.000Z`,
      });
    };

    const run = byTitle("Morning run");
    for (let i = 1; i <= 45; i += 1) {
      if (i % 5 === 0) continue; // missed every fifth day
      const due = isoDate(-i);
      const done = i % 7 === 0 ? isoDate(-i + 1) : due; // occasionally a day late
      add(run.id, due, done);
    }

    const inbox = byTitle("Review inbox");
    for (let i = 1; i <= 21; i += 1) {
      const due = isoDate(-i);
      const dow = new Date(`${due}T00:00:00`).getDay();
      if (dow === 0 || dow === 6) continue;
      if (i % 9 === 0) continue; // a couple of misses
      add(inbox.id, due, due);
    }

    const plants = byTitle("Water the plants");
    for (let w = 1; w <= 8; w += 1) {
      if (w === 3) continue;
      const due = isoDate(-7 * w);
      add(plants.id, due, w % 4 === 0 ? isoDate(-7 * w + 1) : due);
    }
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
      recurrence: input.recurrence ?? null,
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

  async updateList(
    id: string,
    patch: { name?: string; color?: string },
  ): Promise<void> {
    const list = this.lists.find((l) => l.id === id);
    if (list) Object.assign(list, patch);
  }

  async deleteList(id: string): Promise<void> {
    this.lists = this.lists.filter((l) => l.id !== id);
    for (const task of this.tasks) {
      if (task.listId === id) task.listId = null;
    }
  }

  async listStatuses(): Promise<Status[]> {
    return [...this.statuses];
  }

  async listSubtasks(taskId: string): Promise<Subtask[]> {
    return this.subtasks.filter((s) => s.taskId === taskId);
  }

  async listAllSubtasks(): Promise<Subtask[]> {
    return [...this.subtasks];
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

  async listCompletions(): Promise<Completion[]> {
    return [...this.completions];
  }

  async addCompletion(taskId: string, dueDate: string): Promise<Completion> {
    const completion: Completion = {
      id: newId(),
      taskId,
      dueDate,
      completedAt: nowIso(),
    };
    this.completions.push(completion);
    return { ...completion };
  }
}
