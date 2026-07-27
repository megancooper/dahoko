import assert from "node:assert/strict";
import test from "node:test";

import { generateNotes } from "./semantic-release-notes.mjs";

const context = {
  options: {
    repositoryUrl: "https://github.com/megancooper/dahoko.git",
  },
  lastRelease: {
    gitTag: "app-v1.2.3",
  },
  nextRelease: {
    version: "2.0.0",
    gitTag: "app-v2.0.0",
  },
  commits: [
    {
      hash: "1234567890abcdef1234567890abcdef12345678",
      message: "feat(board): add smooth lane dragging",
    },
    {
      hash: "abcdef1234567890abcdef1234567890abcdef12",
      message:
        "feat(data)!: replace the export format\n\nBREAKING CHANGE: exports now use schema v2",
    },
    {
      hash: "fedcba0987654321fedcba0987654321fedcba09",
      message: "chore: refresh dependencies",
    },
    {
      hash: "9999999999999999999999999999999999999999",
      message: "Merge branch 'main'",
    },
  ],
};

test("generates linked release notes for every supported commit type", async () => {
  const notes = await generateNotes({}, context);

  assert.match(
    notes,
    /## \[2\.0\.0\]\(https:\/\/github\.com\/megancooper\/dahoko\/compare\/app-v1\.2\.3\.\.\.app-v2\.0\.0\)/,
  );
  assert.match(notes, /### ⚠ BREAKING CHANGES/);
  assert.match(notes, /exports now use schema v2/);
  assert.match(notes, /### Features/);
  assert.match(notes, /\*\*board:\*\* add smooth lane dragging/);
  assert.match(notes, /### Maintenance/);
  assert.match(notes, /refresh dependencies/);
  assert.doesNotMatch(notes, /Merge branch/);
});

test("does not create unsafe commit links", async () => {
  const notes = await generateNotes(
    {},
    {
      ...context,
      options: { repositoryUrl: "javascript:alert(1)" },
      commits: [
        {
          hash: "../../settings",
          message: "fix: handle malformed release metadata",
        },
      ],
    },
  );

  assert.match(notes, /### Bug Fixes/);
  assert.doesNotMatch(notes, /javascript:/);
  assert.doesNotMatch(notes, /\]\(.*commit/);
});
