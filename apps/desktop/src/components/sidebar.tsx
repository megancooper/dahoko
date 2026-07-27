import { useState } from "react";
import {
  CalendarDays,
  Check,
  CheckCircle2,
  Inbox,
  Plus,
  Sun,
} from "lucide-react";
import { Button, ThemeToggle, cn } from "@dahoko/ui";
import { useStore } from "@/state/store";
import type { Filter } from "@/state/filters";

interface SidebarProps {
  filter: Filter;
  onFilterChange: (filter: Filter) => void;
}

function NavItem({
  active,
  onClick,
  icon,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  icon?: React.ReactNode;
  label: string;
  count?: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2.5 rounded-md border border-transparent px-2.5 py-1.5 text-left text-[13.5px] text-muted-foreground transition-colors hover:bg-secondary",
        active &&
          "border-primary/50 bg-primary/25 font-medium text-foreground",
      )}
    >
      {icon}
      <span className="truncate">{label}</span>
      {count !== undefined && count > 0 ? (
        <span className="ml-auto font-mono text-[11px] text-muted-foreground">
          {count}
        </span>
      ) : null}
    </button>
  );
}

export function Sidebar({ filter, onFilterChange }: SidebarProps) {
  const { tasks, lists, tags, addList } = useStore();
  const [addingList, setAddingList] = useState(false);
  const [newListName, setNewListName] = useState("");

  const open = tasks.filter((t) => !t.completedAt);
  const today = new Date();
  const iso = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const todayIso = iso(today);
  const week = new Date(today);
  week.setDate(week.getDate() + 7);
  const weekIso = iso(week);

  const counts = {
    inbox: open.length,
    today: open.filter((t) => t.dueAt && t.dueAt.slice(0, 10) <= todayIso)
      .length,
    next7: open.filter((t) => t.dueAt && t.dueAt.slice(0, 10) <= weekIso)
      .length,
  };

  const submitNewList = async () => {
    const name = newListName.trim();
    setAddingList(false);
    setNewListName("");
    if (name) await addList(name);
  };

  const iconClass = "h-4 w-4 flex-shrink-0";

  return (
    <aside className="flex w-[232px] flex-shrink-0 flex-col border-r border-border bg-muted/50 p-3">
      <div className="flex items-center gap-2 px-2 pb-4 pt-1">
        <span className="grid h-[22px] w-[22px] place-items-center rounded-[7px] border border-primary-strong/30 bg-primary text-[12px] text-primary-foreground">
          <Check className="h-3.5 w-3.5" strokeWidth={3} />
        </span>
        <span className="font-brand text-[15px] font-semibold tracking-tight">
          dahoko
        </span>
      </div>

      <nav className="space-y-0.5">
        <NavItem
          active={filter.kind === "inbox"}
          onClick={() => onFilterChange({ kind: "inbox" })}
          icon={<Inbox className={iconClass} />}
          label="Inbox"
          count={counts.inbox}
        />
        <NavItem
          active={filter.kind === "today"}
          onClick={() => onFilterChange({ kind: "today" })}
          icon={<Sun className={iconClass} />}
          label="Today"
          count={counts.today}
        />
        <NavItem
          active={filter.kind === "next7"}
          onClick={() => onFilterChange({ kind: "next7" })}
          icon={<CalendarDays className={iconClass} />}
          label="Next 7 days"
          count={counts.next7}
        />
        <NavItem
          active={filter.kind === "completed"}
          onClick={() => onFilterChange({ kind: "completed" })}
          icon={<CheckCircle2 className={iconClass} />}
          label="Completed"
        />
      </nav>

      <div className="mt-5">
        <div className="flex items-center justify-between px-2.5 pb-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Lists
          </span>
          <button
            type="button"
            aria-label="New list"
            onClick={() => setAddingList(true)}
            className="rounded p-0.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>
        <div className="space-y-0.5">
          {lists.map((list) => (
            <NavItem
              key={list.id}
              active={filter.kind === "list" && filter.listId === list.id}
              onClick={() => onFilterChange({ kind: "list", listId: list.id })}
              icon={
                <span
                  className="h-2 w-2 flex-shrink-0 rounded-full"
                  style={{ backgroundColor: list.color }}
                />
              }
              label={list.name}
              count={
                tasks.filter((t) => t.listId === list.id && !t.completedAt)
                  .length
              }
            />
          ))}
          {addingList ? (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void submitNewList();
              }}
              className="px-1 pt-1"
            >
              <input
                autoFocus
                value={newListName}
                onChange={(event) => setNewListName(event.target.value)}
                onBlur={() => void submitNewList()}
                onKeyDown={(event) => {
                  if (event.key === "Escape") {
                    setAddingList(false);
                    setNewListName("");
                  }
                }}
                placeholder="List name"
                className="w-full rounded-md border border-border bg-background px-2 py-1 text-[13px] outline-none focus:ring-2 focus:ring-ring"
              />
            </form>
          ) : null}
        </div>
      </div>

      {tags.length > 0 ? (
        <div className="mt-5">
          <div className="px-2.5 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Tags
          </div>
          <div className="space-y-0.5">
            {tags.map((tag) => (
              <NavItem
                key={tag}
                active={filter.kind === "tag" && filter.tag === tag}
                onClick={() => onFilterChange({ kind: "tag", tag })}
                label={`# ${tag}`}
              />
            ))}
          </div>
        </div>
      ) : null}

      <div className="mt-auto flex items-center justify-between pt-3">
        <Button variant="ghost" size="sm" className="text-muted-foreground">
          Settings
        </Button>
        <ThemeToggle />
      </div>
    </aside>
  );
}
