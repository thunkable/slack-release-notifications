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
exports.handlePRClosed = void 0;
const github = __importStar(require("@actions/github"));
async function handlePRClosed(slackToken, slackChannel, closeMessageTemplate) {
    const pr = github.context.payload.pull_request;
    if (!pr) {
        throw new Error('No pull request found');
    }
    if (!pr.merged) {
        console.log('Pull request was closed but not merged. No notification sent.');
        return;
    }
    const prTitle = pr.title;
    const prUrl = pr.html_url || '';
    const mergedBy = pr.merged_by.login;
    const prBody = pr.body || '';
    const messageTsMatch = prBody.match(/Slack message_ts: (\d+\.\d+)/);
    const messageTs = messageTsMatch ? messageTsMatch[1] : null;
    if (!messageTs) {
        throw new Error('No Slack message_ts found in pull request description');
    }
    const closeMessage = closeMessageTemplate
        .replace('${prUrl}', prUrl)
        .replace('${prTitle}', prTitle)
        .replace('${mergedBy}', mergedBy);
    const response = await fetch('https://slack.com/api/chat.postMessage', {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${slackToken}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            channel: slackChannel,
            text: closeMessage,
            thread_ts: messageTs,
        }),
    });
    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Slack API request failed: ${response.status} ${response.statusText} - ${JSON.stringify(errorData)}`);
    }
}
exports.handlePRClosed = handlePRClosed;
