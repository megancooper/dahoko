import { createHmac, timingSafeEqual } from "node:crypto";
import { log } from "./telemetry.js";

/**
 * Stripe billing for hosted Dahoko Cloud, following the "single sync
 * function" architecture from t3dotgg/stripe-recommendations:
 *
 * - A Stripe customer is always created and bound to the sync account
 *   BEFORE checkout starts (the accountId ↔ customerId binding lives in
 *   the server's own database, its KV).
 * - One `syncStripeDataToDb(customerId)` function is the only writer of
 *   subscription state. The success path (app calling /v1/billing/sync)
 *   and every webhook event funnel into it, so there is no split brain.
 * - Webhooks only trigger a sync for a fixed allow-list of event types;
 *   nothing is ever trusted from the event payload beyond the customer id.
 *
 * Implemented against Stripe's REST API with fetch + form encoding rather
 * than the Stripe SDK, keeping the server's dependency surface minimal.
 */

const STRIPE_API_BASE = "https://api.stripe.com";
const WEBHOOK_TOLERANCE_SECONDS = 300;
const MAX_WEBHOOK_BYTES = 256 * 1024;

export type PlanInterval = "monthly" | "yearly";

export interface BillingOptions {
  stripeSecretKey: string;
  stripeWebhookSecret: string;
  priceIds: Record<PlanInterval, string>;
  successUrl: string;
  cancelUrl: string;
  /** When true, uploading sync data requires an active subscription. */
  requireSubscriptionForSync: boolean;
  fetchImpl?: typeof fetch;
  now?: () => number;
}

/** Mirror of the STRIPE_SUB_CACHE shape from the t3 recommendations. */
export type SubscriptionCache =
  | {
      subscriptionId: string;
      status: string;
      priceId: string | null;
      currentPeriodStart: number | null;
      currentPeriodEnd: number | null;
      cancelAtPeriodEnd: boolean;
      paymentMethod: { brand: string | null; last4: string | null } | null;
    }
  | { status: "none" };

/** Storage the billing module needs; implemented by both server stores. */
export interface BillingStore {
  stripeCustomerIdForAccount(accountId: string): Promise<string | null>;
  bindStripeCustomer(
    accountId: string,
    stripeCustomerId: string,
    now: number,
  ): Promise<void>;
  accountIdForStripeCustomer(
    stripeCustomerId: string,
  ): Promise<string | null>;
  saveSubscriptionCache(
    stripeCustomerId: string,
    cache: SubscriptionCache,
    now: number,
  ): Promise<void>;
  subscriptionCacheForCustomer(
    stripeCustomerId: string,
  ): Promise<SubscriptionCache | null>;
}

export class BillingError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "BillingError";
  }
}

/** Statuses that grant access to hosted sync uploads. */
export function subscriptionIsActive(cache: SubscriptionCache): boolean {
  return cache.status === "active" || cache.status === "trialing";
}

function formEncode(
  params: Record<string, string | number | boolean>,
): string {
  return Object.entries(params)
    .map(
      ([key, value]) =>
        `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`,
    )
    .join("&");
}

interface StripeSubscription {
  id: string;
  status: string;
  cancel_at_period_end?: boolean;
  current_period_start?: number;
  current_period_end?: number;
  items?: {
    data?: Array<{
      price?: { id?: string };
      current_period_start?: number;
      current_period_end?: number;
    }>;
  };
  default_payment_method?:
    | string
    | { card?: { brand?: string; last4?: string } }
    | null;
}

export class Billing {
  private readonly fetchImpl: typeof fetch;
  private readonly now: () => number;

  constructor(
    private readonly options: BillingOptions,
    private readonly store: BillingStore,
  ) {
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.now = options.now ?? Date.now;
  }

  get requiresSubscriptionForSync(): boolean {
    return this.options.requireSubscriptionForSync;
  }

  private async stripeRequest(
    method: "GET" | "POST",
    path: string,
    params?: Record<string, string | number | boolean>,
  ): Promise<Record<string, unknown>> {
    const url =
      method === "GET" && params
        ? `${STRIPE_API_BASE}${path}?${formEncode(params)}`
        : `${STRIPE_API_BASE}${path}`;
    let response: Response;
    try {
      response = await this.fetchImpl(url, {
        method,
        headers: {
          Authorization: `Bearer ${this.options.stripeSecretKey}`,
          ...(method === "POST"
            ? { "Content-Type": "application/x-www-form-urlencoded" }
            : {}),
        },
        body: method === "POST" && params ? formEncode(params) : undefined,
      });
    } catch {
      throw new BillingError(502, "The billing provider could not be reached.");
    }
    let value: unknown = {};
    try {
      value = await response.json();
    } catch {
      throw new BillingError(
        502,
        "The billing provider returned an invalid response.",
      );
    }
    if (!response.ok) {
      log.error("stripe_api_error", undefined, {
        path,
        status: response.status,
      });
      throw new BillingError(
        502,
        "The billing request could not be completed.",
      );
    }
    return (typeof value === "object" && value !== null
      ? value
      : {}) as Record<string, unknown>;
  }

  /**
   * Returns the Stripe customer bound to this account, creating one first
   * when missing — checkout must never start without a customer.
   */
  private async ensureCustomer(
    accountId: string,
    email: string,
  ): Promise<string> {
    const existing = await this.store.stripeCustomerIdForAccount(accountId);
    if (existing) return existing;
    const customer = await this.stripeRequest("POST", "/v1/customers", {
      email,
      "metadata[accountId]": accountId,
    });
    const customerId = customer.id;
    if (typeof customerId !== "string" || !customerId.startsWith("cus_")) {
      throw new BillingError(
        502,
        "The billing provider returned an invalid customer.",
      );
    }
    await this.store.bindStripeCustomer(accountId, customerId, this.now());
    return customerId;
  }

  async createCheckoutSession(
    accountId: string,
    email: string,
    interval: PlanInterval,
  ): Promise<{ url: string }> {
    const priceId = this.options.priceIds[interval];
    if (!priceId) {
      throw new BillingError(400, "The requested plan is not available.");
    }
    const customerId = await this.ensureCustomer(accountId, email);
    const session = await this.stripeRequest(
      "POST",
      "/v1/checkout/sessions",
      {
        customer: customerId,
        mode: "subscription",
        "line_items[0][price]": priceId,
        "line_items[0][quantity]": 1,
        success_url: this.options.successUrl,
        cancel_url: this.options.cancelUrl,
        allow_promotion_codes: true,
        "subscription_data[metadata][accountId]": accountId,
      },
    );
    if (typeof session.url !== "string") {
      throw new BillingError(
        502,
        "The billing provider returned an invalid checkout session.",
      );
    }
    return { url: session.url };
  }

  async createPortalSession(accountId: string): Promise<{ url: string }> {
    const customerId = await this.store.stripeCustomerIdForAccount(accountId);
    if (!customerId) {
      throw new BillingError(404, "There is no billing profile yet.");
    }
    const session = await this.stripeRequest(
      "POST",
      "/v1/billing_portal/sessions",
      {
        customer: customerId,
        return_url: this.options.successUrl,
      },
    );
    if (typeof session.url !== "string") {
      throw new BillingError(
        502,
        "The billing provider returned an invalid portal session.",
      );
    }
    return { url: session.url };
  }

  /**
   * The single source of truth for subscription state: fetches the latest
   * subscription from Stripe and caches the reduced shape in SQLite.
   */
  async syncStripeDataToDb(customerId: string): Promise<SubscriptionCache> {
    const list = await this.stripeRequest("GET", "/v1/subscriptions", {
      customer: customerId,
      limit: 1,
      status: "all",
      "expand[]": "data.default_payment_method",
    });
    const data = Array.isArray(list.data)
      ? (list.data as StripeSubscription[])
      : [];
    let cache: SubscriptionCache;
    if (data.length === 0) {
      cache = { status: "none" };
    } else {
      const subscription = data[0];
      const firstItem = subscription.items?.data?.[0];
      const paymentMethod = subscription.default_payment_method;
      cache = {
        subscriptionId: subscription.id,
        status: subscription.status,
        priceId: firstItem?.price?.id ?? null,
        currentPeriodStart:
          subscription.current_period_start ??
          firstItem?.current_period_start ??
          null,
        currentPeriodEnd:
          subscription.current_period_end ??
          firstItem?.current_period_end ??
          null,
        cancelAtPeriodEnd: subscription.cancel_at_period_end === true,
        paymentMethod:
          paymentMethod && typeof paymentMethod === "object"
            ? {
                brand: paymentMethod.card?.brand ?? null,
                last4: paymentMethod.card?.last4 ?? null,
              }
            : null,
      };
    }
    await this.store.saveSubscriptionCache(customerId, cache, this.now());
    return cache;
  }

  /** Eager sync for the app's post-checkout path (the /success step). */
  async syncForAccount(accountId: string): Promise<SubscriptionCache> {
    const customerId = await this.store.stripeCustomerIdForAccount(accountId);
    if (!customerId) return { status: "none" };
    return this.syncStripeDataToDb(customerId);
  }

  async subscriptionForAccount(
    accountId: string,
  ): Promise<SubscriptionCache> {
    const customerId = await this.store.stripeCustomerIdForAccount(accountId);
    if (!customerId) return { status: "none" };
    return (
      (await this.store.subscriptionCacheForCustomer(customerId)) ?? {
        status: "none",
      }
    );
  }

  verifyWebhookSignature(payload: string, signatureHeader: string): void {
    if (Buffer.byteLength(payload, "utf8") > MAX_WEBHOOK_BYTES) {
      throw new BillingError(413, "The webhook payload is too large.");
    }
    let timestamp: number | null = null;
    const signatures: Buffer[] = [];
    for (const part of signatureHeader.split(",")) {
      const [key, value] = part.split("=", 2);
      if (key?.trim() === "t" && /^\d+$/.test(value ?? "")) {
        timestamp = Number(value);
      } else if (key?.trim() === "v1" && /^[0-9a-f]{64}$/.test(value ?? "")) {
        signatures.push(Buffer.from(value, "hex"));
      }
    }
    if (timestamp === null || signatures.length === 0) {
      throw new BillingError(400, "The webhook signature is invalid.");
    }
    const ageSeconds = Math.abs(this.now() / 1_000 - timestamp);
    if (ageSeconds > WEBHOOK_TOLERANCE_SECONDS) {
      throw new BillingError(400, "The webhook signature is expired.");
    }
    const expected = createHmac("sha256", this.options.stripeWebhookSecret)
      .update(`${timestamp}.${payload}`)
      .digest();
    const matches = signatures.some(
      (candidate) =>
        candidate.length === expected.length &&
        timingSafeEqual(candidate, expected),
    );
    if (!matches) {
      throw new BillingError(400, "The webhook signature is invalid.");
    }
  }

  /**
   * Handles a verified webhook event: for tracked event types, extract the
   * customer id and re-sync that customer from Stripe. Everything else is
   * acknowledged and ignored.
   */
  async processWebhookEvent(payload: string): Promise<void> {
    let event: Record<string, unknown>;
    try {
      const parsed = JSON.parse(payload) as unknown;
      if (typeof parsed !== "object" || parsed === null) return;
      event = parsed as Record<string, unknown>;
    } catch {
      throw new BillingError(400, "The webhook payload is invalid.");
    }
    const type = event.type;
    if (typeof type !== "string" || !ALLOWED_WEBHOOK_EVENTS.has(type)) return;
    const object = (event.data as Record<string, unknown> | undefined)
      ?.object as Record<string, unknown> | undefined;
    const customerId = object?.customer;
    if (typeof customerId !== "string" || !customerId.startsWith("cus_")) {
      log.warn("stripe_webhook_no_customer", { type });
      return;
    }
    // Only sync customers this server knows; other webhooks (e.g. from a
    // shared Stripe account) are acknowledged without work.
    if (!(await this.store.accountIdForStripeCustomer(customerId))) return;
    await this.syncStripeDataToDb(customerId);
  }
}

/** Subscription-affecting events from the t3 recommendations. */
export const ALLOWED_WEBHOOK_EVENTS: ReadonlySet<string> = new Set([
  "checkout.session.completed",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "customer.subscription.paused",
  "customer.subscription.resumed",
  "customer.subscription.pending_update_applied",
  "customer.subscription.pending_update_expired",
  "customer.subscription.trial_will_end",
  "invoice.paid",
  "invoice.payment_failed",
  "invoice.payment_action_required",
  "invoice.upcoming",
  "invoice.marked_uncollectible",
  "invoice.payment_succeeded",
  "payment_intent.succeeded",
  "payment_intent.payment_failed",
  "payment_intent.canceled",
]);

/** Reads billing configuration from the environment; null disables billing. */
export function billingOptionsFromEnv(
  env: Record<string, string | undefined>,
): BillingOptions | null {
  const stripeSecretKey = env.STRIPE_SECRET_KEY?.trim();
  if (!stripeSecretKey) return null;
  const stripeWebhookSecret = env.STRIPE_WEBHOOK_SECRET?.trim();
  const monthly = env.STRIPE_PRICE_ID_PRO_MONTHLY?.trim();
  const yearly = env.STRIPE_PRICE_ID_PRO_YEARLY?.trim();
  const successUrl = env.DAHOKO_BILLING_SUCCESS_URL?.trim();
  const cancelUrl = env.DAHOKO_BILLING_CANCEL_URL?.trim();
  if (!stripeWebhookSecret || !monthly || !yearly || !successUrl || !cancelUrl) {
    throw new Error(
      "Billing is partially configured. Set STRIPE_WEBHOOK_SECRET, " +
        "STRIPE_PRICE_ID_PRO_MONTHLY, STRIPE_PRICE_ID_PRO_YEARLY, " +
        "DAHOKO_BILLING_SUCCESS_URL, and DAHOKO_BILLING_CANCEL_URL " +
        "alongside STRIPE_SECRET_KEY.",
    );
  }
  return {
    stripeSecretKey,
    stripeWebhookSecret,
    priceIds: { monthly, yearly },
    successUrl,
    cancelUrl,
    requireSubscriptionForSync:
      env.DAHOKO_BILLING_REQUIRED?.trim().toLowerCase() !== "false",
  };
}
