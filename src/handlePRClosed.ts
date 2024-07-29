import * as github from '@actions/github';

/**
 * Handles the event when a pull request is closed.
 * @param slackToken - Slack bot token.
 * @param slackChannel - Slack channel ID.
 * @param closeMessageTemplate - Template for the close Slack message.
 */
export async function handlePRClosed(
  slackToken: string,
  slackChannel: string,
  closeMessageTemplate: string
) {
  const pr = github.context.payload.pull_request;
  if (!pr) {
    throw new Error('No pull request found');
  }

  if (!pr.merged) {
    console.log(
      'Pull request was closed but not merged. No notification sent.'
    );
    return;
  }

  const prTitle = pr.title;
  const prUrl = pr.html_url || '';
  const mergedBy = pr.merged_by.login;

  // Extract the Slack message timestamp from the pull request body
  const prBody = pr.body || '';
  const messageTsMatch = prBody.match(/Slack message_ts: (\d+\.\d+)/);
  const messageTs = messageTsMatch ? messageTsMatch[1] : null;

  if (!messageTs) {
    throw new Error('No Slack message_ts found in pull request description');
  }

  const closeMessage = closeMessageTemplate
    .replace('${prUrl}', prUrl)
    .replace('${prTitle}', prTitle)
    .replace('${mergedBy}', mergedBy);

  // Send the close message to Slack in the same thread as the initial message
  const response = await fetch('https://slack.com/api/chat.postMessage', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${slackToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      channel: slackChannel,
      text: closeMessage,
      thread_ts: messageTs,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(
      `Slack API request failed: ${response.status} ${
        response.statusText
      } - ${JSON.stringify(errorData)}`
    );
  }
}
