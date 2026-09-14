/** Error codes the MP4 Export node raises. They extend the core table; the strings live in this capsule's locales. */
export const Mp4ExportErrorCode = {
  EXPORT_FAILED: 'EXPORT_FAILED',
  EXPORT_CANCELLED: 'EXPORT_CANCELLED',
} as const;
export type Mp4ExportErrorCode = (typeof Mp4ExportErrorCode)[keyof typeof Mp4ExportErrorCode];

/** Whether a failed run with this code is worth a retry without changing anything. */
export const RETRYABLE: Record<string, boolean> = {
  EXPORT_FAILED: true,
  EXPORT_CANCELLED: false,
};
