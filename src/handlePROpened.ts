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

async function fetchAllCommits(
  owner: string,
  repo: string,
  pullNumber: number,
  githubToken: string
): Promise<Commit[]> {
  const allCommits: Commit[] = [];
  let url:
    | string
    | null = `https://api.github.com/repos/${owner}/${repo}/pulls/${pullNumber}/commits?per_page=100`;
  let page = 1;

  while (url) {
    const log = `Fetching page ${page}: ${url}`;
    core.info(log);

    const response: Response = await fetch(url, {
      headers: {
        Authorization: `token ${githubToken}`,
      },
    });

    if (!response.ok) {
      const errorData = await response.json();
      const errorLog = `GitHub API request failed: ${response.status} ${
        response.statusText
      } - ${JSON.stringify(errorData)}`;
      core.error(errorLog);
      throw new Error(errorLog);
    }

    const commitsData: Commit[] = await response.json();
    const fetchedLog = `Fetched ${commitsData.length} commits on page ${page}`;
    core.info(fetchedLog);

    allCommits.push(...commitsData);

    const linkHeader: string | null = response.headers.get('link');
    const linkHeaderLog = `Link Header: ${linkHeader}`;
    core.info(linkHeaderLog);

    if (linkHeader) {
      const nextLinkMatch = linkHeader.match(/<([^>]+)>;\s*rel="next"/);
      url = nextLinkMatch ? nextLinkMatch[1] : null;
    } else {
      url = null;
    }

    page++;
  }

  const totalFetchedLog = `Fetched a total of ${allCommits.length} commits`;
  core.info(totalFetchedLog);
  core.debug(`All commits: ${JSON.stringify(allCommits)}`);
  return allCommits;
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

  const logMessage = `Processing PR: ${prNumber} - ${prTitle}`;
  core.info(logMessage);

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
  const initialMessageLog = `Initial message sent: ${initialMessageData.ok}`;
  core.info(initialMessageLog);

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

  const { owner, repo } = github.context.repo;
  const commitsData: Commit[] = await fetchAllCommits(
    owner,
    repo,
    prNumber,
    githubToken
  );

  const repoUrl = `https://github.com/${owner}/${repo}`;
  let commitMessages = commitsData
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

  const commitMessagesLog = `Commit messages:\n${commitMessages}`;
  core.info(commitMessagesLog);

  if (commitMessages.length > 4000) {
    const commitMessagesArr = commitMessages.match(/[\s\S]{1,4000}/g) || [];
    for (let i = 0; i < commitMessagesArr.length; i++) {
      const text =
        i === commitMessagesArr.length - 1
          ? `${commitMessagesArr[i]}\n\n<${repoUrl}/compare/${targetBranch}...${branchName}|Full Changelog: ${branchName} to ${targetBranch}>`
          : commitMessagesArr[i];

      await fetch('https://slack.com/api/chat.postMessage', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${slackToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          channel: slackChannel,
          text: text,
          thread_ts: messageTs,
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
}
