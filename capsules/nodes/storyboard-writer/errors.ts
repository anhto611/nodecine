/** Error codes the Storyboard Writer raises; the strings live in this capsule's locales. */
export const StoryboardWriterErrorCode = {
  STORYBOARD_UNWRITABLE: 'STORYBOARD_UNWRITABLE',
  NO_BLOCKS: 'NO_BLOCKS',
  NOTHING_TO_WRITE_ABOUT: 'NOTHING_TO_WRITE_ABOUT',
} as const;
export type StoryboardWriterErrorCode = (typeof StoryboardWriterErrorCode)[keyof typeof StoryboardWriterErrorCode];
