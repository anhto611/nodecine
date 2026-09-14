/** Raised while drawing a thing that spans the film. The strings live with the node that raises it. */
export const SpanningErrorCode = {
  /** The model could not draw it in a way the contract accepts, after every attempt. */
  SPANNING_DRAW_FAILED: 'SCENE_DRAW_FAILED',
} as const;
export type SpanningErrorCode = (typeof SpanningErrorCode)[keyof typeof SpanningErrorCode];
