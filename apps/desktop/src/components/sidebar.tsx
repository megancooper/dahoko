import { useState } from "react";
import {
  CalendarDays,
  Check,
  CheckCircle2,
  Hash,
  Inbox,
  MoreHorizontal,
  Pencil,
  Plus,
  Repeat,
  Settings,
  Sun,
  Trash2,
} from "lucide-react";
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  ThemeToggle,
  cn,
} from "@dahoko/ui";
import { LIST_COLORS, useStore } from "@/state/store";
import { toggleTagFilter, type Filter } from "@/state/filters";
import { SettingsDialog } from "@/components/settings-dialog";
import { WorkspaceSwitcher } from "@/components/workspace-switcher";

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
  trailing,
}: {
  active: boolean;
  onClick: () => void;
  icon?: React.ReactNode;
  label: string;
  count?: number;
  trailing?: React.ReactNode;
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
      {trailing ??
        (count !== undefined && count > 0 ? (
          <span className="ml-auto font-mono text-[11px] text-muted-foreground">
            {count}
          </span>
        ) : null)}
    </button>
  );
}

export function Sidebar({ filter, onFilterChange }: SidebarProps) {
  const { tasks, lists, tags, addList, updateList, deleteList } = useStore();
  const [addingList, setAddingList] = useState(false);
  const [newListName, setNewListName] = useState("");
  const [editingListId, setEditingListId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);

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

  const submitRename = async () => {
    const id = editingListId;
    const name = editingName.trim();
    setEditingListId(null);
    setEditingName("");
    if (id && name) await updateList(id, { name });
  };

  const handleDeleteList = async (id: string) => {
    await deleteList(id);
    if (filter.kind === "list" && filter.listId === id) {
      onFilterChange({ kind: "inbox" });
    }
  };

  const iconClass = "h-4 w-4 flex-shrink-0";

  return (
    <aside className="flex w-[232px] flex-shrink-0 flex-col border-r border-border bg-muted/50 p-3">
      <div className="mb-3">
        <WorkspaceSwitcher
          onWorkspaceChange={() => onFilterChange({ kind: "inbox" })}
        />
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
          active={filter.kind === "recurring"}
          onClick={() => onFilterChange({ kind: "recurring" })}
          icon={<Repeat className={iconClass} />}
          label="Recurring"
          count={tasks.filter((t) => t.recurrence && !t.completedAt).length}
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
          {lists.map((list) =>
            editingListId === list.id ? (
              <form
                key={list.id}
                onSubmit={(event) => {
                  event.preventDefault();
                  void submitRename();
                }}
                className="px-1"
              >
                <input
                  autoFocus
                  value={editingName}
                  onChange={(event) => setEditingName(event.target.value)}
                  onBlur={() => void submitRename()}
                  onKeyDown={(event) => {
                    event.stopPropagation();
                    if (event.key === "Enter") {
                      event.preventDefault();
                      void submitRename();
                    }
                    if (event.key === "Escape") {
                      setEditingListId(null);
                      setEditingName("");
                    }
                  }}
                  className="w-full rounded-md border border-border bg-background px-2 py-1 text-[13px] outline-none focus:ring-2 focus:ring-ring"
                />
              </form>
            ) : (
              <div key={list.id} className="group/list relative">
                <NavItem
                  active={filter.kind === "list" && filter.listId === list.id}
                  onClick={() =>
                    onFilterChange({ kind: "list", listId: list.id })
                  }
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
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      aria-label={`List options for ${list.name}`}
                      className="invisible absolute right-1.5 top-1/2 -translate-y-1/2 rounded bg-secondary p-1 text-muted-foreground hover:text-foreground group-hover/list:visible data-[state=open]:visible"
                    >
                      <MoreHorizontal className="h-3.5 w-3.5" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="start"
                    className="w-44"
                    onCloseAutoFocus={(event) => {
                      // Entering rename mode: keep focus on the new input
                      // instead of returning it to the menu trigger.
                      if (editingListId) event.preventDefault();
                    }}
                  >
                    <DropdownMenuItem
                      onSelect={() => {
                        setEditingListId(list.id);
                        setEditingName(list.name);
                      }}
                    >
                      <Pencil className="mr-2 h-3.5 w-3.5" /> Rename
                    </DropdownMenuItem>
                    <div className="flex flex-wrap items-center gap-1.5 px-2 py-1.5">
                      {LIST_COLORS.map((color) => (
                        <button
                          key={color}
                          type="button"
                          aria-label={`Set color ${color}`}
                          onClick={() => void updateList(list.id, { color })}
                          style={{ backgroundColor: color }}
                          className={cn(
                            "h-4 w-4 rounded-full transition-transform hover:scale-110",
                            list.color === color &&
                              "ring-2 ring-ring ring-offset-1 ring-offset-popover",
                          )}
                        />
                      ))}
                    </div>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive"
                      onSelect={() => void handleDeleteList(list.id)}
                    >
                      <Trash2 className="mr-2 h-3.5 w-3.5" /> Delete list
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ),
          )}
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
                  if (event.key === "Enter") {
                    event.preventDefault();
                    void submitNewList();
                  }
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
            {tags.map((tag) => {
              const selected =
                filter.kind === "tag" && filter.tags.includes(tag);
              return (
                <NavItem
                  key={tag}
                  active={selected}
                  onClick={() => onFilterChange(toggleTagFilter(filter, tag))}
                  icon={<Hash className="h-3.5 w-3.5 flex-shrink-0" />}
                  label={tag}
                  trailing={
                    selected ? (
                      <Check className="ml-auto h-3.5 w-3.5 flex-shrink-0 text-primary-strong" />
                    ) : undefined
                  }
                />
              );
            })}
          </div>
        </div>
      ) : null}

      <div className="mt-auto flex items-center justify-between pt-3">
        <Button
          variant="ghost"
          size="sm"
          className="text-muted-foreground"
          onClick={() => setSettingsOpen(true)}
        >
          <Settings className="h-3.5 w-3.5" /> Settings
        </Button>
        <ThemeToggle />
      </div>

      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
    </aside>
  );
}
