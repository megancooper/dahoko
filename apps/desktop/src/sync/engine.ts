import type { WorkspaceBundleSnapshot } from "@/db/repo";
import {
  getRemoteSyncState,
  putRemoteSyncState,
  SyncApiError,
} from "./api";
import {
  decryptSyncDocument,
  encryptSyncDocument,
} from "./crypto";
import {
  buildLocalSyncBundle,
  emptySyncBundleDocument,
  mergeSyncBundles,
  normalizeSyncBundle,
  observeSyncBundleClock,
  syncBundlesEqual,
  syncBundleToSnapshot,
  type LocalSyncState,
} from "./bundle";

const MAX_CONFLICT_RETRIES = 3;

export interface SyncCredentials {
  serverUrl: string;
  token: string;
  encryptionSalt: string;
  key: CryptoKey;
  deviceId: string;
}

export interface EncryptedSyncResult {
  localState: LocalSyncState;
  snapshot: WorkspaceBundleSnapshot;
  revision: number;
  uploaded: boolean;
}

export async function runEncryptedSync(
  credentials: SyncCredentials,
  snapshot: WorkspaceBundleSnapshot,
  previousState: LocalSyncState | null,
): Promise<EncryptedSyncResult> {
  let local = buildLocalSyncBundle(
    snapshot,
    previousState?.document ?? null,
    previousState?.clock ?? { millis: 0, counter: 0 },
    credentials.deviceId,
  );
  let remote = await getRemoteSyncState(
    credentials.serverUrl,
    credentials.token,
  );

  for (let attempt = 0; attempt <= MAX_CONFLICT_RETRIES; attempt += 1) {
    const remoteDocument = remote.blob
      ? await decryptSyncDocument(
          remote.blob,
          credentials.key,
          credentials.encryptionSalt,
        )
      : emptySyncBundleDocument();
    const observedClock = observeSyncBundleClock(local.clock, remoteDocument);
    const merged = normalizeSyncBundle(
      mergeSyncBundles(local.document, remoteDocument),
      observedClock,
      credentials.deviceId,
    );

    if (remote.blob && syncBundlesEqual(merged.document, remoteDocument)) {
      return {
        localState: merged,
        snapshot: syncBundleToSnapshot(merged.document),
        revision: remote.revision,
        uploaded: false,
      };
    }

    const encrypted = await encryptSyncDocument(
      merged.document,
      credentials.key,
      credentials.encryptionSalt,
    );
    try {
      const saved = await putRemoteSyncState(
        credentials.serverUrl,
        credentials.token,
        remote.revision,
        encrypted,
      );
      return {
        localState: merged,
        snapshot: syncBundleToSnapshot(merged.document),
        revision: saved.revision,
        uploaded: true,
      };
    } catch (error) {
      if (
        error instanceof SyncApiError &&
        error.status === 409 &&
        error.remote &&
        attempt < MAX_CONFLICT_RETRIES
      ) {
        local = merged;
        remote = error.remote;
        continue;
      }
      throw error;
    }
  }

  throw new SyncApiError(
    "Sync stayed busy on another device. Try again in a moment.",
    409,
  );
}

export function snapshotsEqual(
  left: WorkspaceBundleSnapshot,
  right: WorkspaceBundleSnapshot,
): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}
