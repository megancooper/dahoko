import { ListChecks, Repeat } from "lucide-react";
import type { Task } from "@dahoko/core";
import { RECURRENCE_LABELS } from "@dahoko/core";
import { cn } from "@dahoko/ui";
import { formatDue, isOverdue, overdueDays } from "@/lib/format";

export function TagChip({ tag }: { tag: string }) {
  return (
    <span className="inline-flex items-center rounded-full border border-primary/60 bg-primary/25 px-2 py-0.5 text-[11px] font-medium text-primary-strong">
      #{tag}
    </span>
  );
}

/**
 * Stacked bars showing how long a task has been overdue: one yellow bar
 * after a day, two after three days, and a red bar on top after a week.
 */
export function AgeBars({ task }: { task: Task }) {
  const days = overdueDays(task.dueAt, task.completedAt);
  if (days < 1) return null;
  const bars = days >= 7 ? 3 : days >= 3 ? 2 : 1;
  const label = `Overdue ${days} ${days === 1 ? "day" : "days"}`;
  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      className="flex flex-col-reverse gap-[2px]"
    >
      {Array.from({ length: bars }).map((_, i) => (
        <span
          key={i}
          className={cn(
            "h-[3px] w-[11px] rounded-full",
            i === 2 ? "bg-destructive" : "bg-warning",
          )}
        />
      ))}
    </span>
  );
}

export function RecurrenceChip({ task }: { task: Task }) {
  if (!task.recurrence) return null;
  const label = RECURRENCE_LABELS[task.recurrence];
  return (
    <span
      title={`Repeats ${label.toLowerCase()}`}
      aria-label={`Repeats ${label.toLowerCase()}`}
      className="text-muted-foreground"
    >
      <Repeat className="h-3 w-3" />
    </span>
  );
}

export function SubtaskProgress({
  done,
  total,
}: {
  done: number;
  total: number;
}) {
  if (total === 0) return null;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 font-mono text-[11px]",
        done === total ? "text-success" : "text-muted-foreground",
      )}
    >
      <ListChecks className="h-3 w-3" />
      {done}/{total}
    </span>
  );
}

export function DueLabel({ task }: { task: Task }) {
  if (!task.dueAt) return null;
  const overdue = isOverdue(task.dueAt, task.completedAt);
  return (
    <span
      className={cn(
        "font-mono text-[11px]",
        overdue ? "font-semibold text-destructive" : "text-muted-foreground",
      )}
    >
      {formatDue(task.dueAt, task.hasDueTime)}
    </span>
  );
}
