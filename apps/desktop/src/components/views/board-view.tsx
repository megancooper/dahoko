import { useState } from "react";
import type { Task } from "@dahoko/core";
import { groupByStatus } from "@dahoko/core";
import { cn } from "@dahoko/ui";
import { useStore } from "@/state/store";
import { DueLabel, PriorityFlag, TagChip } from "../task-chips";

function BoardCard({
  task,
  selected,
  onSelect,
  onDragStart,
}: {
  task: Task;
  selected: boolean;
  onSelect: (id: string) => void;
  onDragStart: (id: string) => void;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      draggable
      onDragStart={(event) => {
        event.dataTransfer.effectAllowed = "move";
        onDragStart(task.id);
      }}
      onClick={() => onSelect(task.id)}
      onKeyDown={(event) => {
        if (event.key === "Enter") onSelect(task.id);
      }}
      className={cn(
        "mb-2 cursor-grab rounded-md border border-border bg-card px-3 py-2.5 shadow-soft transition-shadow hover:shadow-md active:cursor-grabbing",
        selected && "border-primary/60 ring-1 ring-primary/40",
        task.completedAt && "opacity-60",
      )}
    >
      <div
        className={cn(
          "mb-1.5 text-[13px]",
          task.completedAt && "line-through",
        )}
      >
        {task.title}
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <PriorityFlag priority={task.priority} />
        {task.tags.map((tag) => (
          <TagChip key={tag} tag={tag} />
        ))}
        <DueLabel task={task} />
      </div>
    </div>
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
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverStatus, setDragOverStatus] = useState<string | null>(null);

  const groups = groupByStatus(
    tasks,
    statuses.map((s) => s.id),
  );

  return (
    <div className="flex min-w-fit items-start gap-3.5 px-5 pb-6 pt-4">
      {statuses.map((status) => {
        const columnTasks = groups.get(status.id) ?? [];
        return (
          <div
            key={status.id}
            onDragOver={(event) => {
              event.preventDefault();
              event.dataTransfer.dropEffect = "move";
              setDragOverStatus(status.id);
            }}
            onDragLeave={() => setDragOverStatus(null)}
            onDrop={(event) => {
              event.preventDefault();
              setDragOverStatus(null);
              if (draggingId) void moveToStatus(draggingId, status.id);
              setDraggingId(null);
            }}
            className={cn(
              "w-64 flex-shrink-0 rounded-lg border border-border bg-muted/50 p-2.5 transition-colors",
              dragOverStatus === status.id && "border-primary/60 bg-primary/10",
            )}
          >
            <div className="flex items-center gap-2 px-1.5 pb-2.5 pt-1">
              <span
                className="h-[9px] w-[9px] rounded-full"
                style={{ backgroundColor: status.color }}
              />
              <span className="text-[12.5px] font-semibold">{status.name}</span>
              <span className="font-mono text-[11px] text-muted-foreground">
                {columnTasks.length}
              </span>
            </div>
            {columnTasks.map((task) => (
              <BoardCard
                key={task.id}
                task={task}
                selected={task.id === selectedId}
                onSelect={onSelect}
                onDragStart={setDraggingId}
              />
            ))}
          </div>
        );
      })}
    </div>
  );
}
