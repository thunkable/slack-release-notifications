export interface Commit {
  sha: string;
  commit: {
    message: string;
    author: {
      name: string;
    };
  };
  author: {
    login: string;
  } | null;
}

export async function fetchAllCommits(
  owner: string,
  repo: string,
  pullNumber: number,
  githubToken: string
): Promise<Commit[]> {
  const allCommits: Commit[] = [];
  let url:
    | string
    | null = `https://api.github.com/repos/${owner}/${repo}/pulls/${pullNumber}/commits?per_page=100`;
  let page = 1;

  while (url) {
    const response: Response = await fetch(url, {
      headers: {
        Authorization: `token ${githubToken}`,
      },
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(
        `GitHub API request failed: ${response.status} ${
          response.statusText
        } - ${JSON.stringify(errorData)}`
      );
    }

    const commitsData: Commit[] = await response.json();
    allCommits.push(...commitsData);

    const linkHeader: string | null = response.headers.get('link');
    if (linkHeader) {
      const nextLinkMatch = linkHeader.match(/<([^>]+)>;\s*rel="next"/);
      url = nextLinkMatch ? nextLinkMatch[1] : null;
    } else {
      url = null;
    }

    page++;
  }

  return allCommits;
}
