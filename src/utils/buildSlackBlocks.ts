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
 * A divider separates scopes, and a changelog link is appended at the end.
 */
export function buildSortedCommitBlocks(
  categorizedCommits: Record<string, { [type: string]: string[] }>,
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

    // Section per type group, sorted alphabetically
    const sortedTypes = Object.keys(types).sort();
    const lines: string[] = [];
    for (const type of sortedTypes) {
      lines.push(`*${type}*`);
      for (const entry of types[type].sort()) {
        lines.push(entry);
      }
    }

    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: lines.join("\n"),
      },
    });

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
 * Splits a blocks array into chunks that respect Slack's 50-block-per-message limit.
 * Uses a limit of 48 to leave room for any wrapper blocks Slack may add.
 */
export function chunkBlocks(
  blocks: SlackBlock[],
  maxBlocks: number = 48,
): SlackBlock[][] {
  if (blocks.length <= maxBlocks) {
    return [blocks];
  }

  const chunks: SlackBlock[][] = [];
  let current: SlackBlock[] = [];

  for (const block of blocks) {
    if (current.length >= maxBlocks) {
      chunks.push(current);
      current = [];
    }
    current.push(block);
  }

  if (current.length > 0) {
    chunks.push(current);
  }

  return chunks;
}
