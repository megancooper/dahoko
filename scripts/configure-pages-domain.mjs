import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
const API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;
const PROJECT_NAME = "dahoko";
const CUSTOM_DOMAIN = "dahoko.com";
const PAGES_DOMAIN = "dahoko.pages.dev";
const API_ROOT = "https://api.cloudflare.com/client/v4";

function requireCredential(value, name) {
  if (!value) {
    throw new Error(`${name} is required.`);
  }
  return value;
}

async function cloudflare(path, init = {}) {
  const token = requireCredential(API_TOKEN, "CLOUDFLARE_API_TOKEN");
  const response = await fetch(`${API_ROOT}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...init.headers,
    },
  });
  const payload = await response.json();
  if (!response.ok || !payload.success) {
    const detail =
      payload.errors
        ?.map((error) => error.message)
        .filter(Boolean)
        .join("; ") || `HTTP ${response.status}`;
    throw new Error(`Cloudflare API request failed: ${detail}`);
  }
  return payload.result;
}

async function ensurePagesDomain(accountId) {
  const path =
    `/accounts/${accountId}/pages/projects/${PROJECT_NAME}/domains/` +
    encodeURIComponent(CUSTOM_DOMAIN);
  const response = await fetch(`${API_ROOT}${path}`, {
    headers: {
      Authorization: `Bearer ${requireCredential(
        API_TOKEN,
        "CLOUDFLARE_API_TOKEN",
      )}`,
      "Content-Type": "application/json",
    },
  });

  if (response.ok) {
    const payload = await response.json();
    if (!payload.success) {
      throw new Error("Cloudflare returned an invalid Pages domain response.");
    }
    return payload.result;
  }
  if (response.status !== 404) {
    const payload = await response.json();
    const detail =
      payload.errors
        ?.map((error) => error.message)
        .filter(Boolean)
        .join("; ") || `HTTP ${response.status}`;
    throw new Error(`Could not read the Pages custom domain: ${detail}`);
  }

  return cloudflare(
    `/accounts/${accountId}/pages/projects/${PROJECT_NAME}/domains`,
    {
      method: "POST",
      body: JSON.stringify({ name: CUSTOM_DOMAIN }),
    },
  );
}

async function findZone() {
  const result = await cloudflare(
    `/zones?name=${encodeURIComponent(CUSTOM_DOMAIN)}&status=active`,
  );
  if (result.length !== 1) {
    throw new Error(
      `Expected one active Cloudflare zone for ${CUSTOM_DOMAIN}, found ${result.length}.`,
    );
  }
  return result[0];
}

async function ensureDnsRecord(zoneId) {
  const records = await cloudflare(
    `/zones/${zoneId}/dns_records?type=CNAME&name=${encodeURIComponent(
      CUSTOM_DOMAIN,
    )}`,
  );
  if (records.length > 1) {
    throw new Error(
      `Expected at most one apex CNAME for ${CUSTOM_DOMAIN}, found ${records.length}.`,
    );
  }

  const desired = {
    type: "CNAME",
    name: CUSTOM_DOMAIN,
    content: PAGES_DOMAIN,
    ttl: 1,
    proxied: true,
    comment: "Dahoko Cloudflare Pages production",
  };
  const current = records[0];
  if (!current) {
    await cloudflare(`/zones/${zoneId}/dns_records`, {
      method: "POST",
      body: JSON.stringify(desired),
    });
    return "created";
  }
  if (
    current.content === desired.content &&
    current.proxied === desired.proxied
  ) {
    return "unchanged";
  }

  await cloudflare(`/zones/${zoneId}/dns_records/${current.id}`, {
    method: "PATCH",
    body: JSON.stringify(desired),
  });
  return "updated";
}

export async function configurePagesDomain() {
  const accountId = requireCredential(
    ACCOUNT_ID,
    "CLOUDFLARE_ACCOUNT_ID",
  );
  const zone = await findZone();
  const domain = await ensurePagesDomain(accountId);
  const dnsResult = await ensureDnsRecord(zone.id);
  return {
    domain: domain.name,
    domainStatus: domain.status,
    dns: dnsResult,
    target: PAGES_DOMAIN,
  };
}

const isDirectRun =
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href;

if (isDirectRun) {
  const result = await configurePagesDomain();
  process.stdout.write(
    `Cloudflare Pages domain configured: ${result.domain} → ${result.target} (${result.dns}).\n`,
  );
}
