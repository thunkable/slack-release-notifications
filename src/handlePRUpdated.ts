import * as github from '@actions/github';
import axios from 'axios';

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

    const prNumber = pr.number;
    const prBody = pr.body || '';
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
    const latestCommit = commitsResponse.data[commitsResponse.data.length - 1];

    if (!latestCommit) {
        throw new Error('No commits found');
    }

    const commitMessage = latestCommit.commit.message;
    const commitSha = latestCommit.sha;
    const commitUrl = `${repoUrl}/commit/${commitSha}`;
    const githubUser = latestCommit.author?.login || latestCommit.commit.author.name;

    const defaultUpdateMessageTemplate = `New commit added: <${commitUrl}|${commitMessage}> by @${githubUser}`;
    const updateMessage = (updateMessageTemplate || defaultUpdateMessageTemplate)
        .replace('${commitUrl}', commitUrl)
        .replace('${commitMessage}', commitMessage)
        .replace('${githubUser}', githubUser);

    await axios.post('https://slack.com/api/chat.postMessage', {
        channel: slackChannel,
        text: updateMessage,
        thread_ts: messageTs
    }, {
        headers: {
            'Authorization': `Bearer ${slackToken}`,
            'Content-Type': 'application/json'
        }
    });
}
