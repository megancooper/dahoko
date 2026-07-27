import {
  createBackup,
  validateBackup,
} from "@/db/backup";
import type {
  Workspace,
  WorkspaceBundleSnapshot,
} from "@/db/repo";
import {
  buildLocalDocument,
  documentToSnapshot,
  emptySyncDocument,
  mergeSyncDocuments,
  normalizeMergedDocument,
  observeDocumentClock,
  parseSyncDocument,
  type SyncClock,
  type SyncDocument,
} from "./document";

export const SYNC_BUNDLE_FORMAT = "dahoko-workspace-sync";
export const SYNC_BUNDLE_VERSION = 1;
const MAX_WORKSPACES = 100;

export interface SyncWorkspaceDocument {
  workspace: Workspace;
  document: SyncDocument;
}

export interface SyncBundleDocument {
  format: typeof SYNC_BUNDLE_FORMAT;
  version: typeof SYNC_BUNDLE_VERSION;
  workspaces: Record<string, SyncWorkspaceDocument>;
}

export interface LocalSyncState {
  document: SyncBundleDocument;
  clock: SyncClock;
}

export class SyncBundleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SyncBundleError";
  }
}

function fail(message: string): never {
  throw new SyncBundleError(message);
}

function record(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    fail(`${label} must be an object.`);
  }
  return value as Record<string, unknown>;
}

function validId(value: string): boolean {
  return (
    value.length > 0 &&
    value.length <= 128 &&
    value !== "__proto__" &&
    value !== "prototype" &&
    value !== "constructor" &&
    !Array.from(value).some((character) => /\p{Cc}/u.test(character))
  );
}

function parseWorkspace(value: unknown, expectedId: string): Workspace {
  const source = record(value, "Synced workspace");
  if (
    source.id !== expectedId ||
    !validId(expectedId) ||
    typeof source.name !== "string" ||
    source.name.trim().length === 0 ||
    source.name.length > 200 ||
    typeof source.color !== "string" ||
    !/^#[0-9a-fA-F]{6}$/.test(source.color) ||
    !Number.isSafeInteger(source.sortOrder) ||
    (source.sortOrder as number) < 0 ||
    typeof source.createdAt !== "string" ||
    source.createdAt.length > 64 ||
    !Number.isFinite(Date.parse(source.createdAt))
  ) {
    fail("Encrypted sync data contains an invalid workspace.");
  }
  return {
    id: expectedId,
    name: source.name,
    color: source.color,
    sortOrder: source.sortOrder as number,
    createdAt: source.createdAt,
  };
}

export function emptySyncBundleDocument(): SyncBundleDocument {
  return {
    format: SYNC_BUNDLE_FORMAT,
    version: SYNC_BUNDLE_VERSION,
    workspaces: Object.create(null) as SyncBundleDocument["workspaces"],
  };
}

export function parseSyncBundleDocument(value: unknown): SyncBundleDocument {
  const root = record(value, "Sync workspace bundle");
  if (
    root.format !== SYNC_BUNDLE_FORMAT ||
    root.version !== SYNC_BUNDLE_VERSION
  ) {
    fail("Encrypted sync data uses an unsupported workspace format.");
  }
  const sourceWorkspaces = record(root.workspaces, "Synced workspaces");
  const rows = Object.entries(sourceWorkspaces);
  if (rows.length === 0 || rows.length > MAX_WORKSPACES) {
    fail("Encrypted sync data has an invalid number of workspaces.");
  }
  const workspaces = Object.create(
    null,
  ) as SyncBundleDocument["workspaces"];
  for (const [id, rawEntry] of rows) {
    if (!validId(id)) fail("Encrypted sync data contains an invalid workspace ID.");
    const entry = record(rawEntry, "Synced workspace entry");
    workspaces[id] = {
      workspace: parseWorkspace(entry.workspace, id),
      document: parseSyncDocument(entry.document),
    };
  }
  return {
    format: SYNC_BUNDLE_FORMAT,
    version: SYNC_BUNDLE_VERSION,
    workspaces,
  };
}

function compareWorkspace(left: Workspace, right: Workspace): number {
  const created = left.createdAt.localeCompare(right.createdAt);
  if (created !== 0) return created;
  return JSON.stringify(left).localeCompare(JSON.stringify(right));
}

export function buildLocalSyncBundle(
  snapshot: WorkspaceBundleSnapshot,
  previous: SyncBundleDocument | null,
  initialClock: SyncClock,
  deviceId: string,
  now = Date.now(),
): LocalSyncState {
  if (
    snapshot.workspaces.length === 0 ||
    snapshot.workspaces.length > MAX_WORKSPACES
  ) {
    fail("Local data has an invalid number of workspaces.");
  }
  const prior = previous ?? emptySyncBundleDocument();
  const workspaces = Object.create(
    null,
  ) as SyncBundleDocument["workspaces"];
  let clock = initialClock;
  const ids = new Set<string>();
  for (const current of [...snapshot.workspaces].sort((left, right) =>
    left.workspace.id.localeCompare(right.workspace.id),
  )) {
    if (!validId(current.workspace.id) || ids.has(current.workspace.id)) {
      fail("Local data contains a duplicate or invalid workspace.");
    }
    ids.add(current.workspace.id);
    validateBackup(createBackup(current.data));
    const priorEntry = prior.workspaces[current.workspace.id];
    const built = buildLocalDocument(
      current.data,
      priorEntry?.document ?? null,
      clock,
      deviceId,
      now,
    );
    clock = built.clock;
    workspaces[current.workspace.id] = {
      workspace: current.workspace,
      document: built.document,
    };
  }
  return {
    document: {
      format: SYNC_BUNDLE_FORMAT,
      version: SYNC_BUNDLE_VERSION,
      workspaces,
    },
    clock,
  };
}

export function observeSyncBundleClock(
  initialClock: SyncClock,
  bundle: SyncBundleDocument,
): SyncClock {
  let clock = initialClock;
  for (const entry of Object.values(bundle.workspaces)) {
    clock = observeDocumentClock(clock, entry.document);
  }
  return clock;
}

export function mergeSyncBundles(
  left: SyncBundleDocument,
  right: SyncBundleDocument,
): SyncBundleDocument {
  const workspaces = Object.create(
    null,
  ) as SyncBundleDocument["workspaces"];
  const ids = [
    ...new Set([
      ...Object.keys(left.workspaces),
      ...Object.keys(right.workspaces),
    ]),
  ].sort();
  for (const id of ids) {
    const leftEntry = left.workspaces[id];
    const rightEntry = right.workspaces[id];
    if (!leftEntry) {
      workspaces[id] = rightEntry;
    } else if (!rightEntry) {
      workspaces[id] = leftEntry;
    } else {
      workspaces[id] = {
        workspace:
          compareWorkspace(leftEntry.workspace, rightEntry.workspace) <= 0
            ? leftEntry.workspace
            : rightEntry.workspace,
        document: mergeSyncDocuments(
          leftEntry.document,
          rightEntry.document,
        ),
      };
    }
  }
  return {
    format: SYNC_BUNDLE_FORMAT,
    version: SYNC_BUNDLE_VERSION,
    workspaces,
  };
}

export function normalizeSyncBundle(
  input: SyncBundleDocument,
  initialClock: SyncClock,
  deviceId: string,
  now = Date.now(),
): LocalSyncState {
  const workspaces = Object.create(
    null,
  ) as SyncBundleDocument["workspaces"];
  let clock = observeSyncBundleClock(initialClock, input);
  for (const id of Object.keys(input.workspaces).sort()) {
    const entry = input.workspaces[id];
    const normalized = normalizeMergedDocument(
      entry.document,
      clock,
      deviceId,
      now,
    );
    clock = normalized.clock;
    workspaces[id] = {
      workspace: entry.workspace,
      document: normalized.document,
    };
  }
  return {
    document: {
      format: SYNC_BUNDLE_FORMAT,
      version: SYNC_BUNDLE_VERSION,
      workspaces,
    },
    clock,
  };
}

export function syncBundleToSnapshot(
  bundle: SyncBundleDocument,
): WorkspaceBundleSnapshot {
  return {
    workspaces: Object.values(bundle.workspaces)
      .sort((left, right) => {
        const order = left.workspace.sortOrder - right.workspace.sortOrder;
        return order || left.workspace.id.localeCompare(right.workspace.id);
      })
      .map((entry) => ({
        workspace: entry.workspace,
        data: documentToSnapshot(entry.document),
      })),
  };
}

export function syncBundlesEqual(
  left: SyncBundleDocument,
  right: SyncBundleDocument,
): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}
