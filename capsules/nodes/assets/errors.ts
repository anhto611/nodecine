/** Error codes the Assets node raises; the strings live in this capsule's locales. */
export const AssetsErrorCode = {
  ASSETS_INVALID: 'ASSETS_INVALID',
} as const;
export type AssetsErrorCode = (typeof AssetsErrorCode)[keyof typeof AssetsErrorCode];
