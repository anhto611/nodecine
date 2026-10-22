/** Error codes the Component forge raises; the strings live in this capsule's locales. */
export const ForgeErrorCode = {
  FORGE_SCOPE_INVALID: 'FORGE_SCOPE_INVALID',
  /** A component that still failed its checks after the rounds of fixing: left out, said as a warning. */
  FORGE_DROPPED: 'FORGE_DROPPED',
} as const;
export type ForgeErrorCode = (typeof ForgeErrorCode)[keyof typeof ForgeErrorCode];
