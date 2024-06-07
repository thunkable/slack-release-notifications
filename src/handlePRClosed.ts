import * as github from '@actions/github';

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
