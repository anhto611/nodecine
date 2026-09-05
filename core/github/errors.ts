/** Error codes the GitHub fetcher raises (github-showcase spec §6). They extend the core table; UI labels live in locales. */
export const GithubErrorCode = {
  REPO_NOT_FOUND: 'REPO_NOT_FOUND',
  REPO_RATE_LIMITED: 'REPO_RATE_LIMITED',
  REPO_NETWORK: 'REPO_NETWORK',
} as const;
export type GithubErrorCode = (typeof GithubErrorCode)[keyof typeof GithubErrorCode];

/** Whether a failed run with this code is worth a retry without changing anything. */
export const RETRYABLE: Record<string, boolean> = {
  REPO_NOT_FOUND: false,
  REPO_RATE_LIMITED: true,
  REPO_NETWORK: true,
};
