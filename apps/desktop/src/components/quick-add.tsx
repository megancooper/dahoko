import { forwardRef, useState } from "react";
import { Plus } from "lucide-react";
import { parseQuickAdd } from "@dahoko/core";
import { useStore } from "@/state/store";
import type { Filter } from "@/state/filters";

/**
 * One-line task entry with quick-add syntax:
 * "Buy milk tomorrow at 15:00 #errand !p2"
 */
export const QuickAdd = forwardRef<HTMLInputElement, { filter: Filter }>(
  function QuickAdd({ filter }, ref) {
    const { addTask } = useStore();
    const [value, setValue] = useState("");

    const submit = async () => {
      const parsed = parseQuickAdd(value);
      if (!parsed.title) return;
      const dueAt = parsed.dueDate
        ? parsed.dueTime
          ? `${parsed.dueDate}T${parsed.dueTime}:00`
          : parsed.dueDate
        : filter.kind === "today"
          ? new Date().toISOString().slice(0, 10)
          : null;
      await addTask({
        title: parsed.title,
        tags: parsed.tags,
        priority: parsed.priority,
        dueAt,
        hasDueTime: parsed.dueTime !== null,
        recurrence: parsed.recurrence,
        listId: filter.kind === "list" ? filter.listId : null,
      });
      setValue("");
    };

    return (
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
        className="mx-5 mb-1 mt-4 flex items-center gap-2.5 rounded-lg border border-border bg-card px-3.5 py-2.5 shadow-soft focus-within:ring-2 focus-within:ring-ring"
      >
        <Plus className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
        <input
          ref={ref}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              void submit();
            }
          }}
          placeholder='Quick add… try "Buy milk tomorrow #errand !p2"'
          className="w-full bg-transparent text-[13.5px] outline-none placeholder:text-muted-foreground"
        />
        <kbd className="hidden flex-shrink-0 rounded border border-border px-1.5 py-0.5 font-mono text-[10.5px] text-muted-foreground sm:block">
          ⌘N
        </kbd>
      </form>
    );
  },
);
