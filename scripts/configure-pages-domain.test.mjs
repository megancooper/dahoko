import assert from "node:assert/strict";
import test from "node:test";

test("creates a proxied apex CNAME after confirming the Pages domain", async (t) => {
  const previousFetch = globalThis.fetch;
  const previousAccountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const previousApiToken = process.env.CLOUDFLARE_API_TOKEN;
  process.env.CLOUDFLARE_ACCOUNT_ID = "account-id";
  process.env.CLOUDFLARE_API_TOKEN = "test-token";

  t.after(() => {
    globalThis.fetch = previousFetch;
    if (previousAccountId === undefined) {
      delete process.env.CLOUDFLARE_ACCOUNT_ID;
    } else {
      process.env.CLOUDFLARE_ACCOUNT_ID = previousAccountId;
    }
    if (previousApiToken === undefined) {
      delete process.env.CLOUDFLARE_API_TOKEN;
    } else {
      process.env.CLOUDFLARE_API_TOKEN = previousApiToken;
    }
  });

  const calls = [];
  globalThis.fetch = async (url, init = {}) => {
    calls.push({ url, init });
    if (url.includes("/zones?")) {
      return response([{ id: "zone-id", name: "dahoko.com" }]);
    }
    if (url.includes("/pages/projects/dahoko/domains/dahoko.com")) {
      return response({ name: "dahoko.com", status: "active" });
    }
    if (url.includes("/dns_records?")) {
      return response([]);
    }
    if (url.endsWith("/dns_records") && init.method === "POST") {
      return response({ id: "record-id" });
    }
    throw new Error(`Unexpected request: ${url}`);
  };

  const module = await import(
    new URL("./configure-pages-domain.mjs?create-test", import.meta.url)
  );
  const result = await module.configurePagesDomain();

  assert.deepEqual(result, {
    domain: "dahoko.com",
    domainStatus: "active",
    dns: "created",
    target: "dahoko.pages.dev",
  });
  assert.equal(calls.length, 4);
  assert.equal(calls[3].init.method, "POST");
  assert.deepEqual(JSON.parse(calls[3].init.body), {
    type: "CNAME",
    name: "dahoko.com",
    content: "dahoko.pages.dev",
    ttl: 1,
    proxied: true,
    comment: "Dahoko Cloudflare Pages production",
  });
  assert.equal(
    calls.every(
      ({ init }) => init.headers?.Authorization === "Bearer test-token",
    ),
    true,
  );
});

function response(result) {
  return {
    ok: true,
    status: 200,
    json: async () => ({ success: true, errors: [], result }),
  };
}
