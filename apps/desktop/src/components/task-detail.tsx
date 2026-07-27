import { useEffect, useState } from "react";
import { Plus, Trash2, X } from "lucide-react";
import type { Priority, Task } from "@dahoko/core";
import { PRIORITY_LABELS } from "@dahoko/core";
import { Button, Separator, cn } from "@dahoko/ui";
import { useStore } from "@/state/store";
import type { Subtask } from "@/db";
import { TaskCheckbox } from "./task-checkbox";

export function TaskDetail({
  task,
  onClose,
}: {
  task: Task;
  onClose: () => void;
}) {
  const { updateTask, deleteTask, toggleComplete, lists, statuses, repo } =
    useStore();
  const [title, setTitle] = useState(task.title);
  const [notes, setNotes] = useState(task.notes);
  const [tagsText, setTagsText] = useState(task.tags.join(", "));
  const [subtasks, setSubtasks] = useState<Subtask[]>([]);
  const [newSubtask, setNewSubtask] = useState("");

  useEffect(() => {
    setTitle(task.title);
    setNotes(task.notes);
    setTagsText(task.tags.join(", "));
  }, [task.id, task.title, task.notes, task.tags]);

  useEffect(() => {
    let cancelled = false;
    void repo()
      .then((r) => r.listSubtasks(task.id))
      .then((rows) => {
        if (!cancelled) setSubtasks(rows);
      });
    return () => {
      cancelled = true;
    };
  }, [task.id, repo]);

  const commitTitle = () => {
    const trimmed = title.trim();
    if (trimmed && trimmed !== task.title) {
      void updateTask(task.id, { title: trimmed });
    } else {
      setTitle(task.title);
    }
  };

  const commitNotes = () => {
    if (notes !== task.notes) void updateTask(task.id, { notes });
  };

  const commitTags = () => {
    const tags = [
      ...new Set(
        tagsText
          .split(",")
          .map((t) => t.trim().replace(/^#/, "").toLowerCase())
          .filter(Boolean),
      ),
    ];
    if (tags.join(",") !== task.tags.join(",")) {
      void updateTask(task.id, { tags });
    }
  };

  const dueDate = task.dueAt ? task.dueAt.slice(0, 10) : "";
  const dueTime =
    task.dueAt && task.hasDueTime && task.dueAt.length > 10
      ? task.dueAt.slice(11, 16)
      : "";

  const setDue = (date: string, time: string) => {
    if (!date) {
      void updateTask(task.id, { dueAt: null, hasDueTime: false });
    } else if (time) {
      void updateTask(task.id, {
        dueAt: `${date}T${time}:00`,
        hasDueTime: true,
      });
    } else {
      void updateTask(task.id, { dueAt: date, hasDueTime: false });
    }
  };

  const addSubtask = async () => {
    const t = newSubtask.trim();
    if (!t) return;
    setNewSubtask("");
    const r = await repo();
    await r.createSubtask(task.id, t);
    setSubtasks(await r.listSubtasks(task.id));
  };

  const fieldLabel =
    "text-[11px] font-semibold uppercase tracking-wider text-muted-foreground";
  const selectClass =
    "w-full rounded-md border border-border bg-background px-2 py-1.5 text-[13px] outline-none focus:ring-2 focus:ring-ring";

  return (
    <aside className="flex w-[300px] flex-shrink-0 flex-col overflow-y-auto border-l border-border bg-card">
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <TaskCheckbox
          task={task}
          onToggle={() => void toggleComplete(task.id)}
        />
        <span className="text-xs text-muted-foreground">
          {task.completedAt ? "Completed" : "Open"}
        </span>
        <button
          type="button"
          aria-label="Close detail panel"
          onClick={onClose}
          className="ml-auto rounded p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex flex-col gap-4 p-4">
        <textarea
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          onBlur={commitTitle}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              event.currentTarget.blur();
            }
          }}
          rows={2}
          className={cn(
            "w-full resize-none bg-transparent text-[15px] font-medium outline-none",
            task.completedAt && "text-muted-foreground line-through",
          )}
        />

        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1">
            <span className={fieldLabel}>Due date</span>
            <input
              type="date"
              value={dueDate}
              onChange={(event) => setDue(event.target.value, dueTime)}
              className={selectClass}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className={fieldLabel}>Time</span>
            <input
              type="time"
              value={dueTime}
              disabled={!dueDate}
              onChange={(event) => setDue(dueDate, event.target.value)}
              className={selectClass}
            />
          </label>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1">
            <span className={fieldLabel}>Priority</span>
            <select
              value={task.priority}
              onChange={(event) =>
                void updateTask(task.id, {
                  priority: Number(event.target.value) as Priority,
                })
              }
              className={selectClass}
            >
              {([0, 1, 2, 3] as Priority[]).map((p) => (
                <option key={p} value={p}>
                  {PRIORITY_LABELS[p]}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className={fieldLabel}>Status</span>
            <select
              value={task.statusId}
              onChange={(event) =>
                void updateTask(task.id, { statusId: event.target.value })
              }
              className={selectClass}
            >
              {statuses.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="flex flex-col gap-1">
          <span className={fieldLabel}>List</span>
          <select
            value={task.listId ?? ""}
            onChange={(event) =>
              void updateTask(task.id, {
                listId: event.target.value || null,
              })
            }
            className={selectClass}
          >
            <option value="">Inbox (no list)</option>
            {lists.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className={fieldLabel}>Tags</span>
          <input
            value={tagsText}
            onChange={(event) => setTagsText(event.target.value)}
            onBlur={commitTags}
            placeholder="work, errand"
            className={selectClass}
          />
        </label>

        <Separator />

        <div className="flex flex-col gap-1.5">
          <span className={fieldLabel}>Subtasks</span>
          {subtasks.map((subtask) => (
            <div key={subtask.id} className="group flex items-center gap-2">
              <input
                type="checkbox"
                checked={subtask.done}
                onChange={async (event) => {
                  const r = await repo();
                  await r.updateSubtask(subtask.id, {
                    done: event.target.checked,
                  });
                  setSubtasks(await r.listSubtasks(task.id));
                }}
                className="h-3.5 w-3.5 accent-[rgb(var(--brand-primary-strong))]"
              />
              <span
                className={cn(
                  "flex-1 text-[13px]",
                  subtask.done && "text-muted-foreground line-through",
                )}
              >
                {subtask.title}
              </span>
              <button
                type="button"
                aria-label="Delete subtask"
                onClick={async () => {
                  const r = await repo();
                  await r.deleteSubtask(subtask.id);
                  setSubtasks(await r.listSubtasks(task.id));
                }}
                className="invisible rounded p-0.5 text-muted-foreground hover:text-destructive group-hover:visible"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void addSubtask();
            }}
            className="flex items-center gap-2"
          >
            <Plus className="h-3.5 w-3.5 text-muted-foreground" />
            <input
              value={newSubtask}
              onChange={(event) => setNewSubtask(event.target.value)}
              placeholder="Add subtask"
              className="flex-1 bg-transparent py-1 text-[13px] outline-none placeholder:text-muted-foreground"
            />
          </form>
        </div>

        <label className="flex flex-col gap-1">
          <span className={fieldLabel}>Notes</span>
          <textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            onBlur={commitNotes}
            rows={5}
            placeholder="Notes…"
            className={cn(selectClass, "resize-y")}
          />
        </label>

        <Button
          variant="destructiveOutline"
          size="sm"
          onClick={() => {
            void deleteTask(task.id);
            onClose();
          }}
        >
          <Trash2 className="h-3.5 w-3.5" /> Delete task
        </Button>
      </div>
    </aside>
  );
}
