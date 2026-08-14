import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { getVersion } from "@tauri-apps/api/app";
import { invoke } from "@tauri-apps/api/core";
import type { Update } from "@tauri-apps/plugin-updater";
import desktopPackage from "../../package.json";
import { isTauri } from "@/db";
import { createLogger } from "@/lib/log";

const log = createLogger("updater");

export type UpdaterStatus =
  | "idle"
  | "checking"
  | "current"
  | "available"
  | "downloading"
  | "restarting"
  | "error"
  | "unavailable";

interface UpdaterContextValue {
  version: string;
  availableVersion: string | null;
  status: UpdaterStatus;
  message: string;
  progress: number | null;
  checkForUpdates: () => Promise<void>;
  installUpdate: () => Promise<void>;
}

const UpdaterContext = createContext<UpdaterContextValue | null>(null);

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "The update service could not be reached.";
}

export function UpdaterProvider({ children }: { children: ReactNode }) {
  const [version, setVersion] = useState(desktopPackage.version);
  const [availableVersion, setAvailableVersion] = useState<string | null>(null);
  const [status, setStatus] = useState<UpdaterStatus>(
    isTauri() ? "idle" : "unavailable",
  );
  const [lastError, setLastError] = useState<string | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const pendingUpdate = useRef<Update | null>(null);
  const autoCheckStarted = useRef(false);

  const replacePendingUpdate = useCallback(async (next: Update | null) => {
    const previous = pendingUpdate.current;
    pendingUpdate.current = next;
    if (previous && previous !== next) {
      await previous.close().catch(() => undefined);
    }
  }, []);

  const checkForUpdates = useCallback(async () => {
    if (!isTauri()) {
      setStatus("unavailable");
      return;
    }

    setStatus("checking");
    setLastError(null);
    setProgress(null);

    try {
      const configured = await invoke<boolean>("updater_is_configured");
      if (!configured) {
        await replacePendingUpdate(null);
        setAvailableVersion(null);
        setStatus("unavailable");
        return;
      }

      const { check } = await import("@tauri-apps/plugin-updater");
      const update = await check({ timeout: 15_000 });
      await replacePendingUpdate(update);

      if (update) {
        setAvailableVersion(update.version);
        setStatus("available");
      } else {
        setAvailableVersion(null);
        setStatus("current");
      }
    } catch (error) {
      log.warn("update check failed", { error: errorMessage(error) });
      setLastError(errorMessage(error));
      setStatus("error");
    }
  }, [replacePendingUpdate]);

  const installUpdate = useCallback(async () => {
    const update = pendingUpdate.current;
    if (!update) {
      await checkForUpdates();
      return;
    }

    setStatus("downloading");
    setLastError(null);
    setProgress(0);

    let downloaded = 0;
    let contentLength: number | undefined;

    try {
      await update.downloadAndInstall((event) => {
        if (event.event === "Started") {
          contentLength = event.data.contentLength;
          setProgress(contentLength ? 0 : null);
        }

        if (event.event === "Progress") {
          downloaded += event.data.chunkLength;
          if (contentLength) {
            setProgress(
              Math.min(99, Math.round((downloaded / contentLength) * 100)),
            );
          }
        }

        if (event.event === "Finished") {
          setProgress(100);
        }
      });

      setStatus("restarting");
      const { relaunch } = await import("@tauri-apps/plugin-process");
      await relaunch();
    } catch (error) {
      log.error("update install failed", error, {
        version: pendingUpdate.current?.version,
      });
      setLastError(errorMessage(error));
      setStatus("error");
    }
  }, [checkForUpdates]);

  useEffect(() => {
    if (!isTauri()) return;
    void getVersion().then(setVersion).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!isTauri() || autoCheckStarted.current) return;
    autoCheckStarted.current = true;
    void checkForUpdates();
  }, [checkForUpdates]);

  const message = useMemo(() => {
    switch (status) {
      case "idle":
        return "Preparing update checks…";
      case "checking":
        return "Checking for a newer release…";
      case "current":
        return `dahoko ${version} is up to date.`;
      case "available":
        return `dahoko ${availableVersion} is ready to install.`;
      case "downloading":
        return progress === null
          ? `Downloading dahoko ${availableVersion}…`
          : `Downloading dahoko ${availableVersion} — ${progress}%`;
      case "restarting":
        return "Update installed. Restarting dahoko…";
      case "error":
        return lastError ?? "The update check failed.";
      case "unavailable":
        return isTauri()
          ? "Update checks activate in signed release builds."
          : "Update checks are available in the desktop app.";
    }
  }, [availableVersion, lastError, progress, status, version]);

  const value = useMemo<UpdaterContextValue>(
    () => ({
      version,
      availableVersion,
      status,
      message,
      progress,
      checkForUpdates,
      installUpdate,
    }),
    [
      availableVersion,
      checkForUpdates,
      installUpdate,
      message,
      progress,
      status,
      version,
    ],
  );

  return (
    <UpdaterContext.Provider value={value}>
      {children}
    </UpdaterContext.Provider>
  );
}

export function useUpdater(): UpdaterContextValue {
  const value = useContext(UpdaterContext);
  if (!value) {
    throw new Error("useUpdater must be used within an UpdaterProvider");
  }
  return value;
}
