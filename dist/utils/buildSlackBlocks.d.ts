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
export declare function buildSortedCommitBlocks(categorizedCommits: Record<string, {
    [type: string]: CommitEntry[];
}>, changelogUrl: string, branchName: string, targetBranch: string): SlackBlock[];
/**
 * Splits a blocks array into chunks that respect both Slack's 50-block-per-message
 * limit and the ~40KB JSON payload limit. Prefers splitting on divider boundaries
 * so scopes stay together.
 */
export declare function chunkBlocks(blocks: SlackBlock[], maxBlocks?: number, maxPayloadBytes?: number): SlackBlock[][];
