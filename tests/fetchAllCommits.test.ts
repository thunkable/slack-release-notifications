import { fetchAllCommits, Commit } from '../src/utils/fetchAllCommits';

global.fetch = jest.fn();

describe('fetchAllCommits', () => {
  const owner = 'owner';
  const repo = 'repo';
  const pullNumber = 1;
  const githubToken = 'githubToken';

  const mockCommitsData: Commit[] = [
    {
      sha: 'commit1',
      commit: {
        message: 'Initial commit',
        author: {
          name: 'author1',
        },
      },
      author: {
        login: 'githubUser1',
      },
    },
    {
      sha: 'commit2',
      commit: {
        message: 'Second commit',
        author: {
          name: 'author2',
        },
      },
      author: {
        login: 'githubUser2',
      },
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('fetches all commits successfully with pagination', async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockCommitsData,
        headers: {
          get: () => '<https://api.github.com/page2>; rel="next"',
        },
        status: 200,
        statusText: 'OK',
        redirected: false,
        type: 'basic',
        url: 'https://api.github.com/repos/owner/repo/pulls/1/commits?per_page=100',
        body: null,
        bodyUsed: false,
        clone: jest.fn(),
        text: jest.fn(),
        arrayBuffer: jest.fn(),
        blob: jest.fn(),
        formData: jest.fn(),
      } as unknown as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [],
        headers: {
          get: () => null,
        },
        status: 200,
        statusText: 'OK',
        redirected: false,
        type: 'basic',
        url: 'https://api.github.com/page2',
        body: null,
        bodyUsed: false,
        clone: jest.fn(),
        text: jest.fn(),
        arrayBuffer: jest.fn(),
        blob: jest.fn(),
        formData: jest.fn(),
      } as unknown as Response);

    const commits = await fetchAllCommits(owner, repo, pullNumber, githubToken);

    expect(commits).toEqual(mockCommitsData);
    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.github.com/repos/owner/repo/pulls/1/commits?per_page=100',
      {
        headers: {
          Authorization: `token ${githubToken}`,
        },
      }
    );
  });

  it('handles errors from the GitHub API', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 404,
      statusText: 'Not Found',
      json: async () => ({ message: 'Not Found' }),
      headers: {
        get: () => null,
      },
      redirected: false,
      type: 'basic',
      url: 'https://api.github.com/repos/owner/repo/pulls/1/commits?per_page=100',
      body: null,
      bodyUsed: false,
      clone: jest.fn(),
      text: jest.fn(),
      arrayBuffer: jest.fn(),
      blob: jest.fn(),
      formData: jest.fn(),
    } as unknown as Response);

    await expect(
      fetchAllCommits(owner, repo, pullNumber, githubToken)
    ).rejects.toThrow(
      'GitHub API request failed: 404 Not Found - {"message":"Not Found"}'
    );

    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('fetches all commits successfully without pagination', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockCommitsData,
      headers: {
        get: () => null,
      },
      status: 200,
      statusText: 'OK',
      redirected: false,
      type: 'basic',
      url: 'https://api.github.com/repos/owner/repo/pulls/1/commits?per_page=100',
      body: null,
      bodyUsed: false,
      clone: jest.fn(),
      text: jest.fn(),
      arrayBuffer: jest.fn(),
      blob: jest.fn(),
      formData: jest.fn(),
    } as unknown as Response);

    const commits = await fetchAllCommits(owner, repo, pullNumber, githubToken);

    expect(commits).toEqual(mockCommitsData);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });
});
