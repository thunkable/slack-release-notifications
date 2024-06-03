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
exports.handlePRUpdated = void 0;
const github = __importStar(require("@actions/github"));
const axios_1 = __importDefault(require("axios"));
async function handlePRUpdated(slackToken, slackChannel, githubToken, updateMessageTemplate) {
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
    const commitsResponse = await axios_1.default.get(commitsUrl, {
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
    const updateMessage = updateMessageTemplate
        .replace('${commitUrl}', commitUrl)
        .replace('${commitMessage}', commitMessage)
        .replace('${githubUser}', githubUser);
    await axios_1.default.post('https://slack.com/api/chat.postMessage', {
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
exports.handlePRUpdated = handlePRUpdated;
