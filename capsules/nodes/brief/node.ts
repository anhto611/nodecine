import { z } from 'zod';
import { NodeError } from '@/contracts/errors';
import { TONES, type Brief } from '@/contracts/types/brief';
import type { NodeDefinition } from '@/core/nodes/definition';
import { BriefErrorCode } from './errors';

const Params = z.object({
  /** Links, a few sentences, or both. */
  about: z.string().max(3000).default(''),
  durationSeconds: z.number().int().min(10).max(120).default(30),
  tone: z.enum(TONES).default('energetic'),
  language: z.string().min(2).max(35).default('vi'),
  /** What must be said or must not be. */
  notes: z.string().max(1000).default(''),
  /** The describe box's placeholder by language, set by the workflow: what to write for its kind of film. */
  hint: z.record(z.string(), z.string().max(300)).default({}),
});

/**
 * What this video is about, the one form a person fills for each video. A workflow is a template: its
 * brief is what changes from one video to the next, and every node that needs to know reads it here.
 */
export const brief: NodeDefinition<typeof Params> = {
  type: 'brief', version: 1, kind: 'source',
  inputs: [],
  outputs: [{ name: 'brief', type: 'Brief' }],
  paramsSchema: Params, defaultParams: Params.parse({}),
  validate: (params) => (params.about.trim() ? [] : [{ code: BriefErrorCode.BRIEF_EMPTY, message: 'say what the video is about: a link or a few sentences' }]),
  run: async ({ params, log }) => {
    const about = params.about.trim();
    if (!about) throw new NodeError(BriefErrorCode.BRIEF_EMPTY, 'the brief is empty').withFix('paste a link, or write a few sentences about what the video should say');
    log('info', `${about.length} characters · ${params.durationSeconds} s · ${params.language}`);
    return { brief: { about, durationSeconds: params.durationSeconds, tone: params.tone, language: params.language, notes: params.notes.trim() } satisfies Brief };
  },
};
