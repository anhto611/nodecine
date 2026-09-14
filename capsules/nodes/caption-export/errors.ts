/** Error codes the Caption Export node raises. They extend the core table; the strings live in this capsule's locales. */
export const CaptionExportErrorCode = {
  CAPTIONS_EMPTY: 'CAPTIONS_EMPTY',
} as const;
export type CaptionExportErrorCode = (typeof CaptionExportErrorCode)[keyof typeof CaptionExportErrorCode];
