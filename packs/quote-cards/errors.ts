/** Pack-specific error codes. They extend the core table; UI labels live in locales. */
export const PackErrorCode = {
  QUOTE_LANGUAGE_MISMATCH: 'QUOTE_LANGUAGE_MISMATCH',
} as const;
export type PackErrorCode = (typeof PackErrorCode)[keyof typeof PackErrorCode];

/** Whether a failed run with this code is worth a retry without changing anything. */
export const RETRYABLE: Record<string, boolean> = {
  QUOTE_LANGUAGE_MISMATCH: true,
};
