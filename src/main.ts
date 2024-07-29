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
    const initialMessageTemplate = core.getInput('initial-message-template');
    const updateMessageTemplate = core.getInput('update-message-template');
    const closeMessageTemplate = core.getInput('close-message-template');
    const commitListMessageTemplate = core.getInput(
      'commit-list-message-template'
    );
    const githubToSlackMap = core.getInput('github-to-slack-map');
    const sortCommits = core.getInput('sort-commits') === 'true';
    const githubToSlackMapParsed = githubToSlackMap
      ? JSON.parse(githubToSlackMap)
      : undefined;

    const action = github.context.payload.action;

    switch (action) {
      case 'opened':
        await handlePROpened(
          slackToken,
          slackChannel,
          githubToken,
          initialMessageTemplate,
          commitListMessageTemplate,
          githubToSlackMapParsed,
          sortCommits
        );
        break;
      case 'synchronize':
        await handlePRUpdated(
          slackToken,
          slackChannel,
          githubToken,
          updateMessageTemplate
        );
        break;
      case 'closed':
        await handlePRClosed(slackToken, slackChannel, closeMessageTemplate);
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
