import type { Task } from "@dahoko/core";
import { cn } from "@dahoko/ui";
import { formatDue, isOverdue } from "@/lib/format";

export function TagChip({ tag }: { tag: string }) {
  return (
    <span className="inline-flex items-center rounded-full border border-primary/60 bg-primary/25 px-2 py-0.5 text-[11px] font-medium text-primary-strong">
      #{tag}
    </span>
  );
}

export function PriorityFlag({ priority }: { priority: number }) {
  if (priority === 0) return null;
  const color =
    priority === 3
      ? "text-destructive"
      : priority === 2
        ? "text-warning"
        : "text-primary-strong";
  return (
    <span className={cn("text-[11px] font-semibold", color)}>
      {"!".repeat(priority)}
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
