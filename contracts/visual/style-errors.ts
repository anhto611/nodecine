/** Raised while drawing a film's style. Extends the core table; the strings live with the node that raises it. */
export const StyleErrorCode = {
  /** The model could not produce a style sheet the contract accepts, after every attempt. */
  STYLE_DRAW_FAILED: 'STYLE_DRAW_FAILED',
} as const;
export type StyleErrorCode = (typeof StyleErrorCode)[keyof typeof StyleErrorCode];
