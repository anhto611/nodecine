import { z } from 'zod';
import { buildIR, DEFAULT_ASSEMBLER_PARAMS } from '../assembler/build-ir';
import type { DirectorPlan, FactSheet, Voiceover } from '../types/payloads';
import type { NodeDefinition } from './definition';
import { ErrorCode } from '../errors';

const Params = z.object({
  fps: z.number().int().positive().default(30),
  width: z.number().int().positive().default(1080),
  height: z.number().int().positive().default(1920),
  minTotalFrames: z.number().int().nonnegative().default(270),
  title: z.string().default('Untitled'),
});

/** CORE_CONTRACTS §5.4 — pure function; facts are optional. */
export const timelineAssembler: NodeDefinition<typeof Params> = {
  type: 'core/timeline-assembler',
  version: 1,
  namespace: 'core',
  kind: 'process',
  inputs: [
    { name: 'plan', type: 'DirectorPlan' },
    { name: 'voiceover', type: 'Voiceover' },
    { name: 'facts', type: 'FactSheet', required: false },
  ],
  outputs: [{ name: 'ir', type: 'VideoIR' }],
  paramsSchema: Params,
  defaultParams: DEFAULT_ASSEMBLER_PARAMS,
  run: async ({ params, inputs, log }) => {
    const plan = inputs.plan!.payload as DirectorPlan;
    const voiceover = inputs.voiceover!.payload as Voiceover;
    const facts = inputs.facts?.payload as FactSheet | undefined;
    const ir = buildIR({ plan, voiceover, facts, params });
    const bound = plan.scenes.reduce((n, s) => n + Object.keys(s.factBindings ?? {}).length, 0);
    // The facts port is optional because a hand-written plan needs no facts. But a plan that *does*
    // bind facts with nothing wired in renders a video quietly missing those values, so say it out loud.
    if (bound > 0 && !facts) {
      log('warn', `${bound} fact bindings have no source; connect a Fact Sheet to the facts port`, ErrorCode.FACTS_NOT_CONNECTED);
    }
    log('info', `${ir.meta.totalDurationInFrames} frames · ${ir.timeline.map((s) => s.durationInFrames).join('/')} · padTail ${ir.audioTrack.padTailFrames}${facts ? ` · ${bound} facts bound` : ''}`);
    return { ir };
  },
};
