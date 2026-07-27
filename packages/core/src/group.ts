import type { Task } from "./types";

export type DueBucket = "overdue" | "today" | "upcoming" | "someday" | "done";

export const DUE_BUCKET_ORDER: DueBucket[] = [
  "overdue",
  "today",
  "upcoming",
  "someday",
  "done",
];

export const DUE_BUCKET_LABELS: Record<DueBucket, string> = {
  overdue: "Overdue",
  today: "Today",
  upcoming: "Upcoming",
  someday: "Someday",
  done: "Done",
};

function isoToday(now: Date): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function dueBucket(task: Task, now = new Date()): DueBucket {
  if (task.completedAt) return "done";
  if (!task.dueAt) return "someday";
  const today = isoToday(now);
  const due = task.dueAt.slice(0, 10);
  if (due < today) return "overdue";
  if (due === today) return "today";
  return "upcoming";
}

export function groupByDueBucket(
  tasks: Task[],
  now = new Date(),
): Map<DueBucket, Task[]> {
  const groups = new Map<DueBucket, Task[]>();
  for (const bucket of DUE_BUCKET_ORDER) groups.set(bucket, []);
  for (const task of tasks) {
    groups.get(dueBucket(task, now))!.push(task);
  }
  for (const [bucket, list] of groups) {
    if (list.length === 0) {
      groups.delete(bucket);
      continue;
    }
    list.sort(compareTasks);
  }
  return groups;
}

/** Groups tasks by tag; tasks with several tags appear in each. */
export function groupByTag(tasks: Task[]): Map<string, Task[]> {
  const groups = new Map<string, Task[]>();
  for (const task of tasks) {
    const keys = task.tags.length > 0 ? task.tags : ["untagged"];
    for (const key of keys) {
      const list = groups.get(key) ?? [];
      list.push(task);
      groups.set(key, list);
    }
  }
  const sorted = new Map(
    [...groups.entries()].sort(([a], [b]) => {
      if (a === "untagged") return 1;
      if (b === "untagged") return -1;
      return a.localeCompare(b);
    }),
  );
  for (const list of sorted.values()) list.sort(compareTasks);
  return sorted;
}

export function groupByStatus(
  tasks: Task[],
  statusIds: string[],
): Map<string, Task[]> {
  const groups = new Map<string, Task[]>();
  for (const id of statusIds) groups.set(id, []);
  for (const task of tasks) {
    const list = groups.get(task.statusId);
    if (list) list.push(task);
    else groups.set(task.statusId, [task]);
  }
  for (const list of groups.values()) {
    list.sort((a, b) => a.sortOrder - b.sortOrder || compareTasks(a, b));
  }
  return groups;
}

/** Incomplete before complete, then by due date (nulls last), priority desc, title. */
export function compareTasks(a: Task, b: Task): number {
  const doneA = a.completedAt ? 1 : 0;
  const doneB = b.completedAt ? 1 : 0;
  if (doneA !== doneB) return doneA - doneB;
  if (a.dueAt !== b.dueAt) {
    if (a.dueAt === null) return 1;
    if (b.dueAt === null) return -1;
    return a.dueAt < b.dueAt ? -1 : 1;
  }
  if (a.priority !== b.priority) return b.priority - a.priority;
  return a.title.localeCompare(b.title);
}
