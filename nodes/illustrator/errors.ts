/** Error codes the Illustrator raises. They extend the core table; the strings live in this capsule's locales. */
export const IllustratorErrorCode = {
  /** The model could not produce a style sheet the contract accepts, after every attempt. */
  STYLE_DRAW_FAILED: 'STYLE_DRAW_FAILED',
  /** The model could not produce a drawing for one scene, after every attempt. */
  SCENE_DRAW_FAILED: 'SCENE_DRAW_FAILED',
} as const;
export type IllustratorErrorCode = (typeof IllustratorErrorCode)[keyof typeof IllustratorErrorCode];
