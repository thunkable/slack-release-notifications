import * as github from '@actions/github';
import { handlePRUpdated } from '../src/handlePRUpdated';
import { fetchAllCommits, Commit } from '../src/utils/fetchAllCommits';

jest.mock('../src/utils/fetchAllCommits');

// Mock fetch globally
global.fetch = jest.fn(async (url) => {
  if (url === 'https://slack.com/api/chat.postMessage') {
    return {
      ok: true,
      json: async () => ({ ok: true }),
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

  const mockCommitsData: Commit[] = [
    {
      sha: 'abc123',
      commit: { message: 'Initial commit', author: { name: 'author1' } },
      author: { login: 'githubUser1' },
    },
    {
      sha: 'def456',
      commit: { message: 'Second commit', author: { name: 'author2' } },
      author: { login: 'githubUser2' },
    },
  ];

  beforeEach(() => {
    Object.defineProperty(github.context, 'payload', {
      value: contextPayload.payload,
    });
    Object.defineProperty(github.context, 'repo', {
      value: contextPayload.repo,
    });
    (fetchAllCommits as jest.Mock).mockResolvedValue(mockCommitsData);
    jest.clearAllMocks();
  });

  it('should send an update message to Slack with the latest commit', async () => {
    await handlePRUpdated(
      'slackToken',
      'slackChannel',
      'githubToken',
      'Updated commit: ${commitMessage} by ${githubUser}'
    );

    expect(fetchAllCommits).toHaveBeenCalledWith(
      'owner',
      'repo',
      1,
      'githubToken'
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
          text: 'Updated commit: Second commit by githubUser2',
          thread_ts: '12345.67890',
        }),
      }
    );
  });

  it('should throw an error if no pull request is found', async () => {
    Object.defineProperty(github.context, 'payload', {
      value: { pull_request: null },
    });

    await expect(
      handlePRUpdated(
        'slackToken',
        'slackChannel',
        'githubToken',
        'Updated commit: ${commitMessage} by ${githubUser}'
      )
    ).rejects.toThrow('No pull request found');
  });

  it('should throw an error if no Slack message_ts is found', async () => {
    Object.defineProperty(github.context.payload.pull_request, 'body', {
      value: 'Some description without message_ts',
    });

    await expect(
      handlePRUpdated(
        'slackToken',
        'slackChannel',
        'githubToken',
        'Updated commit: ${commitMessage} by ${githubUser}'
      )
    ).rejects.toThrow('No Slack message_ts found in pull request description');
  });

  it('should throw an error if no commits are found', async () => {
    (fetchAllCommits as jest.Mock).mockResolvedValueOnce([]);

    Object.defineProperty(github.context.payload.pull_request, 'body', {
      value: 'Some description\nSlack message_ts: 12345.67890',
    });

    await expect(
      handlePRUpdated(
        'slackToken',
        'slackChannel',
        'githubToken',
        'Updated commit: ${commitMessage} by ${githubUser}'
      )
    ).rejects.toThrow('No commits found');
  });

  it('should handle errors from the Slack API', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 400,
      statusText: 'Bad Request',
      json: async () => ({ message: 'Invalid request' }),
    } as Response);

    Object.defineProperty(github.context.payload.pull_request, 'body', {
      value: 'Some description\nSlack message_ts: 12345.67890',
    });

    await expect(
      handlePRUpdated(
        'slackToken',
        'slackChannel',
        'githubToken',
        'Updated commit: ${commitMessage} by ${githubUser}'
      )
    ).rejects.toThrow(
      'Slack API request failed: 400 Bad Request - {"message":"Invalid request"}'
    );
  });
});
