import { Commit } from "./utils/fetchAllCommits";
/**
 * Filters out merge commits that add no value to release notes.
 */
export declare function filterMergeCommits(commits: Commit[]): Commit[];
export interface CommitEntry {
    text: string;
    author: string;
}
/**
 * Categorizes commits by scope and type for sorted display.
 * Each commit is placed under its first (primary) scope only.
 * Multi-scope commits get an "also: X, Y" indicator.
 * Author is stored separately for sorting.
 */
export declare function categorizeCommits(commits: Commit[], owner: string, repo: string, githubToSlackMap?: Record<string, string>): Record<string, {
    [type: string]: CommitEntry[];
}>;
/**
 * Handles the event when a pull request is opened.
 * @param slackToken - Slack bot token.
 * @param slackChannelId - Slack channel ID.
 * @param githubToken - GitHub token.
 * @param initialMessageTemplate - Template for the initial Slack message.
 * @param commitListMessageTemplate - Template for the commit list Slack message.
 * @param githubToSlackMap - Optional mapping of GitHub usernames to Slack user IDs.
 * @param sortCommits - Flag to sort commits by types and scopes.
 */
export declare function handlePROpened(slackToken: string, slackChannelId: string, githubToken: string, initialMessageTemplate: string, commitListMessageTemplate: string, githubToSlackMap?: Record<string, string>, sortCommits?: boolean): Promise<void>;
