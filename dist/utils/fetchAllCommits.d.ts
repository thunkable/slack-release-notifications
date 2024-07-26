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
/**
 * Fetches all commits for a given pull request, handling pagination if necessary.
 * @param owner - The owner of the repository.
 * @param repo - The name of the repository.
 * @param pullNumber - The pull request number.
 * @param githubToken - GitHub token for authentication.
 * @returns A promise that resolves to an array of commits.
 */
export declare function fetchAllCommits(owner: string, repo: string, pullNumber: number, githubToken: string): Promise<Commit[]>;
