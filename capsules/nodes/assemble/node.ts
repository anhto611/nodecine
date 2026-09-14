import { z } from 'zod';
import { NodeError } from '@/contracts/errors';
import type { Composition } from '@/contracts/types/composition';
import type { Voiceover } from '@/contracts/types/payloads';
import type { Storyboard } from '@/contracts/types/storyboard';
import type { NodeDefinition } from '@/core/nodes/definition';
import { assemble as build } from './assemble';
import { AssembleErrorCode } from './errors';

const Params = z.object({});

/**
 * The storyboard put on the clock and turned into the project: a sub-composition per frame under
 * `compositions/frames/`, each as long as its own narration, played in order by `index.html` over the
 * composition's shell. Without a voice, spoken frames get an estimate from their word count.
 */
export const assemble: NodeDefinition<typeof Params> = {
  type: 'assemble', version: 1, kind: 'process',
  inputs: [
    { name: 'composition', type: 'Composition' },
    { name: 'storyboard', type: 'Storyboard' },
    { name: 'voiceover', type: 'Voiceover', required: false },
  ],
  outputs: [{ name: 'composition', type: 'Composition' }],
  paramsSchema: Params, defaultParams: {},
  run: async ({ inputs, log }) => {
    const kit = inputs.composition!.payload as Composition;
    const storyboard = inputs.storyboard!.payload as Storyboard;
    const voice = inputs.voiceover?.payload as Voiceover | undefined;
    const result = build(kit, storyboard, voice);
    if (result.problems.length) {
      throw new NodeError(AssembleErrorCode.ASSEMBLY_INVALID, result.problems[0]!, false, result.problems)
        .withFix(result.problems.length > 1 ? `and ${result.problems.length - 1} more; fix the storyboard or the composition` : 'fix the storyboard or the composition');
    }
    const last = result.frames.at(-1)!;
    log('info', `${result.frames.length} frames · ${(last.start + last.duration).toFixed(1)}s${voice ? '' : ' · no voice: spoken frames are estimated'}`);
    return { composition: result.composition };
  },
};
