import * as github from "@actions/github";
import {
  handlePROpened,
  filterMergeCommits,
  categorizeCommits,
} from "../src/handlePROpened";
import { fetchAllCommits, Commit } from "../src/utils/fetchAllCommits";

jest.mock("@actions/github");
jest.mock("../src/utils/fetchAllCommits");

// Mock fetch globally
global.fetch = jest.fn(async (url) => {
  if (url === "https://slack.com/api/chat.postMessage") {
    return new Response(JSON.stringify({ ok: true, ts: "12345" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }
  throw new Error("Unexpected URL");
}) as jest.Mock;

describe("filterMergeCommits", () => {
  it('filters out "Merge branch" commits', () => {
    const commits: Commit[] = [
      {
        sha: "1",
        commit: {
          message: "Merge branch 'main' into develop",
          author: { name: "bot" },
        },
        author: null,
      },
      {
        sha: "2",
        commit: {
          message: "fix(backend): Fix auth",
          author: { name: "dev" },
        },
        author: { login: "dev" },
      },
    ];

    const filtered = filterMergeCommits(commits);
    expect(filtered).toHaveLength(1);
    expect(filtered[0].sha).toBe("2");
  });

  it('filters out "Merge remote-tracking branch" commits', () => {
    const commits: Commit[] = [
      {
        sha: "1",
        commit: {
          message: "Merge remote-tracking branch 'origin/main' into develop",
          author: { name: "bot" },
        },
        author: null,
      },
    ];

    const filtered = filterMergeCommits(commits);
    expect(filtered).toHaveLength(0);
  });

  it('filters out "Merge pull request" commits', () => {
    const commits: Commit[] = [
      {
        sha: "1",
        commit: {
          message: "Merge pull request #123 from user/branch",
          author: { name: "bot" },
        },
        author: null,
      },
    ];

    const filtered = filterMergeCommits(commits);
    expect(filtered).toHaveLength(0);
  });

  it("keeps non-merge commits intact", () => {
    const commits: Commit[] = [
      {
        sha: "1",
        commit: {
          message: "feat(frontend): Add button",
          author: { name: "dev" },
        },
        author: { login: "dev" },
      },
      {
        sha: "2",
        commit: {
          message: "chore(backend): Update deps",
          author: { name: "dev2" },
        },
        author: { login: "dev2" },
      },
    ];

    const filtered = filterMergeCommits(commits);
    expect(filtered).toHaveLength(2);
  });
});

describe("categorizeCommits", () => {
  it("places multi-scope commit under first scope only", () => {
    const commits: Commit[] = [
      {
        sha: "abc123",
        commit: {
          message: "chore(companion, bs, frontend): Update shared config",
          author: { name: "dev" },
        },
        author: { login: "dev" },
      },
    ];

    const result = categorizeCommits(commits, "owner", "repo");
    // Only first scope gets the commit
    expect(Object.keys(result)).toEqual(["companion"]);
    expect(result["companion"]["chore"]).toHaveLength(1);
    expect(result["companion"]["chore"][0].author).toBe("dev");
  });

  it("places multi-scope commit (no spaces) under first scope only", () => {
    const commits: Commit[] = [
      {
        sha: "abc123",
        commit: {
          message: "fix(backend,frontend): Fix shared util",
          author: { name: "dev" },
        },
        author: { login: "dev" },
      },
    ];

    const result = categorizeCommits(commits, "owner", "repo");
    expect(Object.keys(result)).toEqual(["backend"]);
    expect(result["backend"]["fix"]).toHaveLength(1);
  });

  it('puts scopeless commits under "other"', () => {
    const commits: Commit[] = [
      {
        sha: "abc123",
        commit: {
          message: "Update README",
          author: { name: "dev" },
        },
        author: { login: "dev" },
      },
    ];

    const result = categorizeCommits(commits, "owner", "repo");
    expect(Object.keys(result)).toEqual(["other"]);
  });

  it("uses Slack user display when map is provided", () => {
    const commits: Commit[] = [
      {
        sha: "abc123",
        commit: {
          message: "fix(backend): Fix auth",
          author: { name: "dev" },
        },
        author: { login: "githubUser" },
      },
    ];

    const result = categorizeCommits(commits, "owner", "repo", {
      githubUser: "U12345",
    });
    expect(result["backend"]["fix"][0].text).toContain("<@U12345>");
  });

  it("places single-scope commit under its scope", () => {
    const commits: Commit[] = [
      {
        sha: "abc123",
        commit: {
          message: "fix(backend): Fix auth",
          author: { name: "dev" },
        },
        author: { login: "dev" },
      },
    ];

    const result = categorizeCommits(commits, "owner", "repo");
    expect(Object.keys(result)).toEqual(["backend"]);
    expect(result["backend"]["fix"]).toHaveLength(1);
  });

  it("stores author for sorting", () => {
    const commits: Commit[] = [
      {
        sha: "abc1",
        commit: {
          message: "fix(backend): Fix A",
          author: { name: "zara" },
        },
        author: { login: "zara" },
      },
      {
        sha: "abc2",
        commit: {
          message: "fix(backend): Fix B",
          author: { name: "alice" },
        },
        author: { login: "alice" },
      },
    ];

    const result = categorizeCommits(commits, "owner", "repo");
    expect(result["backend"]["fix"][0].author).toBe("zara");
    expect(result["backend"]["fix"][1].author).toBe("alice");
  });
});

describe("handlePROpened", () => {
  const slackToken = "slack-token";
  const slackChannelId = "slack-channel-id";
  const githubToken = "github-token";
  const initialMessageTemplate = "PR opened: ${prUrl} - ${prTitle}";
  const commitListMessageTemplate =
    "Commits:\n${commitListMessage}\nCompare changes: ${changelogUrl}";
  const githubToSlackMap = { githubUser: "slackUser" };

  const contextPayload = {
    payload: {
      pull_request: {
        title: "Test PR",
        html_url: "http://example.com",
        head: { ref: "feature-branch" },
        base: { ref: "main" },
        number: 1,
        body: "PR body",
        commits_url: "http://api.github.com/commits",
      },
    },
    repo: {
      owner: "owner",
      repo: "repo",
    },
  };

  const mockCommitsData: Commit[] = [
    {
      sha: "commit1",
      commit: {
        message: "Initial commit\nwith newline",
        author: { name: "author1" },
      },
      author: { login: "githubUser" },
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();

    Object.defineProperty(github.context, "payload", {
      value: contextPayload.payload,
    });

    Object.defineProperty(github.context, "repo", {
      value: contextPayload.repo,
    });

    (fetchAllCommits as jest.Mock).mockResolvedValue(mockCommitsData);
  });

  it("sends initial Slack message and updates PR body", async () => {
    const initialSlackResponse = {
      ok: true,
      ts: "12345",
    };

    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(initialSlackResponse)))
      .mockResolvedValueOnce(new Response(JSON.stringify(mockCommitsData)))
      .mockResolvedValueOnce(
        new Response(JSON.stringify(initialSlackResponse)),
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
      githubToSlackMap,
    );

    expect(global.fetch).toHaveBeenCalledWith(
      "https://slack.com/api/chat.postMessage",
      expect.objectContaining({
        body: JSON.stringify({
          channel: slackChannelId,
          text: "PR opened: http://example.com - Test PR",
        }),
        headers: {
          Authorization: `Bearer ${slackToken}`,
          "Content-Type": "application/json",
        },
        method: "POST",
      }),
    );

    expect(octokitMock.rest.pulls.update).toHaveBeenCalledWith(
      expect.objectContaining({
        pull_number: 1,
        body: "Slack message_ts: 12345\n\nPR body",
      }),
    );

    expect(global.fetch).toHaveBeenCalledWith(
      "https://slack.com/api/chat.postMessage",
      expect.objectContaining({
        body: JSON.stringify({
          channel: slackChannelId,
          text: "Commits:\n• <https://github.com/owner/repo/commit/commit1|Initial commit> by <@slackUser>\nCompare changes: https://github.com/owner/repo/compare/main...feature-branch",
          thread_ts: "12345",
        }),
        headers: {
          Authorization: `Bearer ${slackToken}`,
          "Content-Type": "application/json",
        },
        method: "POST",
      }),
    );
  });

  it("handles commit messages with newlines", async () => {
    const initialSlackResponse = {
      ok: true,
      ts: "12345",
    };

    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(initialSlackResponse)))
      .mockResolvedValueOnce(new Response(JSON.stringify(mockCommitsData)))
      .mockResolvedValueOnce(
        new Response(JSON.stringify(initialSlackResponse)),
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
      githubToSlackMap,
    );

    expect(global.fetch).toHaveBeenCalledWith(
      "https://slack.com/api/chat.postMessage",
      expect.objectContaining({
        body: JSON.stringify({
          channel: slackChannelId,
          text: "Commits:\n• <https://github.com/owner/repo/commit/commit1|Initial commit> by <@slackUser>\nCompare changes: https://github.com/owner/repo/compare/main...feature-branch",
          thread_ts: "12345",
        }),
        headers: {
          Authorization: `Bearer ${slackToken}`,
          "Content-Type": "application/json",
        },
        method: "POST",
      }),
    );
  });

  it("throws an error if no pull request is found", async () => {
    Object.defineProperty(github.context, "payload", {
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
        githubToSlackMap,
      ),
    ).rejects.toThrow("No pull request found");
  });

  it("throws an error if initial Slack message fails", async () => {
    const initialSlackResponse = {
      ok: false,
    };
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify(initialSlackResponse)),
      );

    await expect(
      handlePROpened(
        slackToken,
        slackChannelId,
        githubToken,
        initialMessageTemplate,
        commitListMessageTemplate,
        githubToSlackMap,
      ),
    ).rejects.toThrow("Failed to send initial Slack message");
  });

  it("filters merge commits and posts remaining", async () => {
    const commitsWithMerge: Commit[] = [
      {
        sha: "merge1",
        commit: {
          message: "Merge branch 'main' into develop",
          author: { name: "bot" },
        },
        author: null,
      },
      {
        sha: "real1",
        commit: {
          message: "fix(backend): Fix auth",
          author: { name: "dev" },
        },
        author: { login: "githubUser" },
      },
    ];
    (fetchAllCommits as jest.Mock).mockResolvedValue(commitsWithMerge);

    global.fetch = jest.fn().mockImplementation(
      async () =>
        new Response(JSON.stringify({ ok: true, ts: "12345" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
    );

    const octokitMock = {
      rest: { pulls: { update: jest.fn() } },
    };
    (github.getOctokit as jest.Mock).mockReturnValue(octokitMock);

    await handlePROpened(
      slackToken,
      slackChannelId,
      githubToken,
      initialMessageTemplate,
      commitListMessageTemplate,
      githubToSlackMap,
    );

    // The commit list message should only contain the fix commit, not the merge
    const fetchCalls = (global.fetch as jest.Mock).mock.calls;
    const commitListCall = fetchCalls.find((call: [string, RequestInit]) => {
      const body = JSON.parse(call[1].body as string);
      return body.thread_ts === "12345" && body.text;
    });
    expect(commitListCall).toBeDefined();
    const body = JSON.parse(commitListCall![1].body as string);
    expect(body.text).toContain("fix(backend): Fix auth");
    expect(body.text).not.toContain("Merge branch");
  });

  it('posts "No conventional commits" when all commits are merge commits', async () => {
    const onlyMergeCommits: Commit[] = [
      {
        sha: "merge1",
        commit: {
          message: "Merge branch 'main' into develop",
          author: { name: "bot" },
        },
        author: null,
      },
    ];
    (fetchAllCommits as jest.Mock).mockResolvedValue(onlyMergeCommits);

    global.fetch = jest.fn().mockImplementation(
      async () =>
        new Response(JSON.stringify({ ok: true, ts: "12345" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
    );

    const octokitMock = {
      rest: { pulls: { update: jest.fn() } },
    };
    (github.getOctokit as jest.Mock).mockReturnValue(octokitMock);

    await handlePROpened(
      slackToken,
      slackChannelId,
      githubToken,
      initialMessageTemplate,
      commitListMessageTemplate,
      githubToSlackMap,
    );

    expect(global.fetch).toHaveBeenCalledWith(
      "https://slack.com/api/chat.postMessage",
      expect.objectContaining({
        body: JSON.stringify({
          channel: slackChannelId,
          text: "No conventional commits to display.",
          thread_ts: "12345",
        }),
      }),
    );
  });

  it("sends Block Kit blocks when sortCommits is true", async () => {
    const sortedCommits: Commit[] = [
      {
        sha: "abc1",
        commit: {
          message: "fix(backend): Fix auth",
          author: { name: "dev" },
        },
        author: { login: "githubUser" },
      },
      {
        sha: "abc2",
        commit: {
          message: "chore(frontend): Update deps",
          author: { name: "dev2" },
        },
        author: { login: "dev2" },
      },
    ];
    (fetchAllCommits as jest.Mock).mockResolvedValue(sortedCommits);

    global.fetch = jest.fn().mockImplementation(
      async () =>
        new Response(JSON.stringify({ ok: true, ts: "12345" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
    );

    const octokitMock = {
      rest: { pulls: { update: jest.fn() } },
    };
    (github.getOctokit as jest.Mock).mockReturnValue(octokitMock);

    await handlePROpened(
      slackToken,
      slackChannelId,
      githubToken,
      initialMessageTemplate,
      commitListMessageTemplate,
      githubToSlackMap,
      true, // sortCommits
    );

    // Find the Block Kit message call (has `blocks` property)
    const fetchCalls = (global.fetch as jest.Mock).mock.calls;
    const blockKitCall = fetchCalls.find((call: [string, RequestInit]) => {
      const body = JSON.parse(call[1].body as string);
      return body.blocks !== undefined;
    });
    expect(blockKitCall).toBeDefined();
    const body = JSON.parse(blockKitCall![1].body as string);
    expect(body.blocks).toBeDefined();
    expect(body.thread_ts).toBe("12345");

    // Verify block structure: backend header comes first (alphabetical)
    const headerBlocks = body.blocks.filter(
      (b: { type: string }) => b.type === "header",
    );
    expect(headerBlocks[0].text.text).toBe("Backend");
    expect(headerBlocks[1].text.text).toBe("Frontend");

    // Verify fallback text exists
    expect(body.text).toBeDefined();
    expect(body.text).toContain("Backend");
    expect(body.text).toContain("Frontend");
  });

  it("handles multi-scope commits with spaces in sortCommits mode", async () => {
    const multiScopeCommits: Commit[] = [
      {
        sha: "abc1",
        commit: {
          message: "chore(companion, bs, frontend): Update shared config",
          author: { name: "dev" },
        },
        author: { login: "dev" },
      },
    ];
    (fetchAllCommits as jest.Mock).mockResolvedValue(multiScopeCommits);

    global.fetch = jest.fn().mockImplementation(
      async () =>
        new Response(JSON.stringify({ ok: true, ts: "12345" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
    );

    const octokitMock = {
      rest: { pulls: { update: jest.fn() } },
    };
    (github.getOctokit as jest.Mock).mockReturnValue(octokitMock);

    await handlePROpened(
      slackToken,
      slackChannelId,
      githubToken,
      initialMessageTemplate,
      commitListMessageTemplate,
      undefined,
      true, // sortCommits
    );

    // Find the Block Kit message call
    const fetchCalls = (global.fetch as jest.Mock).mock.calls;
    const blockKitCall = fetchCalls.find((call: [string, RequestInit]) => {
      const body = JSON.parse(call[1].body as string);
      return body.blocks !== undefined;
    });
    expect(blockKitCall).toBeDefined();
    const body = JSON.parse(blockKitCall![1].body as string);

    // Should have header only for primary scope: companion (first listed)
    const headerBlocks = body.blocks.filter(
      (b: { type: string }) => b.type === "header",
    );
    expect(headerBlocks).toHaveLength(1);
    expect(headerBlocks[0].text.text).toBe("Companion");
  });
});
