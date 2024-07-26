import * as github from '@actions/github';
import { handlePRUpdated } from '../src/handlePRUpdated';

// Mock fetch globally
global.fetch = jest.fn(async (url) => {
  if (url === 'https://slack.com/api/chat.postMessage') {
    return {
      ok: true,
      json: async () => ({ ok: true }),
    } as Response;
  } else if (url.includes('/commits')) {
    return {
      ok: true,
      json: async () => [
        {
          sha: 'abc123',
          commit: { message: 'Initial commit', author: { name: 'author' } },
          author: { login: 'author' },
        },
      ],
      headers: {
        get: (header: string) => {
          if (header === 'link') {
            return null;
          }
          return null;
        },
      },
    } as Response;
  }
  throw new Error('Unexpected URL');
}) as jest.Mock;

describe('handlePRUpdated', () => {
  const contextPayload = {
    payload: {
      pull_request: {
        body: 'Some description\nSlack message_ts: 12345.67890',
        commits_url: 'http://example.com/commits',
        head: { ref: 'branchName' },
        base: { ref: 'targetBranch' },
        number: 1,
      },
    },
    repo: {
      owner: 'owner',
      repo: 'repo',
    },
  };

  beforeEach(() => {
    Object.defineProperty(github.context, 'payload', {
      value: contextPayload.payload,
    });
    Object.defineProperty(github.context, 'repo', {
      value: contextPayload.repo,
    });
  });

  it('should send an update message to Slack', async () => {
    await handlePRUpdated(
      'slackToken',
      'slackChannel',
      'githubToken',
      'Updated commit: ${commitMessage} by ${githubUser}'
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
          channel: 'slackChannel',
          text: 'Updated commit: Initial commit by author',
          thread_ts: '12345.67890',
        }),
      }
    );
  });
});
