import * as github from '@actions/github';
import { handlePRClosed } from '../src/handlePRClosed';

// Mock fetch globally
global.fetch = jest.fn(async (url, options) => {
  return {
    ok: true,
    json: async () => ({ ok: true, ts: '12345' }),
  } as Response;
}) as jest.Mock;

describe('handlePRClosed', () => {
  const contextPayload = {
    payload: {
      pull_request: {
        merged: true,
        title: 'Test PR',
        html_url: 'http://example.com',
        merged_by: { login: 'user' },
        body: 'Some description\nSlack message_ts: 12345.67890',
        number: 1,
      },
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    Object.defineProperty(github.context, 'payload', {
      value: contextPayload.payload,
    });
  });

  it('should send a message to Slack when PR is closed and merged', async () => {
    await handlePRClosed(
      'slackToken',
      'slackChannelId',
      'PR ${prTitle} was closed by ${mergedBy}'
    );

    expect(fetch).toHaveBeenCalledWith(
      'https://slack.com/api/chat.postMessage',
      {
        method: 'POST',
        headers: {
          Authorization: 'Bearer slackToken',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          channel: 'slackChannelId',
          text: 'PR Test PR was closed by user',
          thread_ts: '12345.67890',
        }),
      }
    );
  });

  it('should not send a message if PR is not merged', async () => {
    contextPayload.payload.pull_request.merged = false;
    Object.defineProperty(github.context, 'payload', {
      value: contextPayload.payload,
    });

    await handlePRClosed(
      'slackToken',
      'slackChannelId',
      'PR ${prTitle} was closed by ${mergedBy}'
    );

    expect(fetch).not.toHaveBeenCalled();
  });
});
