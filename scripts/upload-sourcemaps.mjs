// Uploads hidden Vite sourcemaps to PostHog error tracking, then strips the
// .map files so they never ship inside app bundles or public deploys.
//
// Usage: node scripts/upload-sourcemaps.mjs <dist-dir> <release-name>
//
// Env:
//   POSTHOG_CLI_TOKEN   personal API key with error tracking write scope;
//                       upload is skipped when absent.
//   POSTHOG_PROJECT_ID  the PostHog project id the maps belong to.
//   POSTHOG_HOST        optional ingest host; only used to pick the EU CLI
//                       host when it points at eu.i.posthog.com.
//
// Maps are stripped whenever CI is set, uploaded or not, so a release can
// never package or publish them by accident. Local builds keep their maps.
import { execFileSync } from "node:child_process";
import { readdirSync, rmSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import process from "node:process";

const [, , distArg, releaseName] = process.argv;
if (!distArg || !releaseName) {
  console.error(
    "Usage: node scripts/upload-sourcemaps.mjs <dist-dir> <release-name>",
  );
  process.exit(1);
}
const dist = resolve(distArg);
if (!statSync(dist, { throwIfNoEntry: false })?.isDirectory()) {
  console.error(`[sourcemaps] not a directory: ${dist}`);
  process.exit(1);
}

function mapFiles(dir) {
  const found = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) found.push(...mapFiles(full));
    else if (entry.name.endsWith(".map")) found.push(full);
  }
  return found;
}

function stripMaps() {
  const maps = mapFiles(dist);
  for (const file of maps) rmSync(file);
  console.log(`[sourcemaps] stripped ${maps.length} map file(s) from dist`);
}

const token = (process.env.POSTHOG_CLI_TOKEN ?? "").trim();
const projectId = (process.env.POSTHOG_PROJECT_ID ?? "").trim();
const version = (
  process.env.RELEASE_VERSION ??
  process.env.npm_package_version ??
  ""
).trim();

if (token && projectId) {
  // The CLI authenticates against the app host, not the ingest host.
  const cliHost = (process.env.POSTHOG_HOST ?? "").includes("eu.i.posthog.com")
    ? "https://eu.posthog.com"
    : "https://us.posthog.com";
  const env = {
    ...process.env,
    // Both spellings, covering CLI versions before and after the rename.
    POSTHOG_CLI_TOKEN: token,
    POSTHOG_CLI_API_KEY: token,
    POSTHOG_CLI_ENV_ID: projectId,
    POSTHOG_CLI_PROJECT_ID: projectId,
  };
  const run = (args) =>
    execFileSync(
      process.platform === "win32" ? "npx.cmd" : "npx",
      ["--yes", "@posthog/cli@latest", "--host", cliHost, ...args],
      {
        stdio: "inherit",
        env,
        // Node refuses .cmd without a shell; CI workspace paths are space-free.
        shell: process.platform === "win32",
      },
    );
  run(["sourcemap", "inject", "--directory", dist]);
  run([
    "sourcemap",
    "upload",
    "--directory",
    dist,
    "--release-name",
    releaseName,
    ...(version ? ["--release-version", version] : []),
  ]);
  console.log(`[sourcemaps] uploaded ${releaseName}@${version || "unversioned"}`);
  stripMaps();
} else if (process.env.CI) {
  console.log(
    "[sourcemaps] POSTHOG_CLI_TOKEN/POSTHOG_PROJECT_ID not set; stripping maps without upload",
  );
  stripMaps();
} else {
  console.log("[sourcemaps] local build; keeping maps in place");
}
