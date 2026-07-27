import { useRef, useState, type ChangeEvent, type ReactNode } from "react";
import { Download, Eye, LayoutGrid, Moon, Upload } from "lucide-react";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
  VersionBadge,
} from "@dahoko/ui";
import {
  useSettings,
  type DefaultView,
  type DefaultViewContext,
  type ThemePreference,
} from "@/state/settings";
import { useUpdater } from "@/state/updater";
import { useStore } from "@/state/store";
import {
  BackupValidationError,
  MAX_BACKUP_BYTES,
  parseBackupJson,
  serializeBackup,
  type DahokoBackup,
} from "@/db/backup";
import { isTauri } from "@/db";
import { SyncSettings } from "./sync-settings";

type DataMessage = {
  tone: "neutral" | "success" | "error";
  text: string;
} | null;

const DEFAULT_VIEW_SECTIONS: ReadonlyArray<{
  context: DefaultViewContext;
  label: string;
}> = [
  { context: "inbox", label: "Inbox" },
  { context: "today", label: "Today" },
  { context: "next7", label: "Next 7 days" },
  { context: "completed", label: "Completed" },
  { context: "recurring", label: "Recurring" },
  { context: "lists", label: "Lists" },
  { context: "tags", label: "Tag filters" },
];

function SettingRow({
  icon,
  label,
  hint,
  children,
}: {
  icon: ReactNode;
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex min-w-0 flex-col">
        <span className="flex items-center gap-2 text-[13px] font-medium">
          {icon}
          {label}
        </span>
        {hint ? (
          <span className="pl-[22px] text-[11.5px] text-muted-foreground">
            {hint}
          </span>
        ) : null}
      </div>
      <div className="w-[170px] flex-shrink-0">{children}</div>
    </div>
  );
}

export function SettingsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { settings, updateSettings } = useSettings();
  const {
    version,
    availableVersion,
    status,
    message,
    progress,
    checkForUpdates,
    installUpdate,
  } = useUpdater();
  const {
    activeWorkspace,
    createDataBackup,
    restoreDataBackup,
  } = useStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingBackup, setPendingBackup] = useState<DahokoBackup | null>(null);
  const [dataBusy, setDataBusy] = useState(false);
  const [dataMessage, setDataMessage] = useState<DataMessage>(null);
  const iconClass = "h-3.5 w-3.5 flex-shrink-0 text-muted-foreground";
  const busy =
    status === "checking" ||
    status === "downloading" ||
    status === "restarting";
  const updaterUnavailable = status === "unavailable";

  const exportData = async () => {
    setDataBusy(true);
    try {
      const backup = createDataBackup();
      const contents = serializeBackup(backup);
      const workspaceSlug =
        activeWorkspace?.name
          .toLocaleLowerCase()
          .replace(/[^\p{L}\p{N}]+/gu, "-")
          .replace(/^-|-$/g, "")
          .slice(0, 48) || "workspace";
      const filename = `dahoko-${workspaceSlug}-backup-${backup.exportedAt.slice(0, 10)}.json`;

      if (isTauri()) {
        const [{ save }, { writeTextFile }] = await Promise.all([
          import("@tauri-apps/plugin-dialog"),
          import("@tauri-apps/plugin-fs"),
        ]);
        const path = await save({
          defaultPath: filename,
          filters: [{ name: "JSON backup", extensions: ["json"] }],
        });
        if (!path) {
          setDataMessage({ tone: "neutral", text: "Export canceled." });
          return;
        }
        await writeTextFile(path, contents);
      } else {
        const blob = new Blob([contents], {
          type: "application/json",
        });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = filename;
        link.hidden = true;
        document.body.append(link);
        link.click();
        link.remove();
        window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
      }

      setDataMessage({
        tone: "success",
        text: "Workspace backup exported. Keep it somewhere secure.",
      });
    } catch {
      setDataMessage({
        tone: "error",
        text: "The backup could not be exported.",
      });
    } finally {
      setDataBusy(false);
    }
  };

  const selectImport = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setPendingBackup(null);
    setDataMessage(null);
    if (file.size > MAX_BACKUP_BYTES) {
      setDataMessage({
        tone: "error",
        text: "That backup is larger than the 10 MB import limit.",
      });
      return;
    }

    setDataBusy(true);
    try {
      const backup = parseBackupJson(await file.text());
      setPendingBackup(backup);
      setDataMessage({
        tone: "neutral",
        text: "Backup validated. Review the counts before replacing your current data.",
      });
    } catch (error) {
      setDataMessage({
        tone: "error",
        text:
          error instanceof BackupValidationError
            ? error.message
            : "That file could not be read as a dahoko backup.",
      });
    } finally {
      setDataBusy(false);
    }
  };

  const confirmImport = async () => {
    if (!pendingBackup) return;
    const taskCount = pendingBackup.data.tasks.length;
    setDataBusy(true);
    try {
      await restoreDataBackup(pendingBackup);
      setPendingBackup(null);
      setDataMessage({
        tone: "success",
        text: `Imported ${taskCount} ${taskCount === 1 ? "task" : "tasks"} successfully.`,
      });
    } catch {
      setDataMessage({
        tone: "error",
        text: "Import failed safely. Your current data was not changed.",
      });
    } finally {
      setDataBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) setPendingBackup(null);
        onOpenChange(nextOpen);
      }}
    >
      <DialogContent className="max-h-[calc(100dvh-3rem)] max-w-[520px] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>
            Preferences are stored locally on this device.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 pt-1">
          <SettingRow
            icon={<Moon className={iconClass} />}
            label="Theme"
            hint="System follows your OS appearance"
          >
            <Select
              value={settings.theme}
              onValueChange={(value) =>
                updateSettings({ theme: value as ThemePreference })
              }
            >
              <SelectTrigger aria-label="Theme">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="system">System</SelectItem>
                <SelectItem value="light">Light</SelectItem>
                <SelectItem value="dark">Dark</SelectItem>
              </SelectContent>
            </Select>
          </SettingRow>

          <section
            aria-labelledby="default-views-title"
            className="rounded-lg border border-border bg-muted/35 p-3"
          >
            <div className="flex items-center gap-2">
              <LayoutGrid className={iconClass} aria-hidden="true" />
              <h3 id="default-views-title" className="text-[13px] font-medium">
                Default views
              </h3>
            </div>
            <p className="mt-1 pl-[22px] text-[11.5px] leading-relaxed text-muted-foreground">
              Choose how each sidebar destination opens.
            </p>

            <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2.5">
              {DEFAULT_VIEW_SECTIONS.map(({ context, label }) => {
                const triggerId = `default-view-${context}`;
                return (
                  <div key={context} className="min-w-0">
                    <label
                      htmlFor={triggerId}
                      className="mb-1 block text-[11.5px] font-medium text-muted-foreground"
                    >
                      {label}
                    </label>
                    <Select
                      value={settings.defaultViews[context]}
                      onValueChange={(value) =>
                        updateSettings({
                          defaultViews: {
                            ...settings.defaultViews,
                            [context]: value as DefaultView,
                          },
                        })
                      }
                    >
                      <SelectTrigger id={triggerId}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="list">List</SelectItem>
                        <SelectItem value="board">Swimlanes</SelectItem>
                        <SelectItem value="tags">By tag</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                );
              })}
            </div>
          </section>

          <SettingRow
            icon={<Eye className={iconClass} />}
            label="Completed in Inbox"
            hint="Keep tasks finished today visible"
          >
            <div className="flex justify-end">
              <Switch
                aria-label="Show completed tasks in Inbox"
                checked={settings.showCompletedInInbox}
                onCheckedChange={(checked) =>
                  updateSettings({ showCompletedInInbox: checked })
                }
              />
            </div>
          </SettingRow>

          <div className="h-px bg-border" />

          <SyncSettings />

          <section
            aria-labelledby="app-updates-title"
            className="rounded-lg border border-border bg-muted/35 p-3"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3
                    id="app-updates-title"
                    className="text-[13px] font-medium"
                  >
                    App updates
                  </h3>
                  <VersionBadge version={version} />
                </div>
                <p
                  aria-live="polite"
                  className="mt-1 text-[11.5px] leading-relaxed text-muted-foreground"
                >
                  {message}
                </p>
              </div>

              {status === "available" ? (
                <Button
                  type="button"
                  size="sm"
                  className="flex-shrink-0"
                  onClick={() => void installUpdate()}
                >
                  Update to v{availableVersion}
                </Button>
              ) : (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="flex-shrink-0"
                  disabled={busy || updaterUnavailable}
                  onClick={() => void checkForUpdates()}
                >
                  {status === "checking"
                    ? "Checking…"
                    : status === "error"
                      ? "Retry"
                      : status === "downloading"
                        ? progress === null
                          ? "Downloading…"
                          : `${progress}%`
                        : status === "restarting"
                          ? "Restarting…"
                          : "Check now"}
                </Button>
              )}
            </div>

            {status === "downloading" ? (
              <div
                role="progressbar"
                aria-label="Update download progress"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={progress ?? undefined}
                className="mt-3 h-1.5 overflow-hidden rounded-full bg-secondary"
              >
                <div
                  className="h-full rounded-full bg-primary-strong transition-[width] duration-150 ease-linear motion-reduce:transition-none"
                  style={{ width: `${progress ?? 12}%` }}
                />
              </div>
            ) : null}
          </section>

          <section
            aria-labelledby="data-title"
            className="rounded-lg border border-border bg-muted/35 p-3"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <h3 id="data-title" className="text-[13px] font-medium">
                  Your data
                </h3>
                <p className="mt-1 text-[11.5px] leading-relaxed text-muted-foreground">
                  Export a portable JSON backup or replace local data from a
                  backup you trust. This applies to the current workspace.
                </p>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={dataBusy}
                onClick={exportData}
              >
                <Download aria-hidden="true" className="h-3.5 w-3.5" />
                Export data
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={dataBusy}
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload aria-hidden="true" className="h-3.5 w-3.5" />
                {dataBusy ? "Reading…" : "Import data"}
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json,application/json"
                onChange={(event) => void selectImport(event)}
                className="sr-only"
              />
            </div>

            {pendingBackup ? (
              <div className="mt-3 rounded-md border border-warning/40 bg-warning/10 p-3">
                <p className="text-[12px] font-medium">
                  Replace this workspace’s data?
                </p>
                <p className="mt-1 text-[11.5px] leading-relaxed text-muted-foreground">
                  Valid backup from{" "}
                  {new Date(pendingBackup.exportedAt).toLocaleString()} with{" "}
                  {pendingBackup.data.tasks.length} tasks,{" "}
                  {pendingBackup.data.lists.length} lists, and{" "}
                  {pendingBackup.data.subtasks.length} subtasks. This cannot be
                  undone unless you export this workspace first.
                </p>
                <div className="mt-3 flex justify-end gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={dataBusy}
                    onClick={() => {
                      setPendingBackup(null);
                      setDataMessage(null);
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="destructiveOutline"
                    disabled={dataBusy}
                    onClick={() => void confirmImport()}
                  >
                    {dataBusy ? "Importing…" : "Replace workspace"}
                  </Button>
                </div>
              </div>
            ) : null}

            {dataMessage ? (
              <p
                role={dataMessage.tone === "error" ? "alert" : "status"}
                className={
                  dataMessage.tone === "error"
                    ? "mt-3 text-[11.5px] text-destructive"
                    : dataMessage.tone === "success"
                      ? "mt-3 text-[11.5px] text-success"
                      : "mt-3 text-[11.5px] text-muted-foreground"
                }
              >
                {dataMessage.text}
              </p>
            ) : null}
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}
