import * as github from '@actions/github';
import { handlePROpened } from '../src/handlePROpened';

jest.mock('@actions/github');

describe('handlePROpened', () => {
  const slackToken = 'slack-token';
  const slackChannel = 'slack-channel';
  const githubToken = 'github-token';
  const initialMessageTemplate = 'PR opened: ${prUrl} - ${prTitle}';
  const commitListMessageTemplate =
    'Commits:\n${commitListMessage}\n\n<${changelogUrl}|Full Changelog: ${branchName} to ${targetBranch}>';
  const githubToSlackMap = { duckdum: 'slackUser' };

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

  it('handles complex commit messages with newlines and metadata correctly', async () => {
    const initialSlackResponse = { ok: true, ts: '12345' };
    const commitsData = [
      {
        sha: '8bc9b80433fc1261d67130e35f288a5c553b5f2a',
        commit: {
          message:
            'Test merge commit msg (#59)\nCo-authored-by: Eduardo de Paula <eduardo@thunkable.com>',
          author: {
            name: 'duckdum',
          },
        },
        author: {
          login: 'duckdum',
        },
      },
    ];

    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(initialSlackResponse))) // Mock Slack initial message
      .mockResolvedValueOnce(new Response(JSON.stringify(commitsData))) // Mock GitHub commits
      .mockResolvedValueOnce(
        new Response(JSON.stringify(initialSlackResponse))
      ); // Mock Slack commit list message

    const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

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
      JSON.stringify(githubToSlackMap)
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
          text: 'Commits:\n- <https://github.com/owner/repo/commit/8bc9b80433fc1261d67130e35f288a5c553b5f2a|Test merge commit msg (#59)> by <@slackUser>\n\n<https://github.com/owner/repo/compare/main...feature-branch|Full Changelog: feature-branch to main>',
          thread_ts: '12345',
        }),
        headers: {
          Authorization: `Bearer ${slackToken}`,
          'Content-Type': 'application/json',
        },
        method: 'POST',
      })
    );

    consoleSpy.mockRestore();
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
        JSON.stringify(githubToSlackMap)
      )
    ).rejects.toThrow('No pull request found');
  });

  it('throws an error if initial Slack message fails', async () => {
    const initialSlackResponse = { ok: false };
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
        JSON.stringify(githubToSlackMap)
      )
    ).rejects.toThrow('Failed to send initial Slack message');
  });
});
