import type { Task } from "@dahoko/core";

export type Filter =
  | { kind: "inbox" }
  | { kind: "today" }
  | { kind: "next7" }
  | { kind: "completed" }
  | { kind: "recurring" }
  | { kind: "list"; listId: string }
  | { kind: "tag"; tags: string[] };

/** Toggle a tag in/out of the current filter; empty selection falls back to inbox. */
export function toggleTagFilter(filter: Filter, tag: string): Filter {
  const current = filter.kind === "tag" ? filter.tags : [];
  const next = current.includes(tag)
    ? current.filter((t) => t !== tag)
    : [...current, tag];
  return next.length > 0 ? { kind: "tag", tags: next } : { kind: "inbox" };
}

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
    case "recurring":
      return tasks.filter((t) => t.recurrence !== null && !t.completedAt);
    case "list":
      return tasks.filter((t) => t.listId === filter.listId && !t.completedAt);
    case "tag":
      // Union: a task matches if it carries any of the selected tags.
      return tasks.filter(
        (t) => filter.tags.some((tag) => t.tags.includes(tag)) && !t.completedAt,
      );
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
    case "recurring":
      return "Recurring";
    case "list":
      return listName?.(filter.listId) ?? "List";
    case "tag":
      return filter.tags.map((tag) => `#${tag}`).join("  ");
  }
}
