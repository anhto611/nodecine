/** Error codes the TTS Engine raises. They extend the core table; the strings live in this capsule's locales. */
export const TtsErrorCode = {
  TTS_VOICE_LANGUAGE_MISMATCH: 'TTS_VOICE_LANGUAGE_MISMATCH',
} as const;
export type TtsErrorCode = (typeof TtsErrorCode)[keyof typeof TtsErrorCode];
