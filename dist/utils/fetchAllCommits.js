"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetchAllCommits = void 0;
/**
 * Fetches all commits for a given pull request, handling pagination if necessary.
 * @param owner - The owner of the repository.
 * @param repo - The name of the repository.
 * @param pullNumber - The pull request number.
 * @param githubToken - GitHub token for authentication.
 * @returns A promise that resolves to an array of commits.
 */
async function fetchAllCommits(owner, repo, pullNumber, githubToken) {
    const allCommits = [];
    let url = `https://api.github.com/repos/${owner}/${repo}/pulls/${pullNumber}/commits?per_page=100`;
    let page = 1;
    while (url) {
        const response = await fetch(url, {
            headers: {
                Authorization: `token ${githubToken}`,
            },
        });
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`GitHub API request failed: ${response.status} ${response.statusText} - ${JSON.stringify(errorData)}`);
        }
        const commitsData = await response.json();
        allCommits.push(...commitsData);
        // Check for pagination in the link header
        const linkHeader = response.headers.get('link');
        if (linkHeader) {
            const nextLinkMatch = linkHeader.match(/<([^>]+)>;\s*rel="next"/);
            url = nextLinkMatch ? nextLinkMatch[1] : null;
        }
        else {
            url = null;
        }
        page++;
    }
    return allCommits;
}
exports.fetchAllCommits = fetchAllCommits;
