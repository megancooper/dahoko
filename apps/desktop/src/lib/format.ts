export function isoToday(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** "Today", "Tomorrow", weekday for this week, else "Jul 24". */
export function formatDue(dueAt: string, hasDueTime: boolean): string {
  const date = dueAt.slice(0, 10);
  const today = new Date();
  const due = new Date(`${date}T00:00:00`);
  const startOfToday = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
  );
  const diffDays = Math.round(
    (due.getTime() - startOfToday.getTime()) / 86_400_000,
  );

  let label: string;
  if (diffDays === 0) label = "Today";
  else if (diffDays === 1) label = "Tomorrow";
  else if (diffDays === -1) label = "Yesterday";
  else if (diffDays > 1 && diffDays < 7)
    label = due.toLocaleDateString(undefined, { weekday: "short" });
  else
    label = due.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });

  if (hasDueTime && dueAt.length > 10) {
    label += ` ${dueAt.slice(11, 16)}`;
  }
  return label;
}

export function isOverdue(dueAt: string | null, completedAt: string | null): boolean {
  if (!dueAt || completedAt) return false;
  return dueAt.slice(0, 10) < isoToday();
}

/** Whole days a task is past due; 0 when due today, not yet due, or completed. */
export function overdueDays(
  dueAt: string | null,
  completedAt: string | null,
): number {
  if (!dueAt || completedAt) return 0;
  const due = new Date(`${dueAt.slice(0, 10)}T00:00:00`);
  const now = new Date();
  const startOfToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  );
  const days = Math.round((startOfToday.getTime() - due.getTime()) / 86_400_000);
  return Math.max(0, days);
}
