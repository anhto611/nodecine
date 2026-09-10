/** Error codes the Timeline Assembler raises. They extend the core table; the strings live in this capsule's locales. */
export const AssemblerErrorCode = {
  FACTS_NOT_CONNECTED: 'FACTS_NOT_CONNECTED',
} as const;
export type AssemblerErrorCode = (typeof AssemblerErrorCode)[keyof typeof AssemblerErrorCode];
