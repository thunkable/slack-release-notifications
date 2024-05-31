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
        const githubToSlackMapInput = core.getInput('github-to-slack-map');
        const githubToSlackMap = githubToSlackMapInput ? JSON.parse(githubToSlackMapInput) : undefined;

        const action = github.context.payload.action;

        switch (action) {
            case 'opened':
                await handlePROpened(slackToken, slackChannel, githubToken, githubToSlackMap);
                break;
            case 'synchronize':
                await handlePRUpdated(slackToken, slackChannel, githubToken);
                break;
            case 'closed':
                await handlePRClosed(slackToken, slackChannel, githubToken);
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
