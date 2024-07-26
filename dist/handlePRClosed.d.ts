/**
 * Handles the event when a pull request is closed.
 * @param slackToken - Slack bot token.
 * @param slackChannel - Slack channel ID.
 * @param closeMessageTemplate - Template for the close Slack message.
 */
export declare function handlePRClosed(slackToken: string, slackChannel: string, closeMessageTemplate: string): Promise<void>;
