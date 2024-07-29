/**
 * Handles the event when a pull request is updated with new commits.
 * @param slackToken - Slack bot token.
 * @param slackChannelId - Slack channel ID.
 * @param githubToken - GitHub token.
 * @param updateMessageTemplate - Template for the update Slack message.
 */
export declare function handlePRUpdated(slackToken: string, slackChannelId: string, githubToken: string, updateMessageTemplate: string): Promise<void>;
