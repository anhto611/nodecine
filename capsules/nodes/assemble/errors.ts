/** Error codes the Assemble node raises; the strings live in this capsule's locales. */
export const AssembleErrorCode = {
  ASSEMBLY_INVALID: 'ASSEMBLY_INVALID',
} as const;
export type AssembleErrorCode = (typeof AssembleErrorCode)[keyof typeof AssembleErrorCode];
