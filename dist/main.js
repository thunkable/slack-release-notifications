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
const core = __importStar(require("@actions/core"));
const github = __importStar(require("@actions/github"));
const handlePROpened_1 = require("./handlePROpened");
const handlePRUpdated_1 = require("./handlePRUpdated");
const handlePRClosed_1 = require("./handlePRClosed");
async function run() {
    try {
        const slackToken = core.getInput('slack-bot-token');
        const slackChannel = core.getInput('slack-channel');
        const githubToken = core.getInput('github-token');
        const githubToSlackMap = core.getInput('github-to-slack-map');
        const initialMessageTemplate = core.getInput('initial-message-template');
        const updateMessageTemplate = core.getInput('update-message-template');
        const closeMessageTemplate = core.getInput('close-message-template');
        let githubToSlackMapParsed;
        if (githubToSlackMap) {
            githubToSlackMapParsed = JSON.parse(githubToSlackMap);
        }
        const action = github.context.payload.action;
        switch (action) {
            case 'opened':
                await (0, handlePROpened_1.handlePROpened)(slackToken, slackChannel, githubToken, initialMessageTemplate, githubToSlackMapParsed);
                break;
            case 'synchronize':
                await (0, handlePRUpdated_1.handlePRUpdated)(slackToken, slackChannel, githubToken, updateMessageTemplate);
                break;
            case 'closed':
                await (0, handlePRClosed_1.handlePRClosed)(slackToken, slackChannel, githubToken, closeMessageTemplate);
                break;
            default:
                throw new Error('Unsupported pull request event action');
        }
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
