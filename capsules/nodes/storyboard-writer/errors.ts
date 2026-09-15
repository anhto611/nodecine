/** Error codes the Storyboard Writer raises; the strings live in this capsule's locales. */
export const StoryboardWriterErrorCode = {
  STORYBOARD_UNWRITABLE: 'STORYBOARD_UNWRITABLE',
  NO_BLOCKS: 'NO_BLOCKS',
} as const;
export type StoryboardWriterErrorCode = (typeof StoryboardWriterErrorCode)[keyof typeof StoryboardWriterErrorCode];
