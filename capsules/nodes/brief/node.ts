import { z } from 'zod';
import { NodeError } from '@/contracts/errors';
import { resolveOutputLanguage } from '@/contracts/text/languages';
import type { Brief } from '@/contracts/types/brief';
import type { NodeDefinition } from '@/core/nodes/definition';
import { BriefErrorCode } from './errors';

const Params = z.object({
  /** Links, a few sentences, or both. */
  about: z.string().max(3000).default(''),
  /** The describe box's placeholder by language, set by the workflow: what to write for its kind of film. */
  hint: z.record(z.string(), z.string().max(300)).default({}),
});

/**
 * What this video is about, the one box a person fills for each video. A workflow is a template: its
 * brief is what changes from one video to the next, and every node that needs to know reads it here, with
 * the language it is written in, so what is found out about it reads the way the person wrote.
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
    const language = resolveOutputLanguage('auto', about);
    log('info', `${about.length} characters · written in ${language}`);
    return { brief: { about, language } satisfies Brief };
  },
};
