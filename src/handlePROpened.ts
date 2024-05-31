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

export async function handlePROpened(slackToken: string, slackChannel: string, githubToken: string) {
    const pr = github.context.payload.pull_request;
    if (!pr) {
        throw new Error('No pull request found');
    }

    const prTitle = pr.title;
    const prUrl = pr.html_url;
    const branchName = pr.head.ref;
    const targetBranch = pr.base.ref;
    const prNumber = pr.number;
    const prBody = pr.body;

    const initialMessageResponse = await axios.post('https://slack.com/api/chat.postMessage', {
        channel: slackChannel,
        text: `New release pull request created: <${prUrl}|${prTitle}>\nBranch: ${branchName} -> ${targetBranch}`
    }, {
        headers: {
            'Authorization': `Bearer ${slackToken}`,
            'Content-Type': 'application/json'
        }
    });

    if (!initialMessageResponse.data.ok) {
        throw new Error('Failed to send initial Slack message');
    }

    const messageTs = initialMessageResponse.data.ts;

    const newPrBody = `Slack message_ts: ${messageTs}\n\n${prBody}`;
    const octokit = github.getOctokit(githubToken);
    await octokit.pulls.update({
        ...github.context.repo,
        pull_number: prNumber,
        body: newPrBody
    });

    const commitsUrl = pr.commits_url;
    const commitsResponse = await axios.get(commitsUrl, {
        headers: {
            'Authorization': `token ${githubToken}`
        }
    });

    const repoUrl = `https://github.com/${github.context.repo.owner}/${github.context.repo.repo}`;
    const commitMessages = commitsResponse.data.map((commit: Commit) => {
        const commitMessage = commit.commit.message;
        const commitSha = commit.sha;
        const commitUrl = `${repoUrl}/commit/${commitSha}`;
        const githubUser = commit.author?.login;
        const slackUserId = githubUser ? `<@${githubUser}>` : commit.commit.author.name;
        return `- <${commitUrl}|${commitMessage}> by ${slackUserId}`;
    }).join('\n');

    await axios.post('https://slack.com/api/chat.postMessage', {
        channel: slackChannel,
        text: `Commits in this pull request:\n${commitMessages}`,
        thread_ts: messageTs
    }, {
        headers: {
            'Authorization': `Bearer ${slackToken}`,
            'Content-Type': 'application/json'
        }
    });
}
