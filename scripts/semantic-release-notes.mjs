const SECTION_TITLES = new Map([
  ["feat", "Features"],
  ["fix", "Bug Fixes"],
  ["perf", "Performance"],
  ["revert", "Reverts"],
  ["refactor", "Refactoring"],
  ["docs", "Documentation"],
  ["test", "Tests"],
  ["build", "Build System"],
  ["ci", "Continuous Integration"],
  ["chore", "Maintenance"],
  ["style", "Styles"],
]);

const SECTION_ORDER = [...SECTION_TITLES.values(), "Other Changes"];
const CONVENTIONAL_SUBJECT =
  /^([a-z][\w-]*)(?:\(([^()\r\n]+)\))?(!)?:\s+(.+)$/i;
const BREAKING_FOOTER =
  /^BREAKING(?: CHANGE| CHANGES)?:[ \t]*(.+)$/gim;

function escapeMarkdown(value) {
  return value.replace(/([\\`*_[\]<>])/g, "\\$1");
}

function normalizeRepositoryUrl(value) {
  if (!value) return null;

  let repositoryUrl = value.replace(/^git\+/, "").replace(/\.git$/, "");
  const sshMatch = repositoryUrl.match(
    /^(?:ssh:\/\/)?git@([^/:]+)[:/]([^/]+\/[^/]+)$/,
  );
  if (sshMatch) {
    repositoryUrl = `https://${sshMatch[1]}/${sshMatch[2]}`;
  }

  try {
    const parsed = new URL(repositoryUrl);
    return ["https:", "http:"].includes(parsed.protocol)
      ? parsed.toString().replace(/\/$/, "")
      : null;
  } catch {
    return null;
  }
}

function parseCommit(commit) {
  const message = commit.message ?? "";
  const subject = commit.subject ?? message.split(/\r?\n/, 1)[0] ?? "";
  const match = subject.match(CONVENTIONAL_SUBJECT);
  if (!match) return null;

  const [, rawType, rawScope, bang, rawSubject] = match;
  const breakingDetails = [...message.matchAll(BREAKING_FOOTER)].map(
    (footer) => footer[1].trim(),
  );

  return {
    type: rawType.toLowerCase(),
    scope: rawScope?.trim() || null,
    subject: rawSubject.trim(),
    breaking: Boolean(bang) || breakingDetails.length > 0,
    breakingDetails,
    hash: commit.hash ?? null,
  };
}

function commitLink(repositoryUrl, hash) {
  if (!repositoryUrl || !hash || !/^[0-9a-f]{7,40}$/i.test(hash)) return "";
  const shortHash = hash.slice(0, 7);
  return ` ([${shortHash}](${repositoryUrl}/commit/${hash}))`;
}

function commitBullet(commit, repositoryUrl) {
  const scope = commit.scope
    ? `**${escapeMarkdown(commit.scope)}:** `
    : "";
  return `- ${scope}${escapeMarkdown(commit.subject)}${commitLink(repositoryUrl, commit.hash)}`;
}

function compareHeading(context, repositoryUrl) {
  const version = context.nextRelease.version;
  const tag = context.nextRelease.gitTag;
  const previousTag = context.lastRelease?.gitTag;
  const date = new Date().toISOString().slice(0, 10);

  if (repositoryUrl && previousTag && tag) {
    const compareUrl = `${repositoryUrl}/compare/${encodeURIComponent(previousTag)}...${encodeURIComponent(tag)}`;
    return `## [${version}](${compareUrl}) (${date})`;
  }
  if (repositoryUrl && tag) {
    return `## [${version}](${repositoryUrl}/releases/tag/${encodeURIComponent(tag)}) (${date})`;
  }
  return `## ${version} (${date})`;
}

export async function generateNotes(_pluginConfig, context) {
  const repositoryUrl = normalizeRepositoryUrl(context.options.repositoryUrl);
  const commits = context.commits.map(parseCommit).filter(Boolean);
  const sections = new Map();

  for (const commit of commits) {
    const title = SECTION_TITLES.get(commit.type) ?? "Other Changes";
    const section = sections.get(title) ?? [];
    section.push(commit);
    sections.set(title, section);
  }

  const lines = [compareHeading(context, repositoryUrl)];
  const breakingCommits = commits.filter((commit) => commit.breaking);

  if (breakingCommits.length > 0) {
    lines.push("", "### ⚠ BREAKING CHANGES", "");
    for (const commit of breakingCommits) {
      const details =
        commit.breakingDetails.length > 0
          ? commit.breakingDetails.join("; ")
          : commit.subject;
      const scope = commit.scope
        ? `**${escapeMarkdown(commit.scope)}:** `
        : "";
      lines.push(
        `- ${scope}${escapeMarkdown(details)}${commitLink(repositoryUrl, commit.hash)}`,
      );
    }
  }

  for (const title of SECTION_ORDER) {
    const section = sections.get(title);
    if (!section?.length) continue;

    lines.push("", `### ${title}`, "");
    lines.push(...section.map((commit) => commitBullet(commit, repositoryUrl)));
  }

  return `${lines.join("\n")}\n`;
}
