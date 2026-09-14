/** Error codes the Fill node raises; the strings live in this capsule's locales. */
export const FillErrorCode = {
  VARIABLE_UNDECLARED: 'VARIABLE_UNDECLARED',
  VARIABLE_WRONG_TYPE: 'VARIABLE_WRONG_TYPE',
} as const;
export type FillErrorCode = (typeof FillErrorCode)[keyof typeof FillErrorCode];
