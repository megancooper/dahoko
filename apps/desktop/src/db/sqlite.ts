import Database from "@tauri-apps/plugin-sql";
import { invoke } from "@tauri-apps/api/core";
import type { List, Priority, Recurrence, Status, Task } from "@dahoko/core";
import type {
  Completion,
  NewTask,
  Repo,
  RepoSnapshot,
  Subtask,
  TaskPatch,
} from "./repo";
import { newId, nowIso } from "./repo";

interface TaskRow {
  id: string;
  title: string;
  notes: string;
  due_at: string | null;
  has_due_time: number;
  priority: number;
  list_id: string | null;
  status_id: string;
  recurrence: string | null;
  completed_at: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

/**
 * SQLite-backed repo. Schema is created by the Rust-side migrations in
 * src-tauri/migrations; this class only reads and writes.
 */
export class SqliteRepo implements Repo {
  private db!: Database;

  async init(): Promise<void> {
    this.db = await Database.load("sqlite:dahoko.db");
  }

  async listTasks(): Promise<Task[]> {
    const rows = await this.db.select<TaskRow[]>(
      "SELECT * FROM tasks ORDER BY sort_order",
    );
    const tagRows = await this.db.select<{ task_id: string; tag: string }[]>(
      "SELECT task_id, tag FROM task_tags ORDER BY tag",
    );
    const tagsByTask = new Map<string, string[]>();
    for (const { task_id, tag } of tagRows) {
      const list = tagsByTask.get(task_id) ?? [];
      list.push(tag);
      tagsByTask.set(task_id, list);
    }
    return rows.map((r) => ({
      id: r.id,
      title: r.title,
      notes: r.notes,
      dueAt: r.due_at,
      hasDueTime: r.has_due_time === 1,
      priority: r.priority as Priority,
      listId: r.list_id,
      statusId: r.status_id,
      tags: tagsByTask.get(r.id) ?? [],
      recurrence: (r.recurrence as Recurrence | null) ?? null,
      completedAt: r.completed_at,
      sortOrder: r.sort_order,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }));
  }

  async createTask(input: NewTask): Promise<Task> {
    const id = newId();
    const now = nowIso();
    const statusId =
      input.statusId ??
      (
        await this.db.select<{ id: string }[]>(
          "SELECT id FROM statuses WHERE is_done = 0 ORDER BY sort_order LIMIT 1",
        )
      )[0].id;
    const maxRow = await this.db.select<{ m: number | null }[]>(
      "SELECT MAX(sort_order) as m FROM tasks",
    );
    const sortOrder = (maxRow[0]?.m ?? 0) + 1;
    await this.db.execute(
      `INSERT INTO tasks (id, title, notes, due_at, has_due_time, priority, list_id, status_id, recurrence, completed_at, sort_order, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NULL, $10, $11, $11)`,
      [
        id,
        input.title,
        input.notes ?? "",
        input.dueAt ?? null,
        input.hasDueTime ? 1 : 0,
        input.priority ?? 0,
        input.listId ?? null,
        statusId,
        input.recurrence ?? null,
        sortOrder,
        now,
      ],
    );
    for (const tag of input.tags ?? []) {
      await this.db.execute(
        "INSERT OR IGNORE INTO task_tags (task_id, tag) VALUES ($1, $2)",
        [id, tag],
      );
    }
    return {
      id,
      title: input.title,
      notes: input.notes ?? "",
      dueAt: input.dueAt ?? null,
      hasDueTime: input.hasDueTime ?? false,
      priority: input.priority ?? 0,
      listId: input.listId ?? null,
      statusId,
      tags: input.tags ?? [],
      recurrence: input.recurrence ?? null,
      completedAt: null,
      sortOrder,
      createdAt: now,
      updatedAt: now,
    };
  }

  async updateTask(id: string, patch: TaskPatch): Promise<void> {
    const sets: string[] = [];
    const args: unknown[] = [];
    let i = 1;
    const push = (col: string, value: unknown) => {
      sets.push(`${col} = $${i}`);
      args.push(value);
      i += 1;
    };
    if (patch.title !== undefined) push("title", patch.title);
    if (patch.notes !== undefined) push("notes", patch.notes);
    if (patch.dueAt !== undefined) push("due_at", patch.dueAt);
    if (patch.hasDueTime !== undefined)
      push("has_due_time", patch.hasDueTime ? 1 : 0);
    if (patch.priority !== undefined) push("priority", patch.priority);
    if (patch.listId !== undefined) push("list_id", patch.listId);
    if (patch.statusId !== undefined) push("status_id", patch.statusId);
    if (patch.recurrence !== undefined) push("recurrence", patch.recurrence);
    if (patch.completedAt !== undefined) push("completed_at", patch.completedAt);
    if (patch.sortOrder !== undefined) push("sort_order", patch.sortOrder);
    push("updated_at", nowIso());
    args.push(id);
    await this.db.execute(
      `UPDATE tasks SET ${sets.join(", ")} WHERE id = $${i}`,
      args,
    );
    if (patch.tags !== undefined) {
      await this.db.execute("DELETE FROM task_tags WHERE task_id = $1", [id]);
      for (const tag of patch.tags) {
        await this.db.execute(
          "INSERT OR IGNORE INTO task_tags (task_id, tag) VALUES ($1, $2)",
          [id, tag],
        );
      }
    }
  }

  async deleteTask(id: string): Promise<void> {
    await this.db.execute("DELETE FROM subtasks WHERE task_id = $1", [id]);
    await this.db.execute("DELETE FROM task_tags WHERE task_id = $1", [id]);
    await this.db.execute("DELETE FROM tasks WHERE id = $1", [id]);
  }

  async listLists(): Promise<List[]> {
    const rows = await this.db.select<
      { id: string; name: string; color: string; sort_order: number }[]
    >("SELECT * FROM lists ORDER BY sort_order");
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      color: r.color,
      sortOrder: r.sort_order,
    }));
  }

  async createList(name: string, color: string): Promise<List> {
    const id = newId();
    const maxRow = await this.db.select<{ m: number | null }[]>(
      "SELECT MAX(sort_order) as m FROM lists",
    );
    const sortOrder = (maxRow[0]?.m ?? 0) + 1;
    await this.db.execute(
      "INSERT INTO lists (id, name, color, sort_order) VALUES ($1, $2, $3, $4)",
      [id, name, color, sortOrder],
    );
    return { id, name, color, sortOrder };
  }

  async updateList(
    id: string,
    patch: { name?: string; color?: string },
  ): Promise<void> {
    if (patch.name !== undefined) {
      await this.db.execute("UPDATE lists SET name = $1 WHERE id = $2", [
        patch.name,
        id,
      ]);
    }
    if (patch.color !== undefined) {
      await this.db.execute("UPDATE lists SET color = $1 WHERE id = $2", [
        patch.color,
        id,
      ]);
    }
  }

  async deleteList(id: string): Promise<void> {
    await this.db.execute(
      "UPDATE tasks SET list_id = NULL WHERE list_id = $1",
      [id],
    );
    await this.db.execute("DELETE FROM lists WHERE id = $1", [id]);
  }

  async listStatuses(): Promise<Status[]> {
    const rows = await this.db.select<
      {
        id: string;
        name: string;
        color: string;
        sort_order: number;
        is_done: number;
      }[]
    >("SELECT * FROM statuses ORDER BY sort_order");
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      color: r.color,
      sortOrder: r.sort_order,
      isDone: r.is_done === 1,
    }));
  }

  async listSubtasks(taskId: string): Promise<Subtask[]> {
    const rows = await this.db.select<
      {
        id: string;
        task_id: string;
        title: string;
        done: number;
        sort_order: number;
      }[]
    >("SELECT * FROM subtasks WHERE task_id = $1 ORDER BY sort_order", [taskId]);
    return rows.map((r) => ({
      id: r.id,
      taskId: r.task_id,
      title: r.title,
      done: r.done === 1,
      sortOrder: r.sort_order,
    }));
  }

  async listAllSubtasks(): Promise<Subtask[]> {
    const rows = await this.db.select<
      {
        id: string;
        task_id: string;
        title: string;
        done: number;
        sort_order: number;
      }[]
    >("SELECT * FROM subtasks ORDER BY sort_order");
    return rows.map((r) => ({
      id: r.id,
      taskId: r.task_id,
      title: r.title,
      done: r.done === 1,
      sortOrder: r.sort_order,
    }));
  }

  async createSubtask(taskId: string, title: string): Promise<Subtask> {
    const id = newId();
    const maxRow = await this.db.select<{ m: number | null }[]>(
      "SELECT MAX(sort_order) as m FROM subtasks WHERE task_id = $1",
      [taskId],
    );
    const sortOrder = (maxRow[0]?.m ?? 0) + 1;
    await this.db.execute(
      "INSERT INTO subtasks (id, task_id, title, done, sort_order) VALUES ($1, $2, $3, 0, $4)",
      [id, taskId, title, sortOrder],
    );
    return { id, taskId, title, done: false, sortOrder };
  }

  async updateSubtask(
    id: string,
    patch: { title?: string; done?: boolean },
  ): Promise<void> {
    if (patch.title !== undefined) {
      await this.db.execute("UPDATE subtasks SET title = $1 WHERE id = $2", [
        patch.title,
        id,
      ]);
    }
    if (patch.done !== undefined) {
      await this.db.execute("UPDATE subtasks SET done = $1 WHERE id = $2", [
        patch.done ? 1 : 0,
        id,
      ]);
    }
  }

  async deleteSubtask(id: string): Promise<void> {
    await this.db.execute("DELETE FROM subtasks WHERE id = $1", [id]);
  }

  async listCompletions(): Promise<Completion[]> {
    const rows = await this.db.select<
      { id: string; task_id: string; due_date: string; completed_at: string }[]
    >("SELECT * FROM task_completions ORDER BY due_date");
    return rows.map((r) => ({
      id: r.id,
      taskId: r.task_id,
      dueDate: r.due_date,
      completedAt: r.completed_at,
    }));
  }

  async addCompletion(taskId: string, dueDate: string): Promise<Completion> {
    const id = newId();
    const now = nowIso();
    await this.db.execute(
      `INSERT INTO task_completions (id, task_id, due_date, completed_at)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (task_id, due_date) DO UPDATE SET completed_at = $4`,
      [id, taskId, dueDate, now],
    );
    return { id, taskId, dueDate, completedAt: now };
  }

  async replaceData(data: RepoSnapshot): Promise<void> {
    await invoke("replace_all_data", { data });
  }
}
