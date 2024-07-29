import * as github from '@actions/github';
import { fetchAllCommits, Commit } from './utils/fetchAllCommits';

/**
 * Handles the event when a pull request is opened.
 * @param slackToken - Slack bot token.
 * @param slackChannelId - Slack channel ID.
 * @param githubToken - GitHub token.
 * @param initialMessageTemplate - Template for the initial Slack message.
 * @param commitListMessageTemplate - Template for the commit list Slack message.
 * @param githubToSlackMap - Optional mapping of GitHub usernames to Slack user IDs.
 * @param sortCommits - Flag to sort commits by types and scopes.
 */
export async function handlePROpened(
  slackToken: string,
  slackChannelId: string,
  githubToken: string,
  initialMessageTemplate: string,
  commitListMessageTemplate: string,
  githubToSlackMap?: Record<string, string>,
  sortCommits: boolean = false
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

  // Format the initial Slack message
  const initialMessage = initialMessageTemplate
    .replace('${prUrl}', prUrl)
    .replace('${prTitle}', prTitle)
    .replace('${branchName}', branchName)
    .replace('${targetBranch}', targetBranch)
    .replace(/\\n/g, '\n');

  // Send the initial message to Slack
  const initialMessageResponse = await fetch(
    'https://slack.com/api/chat.postMessage',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${slackToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        channel: slackChannelId,
        text: initialMessage,
      }),
    }
  );

  const initialMessageData = await initialMessageResponse.json();

  if (!initialMessageData.ok) {
    throw new Error('Failed to send initial Slack message');
  }

  const messageTimestamp = initialMessageData.ts;

  // Update the pull request body with the Slack message timestamp
  const newPrBody = `Slack message_ts: ${messageTimestamp}\n\n${prBody}`;
  const octokit = github.getOctokit(githubToken);
  await octokit.rest.pulls.update({
    ...github.context.repo,
    pull_number: prNumber,
    body: newPrBody,
  });

  // Fetch all commits for the pull request
  const { owner, repo } = github.context.repo;
  const commitsData = await fetchAllCommits(owner, repo, prNumber, githubToken);

  let commitMessages: string;
  if (sortCommits) {
    // Categorize commits by scopes and sort them alphabetically by type
    const categorizedCommits: Record<string, { [type: string]: string[] }> =
      commitsData.reduce((acc, commit) => {
        const commitMessage = commit.commit.message.split('\n')[0];
        const commitSha = commit.sha;
        const commitUrl = `https://github.com/${owner}/${repo}/commit/${commitSha}`;
        const githubUser = commit.author?.login || commit.commit.author.name;
        const slackUserId = githubToSlackMap
          ? githubToSlackMap[githubUser]
          : null;
        const userDisplay = slackUserId
          ? `<@${slackUserId}>`
          : `@${githubUser}`;
        const commitEntry = `- <${commitUrl}|${commitMessage}> by ${userDisplay}`;

        const scopeMatch = commitMessage.match(/^\w+\(([\w,]+)\):/);
        const scopes = scopeMatch ? scopeMatch[1].split(',') : ['other'];
        const type = commitMessage.split('(')[0].trim();

        scopes.forEach((scope, index) => {
          const key = scope.trim();
          if (!acc[key]) {
            acc[key] = {};
          }
          if (!acc[key][type]) {
            acc[key][type] = [];
          }
          if (index === 0) {
            acc[key][type].push(commitEntry);
          }
        });

        return acc;
      }, {} as Record<string, { [type: string]: string[] }>);

    // Format commit messages
    commitMessages = Object.keys(categorizedCommits)
      .sort()
      .map(
        (scope) =>
          `*${scope.charAt(0).toUpperCase() + scope.slice(1)}*\n` +
          Object.keys(categorizedCommits[scope])
            .sort()
            .map((type) => categorizedCommits[scope][type].sort().join('\n'))
            .join('\n')
      )
      .join('\n\n')
      .replace(/^\s*$(?:\r\n?|\n)/gm, ''); // Remove empty lines
  } else {
    commitMessages = commitsData
      .map((commit: Commit) => {
        const commitMessage = commit.commit.message.split('\n')[0];
        const commitSha = commit.sha;
        const commitUrl = `https://github.com/${owner}/${repo}/commit/${commitSha}`;
        const githubUser = commit.author?.login || commit.commit.author.name;
        const slackUserId = githubToSlackMap
          ? githubToSlackMap[githubUser]
          : null;
        const userDisplay = slackUserId
          ? `<@${slackUserId}>`
          : `@${githubUser}`;
        return `- <${commitUrl}|${commitMessage}> by ${userDisplay}`;
      })
      .join('\n');
  }

  const repoUrl = `https://github.com/${owner}/${repo}`;
  // Handle Slack message length limits

  if (commitMessages.length > 4000) {
    const commitMessagesArr = [];
    let chunk = '';
    const lines = commitMessages.split('\n');

    for (const line of lines) {
      if ((chunk + '\n' + line).length > 3800) {
        commitMessagesArr.push(chunk.trim());
        chunk = line;
      } else {
        chunk += '\n' + line;
      }
    }
    if (chunk) {
      commitMessagesArr.push(chunk.trim());
    }

    for (let i = 0; i < commitMessagesArr.length; i++) {
      let text = commitMessagesArr[i];

      if (i === commitMessagesArr.length - 1) {
        text = `${text}\n\n<${repoUrl}/compare/${targetBranch}...${branchName}|Full Changelog: ${branchName} to ${targetBranch}>`;
      }

      await fetch('https://slack.com/api/chat.postMessage', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${slackToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          channel: slackChannelId,
          text: text,
          thread_ts: messageTimestamp,
        }),
      });
    }
  } else {
    const changelogUrl = `${repoUrl}/compare/${targetBranch}...${branchName}`;
    const commitListMessage = commitListMessageTemplate
      .replace('${commitListMessage}', commitMessages)
      .replace('${changelogUrl}', changelogUrl)
      .replace('${branchName}', branchName)
      .replace('${targetBranch}', targetBranch)
      .replace(/\\n/g, '\n');

    // Send the commit list message to Slack
    await fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${slackToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        channel: slackChannelId,
        text: commitListMessage,
        thread_ts: messageTimestamp,
      }),
    });
  }
}
