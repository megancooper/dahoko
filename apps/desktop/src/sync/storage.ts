import {
  parseSyncBundleDocument,
  type LocalSyncState,
} from "./bundle";
import type { SyncClock } from "./document";

const DATABASE_NAME = "dahoko-sync";
const DATABASE_VERSION = 1;
const STATE_STORE = "account-state";
const CONFIG_KEY = "dahoko.sync.config";
const DEVICE_KEY = "dahoko.sync.device";

export interface SavedSyncConfig {
  serverUrl: string;
  email: string;
  lastSyncedAt: string | null;
}

export const HOSTED_SYNC_SERVER_URL =
  (import.meta.env.VITE_DAHOKO_SYNC_URL as string | undefined)
    ?.trim()
    .replace(/\/+$/, "") ?? "";

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STATE_STORE)) {
        request.result.createObjectStore(STATE_STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(new Error("Encrypted sync state could not be opened."));
  });
}

export function syncAccountKey(serverUrl: string, email: string): string {
  return `${serverUrl}\u0000${email.trim().toLowerCase()}`;
}

export async function loadLocalSyncState(
  accountKey: string,
): Promise<LocalSyncState | null> {
  const database = await openDatabase();
  try {
    const raw = await new Promise<unknown>((resolve, reject) => {
      const transaction = database.transaction(STATE_STORE, "readonly");
      const request = transaction.objectStore(STATE_STORE).get(accountKey);
      request.onsuccess = () => resolve(request.result as unknown);
      request.onerror = () =>
        reject(new Error("Encrypted sync state could not be read."));
    });
    if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
      return null;
    }
    const source = raw as Record<string, unknown>;
    const clock = source.clock as Partial<SyncClock> | undefined;
    if (
      !clock ||
      !Number.isSafeInteger(clock.millis) ||
      (clock.millis as number) < 0 ||
      !Number.isSafeInteger(clock.counter) ||
      (clock.counter as number) < 0
    ) {
      return null;
    }
    return {
      document: parseSyncBundleDocument(source.document),
      clock: {
        millis: clock.millis as number,
        counter: clock.counter as number,
      },
    };
  } catch {
    return null;
  } finally {
    database.close();
  }
}

export async function saveLocalSyncState(
  accountKey: string,
  state: LocalSyncState,
): Promise<void> {
  const database = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(STATE_STORE, "readwrite");
      transaction.objectStore(STATE_STORE).put(state, accountKey);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () =>
        reject(new Error("Encrypted sync state could not be saved."));
      transaction.onabort = () =>
        reject(new Error("Encrypted sync state could not be saved."));
    });
  } finally {
    database.close();
  }
}

export async function deleteLocalSyncState(accountKey: string): Promise<void> {
  const database = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(STATE_STORE, "readwrite");
      transaction.objectStore(STATE_STORE).delete(accountKey);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () =>
        reject(new Error("Encrypted sync state could not be deleted."));
      transaction.onabort = () =>
        reject(new Error("Encrypted sync state could not be deleted."));
    });
  } finally {
    database.close();
  }
}

export function loadSavedSyncConfig(): SavedSyncConfig | null {
  try {
    const raw = JSON.parse(window.localStorage.getItem(CONFIG_KEY) ?? "null") as
      | Record<string, unknown>
      | null;
    if (
      !raw ||
      typeof raw.serverUrl !== "string" ||
      raw.serverUrl.length > 2_048 ||
      typeof raw.email !== "string" ||
      raw.email.length > 254
    ) {
      return null;
    }
    return {
      serverUrl: raw.serverUrl,
      email: raw.email,
      lastSyncedAt:
        typeof raw.lastSyncedAt === "string" &&
        Number.isFinite(Date.parse(raw.lastSyncedAt))
          ? raw.lastSyncedAt
          : null,
    };
  } catch {
    return null;
  }
}

export function saveSyncConfig(config: SavedSyncConfig): void {
  try {
    window.localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
  } catch {
    // Sync continues for this session when local preferences are unavailable.
  }
}

export function getSyncDeviceId(): string {
  try {
    const stored = window.localStorage.getItem(DEVICE_KEY);
    if (stored && /^[0-9a-f-]{36}$/i.test(stored)) return stored;
  } catch {
    // Use an ephemeral device ID when local storage is unavailable.
  }
  const deviceId = crypto.randomUUID();
  try {
    window.localStorage.setItem(DEVICE_KEY, deviceId);
  } catch {
    // The in-memory ID is still safe for this app session.
  }
  return deviceId;
}
