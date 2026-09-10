/** Error codes the Captions node raises. They extend the core table; the strings live in this capsule's locales. */
export const CaptionsErrorCode = {
  CAPTIONS_NO_WORDS: 'CAPTIONS_NO_WORDS',
} as const;
export type CaptionsErrorCode = (typeof CaptionsErrorCode)[keyof typeof CaptionsErrorCode];
