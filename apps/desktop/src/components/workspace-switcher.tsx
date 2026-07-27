import { useState } from "react";
import { Check, ChevronsUpDown, Plus } from "lucide-react";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Input,
  cn,
} from "@dahoko/ui";
import { useStore } from "@/state/store";

function workspaceInitial(name: string): string {
  return Array.from(name.trim())[0]?.toLocaleUpperCase() ?? "W";
}

function WorkspaceMark({
  name,
  color,
  className,
}: {
  name: string;
  color: string;
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "grid flex-shrink-0 place-items-center rounded-md border border-black/10 text-[11px] font-semibold text-slate-900 shadow-sm",
        className,
      )}
      style={{ backgroundColor: color }}
    >
      {workspaceInitial(name)}
    </span>
  );
}

export function WorkspaceSwitcher({
  onWorkspaceChange,
}: {
  onWorkspaceChange: () => void;
}) {
  const {
    workspaces,
    activeWorkspace,
    switchWorkspace,
    addWorkspace,
  } = useStore();
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  if (!activeWorkspace) return null;

  const selectWorkspace = async (id: string) => {
    if (id === activeWorkspace.id || busy) return;
    setBusy(true);
    try {
      await switchWorkspace(id);
      onWorkspaceChange();
    } finally {
      setBusy(false);
    }
  };

  const createWorkspace = async () => {
    const nextName = name.trim();
    if (!nextName) {
      setError("Enter a workspace name.");
      return;
    }
    if (nextName.length > 80) {
      setError("Keep the workspace name under 80 characters.");
      return;
    }
    if (
      workspaces.some(
        (workspace) =>
          workspace.name.toLocaleLowerCase() ===
          nextName.toLocaleLowerCase(),
      )
    ) {
      setError("A workspace with that name already exists.");
      return;
    }
    if (workspaces.length >= 100) {
      setError("Dahoko supports up to 100 workspaces.");
      return;
    }

    setBusy(true);
    setError("");
    try {
      await addWorkspace(nextName);
      setName("");
      setCreateOpen(false);
      onWorkspaceChange();
    } catch {
      setError("The workspace could not be created.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="group flex h-11 w-full items-center gap-2.5 rounded-lg border border-border/90 bg-background/75 px-2 text-left shadow-sm outline-none transition-[background-color,border-color,box-shadow,transform] duration-150 hover:border-primary-strong/35 hover:bg-background focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-muted active:scale-[0.985] data-[state=open]:border-primary-strong/40 data-[state=open]:bg-background data-[state=open]:shadow-soft"
          >
            <WorkspaceMark
              name={activeWorkspace.name}
              color={activeWorkspace.color}
              className="h-7 w-7"
            />
            <span className="min-w-0 flex-1">
              <span className="block text-[10px] font-medium uppercase leading-3 tracking-[0.08em] text-muted-foreground">
                Workspace
              </span>
              <span className="block truncate text-[13px] font-semibold leading-4 text-foreground">
                {activeWorkspace.name}
              </span>
            </span>
            <ChevronsUpDown
              aria-hidden="true"
              className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground transition-colors group-hover:text-foreground"
            />
          </button>
        </DropdownMenuTrigger>

        <DropdownMenuContent
          align="start"
          sideOffset={7}
          className="w-[208px]"
        >
          <DropdownMenuLabel className="px-2 pb-1 pt-1.5 text-[10px] font-semibold uppercase tracking-[0.08em]">
            Workspaces
          </DropdownMenuLabel>
          {workspaces.map((workspace) => {
            const selected = workspace.id === activeWorkspace.id;
            return (
              <DropdownMenuItem
                key={workspace.id}
                disabled={busy}
                onSelect={() => void selectWorkspace(workspace.id)}
                className="gap-2.5 py-2"
              >
                <WorkspaceMark
                  name={workspace.name}
                  color={workspace.color}
                  className="h-6 w-6"
                />
                <span
                  className={cn(
                    "min-w-0 flex-1 truncate text-[13px]",
                    selected && "font-medium",
                  )}
                >
                  {workspace.name}
                </span>
                {selected ? (
                  <Check
                    aria-hidden="true"
                    className="h-3.5 w-3.5 text-primary-strong"
                  />
                ) : null}
              </DropdownMenuItem>
            );
          })}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={() => setCreateOpen(true)}
            className="gap-2.5 py-2 text-[13px]"
          >
            <span className="grid h-6 w-6 place-items-center rounded-md border border-dashed border-input text-muted-foreground">
              <Plus aria-hidden="true" className="h-3.5 w-3.5" />
            </span>
            Create workspace
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog
        open={createOpen}
        onOpenChange={(open) => {
          if (!busy) {
            setCreateOpen(open);
            if (!open) {
              setName("");
              setError("");
            }
          }
        }}
      >
        <DialogContent className="max-w-[390px]">
          <DialogHeader>
            <DialogTitle>Create workspace</DialogTitle>
            <DialogDescription>
              Workspaces keep their tasks, lists, and views separate.
            </DialogDescription>
          </DialogHeader>
          <form
            className="pt-1"
            onSubmit={(event) => {
              event.preventDefault();
              void createWorkspace();
            }}
          >
            <label htmlFor="workspace-name" className="text-[12px] font-medium">
              Workspace name
            </label>
            <Input
              id="workspace-name"
              autoFocus
              autoComplete="off"
              maxLength={80}
              value={name}
              disabled={busy}
              className="mt-1.5"
              placeholder="e.g. Work"
              onChange={(event) => {
                setName(event.target.value);
                if (error) setError("");
              }}
              aria-invalid={Boolean(error)}
              aria-describedby={error ? "workspace-name-error" : undefined}
            />
            {error ? (
              <p
                id="workspace-name-error"
                role="alert"
                className="mt-1.5 text-[11.5px] text-destructive"
              >
                {error}
              </p>
            ) : (
              <p className="mt-1.5 text-[11.5px] text-muted-foreground">
                You can switch workspaces anytime from the sidebar.
              </p>
            )}
            <div className="mt-4 flex justify-end gap-2">
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={busy}
                onClick={() => setCreateOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={busy}>
                {busy ? "Creating…" : "Create workspace"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
