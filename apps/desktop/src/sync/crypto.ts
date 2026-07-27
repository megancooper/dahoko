import {
  parseSyncBundleDocument,
  type SyncBundleDocument,
} from "./bundle";

export const SYNC_KDF_ITERATIONS = 600_000;
export const MAX_ENCRYPTED_SYNC_BYTES = 14 * 1024 * 1024;

export interface EncryptedSyncBlob {
  version: 1;
  algorithm: "AES-256-GCM";
  kdf: "PBKDF2-SHA256";
  iterations: typeof SYNC_KDF_ITERATIONS;
  salt: string;
  nonce: string;
  ciphertext: string;
}

export class SyncCryptoError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SyncCryptoError";
  }
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 32_768;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(
      ...bytes.subarray(offset, offset + chunkSize),
    );
  }
  return btoa(binary);
}

function base64ToBytes(value: string, label: string): Uint8Array {
  if (
    value.length === 0 ||
    value.length > MAX_ENCRYPTED_SYNC_BYTES * 2 ||
    !/^[A-Za-z0-9+/]+={0,2}$/.test(value)
  ) {
    throw new SyncCryptoError(`${label} is invalid.`);
  }
  try {
    const binary = atob(value);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }
    return bytes;
  } catch {
    throw new SyncCryptoError(`${label} is invalid.`);
  }
}

export function parseEncryptedSyncBlob(value: unknown): EncryptedSyncBlob {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new SyncCryptoError("The server returned an invalid encrypted blob.");
  }
  const source = value as Record<string, unknown>;
  if (
    source.version !== 1 ||
    source.algorithm !== "AES-256-GCM" ||
    source.kdf !== "PBKDF2-SHA256" ||
    source.iterations !== SYNC_KDF_ITERATIONS ||
    typeof source.salt !== "string" ||
    typeof source.nonce !== "string" ||
    typeof source.ciphertext !== "string"
  ) {
    throw new SyncCryptoError("The server returned an unsupported encrypted blob.");
  }
  const salt = base64ToBytes(source.salt, "Encryption salt");
  const nonce = base64ToBytes(source.nonce, "Encryption nonce");
  const ciphertext = base64ToBytes(source.ciphertext, "Encrypted data");
  if (salt.byteLength !== 32 || nonce.byteLength !== 12) {
    throw new SyncCryptoError("The server returned invalid encryption parameters.");
  }
  if (
    ciphertext.byteLength < 16 ||
    ciphertext.byteLength > MAX_ENCRYPTED_SYNC_BYTES
  ) {
    throw new SyncCryptoError("The encrypted sync data has an invalid size.");
  }
  return source as unknown as EncryptedSyncBlob;
}

export async function deriveSyncKey(
  passphrase: string,
  saltBase64: string,
): Promise<CryptoKey> {
  const salt = base64ToBytes(saltBase64, "Encryption salt");
  if (salt.byteLength !== 32) {
    throw new SyncCryptoError("The encryption salt is invalid.");
  }
  const material = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(passphrase),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt,
      iterations: SYNC_KDF_ITERATIONS,
      hash: "SHA-256",
    },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

function additionalData(salt: string): Uint8Array {
  return new TextEncoder().encode(`${SYNC_KDF_ITERATIONS}\u0000${salt}`);
}

export async function encryptSyncDocument(
  document: SyncBundleDocument,
  key: CryptoKey,
  salt: string,
): Promise<EncryptedSyncBlob> {
  const plaintext = new TextEncoder().encode(JSON.stringify(document));
  if (plaintext.byteLength > MAX_ENCRYPTED_SYNC_BYTES - 16) {
    throw new SyncCryptoError("There is too much data for one sync account.");
  }
  const nonce = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv: nonce,
      additionalData: additionalData(salt),
      tagLength: 128,
    },
    key,
    plaintext,
  );
  return {
    version: 1,
    algorithm: "AES-256-GCM",
    kdf: "PBKDF2-SHA256",
    iterations: SYNC_KDF_ITERATIONS,
    salt,
    nonce: bytesToBase64(nonce),
    ciphertext: bytesToBase64(new Uint8Array(encrypted)),
  };
}

export async function decryptSyncDocument(
  rawBlob: unknown,
  key: CryptoKey,
  expectedSalt: string,
): Promise<SyncBundleDocument> {
  const blob = parseEncryptedSyncBlob(rawBlob);
  if (blob.salt !== expectedSalt) {
    throw new SyncCryptoError("The encrypted data belongs to another account.");
  }
  const nonce = base64ToBytes(blob.nonce, "Encryption nonce");
  const ciphertext = base64ToBytes(blob.ciphertext, "Encrypted data");
  try {
    const plaintext = await crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: nonce,
        additionalData: additionalData(blob.salt),
        tagLength: 128,
      },
      key,
      ciphertext,
    );
    const json = new TextDecoder("utf-8", { fatal: true }).decode(plaintext);
    return parseSyncBundleDocument(JSON.parse(json) as unknown);
  } catch (error) {
    if (error instanceof SyncCryptoError) throw error;
    throw new SyncCryptoError(
      "The encryption passphrase is incorrect or the sync data was damaged.",
    );
  }
}
