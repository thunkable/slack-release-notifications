import * as github from '@actions/github';
import * as core from '@actions/core';

interface Commit {
  sha: string;
  commit: {
    message: string;
    author: {
      name: string;
    };
  };
  author: {
    login: string;
  } | null;
}

export async function handlePROpened(
  slackToken: string,
  slackChannel: string,
  githubToken: string,
  initialMessageTemplate: string,
  commitListMessageTemplate: string,
  githubToSlackMap?: Record<string, string>
) {
  const pr = github.context.payload.pull_request;
  if (!pr) {
    throw new Error('No pull request found');
  }

  const prTitle: string = pr.title;
  const prUrl: string = pr.html_url || '';
  const branchName: string = pr.head.ref;
  const targetBranch: string = pr.base.ref;
  const prNumber: number = pr.number;
  const prBody: string = pr.body || '';

  const initialMessage = initialMessageTemplate
    .replace('${prUrl}', prUrl)
    .replace('${prTitle}', prTitle)
    .replace('${branchName}', branchName)
    .replace('${targetBranch}', targetBranch)
    .replace(/\\n/g, '\n');

  const initialMessageResponse = await fetch(
    'https://slack.com/api/chat.postMessage',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${slackToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        channel: slackChannel,
        text: initialMessage,
      }),
    }
  );

  const initialMessageData = await initialMessageResponse.json();

  if (!initialMessageData.ok) {
    throw new Error('Failed to send initial Slack message');
  }

  const messageTs = initialMessageData.ts;

  const newPrBody = `Slack message_ts: ${messageTs}\n\n${prBody}`;
  const octokit = github.getOctokit(githubToken);
  await octokit.rest.pulls.update({
    ...github.context.repo,
    pull_number: prNumber,
    body: newPrBody,
  });

  const commitsUrl = pr.commits_url;
  const commitsResponse = await fetch(commitsUrl, {
    headers: {
      Authorization: `token ${githubToken}`,
    },
  });

  const commitsData = await commitsResponse.json();

  core.info(`Fetched commits data: ${JSON.stringify(commitsData, null, 2)}`);

  const repoUrl = `https://github.com/${github.context.repo.owner}/${github.context.repo.repo}`;
  const commitMessages = commitsData
    .map((commit: Commit) => {
      const commitMessage = commit.commit.message.split('\n')[0];
      const commitSha = commit.sha;
      const commitUrl = `${repoUrl}/commit/${commitSha}`;
      const githubUser = commit.author?.login || commit.commit.author.name;
      const slackUserId = githubToSlackMap
        ? githubToSlackMap[githubUser]
        : null;
      const userDisplay = slackUserId ? `<@${slackUserId}>` : `@${githubUser}`;
      return `- <${commitUrl}|${commitMessage}> by ${userDisplay}`;
    })
    .join('\n');

  core.info(`Formatted commit messages: ${commitMessages}`);

  const changelogUrl = `${repoUrl}/compare/${targetBranch}...${branchName}`;
  const commitListMessage = commitListMessageTemplate
    .replace('${commitListMessage}', commitMessages)
    .replace('${changelogUrl}', changelogUrl)
    .replace('${branchName}', branchName)
    .replace('${targetBranch}', targetBranch)
    .replace(/\\n/g, '\n');

  core.info(`Final commit list message: ${commitListMessage}`);

  await fetch('https://slack.com/api/chat.postMessage', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${slackToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      channel: slackChannel,
      text: commitListMessage,
      thread_ts: messageTs,
    }),
  });
}
