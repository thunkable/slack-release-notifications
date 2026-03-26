import { CommitEntry } from "../handlePROpened";

export interface SlackBlock {
  type: string;
  text?: {
    type: string;
    text: string;
    emoji?: boolean;
  };
}

/**
 * Builds Slack Block Kit blocks from categorized commits.
 * Each scope gets a header, followed by sections grouped by commit type.
 * Within each type, commits are sorted by author so the same person's
 * commits appear together.
 * A divider separates scopes, and a changelog link is appended at the end.
 */
export function buildSortedCommitBlocks(
  categorizedCommits: Record<string, { [type: string]: CommitEntry[] }>,
  changelogUrl: string,
  branchName: string,
  targetBranch: string,
): SlackBlock[] {
  const blocks: SlackBlock[] = [];
  const sortedScopes = Object.keys(categorizedCommits).sort();

  for (let i = 0; i < sortedScopes.length; i++) {
    const scope = sortedScopes[i];
    const types = categorizedCommits[scope];

    // Header for the scope
    blocks.push({
      type: "header",
      text: {
        type: "plain_text",
        text: scope.charAt(0).toUpperCase() + scope.slice(1),
        emoji: true,
      },
    });

    // Section per type group, sorted alphabetically.
    // Slack section blocks have a 3000-char text limit, so we split into
    // multiple sections when the content is too long.
    const MAX_SECTION_LENGTH = 2900;
    const sortedTypes = Object.keys(types).sort();
    const lines: string[] = [];
    for (const type of sortedTypes) {
      lines.push(`*${type}*`);
      const sorted = [...types[type]].sort((a, b) =>
        a.author.localeCompare(b.author),
      );
      for (const entry of sorted) {
        lines.push(entry.text);
      }
    }

    // Split lines into sections that fit within Slack's limit
    let currentText = "";
    for (const line of lines) {
      const candidate = currentText ? currentText + "\n" + line : line;
      if (candidate.length > MAX_SECTION_LENGTH && currentText) {
        blocks.push({
          type: "section",
          text: { type: "mrkdwn", text: currentText },
        });
        currentText = line;
      } else {
        currentText = candidate;
      }
    }
    if (currentText) {
      blocks.push({
        type: "section",
        text: { type: "mrkdwn", text: currentText },
      });
    }

    // Divider between scopes
    if (i < sortedScopes.length - 1) {
      blocks.push({ type: "divider" });
    }
  }

  // Divider before changelog
  blocks.push({ type: "divider" });

  // Changelog link
  blocks.push({
    type: "section",
    text: {
      type: "mrkdwn",
      text: `<${changelogUrl}|Full Changelog: ${branchName} to ${targetBranch}>`,
    },
  });

  return blocks;
}

/**
 * Splits a blocks array into chunks that respect both Slack's 50-block-per-message
 * limit and the ~40KB JSON payload limit. Prefers splitting on divider boundaries
 * so scopes stay together.
 */
export function chunkBlocks(
  blocks: SlackBlock[],
  maxBlocks: number = 48,
  maxPayloadBytes: number = 35000,
): SlackBlock[][] {
  const chunks: SlackBlock[][] = [];
  let current: SlackBlock[] = [];
  let currentSize = 0;

  for (const block of blocks) {
    const blockSize = JSON.stringify(block).length;

    if (
      current.length > 0 &&
      (current.length >= maxBlocks || currentSize + blockSize > maxPayloadBytes)
    ) {
      chunks.push(current);
      current = [];
      currentSize = 0;
    }

    current.push(block);
    currentSize += blockSize;
  }

  if (current.length > 0) {
    chunks.push(current);
  }

  return chunks;
}
