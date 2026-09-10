import { z } from 'zod';
import { buildIR, DEFAULT_ASSEMBLER_PARAMS } from '@/nodes/assembler/build-ir';
import type { CaptionTrack, ScenePlan, FactSheet, Voiceover } from '@/core/types/payloads';
import type { NodeDefinition } from '@/core/nodes/definition';
import { ErrorCode } from '@/core/errors';

const Params = z.object({
  fps: z.number().int().positive().default(30),
  minTotalFrames: z.number().int().nonnegative().default(270),
  title: z.string().default('Untitled'),
});

/** CORE_CONTRACTS §5.4 — pure function; facts are optional. The frame size is the plan's, not a parameter here. */
export const timelineAssembler: NodeDefinition<typeof Params> = {
  type: 'core/timeline-assembler',
  version: 1,
  kind: 'process',
  inputs: [
    { name: 'plan', type: 'ScenePlan' },
    { name: 'voiceover', type: 'Voiceover' },
    { name: 'facts', type: 'FactSheet', required: false },
    { name: 'captions', type: 'CaptionTrack', required: false },
  ],
  outputs: [{ name: 'ir', type: 'VideoIR' }],
  paramsSchema: Params,
  defaultParams: DEFAULT_ASSEMBLER_PARAMS,
  run: async ({ params, inputs, services, log }) => {
    const plan = inputs.plan!.payload as ScenePlan;
    const voiceover = inputs.voiceover!.payload as Voiceover;
    const facts = inputs.facts?.payload as FactSheet | undefined;
    const captions = inputs.captions?.payload as CaptionTrack | undefined;
    const ir = buildIR({ plan, voiceover, facts, captions, params, now: services.now() });
    const bound = plan.scenes.reduce((n, s) => n + Object.keys(s.factBindings ?? {}).length, 0);
    // The facts port is optional because a hand-written plan needs no facts. But a plan that *does*
    // bind facts with nothing wired in renders a video quietly missing those values, so say it out loud.
    if (bound > 0 && !facts) {
      log('warn', `${bound} fact bindings have no source; connect a Fact Sheet to the facts port`, ErrorCode.FACTS_NOT_CONNECTED);
    }
    log('info', `${ir.meta.totalDurationInFrames} frames · ${ir.timeline.map((s) => s.durationInFrames).join('/')} · padTail ${ir.audioTrack.padTailFrames}${facts ? ` · ${bound} facts bound` : ''}${ir.captions ? ` · ${ir.captions.cues.length} caption lines` : ''}`);
    return { ir };
  },
};
