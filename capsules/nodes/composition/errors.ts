/** Error codes the Composition node raises; the strings live in this capsule's locales. */
export const CompositionErrorCode = {
  COMPOSITION_INVALID: 'COMPOSITION_INVALID',
  /** A warning, not an error: the linter would write the project differently, and it still plays. */
  COMPOSITION_LINT_WARNINGS: 'COMPOSITION_LINT_WARNINGS',
} as const;
export type CompositionErrorCode = (typeof CompositionErrorCode)[keyof typeof CompositionErrorCode];
