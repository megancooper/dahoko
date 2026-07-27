import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { Button, SegmentedControl } from "@dahoko/ui";
import { useStore } from "@/state/store";
import { useSettings } from "@/state/settings";
import { applyFilter, filterTitle, type Filter } from "@/state/filters";
import { Sidebar } from "@/components/sidebar";
import { QuickAdd } from "@/components/quick-add";
import { ListView } from "@/components/views/list-view";
import { BoardView } from "@/components/views/board-view";
import { TagView } from "@/components/views/tag-view";
import { TaskDetail } from "@/components/task-detail";
import { RecurringMetrics } from "@/components/recurring-metrics";

export const Route = createFileRoute("/")({
  component: HomePage,
});

type ViewMode = "list" | "board" | "tags";

function HomePage() {
  const { ready, tasks, lists } = useStore();
  const { settings } = useSettings();
  const [filter, setFilter] = useState<Filter>({ kind: "inbox" });
  const [view, setView] = useState<ViewMode>(settings.defaultView);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const quickAddRef = useRef<HTMLInputElement>(null);

  const visibleTasks = useMemo(() => {
    const filtered = applyFilter(tasks, filter);
    if (filter.kind === "inbox" && !settings.showCompletedInInbox) {
      return filtered.filter((t) => !t.completedAt);
    }
    return filtered;
  }, [tasks, filter, settings.showCompletedInInbox]);
  const selectedTask = tasks.find((t) => t.id === selectedId) ?? null;

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === "n") {
        event.preventDefault();
        quickAddRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  if (!ready) {
    return (
      <div className="flex h-dvh items-center justify-center text-sm text-muted-foreground">
        Loading dahoko…
      </div>
    );
  }

  return (
    <div className="flex h-full">
      <Sidebar
        filter={filter}
        onFilterChange={(next) => {
          setFilter(next);
          setSelectedId(null);
        }}
      />

      <main className="relative flex min-w-0 flex-1 flex-col overflow-x-hidden">
        <header className="flex items-center gap-3 border-b border-border px-5 py-2.5">
          <h1 className="text-[15px] font-semibold tracking-tight">
            {filterTitle(filter, (id) => lists.find((l) => l.id === id)?.name)}
          </h1>
          <div className="ml-auto flex items-center gap-3">
            <SegmentedControl<ViewMode>
              aria-label="View mode"
              value={view}
              onValueChange={setView}
              size="sm"
              className="w-auto"
              options={[
                { value: "list", label: "List" },
                { value: "board", label: "Swimlanes" },
                {
                  value: "tags",
                  label: <span className="whitespace-nowrap">By tag</span>,
                },
              ]}
            />
            <Button size="sm" onClick={() => quickAddRef.current?.focus()}>
              <Plus className="h-4 w-4" /> New task
            </Button>
          </div>
        </header>

        <QuickAdd ref={quickAddRef} filter={filter} />

        <div className="min-h-0 flex-1 overflow-auto px-2">
          {filter.kind === "recurring" ? <RecurringMetrics /> : null}
          {view === "list" ? (
            <ListView
              tasks={visibleTasks}
              selectedId={selectedId}
              onSelect={setSelectedId}
            />
          ) : view === "board" ? (
            <BoardView
              tasks={visibleTasks}
              selectedId={selectedId}
              onSelect={setSelectedId}
            />
          ) : (
            <TagView
              tasks={visibleTasks}
              selectedId={selectedId}
              onSelect={setSelectedId}
            />
          )}
        </div>

        {selectedTask ? (
          <TaskDetail
            task={selectedTask}
            onClose={() => setSelectedId(null)}
          />
        ) : null}
      </main>
    </div>
  );
}
