/** Error codes the Storyboard node raises; the strings live in this capsule's locales. */
export const StoryboardErrorCode = {
  STORYBOARD_INVALID: 'STORYBOARD_INVALID',
} as const;
export type StoryboardErrorCode = (typeof StoryboardErrorCode)[keyof typeof StoryboardErrorCode];
