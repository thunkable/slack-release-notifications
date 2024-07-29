/**
 * Handles the event when a pull request is closed.
 * @param slackToken - Slack bot token.
 * @param slackChannelId - Slack channel ID.
 * @param closeMessageTemplate - Template for the close Slack message.
 */
export declare function handlePRClosed(slackToken: string, slackChannelId: string, closeMessageTemplate: string): Promise<void>;
