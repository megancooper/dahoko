import { type ReactNode } from "react";
import { Eye, LayoutGrid, Moon } from "lucide-react";
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
  type ThemePreference,
} from "@/state/settings";
import { useUpdater } from "@/state/updater";

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
  const iconClass = "h-3.5 w-3.5 flex-shrink-0 text-muted-foreground";
  const busy =
    status === "checking" ||
    status === "downloading" ||
    status === "restarting";
  const updaterUnavailable = status === "unavailable";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[420px]">
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

          <SettingRow
            icon={<LayoutGrid className={iconClass} />}
            label="Default view"
            hint="View used when the app opens"
          >
            <Select
              value={settings.defaultView}
              onValueChange={(value) =>
                updateSettings({ defaultView: value as DefaultView })
              }
            >
              <SelectTrigger aria-label="Default view">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="list">List</SelectItem>
                <SelectItem value="board">Swimlanes</SelectItem>
                <SelectItem value="tags">By tag</SelectItem>
              </SelectContent>
            </Select>
          </SettingRow>

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
        </div>
      </DialogContent>
    </Dialog>
  );
}
