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
const fetchAllCommits_1 = require("./utils/fetchAllCommits");
async function handlePROpened(slackToken, slackChannel, githubToken, initialMessageTemplate, commitListMessageTemplate, githubToSlackMap) {
    const pr = github.context.payload.pull_request;
    if (!pr) {
        throw new Error('No pull request found');
    }
    const prTitle = pr.title;
    const prUrl = pr.html_url || '';
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
    const { owner, repo } = github.context.repo;
    const commitsData = await (0, fetchAllCommits_1.fetchAllCommits)(owner, repo, prNumber, githubToken);
    const repoUrl = `https://github.com/${owner}/${repo}`;
    let commitMessages = commitsData
        .map((commit) => {
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
    if (commitMessages.length > 4000) {
        const commitMessagesArr = [];
        let chunk = '';
        const lines = commitMessages.split('\n');
        for (const line of lines) {
            if ((chunk + '\n' + line).length > 3800) {
                commitMessagesArr.push(chunk.trim());
                chunk = line;
            }
            else {
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
exports.handlePROpened = handlePROpened;
