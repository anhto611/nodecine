/** Error codes the Transcribe node raises. They extend the core table; the strings live in this capsule's locales. */
export const TranscribeErrorCode = {
  ALIGN_FAILED: 'ALIGN_FAILED',
  /** The model heard nothing in the recording, so there is nothing to time. */
  TRANSCRIBE_NO_WORDS: 'TRANSCRIBE_NO_WORDS',
} as const;
export type TranscribeErrorCode = (typeof TranscribeErrorCode)[keyof typeof TranscribeErrorCode];
