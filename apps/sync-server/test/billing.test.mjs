import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { describe, it, afterEach } from "node:test";
import { createSyncServer } from "../dist/server.js";
import { billingOptionsFromEnv } from "../dist/billing.js";

const origin = "http://localhost:5103";
const servers = [];
const WEBHOOK_SECRET = "whsec_test_secret";

/** Minimal Stripe API stub: records calls, returns canned objects. */
function stripeStub() {
  const calls = [];
  let subscriptions = { data: [] };
  const fetchImpl = async (url, init) => {
    const parsed = new URL(url);
    calls.push({ path: parsed.pathname, method: init?.method ?? "GET" });
    const respond = (value) =>
      new Response(JSON.stringify(value), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    if (parsed.pathname === "/v1/customers") {
      return respond({ id: "cus_test123" });
    }
    if (parsed.pathname === "/v1/checkout/sessions") {
      return respond({ url: "https://checkout.stripe.com/test-session" });
    }
    if (parsed.pathname === "/v1/billing_portal/sessions") {
      return respond({ url: "https://billing.stripe.com/test-portal" });
    }
    if (parsed.pathname === "/v1/subscriptions") {
      return respond(subscriptions);
    }
    return respond({});
  };
  return {
    calls,
    fetchImpl,
    setSubscription(subscription) {
      subscriptions = { data: subscription ? [subscription] : [] };
    },
  };
}

async function startServer(stub, { required = true } = {}) {
  const syncServer = createSyncServer({
    databasePath: ":memory:",
    allowedOrigins: [origin],
    accountHashKey: "test-only-account-lookup-key-32-bytes",
    scryptCost: 1_024,
    billing: {
      stripeSecretKey: "sk_test_key",
      stripeWebhookSecret: WEBHOOK_SECRET,
      priceIds: { monthly: "price_month", yearly: "price_year" },
      successUrl: "https://dahoko.test/cloud/success",
      cancelUrl: "https://dahoko.test/cloud",
      requireSubscriptionForSync: required,
      fetchImpl: stub.fetchImpl,
    },
  });
  servers.push(syncServer);
  await new Promise((resolve) => {
    syncServer.server.listen(0, "127.0.0.1", resolve);
  });
  const address = syncServer.server.address();
  return `http://127.0.0.1:${address.port}`;
}

async function request(baseUrl, path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: options.method ?? "GET",
    headers: {
      Origin: origin,
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
      ...(options.rawBody !== undefined
        ? options.headers ?? {}
        : options.body !== undefined
          ? { "Content-Type": "application/json" }
          : {}),
    },
    body:
      options.rawBody !== undefined
        ? options.rawBody
        : options.body !== undefined
          ? JSON.stringify(options.body)
          : undefined,
  });
  return { status: response.status, body: await response.json() };
}

async function register(baseUrl) {
  const result = await request(baseUrl, "/v1/auth/register", {
    method: "POST",
    body: { email: "person@example.com", password: "a safe account password" },
  });
  assert.equal(result.status, 200);
  return result.body;
}

function activeSubscription() {
  return {
    id: "sub_test123",
    status: "active",
    cancel_at_period_end: false,
    current_period_start: 1_700_000_000,
    current_period_end: 1_702_600_000,
    items: { data: [{ price: { id: "price_month" } }] },
    default_payment_method: { card: { brand: "visa", last4: "4242" } },
  };
}

function signedWebhook(payload, { timestamp = Date.now() / 1_000 } = {}) {
  const t = Math.floor(timestamp);
  const signature = createHmac("sha256", WEBHOOK_SECRET)
    .update(`${t}.${payload}`)
    .digest("hex");
  return { "Stripe-Signature": `t=${t},v1=${signature}` };
}

function blob(salt, marker) {
  return {
    version: 1,
    algorithm: "AES-256-GCM",
    kdf: "PBKDF2-SHA256",
    iterations: 600_000,
    salt,
    nonce: Buffer.alloc(12, marker).toString("base64"),
    ciphertext: Buffer.alloc(32, marker).toString("base64"),
  };
}

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => server.close()));
});

describe("dahoko billing", () => {
  it("creates the Stripe customer before checkout and returns the session URL", async () => {
    const stub = stripeStub();
    const baseUrl = await startServer(stub);
    const { token } = await register(baseUrl);

    const checkout = await request(baseUrl, "/v1/billing/checkout", {
      method: "POST",
      token,
      body: { email: "person@example.com", interval: "monthly" },
    });
    assert.equal(checkout.status, 200);
    assert.equal(checkout.body.url, "https://checkout.stripe.com/test-session");
    assert.deepEqual(
      stub.calls.map((call) => call.path),
      ["/v1/customers", "/v1/checkout/sessions"],
    );

    // A second checkout reuses the bound customer instead of minting one.
    await request(baseUrl, "/v1/billing/checkout", {
      method: "POST",
      token,
      body: { email: "person@example.com", interval: "yearly" },
    });
    assert.equal(
      stub.calls.filter((call) => call.path === "/v1/customers").length,
      1,
    );
  });

  it("gates sync uploads on an active subscription but never gates downloads", async () => {
    const stub = stripeStub();
    const baseUrl = await startServer(stub);
    const { token, encryptionSalt } = await register(baseUrl);

    const denied = await request(baseUrl, "/v1/sync", {
      method: "PUT",
      token,
      body: { baseRevision: 0, blob: blob(encryptionSalt, 1) },
    });
    assert.equal(denied.status, 402);

    const download = await request(baseUrl, "/v1/sync", { token });
    assert.equal(download.status, 200);

    // Checkout binds the customer; the eager post-success sync sees the
    // now-active subscription and unlocks uploads.
    await request(baseUrl, "/v1/billing/checkout", {
      method: "POST",
      token,
      body: { email: "person@example.com", interval: "monthly" },
    });
    stub.setSubscription(activeSubscription());
    const synced = await request(baseUrl, "/v1/billing/sync", {
      method: "POST",
      token,
    });
    assert.equal(synced.status, 200);
    assert.equal(synced.body.subscription.status, "active");
    assert.equal(synced.body.subscription.paymentMethod.last4, "4242");

    const allowed = await request(baseUrl, "/v1/sync", {
      method: "PUT",
      token,
      body: { baseRevision: 0, blob: blob(encryptionSalt, 1) },
    });
    assert.equal(allowed.status, 200);

    const state = await request(baseUrl, "/v1/billing", { token });
    assert.equal(state.status, 200);
    assert.equal(state.body.subscription.status, "active");
    assert.equal(state.body.syncRequiresSubscription, true);
  });

  it("accepts only correctly signed, fresh webhooks and re-syncs the customer", async () => {
    const stub = stripeStub();
    const baseUrl = await startServer(stub);
    const { token } = await register(baseUrl);
    await request(baseUrl, "/v1/billing/checkout", {
      method: "POST",
      token,
      body: { email: "person@example.com", interval: "monthly" },
    });
    stub.setSubscription(activeSubscription());

    const payload = JSON.stringify({
      type: "customer.subscription.updated",
      data: { object: { customer: "cus_test123" } },
    });

    const unsigned = await request(baseUrl, "/v1/stripe/webhook", {
      method: "POST",
      rawBody: payload,
      headers: { "Stripe-Signature": "t=1,v1=deadbeef" },
    });
    assert.equal(unsigned.status, 400);

    const stale = await request(baseUrl, "/v1/stripe/webhook", {
      method: "POST",
      rawBody: payload,
      headers: signedWebhook(payload, { timestamp: Date.now() / 1_000 - 3_600 }),
    });
    assert.equal(stale.status, 400);

    const accepted = await request(baseUrl, "/v1/stripe/webhook", {
      method: "POST",
      rawBody: payload,
      headers: signedWebhook(payload),
    });
    assert.equal(accepted.status, 200);
    assert.equal(accepted.body.received, true);

    const state = await request(baseUrl, "/v1/billing", { token });
    assert.equal(state.body.subscription.status, "active");

    // Untracked event types are acknowledged without touching Stripe.
    const before = stub.calls.length;
    const ignoredPayload = JSON.stringify({
      type: "charge.refunded",
      data: { object: { customer: "cus_test123" } },
    });
    const ignored = await request(baseUrl, "/v1/stripe/webhook", {
      method: "POST",
      rawBody: ignoredPayload,
      headers: signedWebhook(ignoredPayload),
    });
    assert.equal(ignored.status, 200);
    assert.equal(stub.calls.length, before);
  });

  it("reads billing configuration from the environment", () => {
    assert.equal(billingOptionsFromEnv({}), null);
    assert.throws(() => billingOptionsFromEnv({ STRIPE_SECRET_KEY: "sk" }));
    const options = billingOptionsFromEnv({
      STRIPE_SECRET_KEY: "sk_live_x",
      STRIPE_WEBHOOK_SECRET: "whsec_x",
      STRIPE_PRICE_ID_PRO_MONTHLY: "price_m",
      STRIPE_PRICE_ID_PRO_YEARLY: "price_y",
      DAHOKO_BILLING_SUCCESS_URL: "https://dahoko.test/cloud/success",
      DAHOKO_BILLING_CANCEL_URL: "https://dahoko.test/cloud",
    });
    assert.equal(options.requireSubscriptionForSync, true);
    assert.deepEqual(options.priceIds, {
      monthly: "price_m",
      yearly: "price_y",
    });
  });
});
