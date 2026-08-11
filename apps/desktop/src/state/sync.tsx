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
import { useStore } from "./store";
import { createCoalescedRunner } from "./coalesced-runner";
import {
  authenticateSyncAccount,
  createBillingCheckout,
  createBillingPortal,
  deleteSyncAccount,
  getBillingState,
  logoutSyncAccount,
  normalizeSyncServerUrl,
  refreshBillingState,
  SyncApiError,
  type BillingState,
} from "@/sync/api";
import { deriveSyncKey, SyncCryptoError } from "@/sync/crypto";
import { runEncryptedSync, snapshotsEqual } from "@/sync/engine";
import {
  getSyncDeviceId,
  HOSTED_SYNC_SERVER_URL,
  deleteLocalSyncState,
  loadLocalSyncState,
  loadSavedSyncConfig,
  saveLocalSyncState,
  saveSyncConfig,
  syncAccountKey,
  type SavedSyncConfig,
} from "@/sync/storage";
import type { LocalSyncState } from "@/sync/bundle";

type SyncStatus =
  | "disconnected"
  | "connecting"
  | "syncing"
  | "idle"
  | "error";

export interface SyncAccount {
  serverUrl: string;
  email: string;
}

export interface ConnectSyncInput extends SyncAccount {
  mode: "register" | "login";
  password: string;
  encryptionPassphrase: string;
}

interface ActiveCredentials extends SyncAccount {
  token: string;
  encryptionSalt: string;
  key: CryptoKey;
  deviceId: string;
  accountKey: string;
}

interface SyncValue {
  status: SyncStatus;
  message: string;
  account: SyncAccount | null;
  savedConfig: SavedSyncConfig | null;
  hostedServerUrl: string;
  lastSyncedAt: string | null;
  /** Plan state; null when the connected server has billing disabled. */
  billing: BillingState | null;
  connect: (input: ConnectSyncInput) => Promise<void>;
  disconnect: () => Promise<void>;
  deleteAccount: (password: string) => Promise<void>;
  syncNow: () => Promise<void>;
  startCheckout: (interval: "monthly" | "yearly") => Promise<string>;
  openBillingPortal: () => Promise<string>;
  refreshBilling: () => Promise<void>;
}

const SyncContext = createContext<SyncValue | null>(null);

function messageForError(error: unknown): string {
  if (error instanceof SyncCryptoError || error instanceof SyncApiError) {
    return error.message;
  }
  if (error instanceof Error && error.message.includes("sync state")) {
    return error.message;
  }
  return "Encrypted sync could not be completed.";
}

function validateConnectInput(input: ConnectSyncInput): SyncAccount {
  const email = input.email.trim().normalize("NFKC").toLowerCase();
  if (
    email.length < 3 ||
    email.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(email)
  ) {
    throw new SyncApiError("Enter a valid email address.");
  }
  if (input.password.length < 12 || input.password.length > 256) {
    throw new SyncApiError("Your account password must be 12–256 characters.");
  }
  if (
    input.encryptionPassphrase.length < 16 ||
    input.encryptionPassphrase.length > 1_024
  ) {
    throw new SyncCryptoError(
      "Your encryption passphrase must be 16–1,024 characters.",
    );
  }
  if (input.password === input.encryptionPassphrase) {
    throw new SyncCryptoError(
      "Use a different encryption passphrase so the server can never derive it from your account password.",
    );
  }
  return {
    serverUrl: normalizeSyncServerUrl(input.serverUrl),
    email,
  };
}

export function SyncProvider({ children }: { children: ReactNode }) {
  const {
    ready,
    workspaces,
    tasks,
    lists,
    statuses,
    subtasks,
    completions,
    captureDataForSync,
    applySyncedDataIfUnchanged,
  } = useStore();
  const [status, setStatus] = useState<SyncStatus>("disconnected");
  const [message, setMessage] = useState(
    "Sign in to sync encrypted data between devices.",
  );
  const [account, setAccount] = useState<SyncAccount | null>(null);
  const [savedConfig, setSavedConfig] = useState<SavedSyncConfig | null>(
    loadSavedSyncConfig,
  );
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(
    () => loadSavedSyncConfig()?.lastSyncedAt ?? null,
  );
  const [billing, setBilling] = useState<BillingState | null>(null);
  const credentialsRef = useRef<ActiveCredentials | null>(null);
  const localStateRef = useRef<LocalSyncState | null>(null);
  const captureDataForSyncRef = useRef(captureDataForSync);
  const applySyncedDataRef = useRef(applySyncedDataIfUnchanged);
  captureDataForSyncRef.current = captureDataForSync;
  applySyncedDataRef.current = applySyncedDataIfUnchanged;

  const performSyncRef = useRef<() => Promise<void>>(async () => {});
  const syncRunnerRef = useRef<(() => Promise<void>) | null>(null);
  if (!syncRunnerRef.current) {
    syncRunnerRef.current = createCoalescedRunner(() =>
      performSyncRef.current(),
    );
  }
  const syncNow = useCallback(() => syncRunnerRef.current!(), []);

  performSyncRef.current = async () => {
    const credentials = credentialsRef.current;
    if (!credentials) {
      throw new SyncApiError("Sign in before syncing.");
    }
    setStatus("syncing");
    setMessage("Encrypting and syncing…");
    try {
      const captured = await captureDataForSyncRef.current();
      const currentSnapshot = captured.snapshot;
      const result = await runEncryptedSync(
        credentials,
        currentSnapshot,
        localStateRef.current,
      );
      const hasRemoteChanges = !snapshotsEqual(
        currentSnapshot,
        result.snapshot,
      );
      const applied = await applySyncedDataRef.current(
        result.snapshot,
        captured.version,
        hasRemoteChanges,
      );
      if (!applied) {
        setStatus("idle");
        setMessage("New local changes are waiting; syncing them next.");
        return;
      }
      await saveLocalSyncState(credentials.accountKey, result.localState);
      localStateRef.current = result.localState;
      const syncedAt = new Date().toISOString();
      const nextConfig: SavedSyncConfig = {
        serverUrl: credentials.serverUrl,
        email: credentials.email,
        lastSyncedAt: syncedAt,
      };
      saveSyncConfig(nextConfig);
      setSavedConfig(nextConfig);
      setLastSyncedAt(syncedAt);
      setStatus("idle");
      setMessage(
        result.uploaded
          ? "Encrypted changes are synced."
          : "Everything is up to date.",
      );
    } catch (error) {
      if (error instanceof SyncApiError && error.status === 401) {
        credentialsRef.current = null;
        localStateRef.current = null;
        setAccount(null);
        setBilling(null);
        setStatus("disconnected");
        setMessage("Your session expired. Sign in again.");
      } else {
        setStatus("error");
        setMessage(messageForError(error));
      }
      throw error;
    }
  };

  const connect = useCallback(
    async (input: ConnectSyncInput) => {
      const normalized = validateConnectInput(input);
      setStatus("connecting");
      setMessage(
        input.mode === "register"
          ? "Creating your encrypted sync account…"
          : "Signing in…",
      );
      let token: string | null = null;
      try {
        const auth = await authenticateSyncAccount(
          normalized.serverUrl,
          input.mode,
          normalized.email,
          input.password,
        );
        token = auth.token;
        const key = await deriveSyncKey(
          input.encryptionPassphrase,
          auth.encryptionSalt,
        );
        const accountKey = syncAccountKey(
          normalized.serverUrl,
          normalized.email,
        );
        const credentials: ActiveCredentials = {
          ...normalized,
          token: auth.token,
          encryptionSalt: auth.encryptionSalt,
          key,
          deviceId: getSyncDeviceId(),
          accountKey,
        };
        localStateRef.current = await loadLocalSyncState(accountKey);
        credentialsRef.current = credentials;
        setAccount(normalized);
        try {
          setBilling(
            await getBillingState(normalized.serverUrl, auth.token),
          );
        } catch {
          // Plan details are cosmetic here; sync reports its own errors.
          setBilling(null);
        }
        await syncNow();
      } catch (error) {
        // A 402 means the session is valid but hosted sync needs a plan;
        // keep the signed-in session so the user can upgrade from here.
        if (error instanceof SyncApiError && error.status === 402) {
          return;
        }
        credentialsRef.current = null;
        localStateRef.current = null;
        setAccount(null);
        setBilling(null);
        setStatus("error");
        setMessage(messageForError(error));
        if (token) {
          await logoutSyncAccount(normalized.serverUrl, token);
        }
        throw error;
      }
    },
    [syncNow],
  );

  const disconnect = useCallback(async () => {
    const credentials = credentialsRef.current;
    credentialsRef.current = null;
    localStateRef.current = null;
    setAccount(null);
    setBilling(null);
    setStatus("disconnected");
    setMessage(
      "Disconnected. Your local data and encrypted server copy are unchanged.",
    );
    if (credentials) {
      await logoutSyncAccount(credentials.serverUrl, credentials.token);
    }
  }, []);

  const deleteAccount = useCallback(async (password: string) => {
    const credentials = credentialsRef.current;
    if (!credentials) throw new SyncApiError("Sign in before deleting an account.");
    if (password.length < 12 || password.length > 256) {
      throw new SyncApiError("Enter your account password to confirm deletion.");
    }
    setStatus("syncing");
    setMessage("Deleting the encrypted server copy…");
    try {
      await deleteSyncAccount(
        credentials.serverUrl,
        credentials.token,
        password,
      );
      await deleteLocalSyncState(credentials.accountKey);
      credentialsRef.current = null;
      localStateRef.current = null;
      setAccount(null);
      setBilling(null);
      setLastSyncedAt(null);
      const nextConfig: SavedSyncConfig = {
        serverUrl: credentials.serverUrl,
        email: credentials.email,
        lastSyncedAt: null,
      };
      saveSyncConfig(nextConfig);
      setSavedConfig(nextConfig);
      setStatus("disconnected");
      setMessage(
        "The server account and encrypted copy were deleted. Local tasks remain on this device.",
      );
    } catch (error) {
      setStatus("error");
      setMessage(messageForError(error));
      throw error;
    }
  }, []);

  const startCheckout = useCallback(
    async (interval: "monthly" | "yearly") => {
      const credentials = credentialsRef.current;
      if (!credentials) throw new SyncApiError("Sign in before upgrading.");
      return createBillingCheckout(
        credentials.serverUrl,
        credentials.token,
        credentials.email,
        interval,
      );
    },
    [],
  );

  const openBillingPortal = useCallback(async () => {
    const credentials = credentialsRef.current;
    if (!credentials) throw new SyncApiError("Sign in first.");
    return createBillingPortal(credentials.serverUrl, credentials.token);
  }, []);

  const refreshBilling = useCallback(async () => {
    const credentials = credentialsRef.current;
    if (!credentials) return;
    const subscription = await refreshBillingState(
      credentials.serverUrl,
      credentials.token,
    );
    setBilling((current) =>
      current
        ? { ...current, subscription }
        : { subscription, syncRequiresSubscription: true },
    );
  }, []);

  useEffect(() => {
    if (!ready || !credentialsRef.current) return;
    const timeout = window.setTimeout(() => {
      void syncNow().catch(() => {});
    }, 1_200);
    return () => window.clearTimeout(timeout);
  }, [
    ready,
    workspaces,
    tasks,
    lists,
    statuses,
    subtasks,
    completions,
    syncNow,
  ]);

  useEffect(() => {
    if (!account) return;
    const interval = window.setInterval(() => {
      void syncNow().catch(() => {});
    }, 30_000);
    const onFocus = () => void syncNow().catch(() => {});
    window.addEventListener("focus", onFocus);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", onFocus);
    };
  }, [account, syncNow]);

  const value = useMemo<SyncValue>(
    () => ({
      status,
      message,
      account,
      savedConfig,
      hostedServerUrl: HOSTED_SYNC_SERVER_URL,
      lastSyncedAt,
      billing,
      connect,
      disconnect,
      deleteAccount,
      syncNow,
      startCheckout,
      openBillingPortal,
      refreshBilling,
    }),
    [
      status,
      message,
      account,
      savedConfig,
      lastSyncedAt,
      billing,
      connect,
      disconnect,
      deleteAccount,
      syncNow,
      startCheckout,
      openBillingPortal,
      refreshBilling,
    ],
  );

  return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>;
}

export function useSync(): SyncValue {
  const value = useContext(SyncContext);
  if (!value) throw new Error("useSync must be used within SyncProvider");
  return value;
}
