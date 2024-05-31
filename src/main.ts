import * as core from '@actions/core';
import * as github from '@actions/github';
import { handlePROpened } from './handlePROpened';
import { handlePRUpdated } from './handlePRUpdated';
import { handlePRClosed } from './handlePRClosed';

async function run() {
    try {
        const slackToken = core.getInput('slack-bot-token');
        const slackChannel = core.getInput('slack-channel');
        const githubToken = core.getInput('github-token');
        const githubToSlackMap = core.getInput('github-to-slack-map');
        const initialMessageTemplate = core.getInput('initial-message-template');
        const updateMessageTemplate = core.getInput('update-message-template');
        const closeMessageTemplate = core.getInput('close-message-template');

        let githubToSlackMapParsed: Record<string, string> | undefined;

        if (githubToSlackMap) {
            githubToSlackMapParsed = JSON.parse(githubToSlackMap);
        }

        const action = github.context.payload.action;

        switch (action) {
            case 'opened':
                await handlePROpened(slackToken, slackChannel, githubToken, initialMessageTemplate, githubToSlackMapParsed);
                break;
            case 'synchronize':
                await handlePRUpdated(slackToken, slackChannel, githubToken, updateMessageTemplate);
                break;
            case 'closed':
                await handlePRClosed(slackToken, slackChannel, githubToken, closeMessageTemplate);
                break;
            default:
                throw new Error('Unsupported pull request event action');
        }
    } catch (error) {
        if (error instanceof Error) {
            core.setFailed(error.message);
        } else {
            core.setFailed('An unknown error occurred');
        }
    }
}

run();
