import { z } from 'zod';
import { NodeError } from '@/contracts/errors';
import type { Composition, CompositionVariable } from '@/contracts/types/composition';
import type { Voiceover } from '@/contracts/types/payloads';
import type { Footage } from '@/contracts/types/footage';
import type { NodeDefinition } from '@/core/nodes/definition';
import { FillErrorCode } from './errors';

/**
 * Where what the steps before produced lands in a composition. The composition reads these by name;
 * each is written only when there is something to write.
 *
 * - `voiceover.<ext>`: the voice-over, beside the composition's own files.
 * - `voiceover` variable: that file's path, for an `<audio data-var-src="voiceover">`. Declaring it
 *   is how a composition says it plays the voice; without a voice it stays unset and renders silent.
 * - `voiceoverSeconds` variable: the voice's length, when declared.
 * - `voiceover.json`: `{ durationSeconds, segments?, words? }` — the voice's length, where each
 *   narration segment starts and how long it lasts, and the words' timings, for a timeline that
 *   follows the voice; karaoke captions read their words from here.
 * - `clip.<ext>`: the recording the film is cut from, when one is wired in. A composition built around
 *   a recording plays it by that name, the way it plays the voice by `voiceover`; the scenes say which
 *   stretch of it each of them shows.
 * - `cutout.webm`: the same recording with the speaker cut out of it, when a Matte node is wired in.
 *   A block plays it on top of its own graphics, on the same clock as `clip`, and the speaker comes
 *   forward: type sits behind their head, and their head breaks out over the edge of a card.
 */
export const FILLED = {
  voiceover: 'voiceover',
  voiceoverSeconds: 'voiceoverSeconds',
  timing: 'voiceover.json',
  images: 'images',
  clip: 'clip',
  cutout: 'cutout',
} as const;

/** A file this machine holds, named by the app: an upload or something a node made. */
const APP_FILE = /^\/api\/(?:assets|media)\/[a-f0-9]{16,64}\.([a-z0-9]+)$/;

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
 * A composition with what this run made poured in: the voice-over as a file beside it, its timings and
 * words as JSON it can read, uploaded pictures copied into it, and values for its variables. The composition
 * decides what to do with each; this node only puts them where the composition looks.
 */
export const fill: NodeDefinition<typeof Params> = {
  type: 'fill', version: 1, kind: 'process',
  inputs: [
    { name: 'composition', type: 'Composition' },
    { name: 'voiceover', type: 'Voiceover', required: false },
    { name: 'footage', type: 'Footage', required: false },
    // The same recording with the speaker cut out of it: a second layer, not a second recording.
    { name: 'cutout', type: 'Footage', required: false },
  ],
  outputs: [{ name: 'composition', type: 'Composition' }],
  paramsSchema: Params, defaultParams: { values: {} },
  run: async ({ params, inputs, log }) => {
    const base = inputs.composition!.payload as Composition;
    const voice = inputs.voiceover?.payload as Voiceover | undefined;
    const clip = inputs.footage?.payload as Footage | undefined;
    const cutout = inputs.cutout?.payload as Footage | undefined;
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

    // An uploaded picture is a URL of this app, which the engine's renderer cannot reach: it goes
    // into the project beside the composition, and the variable names it there.
    for (const [id, value] of Object.entries(values)) {
      if (declared.get(id)?.type !== 'image') continue;
      const url = typeof value === 'string' ? value : (value as { url?: unknown } | null)?.url;
      const m = typeof url === 'string' ? APP_FILE.exec(url) : null;
      if (!m) continue;
      const inProject = `${FILLED.images}/${id}.${m[1]}`;
      media[inProject] = url as Composition['media'][string];
      values[id] = typeof value === 'string' ? inProject : { ...(value as object), url: inProject };
    }

    if (voice) {
      const ext = voice.audioUrl.split('.').pop() ?? 'mp3';
      const file = `${FILLED.voiceover}.${ext}`;
      media[file] = voice.audioUrl;
      if (declared.has(FILLED.voiceover)) values[FILLED.voiceover] = file;
      if (declared.has(FILLED.voiceoverSeconds)) values[FILLED.voiceoverSeconds] = voice.durationSeconds;
      files[FILLED.timing] = JSON.stringify({
        durationSeconds: voice.durationSeconds,
        ...(voice.segments ? { segments: voice.segments } : {}),
        ...(voice.words?.length ? { words: voice.words } : {}),
      });
    }

    if (clip) {
      const ext = clip.url.split('.').pop() ?? 'mp4';
      media[`${FILLED.clip}.${ext}`] = clip.url as Composition['media'][string];
      if (declared.has(FILLED.clip)) values[FILLED.clip] = `${FILLED.clip}.${ext}`;
    }

    if (cutout) {
      // Laid over the graphics, so a clip that is not clear anywhere would simply cover them.
      if (!cutout.hasAlpha) log('warn', `${cutout.name} was not cut out: laid over the graphics it will hide them`);
      const ext = cutout.url.split('.').pop() ?? 'webm';
      media[`${FILLED.cutout}.${ext}`] = cutout.url as Composition['media'][string];
      if (declared.has(FILLED.cutout)) values[FILLED.cutout] = `${FILLED.cutout}.${ext}`;
    }

    const unset = base.variables.filter((v) => values[v.id] === undefined && v.default === undefined).map((v) => v.id);
    if (unset.length) log('warn', `no value and no default for ${unset.join(', ')}`);
    log('info', `${Object.keys(values).length} values${voice ? ' · voice-over' : ''}${clip ? ` · ${clip.name}` : ''}${cutout ? ' · cut-out' : ''}`);
    return { composition: { ...base, files, media, values } satisfies Composition };
  },
};
