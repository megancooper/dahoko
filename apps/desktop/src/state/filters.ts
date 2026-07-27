import type { Task } from "@dahoko/core";

export type Filter =
  | { kind: "inbox" }
  | { kind: "today" }
  | { kind: "next7" }
  | { kind: "completed" }
  | { kind: "list"; listId: string }
  | { kind: "tag"; tag: string };

function isoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function applyFilter(tasks: Task[], filter: Filter, now = new Date()): Task[] {
  const today = isoDate(now);
  const week = new Date(now);
  week.setDate(week.getDate() + 7);
  const in7 = isoDate(week);

  switch (filter.kind) {
    case "inbox":
      return tasks.filter((t) => !t.completedAt || sameDay(t.completedAt, now));
    case "today":
      return tasks.filter(
        (t) => !t.completedAt && t.dueAt !== null && t.dueAt.slice(0, 10) <= today,
      );
    case "next7":
      return tasks.filter(
        (t) => !t.completedAt && t.dueAt !== null && t.dueAt.slice(0, 10) <= in7,
      );
    case "completed":
      return tasks.filter((t) => t.completedAt !== null);
    case "list":
      return tasks.filter((t) => t.listId === filter.listId && !t.completedAt);
    case "tag":
      return tasks.filter((t) => t.tags.includes(filter.tag) && !t.completedAt);
  }
}

function sameDay(iso: string, now: Date): boolean {
  // Completion timestamps are UTC ISO strings; compare in local time so a
  // task completed this evening doesn't jump days at the UTC boundary.
  return isoDate(new Date(iso)) === isoDate(now);
}

export function filterTitle(
  filter: Filter,
  listName?: (id: string) => string | undefined,
): string {
  switch (filter.kind) {
    case "inbox":
      return "Inbox";
    case "today":
      return "Today";
    case "next7":
      return "Next 7 days";
    case "completed":
      return "Completed";
    case "list":
      return listName?.(filter.listId) ?? "List";
    case "tag":
      return `#${filter.tag}`;
  }
}
