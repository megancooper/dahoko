import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const VERSION_FILES = {
  packageJson: "apps/desktop/package.json",
  cargoToml: "apps/desktop/src-tauri/Cargo.toml",
  cargoLock: "apps/desktop/src-tauri/Cargo.lock",
  tauriConfig: "apps/desktop/src-tauri/tauri.conf.json",
};

function normalizeVersion(value) {
  const version = value?.replace(/^app-v/, "");
  if (!/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(version ?? "")) {
    throw new Error("Version must be an exact stable SemVer such as 1.2.3.");
  }
  return version;
}

function replaceOnce(source, pattern, replacement, label) {
  let replacements = 0;
  const result = source.replace(pattern, (...args) => {
    replacements += 1;
    return typeof replacement === "function"
      ? replacement(...args)
      : replacement;
  });
  if (replacements !== 1) {
    throw new Error(`Expected one ${label} version, found ${replacements}.`);
  }
  return result;
}

async function updateJson(file, version, check) {
  const source = await readFile(file, "utf8");
  const parsed = JSON.parse(source);
  parsed.version = version;
  const result = `${JSON.stringify(parsed, null, 2)}\n`;
  if (!check && source !== result) await writeFile(file, result);
  return source !== result;
}

async function updateText(file, pattern, replacement, label, check) {
  const source = await readFile(file, "utf8");
  const result = replaceOnce(source, pattern, replacement, label);
  if (!check && source !== result) await writeFile(file, result);
  return source !== result;
}

export async function setVersion(rawVersion, { check = false } = {}) {
  const version = normalizeVersion(rawVersion);
  const packageJson = path.resolve(VERSION_FILES.packageJson);
  const cargoToml = path.resolve(VERSION_FILES.cargoToml);
  const cargoLock = path.resolve(VERSION_FILES.cargoLock);
  const tauriConfig = path.resolve(VERSION_FILES.tauriConfig);

  const changed = await Promise.all([
    updateJson(packageJson, version, check),
    updateJson(tauriConfig, version, check),
    updateText(
      cargoToml,
      /^(\[package\][\s\S]*?^version = ")[^"]+(")/m,
      (_match, prefix, suffix) => `${prefix}${version}${suffix}`,
      "Cargo package",
      check,
    ),
    updateText(
      cargoLock,
      /(\[\[package\]\]\nname = "dahoko"\nversion = ")[^"]+(")/,
      (_match, prefix, suffix) => `${prefix}${version}${suffix}`,
      "Cargo lockfile package",
      check,
    ),
  ]);

  if (check && changed.some(Boolean)) {
    throw new Error(`Desktop version files are not synchronized to ${version}.`);
  }
  return version;
}

async function main() {
  const version = process.argv[2];
  const check = process.argv.includes("--check");
  const normalized = await setVersion(version, { check });
  process.stdout.write(
    check
      ? `Desktop version files match ${normalized}.\n`
      : `Desktop version files set to ${normalized}.\n`,
  );
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : "";
if (invokedPath === fileURLToPath(import.meta.url)) {
  await main();
}
