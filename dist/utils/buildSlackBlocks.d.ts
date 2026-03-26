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
export declare function buildSortedCommitBlocks(categorizedCommits: Record<string, {
    [type: string]: string[];
}>, changelogUrl: string, branchName: string, targetBranch: string): SlackBlock[];
/**
 * Splits a blocks array into chunks that respect Slack's 50-block-per-message limit.
 * Uses a limit of 48 to leave room for any wrapper blocks Slack may add.
 */
export declare function chunkBlocks(blocks: SlackBlock[], maxBlocks?: number): SlackBlock[][];
