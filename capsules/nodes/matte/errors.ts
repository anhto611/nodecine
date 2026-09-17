/** Error codes the Matte node raises; the strings live in this capsule's locales. */
export const MatteErrorCode = {
  MATTE_FAILED: 'MATTE_FAILED',
} as const;
export type MatteErrorCode = (typeof MatteErrorCode)[keyof typeof MatteErrorCode];
