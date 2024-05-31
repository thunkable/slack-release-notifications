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
    const prUrl: string = pr.html_url || ''; // Ensure prUrl is a string
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

    const initialMessageResponse = await axios.post('https://slack.com/api/chat.postMessage', {
        channel: slackChannel,
        text: initialMessage
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
    await octokit.rest.pulls.update({
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
        const githubUser = commit.author?.login || commit.commit.author.name;
        const slackUserId = githubToSlackMap ? githubToSlackMap[githubUser] : githubUser;
        const userDisplay = slackUserId ? `<@${slackUserId}>` : `@${githubUser}`;
        return `- <${commitUrl}|${commitMessage}> by ${userDisplay}`;
    }).join('\n');

    const changelogUrl = `${repoUrl}/compare/${targetBranch}...${branchName}`;
    const commitListMessage = commitListMessageTemplate
        .replace('${commitListMessage}', commitMessages)
        .replace('${changelogUrl}', changelogUrl)
        .replace('${branchName}', branchName)
        .replace('${targetBranch}', targetBranch)
        .replace(/\\n/g, '\n'); // Replace escaped newline characters with actual newline characters

    await axios.post('https://slack.com/api/chat.postMessage', {
        channel: slackChannel,
        text: commitListMessage,
        thread_ts: messageTs
    }, {
        headers: {
            'Authorization': `Bearer ${slackToken}`,
            'Content-Type': 'application/json'
        }
    });
}
