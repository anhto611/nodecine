import { z } from 'zod';
import { NodeError } from '@/contracts/errors';
import type { Composition, CompositionVariable } from '@/contracts/types/composition';
import type { CaptionTrack, Voiceover } from '@/contracts/types/payloads';
import type { NodeDefinition } from '@/core/nodes/definition';
import { FillErrorCode } from './errors';

/**
 * Where what the steps before produced lands in a composition. Files the composition reads by name,
 * and a variable it may declare to learn the voice's length — the one number a timeline built
 * before the voice existed cannot know.
 */
export const FILLED = {
  voiceover: 'voiceover',
  voiceoverSeconds: 'voiceoverSeconds',
  transcript: 'transcript.json',
  captions: 'captions.json',
} as const;

const Params = z.object({
  /** Values for the composition's variables, by id. What is not set keeps the declared default. */
  values: z.record(z.string(), z.unknown()).default({}),
});

/** Whether a value suits a declared type; the engine checks again, this says it on the node. */
function suits(value: unknown, variable: CompositionVariable): boolean {
  switch (variable.type) {
    case 'string': case 'color': case 'enum': return typeof value === 'string';
    case 'number': return typeof value === 'number' && Number.isFinite(value);
    case 'boolean': return typeof value === 'boolean';
    case 'image': return typeof value === 'string' || (!!value && typeof value === 'object' && typeof (value as { url?: unknown }).url === 'string');
    case 'font': return typeof value === 'string' || (!!value && typeof value === 'object' && typeof (value as { name?: unknown }).name === 'string');
    default: return true;
  }
}

/**
 * A composition with what this run made poured in: the voice-over as a file beside it, the word
 * timings and caption lines as JSON it can read, and values for its variables. The composition
 * decides what to do with each; this node only puts them where the composition looks.
 */
export const fill: NodeDefinition<typeof Params> = {
  type: 'fill', version: 1, kind: 'process',
  inputs: [
    { name: 'composition', type: 'Composition' },
    { name: 'voiceover', type: 'Voiceover', required: false },
    { name: 'captions', type: 'CaptionTrack', required: false },
  ],
  outputs: [{ name: 'composition', type: 'Composition' }],
  paramsSchema: Params, defaultParams: { values: {} },
  run: async ({ params, inputs, log }) => {
    const base = inputs.composition!.payload as Composition;
    const voice = inputs.voiceover?.payload as Voiceover | undefined;
    const captions = inputs.captions?.payload as CaptionTrack | undefined;
    const declared = new Map(base.variables.map((v) => [v.id, v] as const));

    const values: Record<string, unknown> = { ...base.values };
    for (const [id, value] of Object.entries(params.values)) {
      const variable = declared.get(id);
      if (!variable) throw new NodeError(FillErrorCode.VARIABLE_UNDECLARED, `the composition declares no variable "${id}"`).withFix(`remove "${id}", or declare it in the composition`);
      if (!suits(value, variable)) throw new NodeError(FillErrorCode.VARIABLE_WRONG_TYPE, `"${id}" is a ${variable.type}, and ${JSON.stringify(value)} is not one`);
      values[id] = value;
    }

    const files = { ...base.files };
    const media = { ...base.media };
    if (voice) {
      const ext = voice.audioUrl.split('.').pop() ?? 'mp3';
      media[`${FILLED.voiceover}.${ext}`] = voice.audioUrl;
      if (declared.has(FILLED.voiceoverSeconds)) values[FILLED.voiceoverSeconds] = voice.durationSeconds;
      if (voice.words?.length) files[FILLED.transcript] = JSON.stringify(voice.words);
    }
    if (captions) files[FILLED.captions] = JSON.stringify(captions.cues);

    const unset = base.variables.filter((v) => values[v.id] === undefined && v.default === undefined).map((v) => v.id);
    if (unset.length) log('warn', `no value and no default for ${unset.join(', ')}`);
    log('info', `${Object.keys(values).length} values${voice ? ' · voice-over' : ''}${captions ? ` · ${captions.cues.length} caption lines` : ''}`);
    return { composition: { ...base, files, media, values } satisfies Composition };
  },
};
