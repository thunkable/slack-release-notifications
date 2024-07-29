import * as github from '@actions/github';
import { fetchAllCommits, Commit } from './utils/fetchAllCommits';

/**
 * Handles the event when a pull request is updated with new commits.
 * @param slackToken - Slack bot token.
 * @param slackChannelId - Slack channel ID.
 * @param githubToken - GitHub token.
 * @param updateMessageTemplate - Template for the update Slack message.
 */
export async function handlePRUpdated(
  slackToken: string,
  slackChannelId: string,
  githubToken: string,
  updateMessageTemplate: string
) {
  const pr = github.context.payload.pull_request;
  if (!pr) {
    throw new Error('No pull request found');
  }

  // Extract the Slack message timestamp from the pull request body
  const prBody = pr.body || '';
  const messageTimestampMatch = prBody.match(/Slack message_ts: (\d+\.\d+)/);
  const messageTimestamp = messageTimestampMatch
    ? messageTimestampMatch[1]
    : null;

  if (!messageTimestamp) {
    throw new Error('No Slack message_ts found in pull request description');
  }

  // Fetch all commits for the pull request
  const { owner, repo } = github.context.repo;
  const commitsData: Commit[] = await fetchAllCommits(
    owner,
    repo,
    pr.number,
    githubToken
  );
  const latestCommit = commitsData[commitsData.length - 1];

  if (!latestCommit) {
    throw new Error('No commits found');
  }

  // Extract details of the latest commit
  const commitMessage = latestCommit.commit.message;
  const commitSha = latestCommit.sha;
  const commitUrl = `https://github.com/${owner}/${repo}/commit/${commitSha}`;
  const githubUser =
    latestCommit.author?.login || latestCommit.commit.author.name;

  // Format the update Slack message
  const updateMessage = updateMessageTemplate
    .replace('${commitUrl}', commitUrl)
    .replace('${commitMessage}', commitMessage)
    .replace('${githubUser}', githubUser);

  // Send the update message to Slack in the same thread as the initial message
  const slackResponse = await fetch('https://slack.com/api/chat.postMessage', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${slackToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      channel: slackChannelId,
      text: updateMessage,
      thread_ts: messageTimestamp,
    }),
  });

  if (!slackResponse.ok) {
    const errorData = await slackResponse.json();
    throw new Error(
      `Slack API request failed: ${slackResponse.status} ${
        slackResponse.statusText
      } - ${JSON.stringify(errorData)}`
    );
  }
}
