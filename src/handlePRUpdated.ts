import * as github from '@actions/github';
import { fetchAllCommits, Commit } from './utils/fetchAllCommits';

export async function handlePRUpdated(
  slackToken: string,
  slackChannel: string,
  githubToken: string,
  updateMessageTemplate: string
) {
  const pr = github.context.payload.pull_request;
  if (!pr) {
    throw new Error('No pull request found');
  }

  const prBody = pr.body || '';
  const messageTsMatch = prBody.match(/Slack message_ts: (\d+\.\d+)/);
  const messageTs = messageTsMatch ? messageTsMatch[1] : null;

  if (!messageTs) {
    throw new Error('No Slack message_ts found in pull request description');
  }

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

  const commitMessage = latestCommit.commit.message;
  const commitSha = latestCommit.sha;
  const commitUrl = `https://github.com/${owner}/${repo}/commit/${commitSha}`;
  const githubUser =
    latestCommit.author?.login || latestCommit.commit.author.name;

  const updateMessage = updateMessageTemplate
    .replace('${commitUrl}', commitUrl)
    .replace('${commitMessage}', commitMessage)
    .replace('${githubUser}', githubUser);

  const slackResponse = await fetch('https://slack.com/api/chat.postMessage', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${slackToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      channel: slackChannel,
      text: updateMessage,
      thread_ts: messageTs,
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
