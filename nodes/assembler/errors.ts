/** Error codes the Timeline Assembler raises. They extend the core table; the strings live in this capsule's locales. */
export const AssemblerErrorCode = {
  FACTS_NOT_CONNECTED: 'FACTS_NOT_CONNECTED',
  /** No voice-over and no `durationSeconds`: nothing says how long the film is. */
  NO_CLOCK: 'NO_CLOCK',
  /** A caption track wired in with no voice for the lines to belong to; the film goes out without them. */
  CAPTIONS_WITHOUT_VOICE: 'CAPTIONS_WITHOUT_VOICE',
  /** A layer that starts after the film has ended has nothing to be on. */
  LAYER_OUTSIDE_FILM: 'LAYER_OUTSIDE_FILM',
  /** An audio track that starts after the film has ended has nothing to play under. */
  AUDIO_OUTSIDE_FILM: 'AUDIO_OUTSIDE_FILM',
} as const;
export type AssemblerErrorCode = (typeof AssemblerErrorCode)[keyof typeof AssemblerErrorCode];
