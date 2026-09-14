/** Error codes the Composition node raises; the strings live in this capsule's locales. */
export const CompositionErrorCode = {
  COMPOSITION_INVALID: 'COMPOSITION_INVALID',
} as const;
export type CompositionErrorCode = (typeof CompositionErrorCode)[keyof typeof CompositionErrorCode];
