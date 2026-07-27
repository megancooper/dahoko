import { Check } from "lucide-react";
import { cn } from "@dahoko/ui";
import type { Task } from "@dahoko/core";

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
      className={cn(
        "grid h-[17px] w-[17px] flex-shrink-0 place-items-center rounded-md border-[1.5px] transition-colors",
        done
          ? "animate-check-pop border-primary-strong/40 bg-primary text-primary-foreground"
          : task.priority === 3
            ? "border-destructive"
            : task.priority === 2
              ? "border-warning"
              : "border-input",
      )}
    >
      {done ? (
        <Check className="animate-check-in h-3 w-3" strokeWidth={3} />
      ) : null}
    </button>
  );
}
