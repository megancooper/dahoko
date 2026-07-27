import { useState } from "react";
import { Layers } from "lucide-react";
import type { Task } from "@dahoko/core";
import { PRIORITY_LABELS, groupByTag, type Priority } from "@dahoko/core";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@dahoko/ui";
import { useStore } from "@/state/store";
import { TaskRow } from "./list-view";

type GroupBy = "tag" | "list" | "priority";

export function TagView({
  tasks,
  selectedId,
  onSelect,
}: {
  tasks: Task[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const { lists } = useStore();
  const [groupBy, setGroupBy] = useState<GroupBy>("tag");

  let groups: [string, Task[]][];
  if (groupBy === "tag") {
    groups = [...groupByTag(tasks).entries()].map(([tag, list]) => [
      tag === "untagged" ? "untagged" : `#${tag}`,
      list,
    ]);
  } else if (groupBy === "list") {
    const byList = new Map<string, Task[]>();
    for (const task of tasks) {
      const name =
        lists.find((l) => l.id === task.listId)?.name ?? "No list";
      byList.set(name, [...(byList.get(name) ?? []), task]);
    }
    groups = [...byList.entries()].sort(([a], [b]) => a.localeCompare(b));
  } else {
    const byPriority = new Map<Priority, Task[]>();
    for (const task of tasks) {
      byPriority.set(task.priority, [
        ...(byPriority.get(task.priority) ?? []),
        task,
      ]);
    }
    groups = ([3, 2, 1, 0] as Priority[])
      .filter((p) => byPriority.has(p))
      .map((p) => [PRIORITY_LABELS[p], byPriority.get(p)!]);
  }

  return (
    <div className="pb-6">
      <div className="flex items-center gap-2 px-3 pt-3">
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Layers className="h-3.5 w-3.5" />
          Group by
        </span>
        <Select
          value={groupBy}
          onValueChange={(value) => setGroupBy(value as GroupBy)}
        >
          <SelectTrigger aria-label="Group by" className="h-7 w-auto min-w-[104px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="tag">Tag</SelectItem>
            <SelectItem value="list">List</SelectItem>
            <SelectItem value="priority">Priority</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {groups.map(([label, groupTasks]) => (
        <section key={label}>
          <h2 className="mb-1.5 mt-4 flex items-center gap-2 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {label}
            <span className="font-mono text-[11px] font-normal">
              {groupTasks.length}
            </span>
          </h2>
          {groupTasks.map((task) => (
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
