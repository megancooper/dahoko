import {
  MAX_ENCRYPTED_SYNC_BYTES,
  parseEncryptedSyncBlob,
  type EncryptedSyncBlob,
} from "./crypto";

const REQUEST_TIMEOUT_MS = 15_000;
const MAX_RESPONSE_TEXT = MAX_ENCRYPTED_SYNC_BYTES * 2 + 32_000;

export interface SyncAuthResponse {
  token: string;
  encryptionSalt: string;
}

export interface RemoteSyncState {
  revision: number;
  blob: EncryptedSyncBlob | null;
}

export class SyncApiError extends Error {
  readonly status: number;
  readonly remote: RemoteSyncState | null;

  constructor(message: string, status = 0, remote: RemoteSyncState | null = null) {
    super(message);
    this.name = "SyncApiError";
    this.status = status;
    this.remote = remote;
  }
}

export function normalizeSyncServerUrl(value: string): string {
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    throw new SyncApiError("Enter a valid sync server URL.");
  }
  if (url.username || url.password || url.search || url.hash) {
    throw new SyncApiError("The sync server URL cannot contain credentials or query parameters.");
  }
  const loopback =
    url.hostname === "localhost" ||
    url.hostname === "127.0.0.1" ||
    url.hostname === "[::1]";
  if (url.protocol !== "https:" && !(url.protocol === "http:" && loopback)) {
    throw new SyncApiError(
      "Sync requires HTTPS. Plain HTTP is allowed only for this device.",
    );
  }
  return url.toString().replace(/\/+$/, "");
}

async function fetchJson(
  url: string,
  init: RequestInit,
): Promise<{ response: Response; value: unknown }> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      cache: "no-store",
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        ...init.headers,
      },
    });
  } catch (error) {
    throw new SyncApiError(
      error instanceof DOMException && error.name === "AbortError"
        ? "The sync server took too long to respond."
        : "The sync server could not be reached.",
    );
  } finally {
    window.clearTimeout(timeout);
  }

  const text = await response.text();
  if (text.length > MAX_RESPONSE_TEXT) {
    throw new SyncApiError("The sync server returned too much data.", response.status);
  }
  let value: unknown = {};
  if (text) {
    try {
      value = JSON.parse(text) as unknown;
    } catch {
      throw new SyncApiError("The sync server returned an invalid response.", response.status);
    }
  }
  return { response, value };
}

function responseRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function errorMessage(value: unknown, fallback: string): string {
  const message = responseRecord(value).error;
  return typeof message === "string" && message.length <= 240
    ? message
    : fallback;
}

function parseAuthResponse(value: unknown): SyncAuthResponse {
  const source = responseRecord(value);
  if (
    typeof source.token !== "string" ||
    source.token.length < 32 ||
    source.token.length > 256 ||
    typeof source.encryptionSalt !== "string" ||
    source.encryptionSalt.length < 40 ||
    source.encryptionSalt.length > 64
  ) {
    throw new SyncApiError("The sync server returned invalid account details.");
  }
  return {
    token: source.token,
    encryptionSalt: source.encryptionSalt,
  };
}

function parseRemoteState(value: unknown): RemoteSyncState {
  const source = responseRecord(value);
  if (
    !Number.isSafeInteger(source.revision) ||
    (source.revision as number) < 0
  ) {
    throw new SyncApiError("The sync server returned an invalid revision.");
  }
  return {
    revision: source.revision as number,
    blob: source.blob === null ? null : parseEncryptedSyncBlob(source.blob),
  };
}

export async function authenticateSyncAccount(
  serverUrl: string,
  mode: "register" | "login",
  email: string,
  password: string,
): Promise<SyncAuthResponse> {
  const { response, value } = await fetchJson(
    `${serverUrl}/v1/auth/${mode}`,
    {
      method: "POST",
      body: JSON.stringify({ email, password }),
    },
  );
  if (!response.ok) {
    throw new SyncApiError(
      errorMessage(value, "The account could not be authenticated."),
      response.status,
    );
  }
  return parseAuthResponse(value);
}

export async function getRemoteSyncState(
  serverUrl: string,
  token: string,
): Promise<RemoteSyncState> {
  const { response, value } = await fetchJson(`${serverUrl}/v1/sync`, {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    throw new SyncApiError(
      errorMessage(value, "Encrypted sync data could not be downloaded."),
      response.status,
    );
  }
  return parseRemoteState(value);
}

export async function putRemoteSyncState(
  serverUrl: string,
  token: string,
  baseRevision: number,
  blob: EncryptedSyncBlob,
): Promise<RemoteSyncState> {
  const { response, value } = await fetchJson(`${serverUrl}/v1/sync`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ baseRevision, blob }),
  });
  if (response.status === 409) {
    throw new SyncApiError(
      "Another device synced first; merging its changes.",
      409,
      parseRemoteState(value),
    );
  }
  if (!response.ok) {
    throw new SyncApiError(
      errorMessage(value, "Encrypted sync data could not be uploaded."),
      response.status,
    );
  }
  return parseRemoteState(value);
}

export async function logoutSyncAccount(
  serverUrl: string,
  token: string,
): Promise<void> {
  try {
    await fetchJson(`${serverUrl}/v1/auth/logout`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: "{}",
    });
  } catch {
    // Local disconnect still succeeds when the server is offline.
  }
}

export async function deleteSyncAccount(
  serverUrl: string,
  token: string,
  password: string,
): Promise<void> {
  const { response, value } = await fetchJson(`${serverUrl}/v1/account`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ password }),
  });
  if (!response.ok) {
    throw new SyncApiError(
      errorMessage(value, "The encrypted sync account could not be deleted."),
      response.status,
    );
  }
}
