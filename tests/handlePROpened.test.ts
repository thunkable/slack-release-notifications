import * as github from '@actions/github';
import { handlePROpened } from '../src/handlePROpened';
import { fetchAllCommits, Commit } from '../src/utils/fetchAllCommits';

jest.mock('@actions/github');
jest.mock('../src/utils/fetchAllCommits');

// Mock fetch globally
global.fetch = jest.fn(async (url) => {
  if (url === 'https://slack.com/api/chat.postMessage') {
    return {
      ok: true,
      json: async () => ({ ok: true, ts: '12345' }),
    } as Response;
  }
  throw new Error('Unexpected URL');
}) as jest.Mock;

describe('handlePROpened', () => {
  const slackToken = 'slack-token';
  const slackChannelId = 'slack-channel-id';
  const githubToken = 'github-token';
  const initialMessageTemplate = 'PR opened: ${prUrl} - ${prTitle}';
  const commitListMessageTemplate =
    'Commits:\n${commitListMessage}\nCompare changes: ${changelogUrl}';
  const githubToSlackMap = { githubUser: 'slackUser' };

  const contextPayload = {
    payload: {
      pull_request: {
        title: 'Test PR',
        html_url: 'http://example.com',
        head: { ref: 'feature-branch' },
        base: { ref: 'main' },
        number: 1,
        body: 'PR body',
        commits_url: 'http://api.github.com/commits',
      },
    },
    repo: {
      owner: 'owner',
      repo: 'repo',
    },
  };

  const mockCommitsData: Commit[] = [
    {
      sha: 'commit1',
      commit: {
        message: 'Initial commit\nwith newline',
        author: { name: 'author1' },
      },
      author: { login: 'githubUser' },
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();

    Object.defineProperty(github.context, 'payload', {
      value: contextPayload.payload,
    });

    Object.defineProperty(github.context, 'repo', {
      value: contextPayload.repo,
    });

    (fetchAllCommits as jest.Mock).mockResolvedValue(mockCommitsData);
  });

  it('sends initial Slack message and updates PR body', async () => {
    const initialSlackResponse = {
      ok: true,
      ts: '12345',
    };

    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(initialSlackResponse)))
      .mockResolvedValueOnce(new Response(JSON.stringify(mockCommitsData)))
      .mockResolvedValueOnce(
        new Response(JSON.stringify(initialSlackResponse))
      );

    const octokitMock = {
      rest: {
        pulls: {
          update: jest.fn(),
        },
      },
    };
    (github.getOctokit as jest.Mock).mockReturnValue(octokitMock);

    await handlePROpened(
      slackToken,
      slackChannelId,
      githubToken,
      initialMessageTemplate,
      commitListMessageTemplate,
      githubToSlackMap
    );

    expect(global.fetch).toHaveBeenCalledWith(
      'https://slack.com/api/chat.postMessage',
      expect.objectContaining({
        body: JSON.stringify({
          channel: slackChannelId,
          text: 'PR opened: http://example.com - Test PR',
        }),
        headers: {
          Authorization: `Bearer ${slackToken}`,
          'Content-Type': 'application/json',
        },
        method: 'POST',
      })
    );

    expect(octokitMock.rest.pulls.update).toHaveBeenCalledWith(
      expect.objectContaining({
        pull_number: 1,
        body: 'Slack message_ts: 12345\n\nPR body',
      })
    );

    expect(global.fetch).toHaveBeenCalledWith(
      'https://slack.com/api/chat.postMessage',
      expect.objectContaining({
        body: JSON.stringify({
          channel: slackChannelId,
          text: 'Commits:\n• <https://github.com/owner/repo/commit/commit1|Initial commit> by <@slackUser>\nCompare changes: https://github.com/owner/repo/compare/main...feature-branch',
          thread_ts: '12345',
        }),
        headers: {
          Authorization: `Bearer ${slackToken}`,
          'Content-Type': 'application/json',
        },
        method: 'POST',
      })
    );
  });

  it('handles commit messages with newlines', async () => {
    const initialSlackResponse = {
      ok: true,
      ts: '12345',
    };

    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(initialSlackResponse)))
      .mockResolvedValueOnce(new Response(JSON.stringify(mockCommitsData)))
      .mockResolvedValueOnce(
        new Response(JSON.stringify(initialSlackResponse))
      );

    const octokitMock = {
      rest: {
        pulls: {
          update: jest.fn(),
        },
      },
    };
    (github.getOctokit as jest.Mock).mockReturnValue(octokitMock);

    await handlePROpened(
      slackToken,
      slackChannelId,
      githubToken,
      initialMessageTemplate,
      commitListMessageTemplate,
      githubToSlackMap
    );

    expect(global.fetch).toHaveBeenCalledWith(
      'https://slack.com/api/chat.postMessage',
      expect.objectContaining({
        body: JSON.stringify({
          channel: slackChannelId,
          text: 'Commits:\n• <https://github.com/owner/repo/commit/commit1|Initial commit> by <@slackUser>\nCompare changes: https://github.com/owner/repo/compare/main...feature-branch',
          thread_ts: '12345',
        }),
        headers: {
          Authorization: `Bearer ${slackToken}`,
          'Content-Type': 'application/json',
        },
        method: 'POST',
      })
    );
  });

  it('throws an error if no pull request is found', async () => {
    Object.defineProperty(github.context, 'payload', {
      value: {},
      writable: true,
    });

    await expect(
      handlePROpened(
        slackToken,
        slackChannelId,
        githubToken,
        initialMessageTemplate,
        commitListMessageTemplate,
        githubToSlackMap
      )
    ).rejects.toThrow('No pull request found');
  });

  it('throws an error if initial Slack message fails', async () => {
    const initialSlackResponse = {
      ok: false,
    };
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify(initialSlackResponse))
      );

    await expect(
      handlePROpened(
        slackToken,
        slackChannelId,
        githubToken,
        initialMessageTemplate,
        commitListMessageTemplate,
        githubToSlackMap
      )
    ).rejects.toThrow('Failed to send initial Slack message');
  });
});
