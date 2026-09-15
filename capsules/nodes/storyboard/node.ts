import { z } from 'zod';
import { NodeError } from '@/contracts/errors';
import type { AudioScript } from '@/contracts/types/payloads';
import type { NodeDefinition } from '@/core/nodes/definition';
import { StoryboardErrorCode } from './errors';
import { readStoryboard, spokenLines } from '@/contracts/storyboard/read';

const Params = z.object({
  /** HyperFrames' STORYBOARD.md; under each frame, the block it plays and a ```json block of its values, or its mounts. */
  markdown: z.string().max(200_000).default(''),
  language: z.string().min(2).max(35).default('vi'),
});

/**
 * The plan of a video, one frame per scene, in HyperFrames' own STORYBOARD.md format. Its frames'
 * voiceovers are the narration, one segment per spoken frame, so the voice and the scenes line up
 * by construction; each frame's block and values, or its mounts, say what it shows and on which word.
 */
export const storyboard: NodeDefinition<typeof Params> = {
  type: 'storyboard', version: 1, kind: 'source',
  inputs: [],
  outputs: [
    { name: 'storyboard', type: 'Storyboard' },
    { name: 'script', type: 'AudioScript' },
  ],
  paramsSchema: Params, defaultParams: { markdown: '', language: 'vi' },
  validate: (params) => {
    if (!params.markdown.trim()) return [{ code: StoryboardErrorCode.STORYBOARD_INVALID, message: 'the storyboard is empty' }];
    return readStoryboard(params.markdown).problems.slice(0, 3).map((message) => ({ code: StoryboardErrorCode.STORYBOARD_INVALID, message }));
  },
  run: async ({ params, log }) => {
    const reading = readStoryboard(params.markdown);
    for (const w of reading.warnings) log('warn', w);
    if (!reading.storyboard) {
      throw new NodeError(StoryboardErrorCode.STORYBOARD_INVALID, reading.problems[0] ?? 'the storyboard does not read', false, reading.problems)
        .withFix(reading.problems.length > 1 ? `and ${reading.problems.length - 1} more; fix the storyboard and run again` : 'fix the storyboard and run again');
    }
    const lines = spokenLines(reading.storyboard);
    const frames = reading.storyboard.frames;
    log('info', `${frames.length} frames · ${lines.length} spoken · ${frames.filter((f) => f.block).length} blocks · ${frames.reduce((n, f) => n + f.mounts.length, 0)} mounts`);
    const script: AudioScript | undefined = lines.length ? { text: lines.join(' '), language: params.language, segments: lines } : undefined;
    return { storyboard: reading.storyboard, ...(script ? { script } : {}) };
  },
};
