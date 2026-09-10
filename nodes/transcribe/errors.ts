/** Error codes the Transcribe node raises. They extend the core table; the strings live in this capsule's locales. */
export const TranscribeErrorCode = {
  ALIGN_FAILED: 'ALIGN_FAILED',
} as const;
export type TranscribeErrorCode = (typeof TranscribeErrorCode)[keyof typeof TranscribeErrorCode];
