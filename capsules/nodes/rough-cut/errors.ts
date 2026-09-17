/** Error codes the Rough Cut node raises; the strings live in this capsule's locales. */
export const RoughCutErrorCode = {
  ROUGH_CUT_NO_WORDS: 'ROUGH_CUT_NO_WORDS',
} as const;
export type RoughCutErrorCode = (typeof RoughCutErrorCode)[keyof typeof RoughCutErrorCode];
