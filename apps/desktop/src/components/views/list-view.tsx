import { CheckCircle2 } from "lucide-react";
import type { Task } from "@dahoko/core";
import { DUE_BUCKET_LABELS, groupByDueBucket } from "@dahoko/core";
import { cn } from "@dahoko/ui";
import { useStore } from "@/state/store";
import { TaskCheckbox } from "../task-checkbox";
import {
  AgeBars,
  DueLabel,
  RecurrenceChip,
  SubtaskProgress,
  TagChip,
} from "../task-chips";

export function TaskRow({
  task,
  selected,
  onSelect,
}: {
  task: Task;
  selected: boolean;
  onSelect: (id: string) => void;
}) {
  const { toggleComplete, lists, subtasks } = useStore();
  const list = lists.find((l) => l.id === task.listId);
  const mine = subtasks.filter((s) => s.taskId === task.id);
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onSelect(task.id)}
      onKeyDown={(event) => {
        if (event.key === "Enter") onSelect(task.id);
      }}
      className={cn(
        "group flex animate-fade-in-up cursor-pointer items-center gap-3 rounded-lg border border-transparent px-3 py-2 transition-colors duration-150 hover:border-border/80 hover:bg-muted/60 hover:shadow-soft",
        selected && "border-primary/50 bg-primary/10",
        task.completedAt && "opacity-70",
      )}
    >
      <TaskCheckbox task={task} onToggle={() => void toggleComplete(task.id)} />
      <span
        data-done={task.completedAt !== null}
        className={cn(
          "task-strike truncate text-[13.5px]",
          task.completedAt && "text-muted-foreground",
        )}
      >
        {task.title}
      </span>
      <span className="ml-auto flex flex-shrink-0 items-center gap-1.5">
        <RecurrenceChip task={task} />
        <SubtaskProgress
          done={mine.filter((s) => s.done).length}
          total={mine.length}
        />
        <AgeBars task={task} />
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
      <div className="flex h-48 flex-col items-center justify-center gap-2 text-muted-foreground">
        <CheckCircle2 className="h-7 w-7 opacity-50" strokeWidth={1.5} />
        <span className="text-sm">No tasks here — add one above.</span>
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
