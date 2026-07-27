const releaseRules = [
  { type: "build", release: "patch" },
  { type: "chore", release: "patch" },
  { type: "ci", release: "patch" },
  { type: "docs", release: "patch" },
  { type: "perf", release: "patch" },
  { type: "refactor", release: "patch" },
  { type: "revert", release: "patch" },
  { type: "style", release: "patch" },
  { type: "test", release: "patch" },
];

const parserOpts = {
  noteKeywords: ["BREAKING CHANGE", "BREAKING CHANGES", "BREAKING"],
};

export default {
  branches: ["main"],
  repositoryUrl: "https://github.com/megancooper/dahoko.git",
  tagFormat: "app-v${version}",
  plugins: [
    [
      "@semantic-release/commit-analyzer",
      {
        preset: "conventionalcommits",
        parserOpts,
        releaseRules,
      },
    ],
    "./scripts/semantic-release-notes.mjs",
    "./scripts/semantic-release-version.mjs",
    [
      "@semantic-release/git",
      {
        assets: [
          "apps/desktop/package.json",
          "apps/desktop/src-tauri/Cargo.toml",
          "apps/desktop/src-tauri/Cargo.lock",
          "apps/desktop/src-tauri/tauri.conf.json",
        ],
        message:
          "chore(release): ${nextRelease.version} [skip ci]\n\n${nextRelease.notes}",
      },
    ],
    [
      "@semantic-release/github",
      {
        successComment: false,
        failComment: false,
        failTitle: false,
        releasedLabels: false,
        releaseNameTemplate: "dahoko v<%= nextRelease.version %>",
        releaseBodyTemplate:
          "<%= nextRelease.notes %>\n\nDesktop installers and signed in-app updater artifacts are attached below.",
      },
    ],
    "./scripts/semantic-release-output.mjs",
  ],
};
