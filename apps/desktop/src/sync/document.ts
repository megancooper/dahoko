import type { List, Status, Task } from "@dahoko/core";
import {
  BACKUP_FORMAT,
  BACKUP_VERSION,
  validateBackup,
} from "@/db/backup";
import type { Completion, RepoSnapshot, Subtask } from "@/db/repo";

export const SYNC_FORMAT = "dahoko-sync";
export const SYNC_VERSION = 1;

export interface SyncStamp {
  millis: number;
  counter: number;
  deviceId: string;
}

export interface SyncClock {
  millis: number;
  counter: number;
}

export interface SyncEntry<T extends { id: string }> {
  value: T | null;
  stamp: SyncStamp;
}

export interface SyncDocument {
  format: typeof SYNC_FORMAT;
  version: typeof SYNC_VERSION;
  records: {
    tasks: Record<string, SyncEntry<Task>>;
    lists: Record<string, SyncEntry<List>>;
    statuses: Record<string, SyncEntry<Status>>;
    subtasks: Record<string, SyncEntry<Subtask>>;
    completions: Record<string, SyncEntry<Completion>>;
  };
}

export interface LocalDocumentState {
  document: SyncDocument;
  clock: SyncClock;
}

export class SyncDocumentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SyncDocumentError";
  }
}

const COLLECTION_LIMITS = {
  tasks: 100_000,
  lists: 4_000,
  statuses: 200,
  subtasks: 400_000,
  completions: 1_000_000,
} as const;

type CollectionName = keyof SyncDocument["records"];

const COLLECTIONS: readonly CollectionName[] = [
  "tasks",
  "lists",
  "statuses",
  "subtasks",
  "completions",
];

function fail(message: string): never {
  throw new SyncDocumentError(message);
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

function parseStamp(value: unknown, label: string): SyncStamp {
  const source = record(value, label);
  if (
    !Number.isSafeInteger(source.millis) ||
    (source.millis as number) < 0 ||
    !Number.isSafeInteger(source.counter) ||
    (source.counter as number) < 0 ||
    typeof source.deviceId !== "string" ||
    !validId(source.deviceId)
  ) {
    fail(`${label} is invalid.`);
  }
  return {
    millis: source.millis as number,
    counter: source.counter as number,
    deviceId: source.deviceId,
  };
}

function validateLiveDocument(document: SyncDocument): SyncDocument {
  try {
    validateBackup({
      format: BACKUP_FORMAT,
      version: BACKUP_VERSION,
      exportedAt: new Date().toISOString(),
      data: documentToSnapshot(document),
    });
  } catch {
    fail("Encrypted sync data contains invalid task records.");
  }
  return document;
}

export function parseSyncDocument(value: unknown): SyncDocument {
  const root = record(value, "Sync document");
  if (root.format !== SYNC_FORMAT || root.version !== SYNC_VERSION) {
    fail("Encrypted sync data uses an unsupported format.");
  }
  const sourceRecords = record(root.records, "Sync records");
  const parsedRecords: Partial<SyncDocument["records"]> = {};

  for (const collection of COLLECTIONS) {
    const sourceCollection = record(
      sourceRecords[collection],
      `Sync ${collection}`,
    );
    const rows = Object.entries(sourceCollection);
    if (rows.length > COLLECTION_LIMITS[collection]) {
      fail(`Sync ${collection} contains too many records.`);
    }

    const output: Record<string, SyncEntry<{ id: string }>> =
      Object.create(null) as Record<string, SyncEntry<{ id: string }>>;
    for (const [id, rawEntry] of rows) {
      if (!validId(id)) fail(`Sync ${collection} contains an invalid ID.`);
      const entry = record(rawEntry, `Sync ${collection} entry`);
      const valueRecord =
        entry.value === null
          ? null
          : record(entry.value, `Sync ${collection} value`);
      if (valueRecord !== null && valueRecord.id !== id) {
        fail(`Sync ${collection} contains a mismatched record ID.`);
      }
      output[id] = {
        value: valueRecord as { id: string } | null,
        stamp: parseStamp(entry.stamp, `Sync ${collection} stamp`),
      };
    }
    Object.assign(parsedRecords, { [collection]: output });
  }

  return validateLiveDocument({
    format: SYNC_FORMAT,
    version: SYNC_VERSION,
    records: parsedRecords as SyncDocument["records"],
  });
}

export function emptySyncDocument(): SyncDocument {
  return {
    format: SYNC_FORMAT,
    version: SYNC_VERSION,
    records: {
      tasks: Object.create(null) as SyncDocument["records"]["tasks"],
      lists: Object.create(null) as SyncDocument["records"]["lists"],
      statuses: Object.create(null) as SyncDocument["records"]["statuses"],
      subtasks: Object.create(null) as SyncDocument["records"]["subtasks"],
      completions:
        Object.create(null) as SyncDocument["records"]["completions"],
    },
  };
}

export function compareStamps(left: SyncStamp, right: SyncStamp): number {
  if (left.millis !== right.millis) return left.millis - right.millis;
  if (left.counter !== right.counter) return left.counter - right.counter;
  return left.deviceId.localeCompare(right.deviceId);
}

function observeStamp(clock: SyncClock, stamp: SyncStamp): SyncClock {
  if (stamp.millis > clock.millis) {
    return { millis: stamp.millis, counter: stamp.counter };
  }
  if (stamp.millis === clock.millis && stamp.counter > clock.counter) {
    return { millis: clock.millis, counter: stamp.counter };
  }
  return clock;
}

export function observeDocumentClock(
  clock: SyncClock,
  document: SyncDocument,
): SyncClock {
  let next = clock;
  for (const collection of COLLECTIONS) {
    for (const entry of Object.values(document.records[collection])) {
      next = observeStamp(next, entry.stamp);
    }
  }
  return next;
}

function tickClock(
  clock: SyncClock,
  deviceId: string,
  now: number,
): { clock: SyncClock; stamp: SyncStamp } {
  const millis = Math.max(now, clock.millis);
  const counter = millis === clock.millis ? clock.counter + 1 : 0;
  return {
    clock: { millis, counter },
    stamp: { millis, counter, deviceId },
  };
}

function valuesEqual(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function reconcileCollection<T extends { id: string }>(
  items: T[],
  previous: Record<string, SyncEntry<T>>,
  nextStamp: () => SyncStamp,
): Record<string, SyncEntry<T>> {
  const current = new Map(items.map((item) => [item.id, item]));
  const ids = [...new Set([...Object.keys(previous), ...current.keys()])].sort();
  const result = Object.create(null) as Record<string, SyncEntry<T>>;

  for (const id of ids) {
    const item = current.get(id);
    const oldEntry = previous[id];
    if (item) {
      result[id] =
        oldEntry?.value && valuesEqual(oldEntry.value, item)
          ? oldEntry
          : { value: item, stamp: nextStamp() };
    } else if (oldEntry) {
      result[id] =
        oldEntry.value === null
          ? oldEntry
          : { value: null, stamp: nextStamp() };
    }
  }
  return result;
}

export function buildLocalDocument(
  snapshot: RepoSnapshot,
  previous: SyncDocument | null,
  initialClock: SyncClock,
  deviceId: string,
  now = Date.now(),
): LocalDocumentState {
  const prior = previous ?? emptySyncDocument();
  let clock = observeDocumentClock(initialClock, prior);
  const nextStamp = () => {
    const next = tickClock(clock, deviceId, now);
    clock = next.clock;
    return next.stamp;
  };

  const document: SyncDocument = {
    format: SYNC_FORMAT,
    version: SYNC_VERSION,
    records: {
      tasks: reconcileCollection(
        snapshot.tasks,
        prior.records.tasks,
        nextStamp,
      ),
      lists: reconcileCollection(
        snapshot.lists,
        prior.records.lists,
        nextStamp,
      ),
      statuses: reconcileCollection(
        snapshot.statuses,
        prior.records.statuses,
        nextStamp,
      ),
      subtasks: reconcileCollection(
        snapshot.subtasks,
        prior.records.subtasks,
        nextStamp,
      ),
      completions: reconcileCollection(
        snapshot.completions,
        prior.records.completions,
        nextStamp,
      ),
    },
  };
  return { document, clock };
}

function mergeCollection<T extends { id: string }>(
  left: Record<string, SyncEntry<T>>,
  right: Record<string, SyncEntry<T>>,
): Record<string, SyncEntry<T>> {
  const ids = [...new Set([...Object.keys(left), ...Object.keys(right)])].sort();
  const merged = Object.create(null) as Record<string, SyncEntry<T>>;
  for (const id of ids) {
    const leftEntry = left[id];
    const rightEntry = right[id];
    if (!leftEntry) {
      merged[id] = rightEntry;
    } else if (!rightEntry) {
      merged[id] = leftEntry;
    } else {
      merged[id] =
        compareStamps(leftEntry.stamp, rightEntry.stamp) >= 0
          ? leftEntry
          : rightEntry;
    }
  }
  return merged;
}

export function mergeSyncDocuments(
  left: SyncDocument,
  right: SyncDocument,
): SyncDocument {
  return {
    format: SYNC_FORMAT,
    version: SYNC_VERSION,
    records: {
      tasks: mergeCollection(left.records.tasks, right.records.tasks),
      lists: mergeCollection(left.records.lists, right.records.lists),
      statuses: mergeCollection(left.records.statuses, right.records.statuses),
      subtasks: mergeCollection(left.records.subtasks, right.records.subtasks),
      completions: mergeCollection(
        left.records.completions,
        right.records.completions,
      ),
    },
  };
}

export function normalizeMergedDocument(
  input: SyncDocument,
  initialClock: SyncClock,
  deviceId: string,
  now = Date.now(),
): LocalDocumentState {
  const document = structuredClone(input);
  let clock = observeDocumentClock(initialClock, document);
  const nextStamp = () => {
    const next = tickClock(clock, deviceId, now);
    clock = next.clock;
    return next.stamp;
  };

  const liveStatuses = Object.values(document.records.statuses)
    .flatMap((entry) => (entry.value ? [entry.value] : []))
    .sort((left, right) => left.sortOrder - right.sortOrder);
  const firstOpenStatus = liveStatuses.find((status) => !status.isDone);
  if (!firstOpenStatus) {
    fail("Synced data does not contain an open task status.");
  }
  const statusIds = new Set(liveStatuses.map((status) => status.id));
  const listIds = new Set(
    Object.values(document.records.lists).flatMap((entry) =>
      entry.value ? [entry.value.id] : [],
    ),
  );

  for (const [id, entry] of Object.entries(document.records.tasks)) {
    if (!entry.value) continue;
    let task = entry.value;
    if (task.listId !== null && !listIds.has(task.listId)) {
      task = { ...task, listId: null };
    }
    if (!statusIds.has(task.statusId)) {
      task = { ...task, statusId: firstOpenStatus.id };
    }
    if (task !== entry.value) {
      document.records.tasks[id] = { value: task, stamp: nextStamp() };
    }
  }

  const taskIds = new Set(
    Object.values(document.records.tasks).flatMap((entry) =>
      entry.value ? [entry.value.id] : [],
    ),
  );
  for (const [id, entry] of Object.entries(document.records.subtasks)) {
    if (entry.value && !taskIds.has(entry.value.taskId)) {
      document.records.subtasks[id] = { value: null, stamp: nextStamp() };
    }
  }
  for (const [id, entry] of Object.entries(document.records.completions)) {
    if (entry.value && !taskIds.has(entry.value.taskId)) {
      document.records.completions[id] = {
        value: null,
        stamp: nextStamp(),
      };
    }
  }

  const completionByDate = new Map<string, string>();
  for (const [id, entry] of Object.entries(document.records.completions)) {
    if (!entry.value) continue;
    const key = `${entry.value.taskId}\u0000${entry.value.dueDate}`;
    const existingId = completionByDate.get(key);
    if (!existingId) {
      completionByDate.set(key, id);
      continue;
    }
    const existing = document.records.completions[existingId];
    const loser =
      compareStamps(existing.stamp, entry.stamp) >= 0 ? id : existingId;
    const winner = loser === id ? existingId : id;
    document.records.completions[loser] = {
      value: null,
      stamp: nextStamp(),
    };
    completionByDate.set(key, winner);
  }

  validateLiveDocument(document);
  return { document, clock };
}

export function documentToSnapshot(document: SyncDocument): RepoSnapshot {
  const live = <T extends { id: string }>(
    entries: Record<string, SyncEntry<T>>,
  ) =>
    Object.values(entries).flatMap((entry) =>
      entry.value ? [entry.value] : [],
    );

  return {
    tasks: live(document.records.tasks).sort(
      (left, right) => left.sortOrder - right.sortOrder,
    ),
    lists: live(document.records.lists).sort(
      (left, right) => left.sortOrder - right.sortOrder,
    ),
    statuses: live(document.records.statuses).sort(
      (left, right) => left.sortOrder - right.sortOrder,
    ),
    subtasks: live(document.records.subtasks).sort(
      (left, right) => left.sortOrder - right.sortOrder,
    ),
    completions: live(document.records.completions).sort((left, right) =>
      left.dueDate.localeCompare(right.dueDate),
    ),
  };
}

export function syncDocumentsEqual(
  left: SyncDocument,
  right: SyncDocument,
): boolean {
  return valuesEqual(left, right);
}
