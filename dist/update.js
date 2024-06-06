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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const core = __importStar(require("@actions/core"));
const github = __importStar(require("@actions/github"));
const axios_1 = __importDefault(require("axios"));
async function run() {
    try {
        const slackToken = core.getInput('slack-bot-token');
        const slackChannel = core.getInput('slack-channel');
        const githubToken = core.getInput('github-token');
        if (!slackToken || !slackChannel || !githubToken) {
            throw new Error('Missing required environment variables');
        }
        const pr = github.context.payload.pull_request;
        if (!pr) {
            throw new Error('No pull request found');
        }
        const prNumber = pr.number;
        const prBody = pr.body;
        if (!prBody) {
            throw new Error('No pull request body found');
        }
        const messageTsMatch = prBody.match(/Slack message_ts: (\d+\.\d+)/);
        if (!messageTsMatch) {
            throw new Error('No Slack message timestamp found in pull request description');
        }
        const messageTs = messageTsMatch[1];
        const commitsUrl = pr.commits_url;
        const commitsResponse = await axios_1.default.get(commitsUrl, {
            headers: {
                'Authorization': `token ${githubToken}`
            }
        });
        const repoUrl = `https://github.com/${github.context.repo.owner}/${github.context.repo.repo}`;
        const commitMessages = commitsResponse.data.map((commit) => {
            const commitMessage = commit.commit.message;
            const commitSha = commit.sha;
            const commitUrl = `${repoUrl}/commit/${commitSha}`;
            const githubUser = commit.author?.login;
            const slackUserId = githubUser ? `<@${githubUser}>` : commit.commit.author.name;
            return `- <${commitUrl}|${commitMessage}> by ${slackUserId}`;
        }).join('\n');
        await axios_1.default.post('https://slack.com/api/chat.postMessage', {
            channel: slackChannel,
            text: `New commit added:\n${commitMessages}`,
            thread_ts: messageTs
        }, {
            headers: {
                'Authorization': `Bearer ${slackToken}`,
                'Content-Type': 'application/json'
            }
        });
    }
    catch (error) {
        if (error instanceof Error) {
            core.setFailed(error.message);
        }
        else {
            core.setFailed('An unknown error occurred');
        }
    }
}
run();
