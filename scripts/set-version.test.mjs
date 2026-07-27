import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { cp, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const versionScript = path.join(repositoryRoot, "scripts/set-version.mjs");
const versionFiles = [
  "apps/desktop/package.json",
  "apps/desktop/src-tauri/Cargo.toml",
  "apps/desktop/src-tauri/Cargo.lock",
  "apps/desktop/src-tauri/tauri.conf.json",
];

async function createFixture() {
  const fixture = await mkdtemp(path.join(tmpdir(), "dahoko-version-test-"));
  for (const relativeFile of versionFiles) {
    const destination = path.join(fixture, relativeFile);
    await cp(path.join(repositoryRoot, relativeFile), destination, {
      recursive: true,
    });
  }
  return fixture;
}

test("synchronizes every desktop version file", async (t) => {
  const fixture = await createFixture();
  t.after(() => rm(fixture, { recursive: true, force: true }));

  execFileSync(process.execPath, [versionScript, "2.3.4"], {
    cwd: fixture,
  });
  execFileSync(process.execPath, [versionScript, "app-v2.3.4", "--check"], {
    cwd: fixture,
  });

  const packageJson = JSON.parse(
    await readFile(path.join(fixture, versionFiles[0]), "utf8"),
  );
  const cargoToml = await readFile(path.join(fixture, versionFiles[1]), "utf8");
  const cargoLock = await readFile(path.join(fixture, versionFiles[2]), "utf8");
  const tauriConfig = JSON.parse(
    await readFile(path.join(fixture, versionFiles[3]), "utf8"),
  );

  assert.equal(packageJson.version, "2.3.4");
  assert.match(cargoToml, /^\[package\][\s\S]*?^version = "2\.3\.4"$/m);
  assert.match(
    cargoLock,
    /\[\[package\]\]\nname = "dahoko"\nversion = "2\.3\.4"/,
  );
  assert.equal(tauriConfig.version, "2.3.4");
});

test("rejects versions that are not exact stable SemVer", async (t) => {
  const fixture = await createFixture();
  t.after(() => rm(fixture, { recursive: true, force: true }));

  assert.throws(
    () =>
      execFileSync(process.execPath, [versionScript, "1.2.3; touch nope"], {
        cwd: fixture,
        stdio: "pipe",
      }),
    /Command failed/,
  );
});
