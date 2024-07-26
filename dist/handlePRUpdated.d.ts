/**
 * Handles the event when a pull request is updated with new commits.
 * @param slackToken - Slack bot token.
 * @param slackChannel - Slack channel ID.
 * @param githubToken - GitHub token.
 * @param updateMessageTemplate - Template for the update Slack message.
 */
export declare function handlePRUpdated(slackToken: string, slackChannel: string, githubToken: string, updateMessageTemplate: string): Promise<void>;
