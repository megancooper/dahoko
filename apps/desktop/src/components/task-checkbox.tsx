import { Check } from "lucide-react";
import { cn } from "@dahoko/ui";
import type { Task } from "@dahoko/core";

/**
 * Circular complete toggle. The button provides a 28px hit area (Fitts-law
 * friendly) around an 18px visual circle so near-misses still toggle the
 * task instead of falling through to the row's select handler.
 */
export function TaskCheckbox({
  task,
  onToggle,
}: {
  task: Task;
  onToggle: () => void;
}) {
  const done = task.completedAt !== null;
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={done}
      aria-label={done ? "Mark incomplete" : "Mark complete"}
      onClick={(event) => {
        event.stopPropagation();
        onToggle();
      }}
      onKeyDown={(event) => {
        // Keep Enter/Space on the checkbox from also activating the row.
        event.stopPropagation();
      }}
      className="group/check -my-1 grid h-7 w-7 flex-shrink-0 place-items-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span
        aria-hidden="true"
        className={cn(
          "grid h-[18px] w-[18px] place-items-center rounded-full border-[1.5px] transition-all duration-150",
          done
            ? "animate-check-pop border-primary-strong/40 bg-primary text-primary-foreground"
            : cn(
                "bg-transparent text-transparent",
                task.priority === 3
                  ? "border-destructive group-hover/check:bg-destructive/10 group-hover/check:text-destructive"
                  : task.priority === 2
                    ? "border-warning group-hover/check:bg-warning/10 group-hover/check:text-warning"
                    : "border-input group-hover/check:bg-muted group-hover/check:text-muted-foreground",
              ),
        )}
      >
        <Check
          className={cn("h-3 w-3", done && "animate-check-in")}
          strokeWidth={3}
        />
      </span>
    </button>
  );
}
