"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.handlePROpened = void 0;
const github = __importStar(require("@actions/github"));
const core = __importStar(require("@actions/core"));
async function fetchAllCommits(commitsUrl, githubToken) {
    const allCommits = [];
    let url = `${commitsUrl}?per_page=100`;
    let page = 1;
    while (url) {
        core.setFailed(`Fetching page ${page}: ${url}`);
        const response = await fetch(url, {
            headers: {
                Authorization: `token ${githubToken}`,
            },
        });
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`GitHub API request failed: ${response.status} ${response.statusText} - ${JSON.stringify(errorData)}`);
        }
        const commitsData = await response.json();
        core.setFailed(`Fetched ${commitsData.length} commits on page ${page}`);
        if (!Array.isArray(commitsData) || commitsData.length === 0) {
            break;
        }
        allCommits.push(...commitsData);
        const linkHeader = response.headers.get('link');
        if (linkHeader) {
            const nextLinkMatch = linkHeader.match(/<([^>]+)>;\s*rel="next"/);
            url = nextLinkMatch ? nextLinkMatch[1] : null;
        }
        else {
            url = null;
        }
        page++;
    }
    core.setFailed(`Fetched a total of ${allCommits.length} commits`);
    return allCommits;
}
async function handlePROpened(slackToken, slackChannel, githubToken, initialMessageTemplate, commitListMessageTemplate, githubToSlackMap) {
    const pr = github.context.payload.pull_request;
    if (!pr) {
        throw new Error('No pull request found');
    }
    const prTitle = pr.title;
    const prUrl = pr.html_url || ''; // Ensure prUrl is a string
    const branchName = pr.head.ref;
    const targetBranch = pr.base.ref;
    const prNumber = pr.number;
    const prBody = pr.body || '';
    const initialMessage = initialMessageTemplate
        .replace('${prUrl}', prUrl)
        .replace('${prTitle}', prTitle)
        .replace('${branchName}', branchName)
        .replace('${targetBranch}', targetBranch)
        .replace(/\\n/g, '\n');
    const initialMessageResponse = await fetch('https://slack.com/api/chat.postMessage', {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${slackToken}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            channel: slackChannel,
            text: initialMessage,
        }),
    });
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
    const commitsData = await fetchAllCommits(commitsUrl, githubToken);
    const repoUrl = `https://github.com/${github.context.repo.owner}/${github.context.repo.repo}`;
    let commitMessages = commitsData
        .map((commit) => {
        const commitMessage = commit.commit.message.split('\n')[0]; // Extract only the first line
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
    if (commitMessages.length > 4000) {
        // Slack message limit is 4000 characters
        const commitMessagesArr = commitMessages.match(/[\s\S]{1,4000}/g) || [];
        for (let i = 0; i < commitMessagesArr.length; i++) {
            const text = i === commitMessagesArr.length - 1
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
    }
    else {
        const changelogUrl = `${repoUrl}/compare/${targetBranch}...${branchName}`;
        const commitListMessage = commitListMessageTemplate
            .replace('${commitListMessage}', commitMessages)
            .replace('${changelogUrl}', changelogUrl)
            .replace('${branchName}', branchName)
            .replace('${targetBranch}', targetBranch)
            .replace(/\\n/g, '\n'); // Replace escaped newline characters with actual newline characters
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
exports.handlePROpened = handlePROpened;
