import { useState } from "react";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  VersionBadge,
} from "@dahoko/ui";
import { useUpdater } from "@/state/updater";

export function UpdateDialog() {
  const {
    version,
    availableVersion,
    status,
    message,
    progress,
    installUpdate,
  } = useUpdater();
  const [dismissedVersion, setDismissedVersion] = useState<string | null>(null);
  const busy = status === "downloading" || status === "restarting";
  const open =
    availableVersion !== null &&
    availableVersion !== dismissedVersion &&
    (status === "available" || busy);

  const dismiss = () => {
    if (!busy) setDismissedVersion(availableVersion);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) dismiss();
      }}
    >
      <DialogContent className="max-w-[390px]">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <DialogTitle>Update available</DialogTitle>
            {availableVersion ? (
              <VersionBadge version={availableVersion} />
            ) : null}
          </div>
          <DialogDescription>
            You’re on v{version}. dahoko can install the signed update now and
            relaunch when it’s ready.
          </DialogDescription>
        </DialogHeader>

        <div aria-live="polite" className="text-sm text-muted-foreground">
          {message}
        </div>

        {status === "downloading" ? (
          <div
            role="progressbar"
            aria-label="Update download progress"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progress ?? undefined}
            className="h-1.5 overflow-hidden rounded-full bg-secondary"
          >
            <div
              className="h-full rounded-full bg-primary-strong transition-[width] duration-150 ease-linear motion-reduce:transition-none"
              style={{ width: `${progress ?? 12}%` }}
            />
          </div>
        ) : null}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={dismiss}
          >
            Later
          </Button>
          <Button
            type="button"
            disabled={busy}
            onClick={() => void installUpdate()}
          >
            {status === "downloading"
              ? progress === null
                ? "Downloading…"
                : `Downloading ${progress}%`
              : status === "restarting"
                ? "Restarting…"
                : "Update & restart"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
