import { z } from 'zod';
import { NodeError } from '@/contracts/errors';
import type { Footage } from '@/contracts/types/footage';
import type { Voiceover } from '@/contracts/types/payloads';
import type { Storyboard, StoryboardFrame } from '@/contracts/types/storyboard';
import type { NodeDefinition } from '@/core/nodes/definition';
import { RoughCutErrorCode } from './errors';
import { cutIntoScenes, sceneTitle } from './scenes';

const Params = z.object({
  /** How long a scene should run before a breath in the speech may end it. */
  targetSeconds: z.number().min(2).max(30).default(6),
  /** No scene shorter than this, however the person breathes. */
  minSeconds: z.number().min(0.5).max(10).default(2.5),
  /** A gap between two words long enough to be the end of a thought. */
  pauseSeconds: z.number().min(0.1).max(2).default(0.35),
});

/**
 * A recording laid out as a film: the rough cut.
 *
 * The Storyboard Writer writes a film that does not exist yet; this does the opposite. The words are
 * already spoken and already timed, so the work is to say where one scene ends and the next begins,
 * and which of the workflow's blocks shows each of them. It cuts where the speech itself stops — in
 * the gaps between thoughts — and never drops or reorders a moment: what is heard always matches what
 * is seen, and a person can move a boundary afterwards knowing nothing else shifted under them.
 *
 * It hands the voice on with those same boundaries marked on it, because the Assemble node measures a
 * scene by the stretch of voice it carries; the two have to be cut by the same hand or they disagree.
 */
export const roughCut: NodeDefinition<typeof Params> = {
  type: 'rough-cut', version: 1, kind: 'process',
  inputs: [
    { name: 'footage', type: 'Footage' },
    { name: 'voiceover', type: 'Voiceover' },
  ],
  outputs: [
    { name: 'storyboard', type: 'Storyboard' },
    { name: 'voiceover', type: 'Voiceover' },
  ],
  paramsSchema: Params, defaultParams: Params.parse({}),
  run: async ({ params, inputs, log }) => {
    const footage = inputs.footage!.payload as Footage;
    const voice = inputs.voiceover!.payload as Voiceover;
    if (!voice.words?.length) {
      throw new NodeError(RoughCutErrorCode.ROUGH_CUT_NO_WORDS, 'the voice carries no word timings')
        .withFix('wire the Caption Sync node between the Footage node and this one');
    }
    const scenes = cutIntoScenes(voice.words, Math.min(footage.durationSeconds, voice.durationSeconds), params);
    if (!scenes.length) throw new NodeError(RoughCutErrorCode.ROUGH_CUT_NO_WORDS, 'nothing is said on this recording');

    const frames: StoryboardFrame[] = scenes.map((scene, i) => ({
      number: i + 1,
      title: sceneTitle(scene.said),
      voiceover: scene.said,
      transitionIn: 'cut',
      block: 'clip-full',
      // Where this scene sits in the recording; the Assemble node gives it its length.
      values: { from: scene.start },
      mounts: [],
      extra: {},
    }));
    const markdown = [
      '---', `format: ${footage.width}x${footage.height}`, `subject: ${footage.name}`, '---', '',
      ...frames.map((f, i) => [
        `## Frame ${f.number} — ${f.title}`,
        `- voiceover: "${(f.voiceover ?? '').replace(/"/g, '”')}"`,
        `- transition_in: ${f.transitionIn}`,
        `- block: ${f.block}`,
        '',
        '```json',
        JSON.stringify({ from: scenes[i]!.start }, null, 2),
        '```',
        '',
      ].join('\n')),
    ].join('\n');

    const storyboard: Storyboard = {
      format: `${footage.width}x${footage.height}`,
      subject: footage.name,
      frames,
      layers: [],
      markdown,
    };
    const cut: Voiceover = {
      ...voice,
      segments: scenes.map((s) => ({ start: s.start, durationSeconds: s.durationSeconds })),
    };
    const lengths = scenes.map((s) => s.durationSeconds);
    log('info', `${scenes.length} scenes · ${Math.min(...lengths).toFixed(1)}–${Math.max(...lengths).toFixed(1)}s each`);
    return { storyboard, voiceover: cut };
  },
};
