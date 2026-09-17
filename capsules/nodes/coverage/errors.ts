/** Error codes the Coverage node raises; the strings live in this capsule's locales. */
export const CoverageErrorCode = {
  COVERAGE_NO_BLOCKS: 'COVERAGE_NO_BLOCKS',
} as const;
export type CoverageErrorCode = (typeof CoverageErrorCode)[keyof typeof CoverageErrorCode];
