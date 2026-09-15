/** Error codes the Brief node raises; the strings live in this capsule's locales. */
export const BriefErrorCode = {
  BRIEF_EMPTY: 'BRIEF_EMPTY',
} as const;
export type BriefErrorCode = (typeof BriefErrorCode)[keyof typeof BriefErrorCode];
