import type { List, Priority, Status, Task } from "@dahoko/core";

export interface Subtask {
  id: string;
  taskId: string;
  title: string;
  done: boolean;
  sortOrder: number;
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
  listStatuses(): Promise<Status[]>;
  listSubtasks(taskId: string): Promise<Subtask[]>;
  createSubtask(taskId: string, title: string): Promise<Subtask>;
  updateSubtask(id: string, patch: { title?: string; done?: boolean }): Promise<void>;
  deleteSubtask(id: string): Promise<void>;
}

export function newId(): string {
  return crypto.randomUUID();
}

export function nowIso(): string {
  return new Date().toISOString();
}
