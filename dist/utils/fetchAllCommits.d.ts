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
export declare function fetchAllCommits(owner: string, repo: string, pullNumber: number, githubToken: string): Promise<Commit[]>;
