/**
 * Client for the Dahoko sync server used by the website account area, plus
 * the browser-side decryption that lets a signed-in user view their tasks
 * without the server ever seeing plaintext. Mirrors the desktop app's
 * crypto exactly: PBKDF2-SHA-256 (600k iterations) → AES-256-GCM with the
 * account salt bound as additional authenticated data.
 */

import { reportError } from "./telemetry";

const KDF_ITERATIONS = 600_000;
const MAX_BLOB_BYTES = 14 * 1024 * 1024;

export const SYNC_SERVER_URL =
  (import.meta.env.VITE_DAHOKO_SYNC_URL as string | undefined)
    ?.trim()
    .replace(/\/+$/, "") ||
  (import.meta.env.DEV ? "http://127.0.0.1:8787" : "");

export class AccountApiError extends Error {
  constructor(
    message: string,
    readonly status = 0,
  ) {
    super(message);
    this.name = "AccountApiError";
  }
}

export interface AccountSession {
  email: string;
  token: string;
  encryptionSalt: string;
}

export interface BillingSubscription {
  status: string;
  priceId?: string | null;
  currentPeriodEnd?: number | null;
  cancelAtPeriodEnd?: boolean;
  paymentMethod?: { brand: string | null; last4: string | null } | null;
}

export interface BillingState {
  subscription: BillingSubscription;
  syncRequiresSubscription: boolean;
}

export interface RemoteSyncInfo {
  revision: number;
  blob: Record<string, unknown> | null;
  /** Approximate encrypted payload size in bytes. */
  encryptedBytes: number;
}

const SESSION_KEY = "dahoko.account.session";

export function loadSession(): AccountSession | null {
  try {
    const raw = JSON.parse(
      window.sessionStorage.getItem(SESSION_KEY) ?? "null",
    ) as Record<string, unknown> | null;
    if (
      !raw ||
      typeof raw.email !== "string" ||
      typeof raw.token !== "string" ||
      typeof raw.encryptionSalt !== "string"
    ) {
      return null;
    }
    return {
      email: raw.email,
      token: raw.token,
      encryptionSalt: raw.encryptionSalt,
    };
  } catch {
    return null;
  }
}

export function saveSession(session: AccountSession | null): void {
  try {
    if (session) {
      window.sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
    } else {
      window.sessionStorage.removeItem(SESSION_KEY);
    }
  } catch {
    // Sessions simply do not survive a reload without storage access.
  }
}

async function request(
  path: string,
  init: RequestInit & { token?: string } = {},
): Promise<{ status: number; value: Record<string, unknown> }> {
  if (!SYNC_SERVER_URL) {
    throw new AccountApiError(
      "This site build has no sync server configured.",
    );
  }
  let response: Response;
  try {
    response = await fetch(`${SYNC_SERVER_URL}${path}`, {
      ...init,
      cache: "no-store",
      headers: {
        Accept: "application/json",
        ...(init.body !== undefined
          ? { "Content-Type": "application/json" }
          : {}),
        ...(init.token ? { Authorization: `Bearer ${init.token}` } : {}),
      },
    });
  } catch {
    throw new AccountApiError("The sync server could not be reached.");
  }
  let value: unknown = {};
  const text = await response.text();
  if (text) {
    try {
      value = JSON.parse(text);
    } catch {
      throw new AccountApiError(
        "The sync server returned an invalid response.",
        response.status,
      );
    }
  }
  const record =
    typeof value === "object" && value !== null && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  if (!response.ok) {
    const message = record.error;
    const error = new AccountApiError(
      typeof message === "string" && message.length <= 240
        ? message
        : "The request could not be completed.",
      response.status,
    );
    // 4xx responses are expected account states; 5xx means a server bug.
    if (response.status >= 500) {
      reportError(error, { path, status: response.status });
    }
    throw error;
  }
  return { status: response.status, value: record };
}

export async function login(
  email: string,
  password: string,
): Promise<AccountSession> {
  const { value } = await request("/v1/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  if (
    typeof value.token !== "string" ||
    typeof value.encryptionSalt !== "string"
  ) {
    throw new AccountApiError("The server returned invalid account details.");
  }
  return {
    email: email.trim().toLowerCase(),
    token: value.token,
    encryptionSalt: value.encryptionSalt,
  };
}

export async function logout(session: AccountSession): Promise<void> {
  try {
    await request("/v1/auth/logout", {
      method: "POST",
      token: session.token,
      body: "{}",
    });
  } catch {
    // The local session is discarded regardless.
  }
}

export async function getBillingState(
  session: AccountSession,
): Promise<BillingState | null> {
  try {
    const { value } = await request("/v1/billing", { token: session.token });
    const subscription = value.subscription;
    return {
      subscription:
        typeof subscription === "object" && subscription !== null
          ? (subscription as BillingSubscription)
          : { status: "none" },
      syncRequiresSubscription: value.syncRequiresSubscription === true,
    };
  } catch (error) {
    if (error instanceof AccountApiError && error.status === 404) return null;
    throw error;
  }
}

export async function refreshBilling(
  session: AccountSession,
): Promise<void> {
  await request("/v1/billing/sync", {
    method: "POST",
    token: session.token,
    body: "{}",
  });
}

export async function startCheckout(
  session: AccountSession,
  interval: "monthly" | "yearly",
): Promise<string> {
  const { value } = await request("/v1/billing/checkout", {
    method: "POST",
    token: session.token,
    body: JSON.stringify({ email: session.email, interval }),
  });
  if (typeof value.url !== "string" || !value.url.startsWith("https://")) {
    throw new AccountApiError("Checkout could not be started.");
  }
  return value.url;
}

export async function openPortal(session: AccountSession): Promise<string> {
  const { value } = await request("/v1/billing/portal", {
    method: "POST",
    token: session.token,
    body: "{}",
  });
  if (typeof value.url !== "string" || !value.url.startsWith("https://")) {
    throw new AccountApiError("The billing portal could not be opened.");
  }
  return value.url;
}

export async function getSyncInfo(
  session: AccountSession,
): Promise<RemoteSyncInfo> {
  const { value } = await request("/v1/sync", { token: session.token });
  const revision = Number(value.revision ?? 0);
  const blob =
    typeof value.blob === "object" && value.blob !== null
      ? (value.blob as Record<string, unknown>)
      : null;
  const ciphertext = blob?.ciphertext;
  return {
    revision: Number.isFinite(revision) ? revision : 0,
    blob,
    encryptedBytes:
      typeof ciphertext === "string"
        ? Math.floor((ciphertext.length * 3) / 4)
        : 0,
  };
}

// ---------------------------------------------------------------------------
// Browser-side decryption (never sends the passphrase or plaintext anywhere)

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

export interface DecryptedTask {
  title: string;
  done: boolean;
  dueAt: string | null;
  tags: string[];
  priority: number;
}

export interface DecryptedWorkspace {
  id: string;
  name: string;
  color: string;
  sortOrder: number;
  openTasks: DecryptedTask[];
  completedCount: number;
  listCount: number;
}

export async function decryptWorkspaces(
  blob: Record<string, unknown>,
  passphrase: string,
  expectedSalt: string,
): Promise<DecryptedWorkspace[]> {
  if (
    blob.version !== 1 ||
    blob.algorithm !== "AES-256-GCM" ||
    blob.kdf !== "PBKDF2-SHA256" ||
    blob.iterations !== KDF_ITERATIONS ||
    blob.salt !== expectedSalt ||
    typeof blob.nonce !== "string" ||
    typeof blob.ciphertext !== "string" ||
    blob.ciphertext.length > MAX_BLOB_BYTES * 2
  ) {
    throw new AccountApiError("The encrypted data is in an unexpected format.");
  }
  const salt = base64ToBytes(expectedSalt);
  const material = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(passphrase),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  const key = await crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: KDF_ITERATIONS, hash: "SHA-256" },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["decrypt"],
  );
  let plaintext: ArrayBuffer;
  try {
    plaintext = await crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: base64ToBytes(blob.nonce),
        // The NUL separator must match the desktop app byte-for-byte;
        // AES-GCM rejects the ciphertext if the AAD differs at all.
        additionalData: new TextEncoder().encode(
          `${KDF_ITERATIONS}\u0000${expectedSalt}`,
        ),
        tagLength: 128,
      },
      key,
      base64ToBytes(blob.ciphertext),
    );
  } catch {
    throw new AccountApiError(
      "The passphrase is incorrect or the data was damaged.",
    );
  }
  const document = JSON.parse(
    new TextDecoder("utf-8", { fatal: true }).decode(plaintext),
  ) as Record<string, unknown>;
  return readWorkspaces(document);
}

function readWorkspaces(
  document: Record<string, unknown>,
): DecryptedWorkspace[] {
  const workspaces = document.workspaces;
  if (typeof workspaces !== "object" || workspaces === null) return [];
  const result: DecryptedWorkspace[] = [];
  for (const [id, rawEntry] of Object.entries(
    workspaces as Record<string, unknown>,
  )) {
    if (typeof rawEntry !== "object" || rawEntry === null) continue;
    const entry = rawEntry as Record<string, unknown>;
    const workspace = (entry.workspace ?? {}) as Record<string, unknown>;
    const records = (
      (entry.document as Record<string, unknown> | undefined)?.records ?? {}
    ) as Record<string, unknown>;
    const tasks = readEntries(records.tasks);
    const lists = readEntries(records.lists);
    const open: DecryptedTask[] = [];
    let completedCount = 0;
    for (const task of tasks) {
      const done = typeof task.completedAt === "string";
      if (done) {
        completedCount += 1;
        continue;
      }
      open.push({
        title: typeof task.title === "string" ? task.title : "(untitled)",
        done,
        dueAt: typeof task.dueAt === "string" ? task.dueAt : null,
        tags: Array.isArray(task.tags)
          ? task.tags.filter((tag): tag is string => typeof tag === "string")
          : [],
        priority: typeof task.priority === "number" ? task.priority : 0,
      });
    }
    open.sort((left, right) =>
      (left.dueAt ?? "9999").localeCompare(right.dueAt ?? "9999"),
    );
    result.push({
      id,
      name: typeof workspace.name === "string" ? workspace.name : id,
      color:
        typeof workspace.color === "string" ? workspace.color : "#A3D0FF",
      sortOrder:
        typeof workspace.sortOrder === "number" ? workspace.sortOrder : 0,
      openTasks: open,
      completedCount,
      listCount: lists.length,
    });
  }
  return result.sort(
    (left, right) =>
      left.sortOrder - right.sortOrder || left.name.localeCompare(right.name),
  );
}

/** Live values from a record collection, skipping tombstones. */
function readEntries(collection: unknown): Array<Record<string, unknown>> {
  if (typeof collection !== "object" || collection === null) return [];
  const values: Array<Record<string, unknown>> = [];
  for (const rawEntry of Object.values(
    collection as Record<string, unknown>,
  )) {
    if (typeof rawEntry !== "object" || rawEntry === null) continue;
    const value = (rawEntry as Record<string, unknown>).value;
    if (typeof value === "object" && value !== null) {
      values.push(value as Record<string, unknown>);
    }
  }
  return values;
}
