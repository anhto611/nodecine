/** Error codes the Footage node raises; the strings live in this capsule's locales. */
export const FootageErrorCode = {
  FOOTAGE_EMPTY: 'FOOTAGE_EMPTY',
} as const;
export type FootageErrorCode = (typeof FootageErrorCode)[keyof typeof FootageErrorCode];
