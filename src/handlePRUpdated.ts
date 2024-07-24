import * as github from '@actions/github';

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

  const commitsUrl = pr.commits_url;
  const commitsResponse = await fetch(commitsUrl, {
    headers: {
      Authorization: `token ${githubToken}`,
    },
  });

  if (!commitsResponse.ok) {
    const errorData = await commitsResponse.json();
    throw new Error(
      `GitHub API request failed: ${commitsResponse.status} ${
        commitsResponse.statusText
      } - ${JSON.stringify(errorData)}`
    );
  }

  const commitsData = await commitsResponse.json();
  const repoUrl = `https://github.com/${github.context.repo.owner}/${github.context.repo.repo}`;

  // Retrieve the last processed commit from the PR body
  const lastProcessedCommitMatch = prBody.match(/Last processed commit: (\w+)/);
  const lastProcessedCommit = lastProcessedCommitMatch
    ? lastProcessedCommitMatch[1]
    : null;

  // Find new commits
  const newCommits = lastProcessedCommit
    ? commitsData.filter(
        (commit: { sha: string }) => commit.sha !== lastProcessedCommit
      )
    : commitsData;

  if (newCommits.length === 0) {
    console.log('No new commits to process.');
    return;
  }

  // Process each new commit
  for (const commit of newCommits) {
    const commitMessage = commit.commit.message;
    const commitSha = commit.sha;
    const commitUrl = `${repoUrl}/commit/${commitSha}`;
    const githubUser = commit.author?.login || commit.commit.author.name;

    const updateMessage = updateMessageTemplate
      .replace('${commitUrl}', commitUrl)
      .replace('${commitMessage}', commitMessage)
      .replace('${githubUser}', githubUser);

    const slackResponse = await fetch(
      'https://slack.com/api/chat.postMessage',
      {
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
      }
    );

    if (!slackResponse.ok) {
      const errorData = await slackResponse.json();
      throw new Error(
        `Slack API request failed: ${slackResponse.status} ${
          slackResponse.statusText
        } - ${JSON.stringify(errorData)}`
      );
    }
  }

  // Update the PR body with the latest processed commit SHA
  const latestCommitSha = commitsData[commitsData.length - 1].sha;
  const newPrBody = `${prBody}\n\nLast processed commit: ${latestCommitSha}`;
  const octokit = github.getOctokit(githubToken);
  await octokit.rest.pulls.update({
    ...github.context.repo,
    pull_number: pr.number,
    body: newPrBody,
  });
}
