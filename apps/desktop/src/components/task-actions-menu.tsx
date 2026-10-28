import { MoreHorizontal, PanelRight, Trash2 } from "lucide-react";
import type { Task } from "@dahoko/core";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  cn,
} from "@dahoko/ui";
import { useStore } from "@/state/store";

/**
 * The "…" menu on a task row or board card. Opens on click of the trigger
 * and, when the parent passes `open` / `onOpenChange`, on right-click of
 * the whole row. Delete is immediate — the same contract as the detail
 * dialog's button — so the item is styled destructive and sits apart.
 */
export function TaskActionsMenu({
  task,
  onOpenTask,
  open,
  onOpenChange,
  className,
}: {
  task: Task;
  onOpenTask: (id: string) => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  className?: string;
}) {
  const { deleteTask } = useStore();
  return (
    <DropdownMenu open={open} onOpenChange={onOpenChange}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={`Actions for ${task.title}`}
          onClick={(event) => event.stopPropagation()}
          onKeyDown={(event) => event.stopPropagation()}
          className={cn(
            "flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground outline-none transition-[background-color,color,opacity] duration-150 hover:bg-secondary hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring",
            className,
          )}
        >
          <MoreHorizontal aria-hidden="true" className="h-4 w-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-44"
        onClick={(event) => event.stopPropagation()}
      >
        <DropdownMenuItem onSelect={() => onOpenTask(task.id)}>
          <PanelRight className="mr-2 h-3.5 w-3.5" />
          Open
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="text-destructive focus:bg-destructive/10 focus:text-destructive"
          onSelect={() => void deleteTask(task.id)}
        >
          <Trash2 className="mr-2 h-3.5 w-3.5" />
          Delete task
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
