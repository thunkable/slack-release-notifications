/**
 * Handles the event when a pull request is opened.
 * @param slackToken - Slack bot token.
 * @param slackChannel - Slack channel ID.
 * @param githubToken - GitHub token.
 * @param initialMessageTemplate - Template for the initial Slack message.
 * @param commitListMessageTemplate - Template for the commit list Slack message.
 * @param githubToSlackMap - Optional mapping of GitHub usernames to Slack user IDs.
 */
export declare function handlePROpened(slackToken: string, slackChannel: string, githubToken: string, initialMessageTemplate: string, commitListMessageTemplate: string, githubToSlackMap?: Record<string, string>): Promise<void>;
