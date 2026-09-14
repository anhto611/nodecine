/** Error codes the Script node raises; the strings live in this capsule's locales. */
export const ScriptErrorCode = {
  SCRIPT_EMPTY: 'SCRIPT_EMPTY',
} as const;
export type ScriptErrorCode = (typeof ScriptErrorCode)[keyof typeof ScriptErrorCode];
