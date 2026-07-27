import type { List, Priority, Recurrence, Status, Task } from "@dahoko/core";

export interface Subtask {
  id: string;
  taskId: string;
  title: string;
  done: boolean;
  sortOrder: number;
}

/** One completed occurrence of a recurring task. */
export interface Completion {
  id: string;
  taskId: string;
  /** The date (YYYY-MM-DD) this occurrence was due */
  dueDate: string;
  completedAt: string;
}

export interface NewTask {
  title: string;
  notes?: string;
  dueAt?: string | null;
  hasDueTime?: boolean;
  priority?: Priority;
  listId?: string | null;
  statusId?: string;
  tags?: string[];
  recurrence?: Recurrence | null;
}

export interface TaskPatch {
  title?: string;
  notes?: string;
  dueAt?: string | null;
  hasDueTime?: boolean;
  priority?: Priority;
  listId?: string | null;
  statusId?: string;
  tags?: string[];
  recurrence?: Recurrence | null;
  completedAt?: string | null;
  sortOrder?: number;
}

export interface Repo {
  init(): Promise<void>;
  listTasks(): Promise<Task[]>;
  createTask(input: NewTask): Promise<Task>;
  updateTask(id: string, patch: TaskPatch): Promise<void>;
  deleteTask(id: string): Promise<void>;
  listLists(): Promise<List[]>;
  createList(name: string, color: string): Promise<List>;
  updateList(id: string, patch: { name?: string; color?: string }): Promise<void>;
  /** Tasks in the list are kept and moved to the inbox (listId = null). */
  deleteList(id: string): Promise<void>;
  listStatuses(): Promise<Status[]>;
  listSubtasks(taskId: string): Promise<Subtask[]>;
  listAllSubtasks(): Promise<Subtask[]>;
  createSubtask(taskId: string, title: string): Promise<Subtask>;
  updateSubtask(id: string, patch: { title?: string; done?: boolean }): Promise<void>;
  deleteSubtask(id: string): Promise<void>;
  listCompletions(): Promise<Completion[]>;
  addCompletion(taskId: string, dueDate: string): Promise<Completion>;
}

export function newId(): string {
  return crypto.randomUUID();
}

export function nowIso(): string {
  return new Date().toISOString();
}
