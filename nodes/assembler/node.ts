import { z } from 'zod';
import { buildIR, DEFAULT_ASSEMBLER_PARAMS } from '@/nodes/assembler/build-ir';
import type { AudioTrackSpec, CaptionTrack, LayerSheet, ScenePlan, FactSheet, Voiceover } from '@/contracts/types/payloads';
import type { NodeDefinition } from '@/core/nodes/definition';
import { padTailFramesOf, voiceTrackOf } from '@/contracts/types/ir';
import { AssemblerErrorCode } from './errors';

const Params = z.object({
  fps: z.number().int().positive().default(30),
  minTotalFrames: z.number().int().nonnegative().default(270),
  title: z.string().default('Untitled'),
  /** The clock of a film with no voice-over, in seconds. A wired voice-over takes precedence; without either, the longest sound (docs/IR_V3.md §5.3). */
  durationSeconds: z.number().positive().optional(),
  /** Move each cut to the nearest beat of a sound that carries them (wire one through Audio Analysis). */
  snapToBeat: z.boolean().default(false),
});

/** CORE_CONTRACTS §5.4 — pure function; facts are optional. The frame size is the plan's, not a parameter here. */
export const timelineAssembler: NodeDefinition<typeof Params> = {
  type: 'core/timeline-assembler',
  // 2: emits IR version 3 (docs/IR_V3.md); a version-2 result cached by an older build is not this node's output.
  version: 3,
  kind: 'process',
  inputs: [
    { name: 'plan', type: 'ScenePlan' },
    { name: 'voiceover', type: 'Voiceover', required: false },
    { name: 'facts', type: 'FactSheet', required: false },
    { name: 'captions', type: 'CaptionTrack', required: false },
    // Everything beside the scenes (§5.22), from any number of nodes: every sheet wired in, in list
    // order, under the scenes first and then over them. The set's things and a Layer node's file
    // arrived on two ports until 2026-09-13, and this node turned the first into the second on the
    // way in — which is the definition of one idea wearing two names.
    { name: 'layers', type: 'LayerSheet', required: false, multiple: true },
    { name: 'audio', type: 'AudioTrackSpec', required: false, multiple: true },
  ],
  outputs: [{ name: 'ir', type: 'VideoIR' }],
  paramsSchema: Params,
  defaultParams: DEFAULT_ASSEMBLER_PARAMS,
  run: async ({ params, inputs, lists, services, log }) => {
    const plan = inputs.plan!.payload as ScenePlan;
    // A layer announced to the scenes but drawn by somebody else carries no drawing of its own and
    // nothing is laid down for it here; the scenes still read its name and size off their stage.
    const layers = (lists.layers ?? []).flatMap((packet) => (packet.payload as LayerSheet).layers).filter((l) => l.kind === 'media' || l.source.trim());
    const audio = (lists.audio ?? []).map((packet) => packet.payload as AudioTrackSpec);
    const voiceover = inputs.voiceover?.payload as Voiceover | undefined;
    const facts = inputs.facts?.payload as FactSheet | undefined;
    const captions = inputs.captions?.payload as CaptionTrack | undefined;
    // Captions are lines of the voice; with no voice they have nothing to belong to (IR invariant 7).
    if (captions && !voiceover) log('warn', 'a caption track is wired in but no voice-over; the film goes out without captions', AssemblerErrorCode.CAPTIONS_WITHOUT_VOICE);
    if (voiceover && params.durationSeconds) log('info', `durationSeconds ${params.durationSeconds} is set, but the voice-over sets the clock`);
    const ir = buildIR({ plan, voiceover, facts, captions, layers, audio, params, now: services.now() });
    const bound = plan.scenes.reduce((n, s) => n + Object.keys(s.factBindings ?? {}).length, 0);
    // The facts port is optional because a hand-written plan needs no facts. But a plan that *does*
    // bind facts with nothing wired in renders a video quietly missing those values, so say it out loud.
    if (bound > 0 && !facts) {
      log('warn', `${bound} fact bindings have no source; connect a Fact Sheet to the facts port`, AssemblerErrorCode.FACTS_NOT_CONNECTED);
    }
    const clock = voiceTrackOf(ir) ? `padTail ${padTailFramesOf(ir)}` : 'silent';
    log('info', `${ir.meta.totalDurationInFrames} frames · ${ir.beats.map((b) => b.durationInFrames).join('/')} · ${clock}${layers.length ? ` · ${layers.length} layer${layers.length === 1 ? '' : 's'}` : ''}${audio.length ? ` · ${audio.length} sound${audio.length === 1 ? '' : 's'}` : ''}${facts ? ` · ${bound} facts bound` : ''}${ir.captions ? ` · ${ir.captions.cues.length} caption lines` : ''}`);
    return { ir };
  },
};
