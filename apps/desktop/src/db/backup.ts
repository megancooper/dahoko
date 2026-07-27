import type { Priority, Recurrence } from "@dahoko/core";
import type { RepoSnapshot } from "./repo";

export const BACKUP_FORMAT = "dahoko-backup";
export const BACKUP_VERSION = 1;
export const MAX_BACKUP_BYTES = 10 * 1024 * 1024;

const LIMITS = {
  tasks: 50_000,
  lists: 2_000,
  statuses: 100,
  subtasks: 200_000,
  completions: 500_000,
  tagsPerTask: 100,
} as const;

const RECURRENCES = new Set<Recurrence>([
  "daily",
  "weekdays",
  "weekly",
  "monthly",
]);
const COLOR = /^#[0-9a-fA-F]{6}$/;
const DAY = /^\d{4}-\d{2}-\d{2}$/;

export interface DahokoBackup {
  format: typeof BACKUP_FORMAT;
  version: typeof BACKUP_VERSION;
  exportedAt: string;
  data: RepoSnapshot;
}

export class BackupValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BackupValidationError";
  }
}

function fail(message: string): never {
  throw new BackupValidationError(message);
}

function record(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    fail(`${label} must be an object.`);
  }
  return value as Record<string, unknown>;
}

function array(
  value: unknown,
  label: string,
  max: number,
): unknown[] {
  if (!Array.isArray(value)) fail(`${label} must be an array.`);
  if (value.length > max) fail(`${label} contains too many items.`);
  return value;
}

function string(
  value: unknown,
  label: string,
  max: number,
  allowEmpty = false,
): string {
  if (typeof value !== "string") fail(`${label} must be text.`);
  if ((!allowEmpty && value.length === 0) || value.length > max) {
    fail(`${label} has an invalid length.`);
  }
  return value;
}

function nullableString(
  value: unknown,
  label: string,
  max: number,
): string | null {
  return value === null ? null : string(value, label, max, true);
}

function boolean(value: unknown, label: string): boolean {
  if (typeof value !== "boolean") fail(`${label} must be true or false.`);
  return value;
}

function integer(
  value: unknown,
  label: string,
  min = 0,
  max = Number.MAX_SAFE_INTEGER,
): number {
  if (!Number.isSafeInteger(value) || (value as number) < min || (value as number) > max) {
    fail(`${label} must be a valid whole number.`);
  }
  return value as number;
}

function validDay(value: string): boolean {
  if (!DAY.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function dateTime(value: unknown, label: string): string {
  const result = string(value, label, 64);
  if (!Number.isFinite(Date.parse(result))) fail(`${label} is not a valid date.`);
  return result;
}

function dueDate(value: unknown, label: string): string | null {
  if (value === null) return null;
  const result = string(value, label, 64);
  const valid = result.length === 10 ? validDay(result) : Number.isFinite(Date.parse(result));
  if (!valid) fail(`${label} is not a valid date.`);
  return result;
}

function color(value: unknown, label: string): string {
  const result = string(value, label, 7);
  if (!COLOR.test(result)) fail(`${label} must be a six-digit hex color.`);
  return result;
}

function uniqueIds(items: { id: string }[], label: string): Set<string> {
  const ids = new Set<string>();
  for (const item of items) {
    if (ids.has(item.id)) fail(`${label} contains duplicate IDs.`);
    ids.add(item.id);
  }
  return ids;
}

export function createBackup(data: RepoSnapshot): DahokoBackup {
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    data,
  };
}

export function serializeBackup(backup: DahokoBackup): string {
  return `${JSON.stringify(backup, null, 2)}\n`;
}

export function parseBackupJson(json: string): DahokoBackup {
  if (new TextEncoder().encode(json).byteLength > MAX_BACKUP_BYTES) {
    fail("The backup is larger than 10 MB.");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    fail("The selected file is not valid JSON.");
  }
  return validateBackup(parsed);
}

export function validateBackup(value: unknown): DahokoBackup {
  const root = record(value, "Backup");
  if (root.format !== BACKUP_FORMAT) fail("This is not a dahoko backup.");
  if (root.version !== BACKUP_VERSION) {
    fail("This backup version is not supported.");
  }
  const exportedAt = dateTime(root.exportedAt, "Export date");
  const data = record(root.data, "Backup data");

  const statuses = array(data.statuses, "Statuses", LIMITS.statuses).map(
    (item, index) => {
      const row = record(item, `Status ${index + 1}`);
      return {
        id: string(row.id, `Status ${index + 1} ID`, 128),
        name: string(row.name, `Status ${index + 1} name`, 200),
        color: color(row.color, `Status ${index + 1} color`),
        sortOrder: integer(row.sortOrder, `Status ${index + 1} order`),
        isDone: boolean(row.isDone, `Status ${index + 1} done state`),
      };
    },
  );
  if (statuses.length === 0 || !statuses.some((status) => !status.isDone)) {
    fail("A backup needs at least one open status.");
  }

  const lists = array(data.lists, "Lists", LIMITS.lists).map((item, index) => {
    const row = record(item, `List ${index + 1}`);
    return {
      id: string(row.id, `List ${index + 1} ID`, 128),
      name: string(row.name, `List ${index + 1} name`, 500),
      color: color(row.color, `List ${index + 1} color`),
      sortOrder: integer(row.sortOrder, `List ${index + 1} order`),
    };
  });

  const statusIds = uniqueIds(statuses, "Statuses");
  const listIds = uniqueIds(lists, "Lists");

  const tasks = array(data.tasks, "Tasks", LIMITS.tasks).map((item, index) => {
    const row = record(item, `Task ${index + 1}`);
    const id = string(row.id, `Task ${index + 1} ID`, 128);
    const listId = nullableString(row.listId, `Task ${index + 1} list ID`, 128);
    const statusId = string(row.statusId, `Task ${index + 1} status ID`, 128);
    if (listId !== null && !listIds.has(listId)) {
      fail(`Task ${index + 1} refers to a missing list.`);
    }
    if (!statusIds.has(statusId)) {
      fail(`Task ${index + 1} refers to a missing status.`);
    }

    const tags = array(row.tags, `Task ${index + 1} tags`, LIMITS.tagsPerTask).map(
      (tag, tagIndex) =>
        string(tag, `Task ${index + 1} tag ${tagIndex + 1}`, 100),
    );
    if (new Set(tags).size !== tags.length) {
      fail(`Task ${index + 1} contains duplicate tags.`);
    }

    const recurrence =
      row.recurrence === null
        ? null
        : (string(row.recurrence, `Task ${index + 1} recurrence`, 20) as Recurrence);
    if (recurrence !== null && !RECURRENCES.has(recurrence)) {
      fail(`Task ${index + 1} has an invalid recurrence.`);
    }

    return {
      id,
      title: string(row.title, `Task ${index + 1} title`, 10_000),
      notes: string(row.notes, `Task ${index + 1} notes`, 1_000_000, true),
      dueAt: dueDate(row.dueAt, `Task ${index + 1} due date`),
      hasDueTime: boolean(row.hasDueTime, `Task ${index + 1} due-time state`),
      priority: integer(row.priority, `Task ${index + 1} priority`, 0, 3) as Priority,
      listId,
      statusId,
      tags,
      recurrence,
      completedAt:
        row.completedAt === null
          ? null
          : dateTime(row.completedAt, `Task ${index + 1} completion date`),
      sortOrder: integer(row.sortOrder, `Task ${index + 1} order`),
      createdAt: dateTime(row.createdAt, `Task ${index + 1} creation date`),
      updatedAt: dateTime(row.updatedAt, `Task ${index + 1} update date`),
    };
  });
  const taskIds = uniqueIds(tasks, "Tasks");

  const subtasks = array(data.subtasks, "Subtasks", LIMITS.subtasks).map(
    (item, index) => {
      const row = record(item, `Subtask ${index + 1}`);
      const taskId = string(row.taskId, `Subtask ${index + 1} task ID`, 128);
      if (!taskIds.has(taskId)) {
        fail(`Subtask ${index + 1} refers to a missing task.`);
      }
      return {
        id: string(row.id, `Subtask ${index + 1} ID`, 128),
        taskId,
        title: string(row.title, `Subtask ${index + 1} title`, 10_000),
        done: boolean(row.done, `Subtask ${index + 1} done state`),
        sortOrder: integer(row.sortOrder, `Subtask ${index + 1} order`),
      };
    },
  );
  uniqueIds(subtasks, "Subtasks");

  const completionKeys = new Set<string>();
  const completions = array(
    data.completions,
    "Completions",
    LIMITS.completions,
  ).map((item, index) => {
    const row = record(item, `Completion ${index + 1}`);
    const taskId = string(row.taskId, `Completion ${index + 1} task ID`, 128);
    if (!taskIds.has(taskId)) {
      fail(`Completion ${index + 1} refers to a missing task.`);
    }
    const day = string(row.dueDate, `Completion ${index + 1} due date`, 10);
    if (!validDay(day)) fail(`Completion ${index + 1} has an invalid due date.`);
    const key = `${taskId}\u0000${day}`;
    if (completionKeys.has(key)) {
      fail("Completions contains duplicate task dates.");
    }
    completionKeys.add(key);
    return {
      id: string(row.id, `Completion ${index + 1} ID`, 128),
      taskId,
      dueDate: day,
      completedAt: dateTime(
        row.completedAt,
        `Completion ${index + 1} completion date`,
      ),
    };
  });
  uniqueIds(completions, "Completions");

  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt,
    data: { tasks, lists, statuses, subtasks, completions },
  };
}
