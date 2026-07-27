import type { Task } from "@dahoko/core";
import { DUE_BUCKET_LABELS, groupByDueBucket } from "@dahoko/core";
import { cn } from "@dahoko/ui";
import { useStore } from "@/state/store";
import { TaskCheckbox } from "../task-checkbox";
import { DueLabel, PriorityFlag, TagChip } from "../task-chips";

export function TaskRow({
  task,
  selected,
  onSelect,
}: {
  task: Task;
  selected: boolean;
  onSelect: (id: string) => void;
}) {
  const { toggleComplete, lists } = useStore();
  const list = lists.find((l) => l.id === task.listId);
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onSelect(task.id)}
      onKeyDown={(event) => {
        if (event.key === "Enter") onSelect(task.id);
      }}
      className={cn(
        "flex cursor-pointer items-center gap-3 rounded-md border border-transparent px-3 py-2 transition-colors hover:border-border/80 hover:bg-muted/60",
        selected && "border-primary/50 bg-primary/10",
      )}
    >
      <TaskCheckbox task={task} onToggle={() => void toggleComplete(task.id)} />
      <span
        className={cn(
          "truncate text-[13.5px]",
          task.completedAt && "text-muted-foreground line-through",
        )}
      >
        {task.title}
      </span>
      <span className="ml-auto flex flex-shrink-0 items-center gap-1.5">
        <PriorityFlag priority={task.priority} />
        {task.tags.map((tag) => (
          <TagChip key={tag} tag={tag} />
        ))}
        {list ? (
          <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
            {list.name}
          </span>
        ) : null}
        <DueLabel task={task} />
      </span>
    </div>
  );
}

export function ListView({
  tasks,
  selectedId,
  onSelect,
}: {
  tasks: Task[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const groups = groupByDueBucket(tasks);

  if (tasks.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
        No tasks here — add one above.
      </div>
    );
  }

  return (
    <div className="pb-6">
      {[...groups.entries()].map(([bucket, bucketTasks]) => (
        <section key={bucket}>
          <h2 className="mb-1.5 mt-4 flex items-center gap-2 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {DUE_BUCKET_LABELS[bucket]}
            <span className="font-mono text-[11px] font-normal">
              {bucketTasks.length}
            </span>
          </h2>
          {bucketTasks.map((task) => (
            <TaskRow
              key={task.id}
              task={task}
              selected={task.id === selectedId}
              onSelect={onSelect}
            />
          ))}
        </section>
      ))}
    </div>
  );
}
