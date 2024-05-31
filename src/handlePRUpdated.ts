import * as github from '@actions/github';
import axios from 'axios';

export async function handlePRUpdated(slackToken: string, slackChannel: string, githubToken: string) {
    const pr = github.context.payload.pull_request;
    if (!pr) {
        throw new Error('No pull request found');
    }

    const prBody = pr.body || '';  // Ensure prBody is a string
    const messageTsMatch = prBody.match(/Slack message_ts: (\d+\.\d+)/);
    const messageTs = messageTsMatch ? messageTsMatch[1] : null;

    if (!messageTs) {
        throw new Error('No Slack message_ts found in pull request description');
    }

    const commitsUrl = pr.commits_url;
    const commitsResponse = await axios.get(commitsUrl, {
        headers: {
            'Authorization': `token ${githubToken}`
        }
    });

    const repoUrl = `https://github.com/${github.context.repo.owner}/${github.context.repo.repo}`;
    const commit = commitsResponse.data[commitsResponse.data.length - 1];  // Get the last commit
    const commitMessage = commit.commit.message.split('\n')[0];  // Use only the first line of the commit message
    const commitSha = commit.sha;
    const commitUrl = `${repoUrl}/commit/${commitSha}`;
    const githubUser = commit.author?.login;
    const slackUser = `@${githubUser || commit.commit.author.name}`;

    const commitMessageFormatted = `<${commitUrl}|${commitMessage}> by ${slackUser}`;

    await axios.post('https://slack.com/api/chat.postMessage', {
        channel: slackChannel,
        text: `New commit added: ${commitMessageFormatted}`,
        thread_ts: messageTs
    }, {
        headers: {
            'Authorization': `Bearer ${slackToken}`,
            'Content-Type': 'application/json'
        }
    });
}