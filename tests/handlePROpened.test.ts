import * as github from '@actions/github';
import { handlePROpened } from '../src/handlePROpened';

jest.mock('@actions/github');

describe('handlePROpened', () => {
  const slackToken = 'slack-token';
  const slackChannel = 'slack-channel';
  const githubToken = 'github-token';
  const initialMessageTemplate = 'PR opened: ${prUrl} - ${prTitle}';
  const commitListMessageTemplate =
    'Commits:\n${commitListMessage}\nCompare changes: ${changelogUrl}';
  const githubToSlackMap = { githubUser: 'slackUser' };

  beforeEach(() => {
    jest.clearAllMocks();

    Object.defineProperty(github.context, 'payload', {
      value: {
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
      writable: true,
    });

    Object.defineProperty(github.context, 'repo', {
      value: {
        owner: 'owner',
        repo: 'repo',
      },
      writable: true,
    });
  });

  it('sends initial Slack message and updates PR body', async () => {
    const initialSlackResponse = {
      ok: true,
      ts: '12345',
    };

    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(initialSlackResponse)))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify([
            {
              sha: 'commit1',
              commit: {
                message: 'Initial commit',
                author: {
                  name: 'author1',
                },
              },
              author: {
                login: 'githubUser',
              },
            },
          ])
        )
      )
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
      slackChannel,
      githubToken,
      initialMessageTemplate,
      commitListMessageTemplate,
      githubToSlackMap
    );

    expect(global.fetch).toHaveBeenCalledWith(
      'https://slack.com/api/chat.postMessage',
      expect.objectContaining({
        body: JSON.stringify({
          channel: slackChannel,
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
          channel: slackChannel,
          text: 'Commits:\n- <https://github.com/owner/repo/commit/commit1|Initial commit> by <@slackUser>\nCompare changes: https://github.com/owner/repo/compare/main...feature-branch',
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
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify([
            {
              sha: 'commit1',
              commit: {
                message: 'Initial commit\nwith newline',
                author: {
                  name: 'author1',
                },
              },
              author: {
                login: 'githubUser',
              },
            },
          ])
        )
      )
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
      slackChannel,
      githubToken,
      initialMessageTemplate,
      commitListMessageTemplate,
      githubToSlackMap
    );

    expect(global.fetch).toHaveBeenCalledWith(
      'https://slack.com/api/chat.postMessage',
      expect.objectContaining({
        body: JSON.stringify({
          channel: slackChannel,
          text: 'Commits:\n- <https://github.com/owner/repo/commit/commit1|Initial commit> by <@slackUser>\nCompare changes: https://github.com/owner/repo/compare/main...feature-branch',
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
        slackChannel,
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
        slackChannel,
        githubToken,
        initialMessageTemplate,
        commitListMessageTemplate,
        githubToSlackMap
      )
    ).rejects.toThrow('Failed to send initial Slack message');
  });
});