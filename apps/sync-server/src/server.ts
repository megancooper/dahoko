import {
  createHash,
  createHmac,
  randomBytes,
  randomUUID,
  scrypt as scryptCallback,
  timingSafeEqual,
} from "node:crypto";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import {
  Billing,
  BillingError,
  subscriptionIsActive,
  type BillingOptions,
  type PlanInterval,
} from "./billing.js";
import {
  SqliteStore,
  type AccountRow,
  type AuthenticatedAccount,
  type EncryptedBlob,
  type Store,
} from "./store.js";
import { log } from "./telemetry.js";

const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1_000;
const AUTH_WINDOW_MS = 15 * 60 * 1_000;
const AUTH_ATTEMPTS_PER_WINDOW = 10;
const DEFAULT_MAX_BLOB_BYTES = 14 * 1024 * 1024;
const MAX_EMAIL_LENGTH = 254;
const MIN_PASSWORD_LENGTH = 12;
const MAX_PASSWORD_LENGTH = 256;
const MAX_RATE_LIMIT_KEYS = 20_000;

type JsonObject = Record<string, unknown>;

export interface SyncServerOptions {
  /** SQLite path used when no explicit store is provided. */
  databasePath: string;
  /** Overrides SQLite — e.g. a PgStore pointed at DATABASE_URL. */
  store?: Store;
  allowedOrigins: string[];
  accountHashKey: string;
  trustProxy?: boolean;
  maxBlobBytes?: number;
  sessionDurationMs?: number;
  scryptCost?: number;
  now?: () => number;
  /** Stripe billing for hosted Dahoko Cloud; omit to run without billing. */
  billing?: BillingOptions | null;
}

export interface SyncServer {
  server: ReturnType<typeof createServer>;
  close: () => Promise<void>;
}


class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

class RateLimiter {
  private readonly attempts = new Map<string, number[]>();

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
    private readonly now: () => number,
  ) {}

  consume(key: string): boolean {
    const cutoff = this.now() - this.windowMs;
    if (!this.attempts.has(key) && this.attempts.size >= MAX_RATE_LIMIT_KEYS) {
      return false;
    }
    const recent = (this.attempts.get(key) ?? []).filter(
      (timestamp) => timestamp > cutoff,
    );
    if (recent.length >= this.limit) {
      this.attempts.set(key, recent);
      return false;
    }
    recent.push(this.now());
    this.attempts.set(key, recent);
    if (this.attempts.size >= MAX_RATE_LIMIT_KEYS) {
      for (const [candidate, timestamps] of this.attempts) {
        if (timestamps.every((timestamp) => timestamp <= cutoff)) {
          this.attempts.delete(candidate);
        }
      }
    }
    return true;
  }
}


function normalizeEmail(value: unknown): string {
  if (typeof value !== "string") {
    throw new HttpError(400, "Enter a valid email and password.");
  }
  const email = value.trim().normalize("NFKC").toLowerCase();
  if (
    email.length < 3 ||
    email.length > MAX_EMAIL_LENGTH ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(email)
  ) {
    throw new HttpError(400, "Enter a valid email and password.");
  }
  return email;
}

function validatePassword(value: unknown): string {
  if (
    typeof value !== "string" ||
    value.length < MIN_PASSWORD_LENGTH ||
    value.length > MAX_PASSWORD_LENGTH
  ) {
    throw new HttpError(
      400,
      `Passwords must be ${MIN_PASSWORD_LENGTH}–${MAX_PASSWORD_LENGTH} characters.`,
    );
  }
  return value;
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function emailLookupHash(email: string, key: string): string {
  return createHmac("sha256", key).update(email).digest("hex");
}

function derivePasswordHash(
  password: string,
  salt: Buffer,
  cost: number,
  r: number,
  p: number,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCallback(
      password,
      salt,
      32,
      {
        N: cost,
        r,
        p,
        maxmem: Math.max(64 * 1024 * 1024, 256 * cost * r),
      },
      (error, derived) => {
        if (error) reject(error);
        else resolve(derived);
      },
    );
  });
}

async function hashPassword(password: string, cost: number): Promise<string> {
  const salt = randomBytes(16);
  const derived = await derivePasswordHash(password, salt, cost, 8, 1);
  return [
    "scrypt",
    cost,
    8,
    1,
    salt.toString("base64"),
    derived.toString("base64"),
  ].join("$");
}

async function verifyPassword(
  password: string,
  encoded: string,
): Promise<boolean> {
  const [algorithm, costText, rText, pText, saltText, hashText] =
    encoded.split("$");
  const cost = Number(costText);
  const r = Number(rText);
  const p = Number(pText);
  if (
    algorithm !== "scrypt" ||
    !Number.isSafeInteger(cost) ||
    cost < 1_024 ||
    cost > 1_048_576 ||
    (cost & (cost - 1)) !== 0 ||
    !Number.isSafeInteger(r) ||
    r < 1 ||
    r > 32 ||
    !Number.isSafeInteger(p) ||
    p < 1 ||
    p > 16
  ) {
    return false;
  }
  try {
    const expected = Buffer.from(hashText, "base64");
    const salt = Buffer.from(saltText, "base64");
    if (expected.byteLength !== 32 || salt.byteLength !== 16) return false;
    const actual = await derivePasswordHash(
      password,
      salt,
      cost,
      r,
      p,
    );
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}

function clientAddress(request: IncomingMessage, trustProxy: boolean): string {
  if (trustProxy) {
    const forwarded = request.headers["x-forwarded-for"];
    const value = Array.isArray(forwarded) ? forwarded[0] : forwarded;
    const first = value?.split(",")[0]?.trim();
    if (first) return first.slice(0, 128);
  }
  return request.socket.remoteAddress ?? "unknown";
}

async function readJsonBody(
  request: IncomingMessage,
  maxBytes: number,
): Promise<JsonObject> {
  const contentType = request.headers["content-type"] ?? "";
  if (!contentType.toLowerCase().startsWith("application/json")) {
    throw new HttpError(415, "Requests must use application/json.");
  }
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const rawChunk of request) {
    const chunk = Buffer.isBuffer(rawChunk) ? rawChunk : Buffer.from(rawChunk);
    size += chunk.byteLength;
    if (size > maxBytes) throw new HttpError(413, "The request is too large.");
    chunks.push(chunk);
  }
  try {
    const value = JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
      throw new Error("not an object");
    }
    return value as JsonObject;
  } catch {
    throw new HttpError(400, "The request body is invalid.");
  }
}

async function readRawBody(
  request: IncomingMessage,
  maxBytes: number,
): Promise<string> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const rawChunk of request) {
    const chunk = Buffer.isBuffer(rawChunk) ? rawChunk : Buffer.from(rawChunk);
    size += chunk.byteLength;
    if (size > maxBytes) throw new HttpError(413, "The request is too large.");
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
}

function validBase64(value: string): boolean {
  return /^[A-Za-z0-9+/]+={0,2}$/.test(value);
}

function validateBlob(
  value: unknown,
  expectedSalt: string,
  maxBlobBytes: number,
): EncryptedBlob {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new HttpError(400, "The encrypted sync blob is invalid.");
  }
  const blob = value as Record<string, unknown>;
  if (
    blob.version !== 1 ||
    blob.algorithm !== "AES-256-GCM" ||
    blob.kdf !== "PBKDF2-SHA256" ||
    blob.iterations !== 600_000 ||
    blob.salt !== expectedSalt ||
    typeof blob.nonce !== "string" ||
    blob.nonce.length !== 16 ||
    !validBase64(blob.nonce) ||
    typeof blob.ciphertext !== "string" ||
    blob.ciphertext.length < 24 ||
    blob.ciphertext.length > Math.ceil((maxBlobBytes * 4) / 3) + 4 ||
    !validBase64(blob.ciphertext)
  ) {
    throw new HttpError(400, "The encrypted sync blob is invalid.");
  }
  return blob as unknown as EncryptedBlob;
}

function writeJson(
  response: ServerResponse,
  status: number,
  value: unknown,
) {
  const body = JSON.stringify(value);
  response.statusCode = status;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Content-Length", Buffer.byteLength(body));
  response.end(body);
}

function applySecurityHeaders(
  request: IncomingMessage,
  response: ServerResponse,
  allowedOrigins: Set<string>,
): boolean {
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("Referrer-Policy", "no-referrer");
  response.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
  const origin = request.headers.origin;
  if (!origin) return true;
  if (!allowedOrigins.has(origin)) return false;
  response.setHeader("Access-Control-Allow-Origin", origin);
  response.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");
  response.setHeader(
    "Access-Control-Allow-Methods",
    "GET, PUT, POST, DELETE, OPTIONS",
  );
  response.setHeader("Access-Control-Max-Age", "600");
  response.setHeader("Vary", "Origin");
  return true;
}

function bearerToken(request: IncomingMessage): string {
  const authorization = request.headers.authorization;
  const match = authorization?.match(/^Bearer ([A-Za-z0-9_-]{43})$/);
  if (!match) throw new HttpError(401, "Authentication is required.");
  return match[1];
}

export function createSyncServer(options: SyncServerOptions): SyncServer {
  if (Buffer.byteLength(options.accountHashKey, "utf8") < 32) {
    throw new Error("accountHashKey must contain at least 32 bytes.");
  }
  const now = options.now ?? Date.now;
  const maxBlobBytes = options.maxBlobBytes ?? DEFAULT_MAX_BLOB_BYTES;
  const sessionDuration = options.sessionDurationMs ?? SESSION_DURATION_MS;
  const passwordCost = options.scryptCost ?? 32_768;
  const allowedOrigins = new Set(options.allowedOrigins);
  const store = options.store ?? new SqliteStore(options.databasePath);
  const billing = options.billing
    ? new Billing({ ...options.billing, now: options.billing.now ?? now }, store)
    : null;
  const rateLimiter = new RateLimiter(
    AUTH_ATTEMPTS_PER_WINDOW,
    AUTH_WINDOW_MS,
    now,
  );
  const dummyPasswordHashPromise = hashPassword(
    randomBytes(32).toString("base64url"),
    passwordCost,
  );
  let requestCount = 0;

  const authenticate = async (
    request: IncomingMessage,
  ): Promise<AuthenticatedAccount> => {
    const token = bearerToken(request);
    const account = await store.accountForSession(sha256(token), now());
    if (!account) throw new HttpError(401, "Authentication is required.");
    return account;
  };

  const server = createServer(async (request, response) => {
    const requestId = randomUUID();
    const startedAt = Date.now();
    response.setHeader("X-Request-Id", requestId);
    let path = "/";
    try {
      path = new URL(request.url ?? "/", "http://localhost").pathname;
      if (!applySecurityHeaders(request, response, allowedOrigins)) {
        throw new HttpError(403, "This app origin is not allowed.");
      }
      if (request.method === "OPTIONS") {
        response.statusCode = 204;
        response.end();
        return;
      }
      if (request.method === "GET" && path === "/health") {
        writeJson(response, 200, {
          status: "ok",
          protocol: 1,
          billing: billing !== null,
        });
        return;
      }

      // Stripe calls this endpoint directly; it is authenticated by the
      // webhook signature instead of a bearer token.
      if (request.method === "POST" && path === "/v1/stripe/webhook") {
        if (!billing) throw new HttpError(404, "Not found.");
        const signature = request.headers["stripe-signature"];
        if (typeof signature !== "string") {
          throw new HttpError(400, "The webhook signature is missing.");
        }
        const payload = await readRawBody(request, 256 * 1024);
        billing.verifyWebhookSignature(payload, signature);
        try {
          await billing.processWebhookEvent(payload);
        } catch (error) {
          // Non-signature failures are logged but acknowledged so Stripe
          // retries on transient errors without flagging the endpoint.
          log.error("stripe_webhook_error", error, { requestId });
          if (error instanceof BillingError && error.status < 500) {
            throw error;
          }
        }
        writeJson(response, 200, { received: true });
        return;
      }

      if (path === "/v1/billing" && request.method === "GET") {
        if (!billing) throw new HttpError(404, "Not found.");
        const account = await authenticate(request);
        writeJson(response, 200, {
          subscription: await billing.subscriptionForAccount(account.id),
          syncRequiresSubscription: billing.requiresSubscriptionForSync,
        });
        return;
      }

      if (path === "/v1/billing/sync" && request.method === "POST") {
        if (!billing) throw new HttpError(404, "Not found.");
        const account = await authenticate(request);
        writeJson(response, 200, {
          subscription: await billing.syncForAccount(account.id),
        });
        return;
      }

      if (path === "/v1/billing/checkout" && request.method === "POST") {
        if (!billing) throw new HttpError(404, "Not found.");
        const account = await authenticate(request);
        const body = await readJsonBody(request, 8_192);
        // The server stores only an HMAC of the account email; the client
        // re-sends it here so Stripe can issue receipts. It is passed
        // through to Stripe and never persisted locally.
        const email = normalizeEmail(body.email);
        const interval: PlanInterval =
          body.interval === "yearly" ? "yearly" : "monthly";
        writeJson(
          response,
          200,
          await billing.createCheckoutSession(account.id, email, interval),
        );
        return;
      }

      if (path === "/v1/billing/portal" && request.method === "POST") {
        if (!billing) throw new HttpError(404, "Not found.");
        const account = await authenticate(request);
        writeJson(response, 200, await billing.createPortalSession(account.id));
        return;
      }
      if (
        request.method === "POST" &&
        (path === "/v1/auth/register" || path === "/v1/auth/login")
      ) {
        const body = await readJsonBody(request, 8_192);
        const email = normalizeEmail(body.email);
        const password = validatePassword(body.password);
        const emailHash = emailLookupHash(email, options.accountHashKey);
        const address = clientAddress(request, options.trustProxy ?? false);
        if (
          !rateLimiter.consume(`ip:${address}`) ||
          !rateLimiter.consume(`account:${emailHash}`)
        ) {
          throw new HttpError(429, "Too many attempts. Try again later.");
        }

        let account: AccountRow | null;
        if (path.endsWith("/register")) {
          const passwordHash = await hashPassword(password, passwordCost);
          const encryptionSalt = randomBytes(32).toString("base64");
          const accountId = await store.createAccount(
            emailHash,
            passwordHash,
            encryptionSalt,
            now(),
          );
          if (!accountId) {
            throw new HttpError(409, "The account could not be created.");
          }
          account = {
            id: accountId,
            password_hash: passwordHash,
            encryption_salt: encryptionSalt,
          };
        } else {
          account = await store.accountByEmailHash(emailHash);
          const encodedHash =
            account?.password_hash ?? (await dummyPasswordHashPromise);
          if (!(await verifyPassword(password, encodedHash)) || !account) {
            throw new HttpError(401, "The email or password is incorrect.");
          }
        }

        const token = randomBytes(32).toString("base64url");
        await store.createSession(
          account.id,
          sha256(token),
          now() + sessionDuration,
          now(),
        );
        writeJson(response, 200, {
          token,
          encryptionSalt: account.encryption_salt,
        });
        return;
      }

      if (request.method === "POST" && path === "/v1/auth/logout") {
        const token = bearerToken(request);
        await store.deleteSession(sha256(token));
        writeJson(response, 200, { ok: true });
        return;
      }

      if (request.method === "DELETE" && path === "/v1/account") {
        const account = await authenticate(request);
        const body = await readJsonBody(request, 8_192);
        const password = validatePassword(body.password);
        const address = clientAddress(request, options.trustProxy ?? false);
        if (
          !rateLimiter.consume(`delete-ip:${address}`) ||
          !rateLimiter.consume(`delete-account:${account.id}`)
        ) {
          throw new HttpError(429, "Too many attempts. Try again later.");
        }
        const storedAccount = await store.accountById(account.id);
        if (
          !storedAccount ||
          !(await verifyPassword(password, storedAccount.password_hash))
        ) {
          throw new HttpError(401, "The account password is incorrect.");
        }
        await store.deleteAccount(account.id);
        writeJson(response, 200, { ok: true });
        return;
      }

      if (request.method === "GET" && path === "/v1/sync") {
        const account = await authenticate(request);
        const state = await store.syncState(account.id);
        if (!state) throw new HttpError(401, "Authentication is required.");
        writeJson(response, 200, state);
        return;
      }

      if (request.method === "PUT" && path === "/v1/sync") {
        const account = await authenticate(request);
        // Uploads are gated on Dahoko Cloud Pro; downloads stay open so a
        // lapsed subscription never holds anyone's data hostage.
        if (
          billing?.requiresSubscriptionForSync &&
          !subscriptionIsActive(await billing.subscriptionForAccount(account.id))
        ) {
          throw new HttpError(
            402,
            "Hosted sync uploads need an active Dahoko Cloud subscription. Your data stays downloadable.",
          );
        }
        const body = await readJsonBody(
          request,
          Math.ceil((maxBlobBytes * 4) / 3) + 32_000,
        );
        if (
          !Number.isSafeInteger(body.baseRevision) ||
          (body.baseRevision as number) < 0
        ) {
          throw new HttpError(400, "The base revision is invalid.");
        }
        const blob = validateBlob(
          body.blob,
          account.encryptionSalt,
          maxBlobBytes,
        );
        const result = await store.compareAndSwapSync(
          account.id,
          body.baseRevision as number,
          blob,
          now(),
        );
        writeJson(response, result.saved ? 200 : 409, result.state);
        return;
      }

      throw new HttpError(404, "Not found.");
    } catch (error) {
      if (error instanceof HttpError || error instanceof BillingError) {
        writeJson(response, error.status, { error: error.message });
      } else {
        log.error("sync_server_error", error, {
          requestId,
          path,
          method: request.method,
        });
        writeJson(response, 500, {
          error: "An unexpected server error occurred.",
          requestId,
        });
      }
    } finally {
      // One wide event per request; 2xx/3xx stay at debug so the default
      // info level only ships actionable traffic.
      const status = response.statusCode;
      const level =
        status >= 500 ? "warn" : status >= 400 ? "info" : "debug";
      log[level]("http_request", {
        requestId,
        method: request.method,
        path,
        status,
        durationMs: Date.now() - startedAt,
      });
      requestCount += 1;
      if (requestCount % 1_000 === 0) void store.cleanupSessions(now()).catch(() => {});
    }
  });

  return {
    server,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => {
          void store.close().then(
            () => (error ? reject(error) : resolve()),
            (closeError) => reject(error ?? closeError),
          );
        });
      }),
  };
}
