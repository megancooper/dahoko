import {
  DragDropProvider,
  useDraggable,
  useDroppable,
} from "@dnd-kit/react";
import { pointerIntersection } from "@dnd-kit/collision";
import { GripVertical } from "lucide-react";
import type { Status, Task } from "@dahoko/core";
import { groupByStatus } from "@dahoko/core";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  cn,
} from "@dahoko/ui";
import { useStore } from "@/state/store";
import {
  AgeBars,
  DueLabel,
  RecurrenceChip,
  SubtaskProgress,
  TagChip,
} from "../task-chips";

function BoardCard({
  task,
  selected,
  onSelect,
}: {
  task: Task;
  selected: boolean;
  onSelect: (id: string) => void;
}) {
  const { subtasks } = useStore();
  const { ref, handleRef, isDragging, isDropping } = useDraggable({
    id: task.id,
    type: "task",
    data: { statusId: task.statusId },
  });
  const mine = subtasks.filter((subtask) => subtask.taskId === task.id);

  return (
    <div
      ref={ref}
      data-task-id={task.id}
      data-status-id={task.statusId}
      className={cn(
        "group/card relative mb-2 rounded-md border border-border bg-card shadow-soft transition-[border-color,box-shadow,opacity] duration-150 ease-out-strong",
        "hover:shadow-md",
        selected && "border-primary/60 ring-1 ring-primary/40",
        task.completedAt && "opacity-60",
        isDragging && "cursor-grabbing shadow-panel ring-2 ring-ring",
        isDropping && "ring-2 ring-primary/60",
      )}
    >
      <button
        type="button"
        aria-pressed={selected}
        onClick={() => onSelect(task.id)}
        className="block w-full rounded-md px-3 py-2.5 pr-10 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card"
      >
        <span
          data-done={task.completedAt !== null}
          className="task-strike mb-1.5 block w-fit max-w-full text-[13px]"
        >
          {task.title}
        </span>
        <span className="flex flex-wrap items-center gap-1.5">
          <RecurrenceChip task={task} />
          <SubtaskProgress
            done={mine.filter((subtask) => subtask.done).length}
            total={mine.length}
          />
          <AgeBars task={task} />
          {task.tags.map((tag) => (
            <TagChip key={tag} tag={tag} />
          ))}
          <DueLabel task={task} />
        </span>
      </button>

      <Tooltip>
        <TooltipTrigger asChild>
          <button
            ref={handleRef}
            type="button"
            aria-label={`Move ${task.title}`}
            onClick={(event) => event.stopPropagation()}
            className="absolute right-1.5 top-1.5 flex h-7 w-7 touch-none items-center justify-center rounded-md text-muted-foreground opacity-55 outline-none transition-[background-color,color,opacity] duration-150 hover:bg-secondary hover:text-foreground hover:opacity-100 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring"
          >
            <GripVertical aria-hidden="true" className="h-4 w-4" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="top">Drag to another swimlane</TooltipContent>
      </Tooltip>
    </div>
  );
}

function Swimlane({
  status,
  tasks,
  selectedId,
  onSelect,
}: {
  status: Status;
  tasks: Task[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const { ref, isDropTarget } = useDroppable({
    id: status.id,
    accept: "task",
    data: { statusId: status.id },
    // Kanban columns are large targets. Following the pointer avoids a wide
    // card continuing to collide with its source lane after crossing over.
    collisionDetector: pointerIntersection,
  });

  return (
    <section
      ref={ref}
      data-status-id={status.id}
      aria-label={`${status.name} swimlane`}
      className={cn(
        "flex h-full min-h-[220px] w-72 flex-shrink-0 flex-col rounded-lg border border-border bg-muted/50 transition-[background-color,border-color,box-shadow] duration-150 ease-out-strong",
        isDropTarget &&
          "border-primary-strong/70 bg-primary/15 shadow-[inset_0_0_0_1px_rgb(var(--brand-primary-strong)/0.18)]",
      )}
    >
      <header className="flex flex-shrink-0 items-center gap-2 px-4 pb-2.5 pt-3.5">
        <span
          aria-hidden="true"
          className="h-[9px] w-[9px] rounded-full"
          style={{ backgroundColor: status.color }}
        />
        <h2 className="text-[12.5px] font-semibold">{status.name}</h2>
        <span className="font-mono text-[11px] text-muted-foreground">
          {tasks.length}
        </span>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-2.5 pb-2.5 [scrollbar-gutter:stable]">
        {tasks.map((task) => (
          <BoardCard
            key={task.id}
            task={task}
            selected={task.id === selectedId}
            onSelect={onSelect}
          />
        ))}
        {tasks.length === 0 ? (
          <div
            className={cn(
              "flex min-h-24 items-center justify-center rounded-md border border-dashed border-border px-4 text-center text-[11.5px] text-muted-foreground transition-colors",
              isDropTarget && "border-primary-strong/50 text-foreground",
            )}
          >
            Drop a task here
          </div>
        ) : null}
      </div>
    </section>
  );
}

export function BoardView({
  tasks,
  selectedId,
  onSelect,
}: {
  tasks: Task[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const { statuses, moveToStatus } = useStore();
  const groups = groupByStatus(
    tasks,
    statuses.map((status) => status.id),
  );

  return (
    <DragDropProvider
      onDragEnd={(event) => {
        const { source, target } = event.operation;
        if (event.canceled || !source || !target) return;
        void moveToStatus(String(source.id), String(target.id));
      }}
    >
      <div
        data-testid="swimlane-scroll"
        className="h-full overflow-x-auto overflow-y-hidden overscroll-x-contain [scrollbar-gutter:stable]"
      >
        <div className="flex h-full w-max min-w-full items-start gap-3.5 px-3 pb-4 pt-4">
          {statuses.map((status) => (
            <Swimlane
              key={status.id}
              status={status}
              tasks={groups.get(status.id) ?? []}
              selectedId={selectedId}
              onSelect={onSelect}
            />
          ))}
        </div>
      </div>
    </DragDropProvider>
  );
}
