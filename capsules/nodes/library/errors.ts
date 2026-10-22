/** Error codes the Library node raises; the strings live in this capsule's locales. */
export const LibraryErrorCode = {
  LIBRARY_SCOPE_INVALID: 'LIBRARY_SCOPE_INVALID',
} as const;
export type LibraryErrorCode = (typeof LibraryErrorCode)[keyof typeof LibraryErrorCode];
