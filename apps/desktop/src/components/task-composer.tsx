import { useMemo, useRef, useState, type ReactNode } from "react";
import {
  CalendarDays,
  ChevronDown,
  Clock,
  FileText,
  Flag,
  FolderOpen,
  Plus,
  Repeat,
  Sparkles,
  Tag,
} from "lucide-react";
import type { Priority, Recurrence } from "@dahoko/core";
import {
  parseQuickAdd,
  PRIORITY_LABELS,
  RECURRENCE_LABELS,
} from "@dahoko/core";
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
  cn,
} from "@dahoko/ui";
import { useStore } from "@/state/store";
import type { Filter } from "@/state/filters";
import { ParsedTokenChips } from "./parsed-token-chips";

/** Radix Select items can't use an empty value. */
const NO_LIST = "none";
const NO_REPEAT = "never";
/** Sentinel meaning "follow whatever the quick-add syntax parsed". */
const AUTO = Symbol("auto");

type Auto<T> = T | typeof AUTO;

function fromAuto<T>(value: Auto<T>, parsed: T): T {
  return value === AUTO ? parsed : (value as T);
}

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

/**
 * Full task composer behind the "New task" button. The title input accepts
 * the same quick-add syntax as the inline bar and previews recognized
 * tokens live; the explicit fields below start in "auto" mode (following
 * the parsed syntax) and switch to manual once touched, so power users can
 * type everything while everyone else gets ordinary form controls.
 */
export function TaskComposer({
  open,
  filter,
  onOpenChange,
}: {
  open: boolean;
  filter: Filter;
  onOpenChange: (open: boolean) => void;
}) {
  const { addTask, lists, tags: allTags } = useStore();
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [newTag, setNewTag] = useState("");
  const [manualTags, setManualTags] = useState<string[]>([]);
  const [removedTags, setRemovedTags] = useState<string[]>([]);
  const [dueDate, setDueDate] = useState<Auto<string | null>>(AUTO);
  const [dueTime, setDueTime] = useState<Auto<string | null>>(AUTO);
  const [priority, setPriority] = useState<Auto<Priority>>(AUTO);
  const [recurrence, setRecurrence] = useState<Auto<Recurrence | null>>(AUTO);
  const [listId, setListId] = useState<string | null>(
    filter.kind === "list" ? filter.listId : null,
  );
  const [justAdded, setJustAdded] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);
  const addedTimerRef = useRef<number | null>(null);

  const parsed = useMemo(() => parseQuickAdd(title), [title]);

  const effectiveDate = fromAuto(dueDate, parsed.dueDate);
  const effectiveTime = fromAuto(dueTime, parsed.dueTime);
  const effectivePriority = fromAuto(priority, parsed.priority);
  const effectiveRecurrence = fromAuto(recurrence, parsed.recurrence);
  const effectiveTags = useMemo(
    () =>
      [...new Set([...parsed.tags, ...manualTags])].filter(
        (tag) => !removedTags.includes(tag),
      ),
    [parsed.tags, manualTags, removedTags],
  );
  const tagOptions = [...new Set([...allTags, ...effectiveTags])].sort();
  const canSubmit = parsed.title.length > 0;

  const reset = () => {
    setTitle("");
    setNotes("");
    setNewTag("");
    setManualTags([]);
    setRemovedTags([]);
    setDueDate(AUTO);
    setDueTime(AUTO);
    setPriority(AUTO);
    setRecurrence(AUTO);
    setListId(filter.kind === "list" ? filter.listId : null);
  };

  const close = (next: boolean) => {
    if (!next) reset();
    onOpenChange(next);
  };

  const submit = async (keepOpen: boolean) => {
    if (!canSubmit) return;
    const dueAt = effectiveDate
      ? effectiveTime
        ? `${effectiveDate}T${effectiveTime}:00`
        : effectiveDate
      : filter.kind === "today"
        ? new Date().toISOString().slice(0, 10)
        : null;
    await addTask({
      title: parsed.title,
      notes,
      tags: effectiveTags,
      priority: effectivePriority,
      dueAt,
      hasDueTime: effectiveDate !== null && effectiveTime !== null,
      recurrence: effectiveRecurrence,
      listId,
    });
    if (keepOpen) {
      reset();
      titleRef.current?.focus();
      setJustAdded(true);
      if (addedTimerRef.current) window.clearTimeout(addedTimerRef.current);
      addedTimerRef.current = window.setTimeout(
        () => setJustAdded(false),
        1_600,
      );
    } else {
      close(false);
    }
  };

  const toggleTag = (tag: string) => {
    if (effectiveTags.includes(tag)) {
      setManualTags((current) => current.filter((t) => t !== tag));
      setRemovedTags((current) =>
        current.includes(tag) ? current : [...current, tag],
      );
    } else {
      setRemovedTags((current) => current.filter((t) => t !== tag));
      setManualTags((current) =>
        current.includes(tag) ? current : [...current, tag],
      );
    }
  };

  const addNewTag = () => {
    const tag = newTag.trim().replace(/^#/, "").toLowerCase();
    setNewTag("");
    if (!tag || effectiveTags.includes(tag)) return;
    setRemovedTags((current) => current.filter((t) => t !== tag));
    setManualTags((current) => [...current, tag]);
  };

  const inputClass =
    "h-8 w-full rounded-md border border-border bg-background px-2.5 text-[13px] shadow-soft outline-none focus:ring-2 focus:ring-ring";
  const fieldIcon = "h-3.5 w-3.5 flex-shrink-0";

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent
        className="max-h-[calc(100dvh-4rem)] max-w-[560px] grid-rows-[minmax(0,1fr)] gap-0 overflow-hidden p-0"
        onKeyDown={(event) => {
          if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
            event.preventDefault();
            void submit(true);
          }
        }}
      >
        <div className="min-h-0 overflow-y-auto">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void submit(false);
            }}
            className="flex flex-col"
          >
            <div className="flex flex-col gap-2.5 px-5 pb-4 pt-5">
              <DialogTitle className="sr-only">New task</DialogTitle>
              <DialogDescription className="sr-only">
                Create a task. The name accepts quick-add syntax for dates,
                #tags, and !priority.
              </DialogDescription>
              <input
                ref={titleRef}
                autoFocus
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    void submit(false);
                  }
                }}
                placeholder="Task name"
                aria-label="Task name"
                className="w-full bg-transparent text-[17px] font-medium leading-snug outline-none placeholder:text-muted-foreground/70"
              />
              <ParsedTokenChips parsed={parsed} />
              <p className="flex items-center gap-1.5 text-[11.5px] text-muted-foreground/80">
                <Sparkles className="h-3 w-3 flex-shrink-0" />
                Type naturally — “pay rent tomorrow 9:00 #home !high every
                month” fills the fields below.
              </p>
            </div>

            <div className="flex flex-col gap-3 border-t border-border bg-muted/25 px-5 py-4">
              <div className="grid grid-cols-2 gap-x-3 gap-y-2.5">
                <Field
                  icon={<CalendarDays className={fieldIcon} />}
                  label="Due date"
                >
                  <input
                    type="date"
                    value={effectiveDate ?? ""}
                    onChange={(event) => {
                      setDueDate(event.target.value || null);
                      if (!event.target.value) setDueTime(null);
                    }}
                    className={inputClass}
                  />
                </Field>

                <Field icon={<Clock className={fieldIcon} />} label="Time">
                  <input
                    type="time"
                    value={effectiveTime ?? ""}
                    disabled={!effectiveDate}
                    onChange={(event) =>
                      setDueTime(event.target.value || null)
                    }
                    className={cn(inputClass, "disabled:opacity-50")}
                  />
                </Field>

                <Field icon={<Flag className={fieldIcon} />} label="Priority">
                  <Select
                    value={String(effectivePriority)}
                    onValueChange={(value) =>
                      setPriority(Number(value) as Priority)
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

                <Field icon={<Repeat className={fieldIcon} />} label="Repeat">
                  <Select
                    value={effectiveRecurrence ?? NO_REPEAT}
                    onValueChange={(value) =>
                      setRecurrence(
                        value === NO_REPEAT ? null : (value as Recurrence),
                      )
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

                <Field
                  icon={<FolderOpen className={fieldIcon} />}
                  label="List"
                >
                  <Select
                    value={listId ?? NO_LIST}
                    onValueChange={(value) =>
                      setListId(value === NO_LIST ? null : value)
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
                          effectiveTags.length === 0 &&
                            "text-muted-foreground",
                        )}
                      >
                        <span className="truncate">
                          {effectiveTags.length > 0
                            ? effectiveTags.map((t) => `#${t}`).join(", ")
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
                            checked={effectiveTags.includes(tag)}
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

              <Field icon={<FileText className={fieldIcon} />} label="Notes">
                <textarea
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  rows={2}
                  placeholder="Notes…"
                  className={cn(
                    inputClass,
                    "h-auto resize-y py-2 leading-relaxed",
                  )}
                />
              </Field>
            </div>

            <div className="flex items-center gap-3 border-t border-border px-5 py-3.5">
              <span
                aria-live="polite"
                className={cn(
                  "text-[11.5px] text-success transition-opacity duration-300",
                  justAdded ? "opacity-100" : "opacity-0",
                )}
              >
                Task added
              </span>
              <span className="ml-auto hidden text-[11px] text-muted-foreground sm:block">
                <kbd className="rounded border border-border px-1.5 py-0.5 font-mono text-[10px]">
                  ⌘⏎
                </kbd>{" "}
                add &amp; keep writing
              </span>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => close(false)}
              >
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={!canSubmit}>
                <Plus className="h-4 w-4" /> Add task
              </Button>
            </div>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
