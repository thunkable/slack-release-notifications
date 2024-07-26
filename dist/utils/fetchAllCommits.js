"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetchAllCommits = void 0;
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
