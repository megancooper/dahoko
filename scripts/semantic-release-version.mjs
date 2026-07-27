import { setVersion } from "./set-version.mjs";

export async function prepare(_pluginConfig, { logger, nextRelease }) {
  await setVersion(nextRelease.version);
  logger.log(
    "Synchronized desktop package, Tauri, Cargo, and lockfile versions to %s",
    nextRelease.version,
  );
}
