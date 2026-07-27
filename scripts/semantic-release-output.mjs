import { appendFile } from "node:fs/promises";

export async function success(_pluginConfig, { nextRelease }) {
  const outputFile = process.env.GITHUB_OUTPUT;
  if (!outputFile) return;

  await appendFile(
    outputFile,
    `released=true\nversion=${nextRelease.version}\ntag=${nextRelease.gitTag}\n`,
  );
}
