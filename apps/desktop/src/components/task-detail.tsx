import { useEffect, useState, type ReactNode } from "react";
import {
  CalendarDays,
  ChevronDown,
  CircleDot,
  Clock,
  FileText,
  Flag,
  FolderOpen,
  ListChecks,
  Plus,
  Repeat,
  Tag,
  Trash2,
} from "lucide-react";
import type { Priority, Recurrence, Task } from "@dahoko/core";
import { PRIORITY_LABELS, RECURRENCE_LABELS } from "@dahoko/core";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Separator,
  cn,
} from "@dahoko/ui";
import { useStore } from "@/state/store";
import { TaskCheckbox } from "./task-checkbox";

/** Sentinel for "no list" — Radix Select items can't use an empty value. */
const NO_LIST = "none";
/** Sentinel for "no recurrence" for the same reason. */
const NO_REPEAT = "never";

function Field({
  icon,
  label,
  children,
}: {
  icon: ReactNode;
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {icon}
        {label}
      </span>
      {children}
    </div>
  );
}

export function TaskDetail({
  task,
  onClose,
}: {
  task: Task;
  onClose: () => void;
}) {
  const {
    updateTask,
    deleteTask,
    toggleComplete,
    lists,
    statuses,
    tags: allTags,
    subtasks: allSubtasks,
    addSubtask: storeAddSubtask,
    updateSubtask,
    deleteSubtask,
  } = useStore();
  const [title, setTitle] = useState(task.title);
  const [notes, setNotes] = useState(task.notes);
  const [newTag, setNewTag] = useState("");
  const [newSubtask, setNewSubtask] = useState("");

  const subtasks = allSubtasks.filter((s) => s.taskId === task.id);

  useEffect(() => {
    setTitle(task.title);
    setNotes(task.notes);
  }, [task.id, task.title, task.notes]);

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

  const toggleTag = (tag: string) => {
    const tags = task.tags.includes(tag)
      ? task.tags.filter((t) => t !== tag)
      : [...task.tags, tag];
    void updateTask(task.id, { tags });
  };

  const addNewTag = () => {
    const tag = newTag.trim().replace(/^#/, "").toLowerCase();
    setNewTag("");
    if (!tag || task.tags.includes(tag)) return;
    void updateTask(task.id, { tags: [...task.tags, tag] });
  };

  // Existing tags across the app plus this task's own, so nothing vanishes
  // from the menu while unchecked.
  const tagOptions = [...new Set([...allTags, ...task.tags])].sort();

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
    await storeAddSubtask(task.id, t);
  };

  const sectionLabel =
    "flex items-center gap-2 text-[12.5px] font-medium text-muted-foreground";
  const inputClass =
    "h-8 w-full rounded-md border border-border bg-background px-2.5 text-[13px] shadow-soft outline-none focus:ring-2 focus:ring-ring";
  const fieldIcon = "h-3.5 w-3.5 flex-shrink-0";

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="max-h-[calc(100dvh-4rem)] max-w-[640px] grid-rows-[auto_minmax(0,1fr)] gap-0 overflow-hidden p-0">
        <div className="flex items-center gap-3 border-b border-border px-5 py-3.5 pr-12">
          <TaskCheckbox
            task={task}
            onToggle={() => void toggleComplete(task.id)}
          />
          <div className="min-w-0">
            <DialogTitle className="text-[14px] leading-tight">
              Task details
            </DialogTitle>
            <DialogDescription className="text-[11.5px] leading-snug">
              {task.completedAt ? "Completed" : "Open"}
            </DialogDescription>
          </div>
        </div>

        <div className="min-h-0 overflow-y-auto">
          <div className="flex flex-col gap-4 p-5">
            <textarea
              aria-label="Task title"
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

            <div className="flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-x-3">
                <div className="flex flex-col gap-2.5">
                  <Field
                    icon={<CalendarDays className={fieldIcon} />}
                    label="Due date"
                  >
                    <input
                      type="date"
                      value={dueDate}
                      onChange={(event) => setDue(event.target.value, dueTime)}
                      className={inputClass}
                    />
                  </Field>

                  <Field icon={<Clock className={fieldIcon} />} label="Time">
                    <input
                      type="time"
                      value={dueTime}
                      disabled={!dueDate}
                      onChange={(event) => setDue(dueDate, event.target.value)}
                      className={cn(inputClass, "disabled:opacity-50")}
                    />
                  </Field>

                  <Field icon={<Repeat className={fieldIcon} />} label="Repeat">
                    <Select
                      value={task.recurrence ?? NO_REPEAT}
                      onValueChange={(value) =>
                        void updateTask(task.id, {
                          recurrence:
                            value === NO_REPEAT ? null : (value as Recurrence),
                        })
                      }
                    >
                      <SelectTrigger aria-label="Repeat">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NO_REPEAT}>Never</SelectItem>
                        {(
                          Object.entries(RECURRENCE_LABELS) as [
                            Recurrence,
                            string,
                          ][]
                        ).map(([value, label]) => (
                          <SelectItem key={value} value={value}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                </div>

                <div className="flex flex-col gap-2.5">
                  <Field icon={<Flag className={fieldIcon} />} label="Priority">
                    <Select
                      value={String(task.priority)}
                      onValueChange={(value) =>
                        void updateTask(task.id, {
                          priority: Number(value) as Priority,
                        })
                      }
                    >
                      <SelectTrigger aria-label="Priority">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {([0, 1, 2, 3] as Priority[]).map((p) => (
                          <SelectItem key={p} value={String(p)}>
                            {PRIORITY_LABELS[p]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>

                  <Field
                    icon={<CircleDot className={fieldIcon} />}
                    label="Status"
                  >
                    <Select
                      value={task.statusId}
                      onValueChange={(value) =>
                        void updateTask(task.id, { statusId: value })
                      }
                    >
                      <SelectTrigger aria-label="Status">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {statuses.map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            <span className="flex items-center gap-2">
                              <span
                                className="h-2 w-2 rounded-full"
                                style={{ backgroundColor: s.color }}
                              />
                              {s.name}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                </div>
              </div>

              <Field icon={<FolderOpen className={fieldIcon} />} label="List">
                <Select
                  value={task.listId ?? NO_LIST}
                  onValueChange={(value) =>
                    void updateTask(task.id, {
                      listId: value === NO_LIST ? null : value,
                    })
                  }
                >
                  <SelectTrigger aria-label="List">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_LIST}>Inbox (no list)</SelectItem>
                    {lists.map((l) => (
                      <SelectItem key={l.id} value={l.id}>
                        <span className="flex items-center gap-2">
                          <span
                            className="h-2 w-2 rounded-full"
                            style={{ backgroundColor: l.color }}
                          />
                          {l.name}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              <Field icon={<Tag className={fieldIcon} />} label="Tags">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      aria-label="Tags"
                      className={cn(
                        inputClass,
                        "flex items-center justify-between gap-2 text-left",
                        task.tags.length === 0 && "text-muted-foreground",
                      )}
                    >
                      <span className="truncate">
                        {task.tags.length > 0
                          ? task.tags.map((t) => `#${t}`).join(", ")
                          : "Add tags…"}
                      </span>
                      <ChevronDown className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="end"
                    className="max-h-72 w-[var(--radix-dropdown-menu-trigger-width)] overflow-y-auto"
                  >
                    {tagOptions.length === 0 ? (
                      <div className="px-2 py-1.5 text-[12px] text-muted-foreground">
                        No tags yet
                      </div>
                    ) : (
                      tagOptions.map((tag) => (
                        <DropdownMenuCheckboxItem
                          key={tag}
                          checked={task.tags.includes(tag)}
                          onCheckedChange={() => toggleTag(tag)}
                          onSelect={(event) => event.preventDefault()}
                          className="text-[13px]"
                        >
                          #{tag}
                        </DropdownMenuCheckboxItem>
                      ))
                    )}
                    <DropdownMenuSeparator />
                    <div className="flex items-center gap-1.5 px-2 py-1">
                      <Plus className="h-3 w-3 flex-shrink-0 text-muted-foreground" />
                      <input
                        value={newTag}
                        onChange={(event) => setNewTag(event.target.value)}
                        onKeyDown={(event) => {
                          event.stopPropagation();
                          if (event.key === "Enter") {
                            event.preventDefault();
                            addNewTag();
                          }
                        }}
                        placeholder="New tag"
                        className="w-full bg-transparent text-[13px] outline-none placeholder:text-muted-foreground"
                      />
                    </div>
                  </DropdownMenuContent>
                </DropdownMenu>
              </Field>
            </div>

            <Separator />

            <div className="flex flex-col gap-1.5">
              <span className={sectionLabel}>
                <ListChecks className={fieldIcon} />
                Subtasks
              </span>
              {subtasks.map((subtask) => (
                <div
                  key={subtask.id}
                  className="group flex animate-fade-in-up items-center gap-2 rounded-md px-1 py-0.5 transition-colors hover:bg-muted/60"
                >
                  <input
                    type="checkbox"
                    checked={subtask.done}
                    onChange={(event) =>
                      void updateSubtask(subtask.id, {
                        done: event.target.checked,
                      })
                    }
                    className="h-3.5 w-3.5 accent-[rgb(var(--brand-primary-strong))]"
                  />
                  <span className="min-w-0 flex-1 text-[13px]">
                    <span
                      data-done={subtask.done}
                      className={cn(
                        "task-strike",
                        subtask.done && "text-muted-foreground",
                      )}
                    >
                      {subtask.title}
                    </span>
                  </span>
                  <button
                    type="button"
                    aria-label="Delete subtask"
                    onClick={() => void deleteSubtask(subtask.id)}
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
                className="mt-0.5 flex items-center gap-2 rounded-md border border-dashed border-border px-2 py-1 transition-colors focus-within:border-solid focus-within:ring-2 focus-within:ring-ring"
              >
                <Plus className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
                <input
                  value={newSubtask}
                  onChange={(event) => setNewSubtask(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      void addSubtask();
                    }
                    event.stopPropagation();
                  }}
                  placeholder="Add subtask"
                  className="flex-1 bg-transparent py-0.5 text-[13px] outline-none placeholder:text-muted-foreground"
                />
              </form>
            </div>

            <div className="flex flex-col gap-1.5">
              <span className={sectionLabel}>
                <FileText className={fieldIcon} />
                Notes
              </span>
              <textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                onBlur={commitNotes}
                rows={5}
                placeholder="Notes…"
                className={cn(
                  inputClass,
                  "h-auto resize-y py-2 leading-relaxed",
                )}
              />
            </div>

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
        </div>
      </DialogContent>
    </Dialog>
  );
}
