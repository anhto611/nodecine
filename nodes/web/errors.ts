/**
 * Error codes the fetcher raises (CORE_CONTRACTS §5.14). They extend the core table; UI labels live
 * in locales. The REPO_ ones came from the GitHub fetcher when the two nodes became one on
 * 2026-09-13: a repository is one kind of link, not one kind of node.
 */
export const WebErrorCode = {
  PAGE_URL_INVALID: 'PAGE_URL_INVALID',
  PAGE_NOT_FOUND: 'PAGE_NOT_FOUND',
  PAGE_NETWORK: 'PAGE_NETWORK',
  PAGE_TOO_BIG: 'PAGE_TOO_BIG',
  SHOT_FAILED: 'SHOT_FAILED',
  REPO_NOT_FOUND: 'REPO_NOT_FOUND',
  REPO_RATE_LIMITED: 'REPO_RATE_LIMITED',
  REPO_NETWORK: 'REPO_NETWORK',
} as const;
export type WebErrorCode = (typeof WebErrorCode)[keyof typeof WebErrorCode];

/** Whether a failed run with this code is worth a retry without changing anything. */
export const RETRYABLE: Record<string, boolean> = {
  PAGE_URL_INVALID: false,
  PAGE_NOT_FOUND: false,
  PAGE_NETWORK: true,
  PAGE_TOO_BIG: false,
  SHOT_FAILED: true,
  REPO_NOT_FOUND: false,
  REPO_RATE_LIMITED: true,
  REPO_NETWORK: true,
};
