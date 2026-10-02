import { z } from 'zod';
import { NodeError } from '@/contracts/errors';
import { AssetUrlSchema } from '@/contracts/types/payloads';
import type { Footage } from '@/contracts/types/footage';
import type { Voiceover } from '@/contracts/types/payloads';
import type { ClipFacts } from '@/server/contracts/video';
import type { NodeDefinition } from '@/core/nodes/definition';
import { FootageErrorCode } from './errors';

const Params = z.object({
  /** The clip, already in this machine's asset store; chosen on the node. */
  clip: z.union([AssetUrlSchema, z.literal('')]).default(''),
  /** What the file was called when it was chosen. */
  name: z.string().max(200).default(''),
});

/**
 * A clip somebody recorded, brought into a workflow.
 *
 * Every other source node here starts from what a person writes; this one starts from what they shot.
 * The file is read as it is — how long, how big, how fast, whether anything is said on it — and comes
 * out on two wires: the clip, for a film to show, and its own sound as a voice-over, because that is
 * what the recording is once a film is built around it. Wire that into the Caption Sync node and the
 * words are timed like any other narration; nothing downstream has to learn about video to use it.
 *
 * Nobody is asked what language is spoken on it. The voice leaves here as `und` — BCP 47 for
 * undetermined, which is the truth about a file nobody has listened to — and the Caption Sync node
 * writes down whatever the model hears.
 */
export const footage: NodeDefinition<typeof Params> = {
  type: 'footage',
  version: 2,
  kind: 'source',
  inputs: [],
  outputs: [
    { name: 'footage', type: 'Footage' },
    { name: 'voice', type: 'Voiceover' },
  ],
  paramsSchema: Params,
  defaultParams: Params.parse({}),
  validate: (params) => (params.clip ? [] : [{ code: FootageErrorCode.FOOTAGE_EMPTY, message: 'choose a clip to work from' }]),
  run: async ({ params, services, signal, log }) => {
    if (!params.clip) throw new NodeError(FootageErrorCode.FOOTAGE_EMPTY, 'no clip chosen').withFix('choose a recording on this node');
    let facts = await services.invoke<ClipFacts>('footage/read', [params.clip, signal]);
    // A phone films in a codec no browser here can play; the film shows a copy it can.
    const playable = await services.invoke<{ url: string; converted: boolean; why?: 'codec' | 'seeking' }>('footage/playable', [params.clip, facts, signal]);
    if (playable.converted) {
      log(
        'info',
        playable.why === 'codec'
          ? `${facts.codec} is not a codec this engine plays: made an H.264 copy`
          : `its keyframes are ${facts.keyframeSeconds}s apart, which stalls every cut: made a copy with one a second`,
      );
      // Transcoding applies the recording's rotation, so dimensions must describe the playable pixels.
      facts = await services.invoke<ClipFacts>('footage/read', [playable.url, signal]);
    }
    const footage: Footage = {
      url: playable.url,
      name: params.name.trim() || 'clip',
      durationSeconds: facts.durationSeconds,
      width: facts.width,
      height: facts.height,
      fps: facts.fps,
      hasAudio: facts.hasAudio,
      // Nothing has been cut out of it: this is the recording as it was shot.
      hasAlpha: false,
    };
    log('info', `${footage.name} · ${facts.width}×${facts.height} · ${facts.fps}fps · ${facts.durationSeconds.toFixed(2)}s${facts.hasAudio ? '' : ' · silent'}`);
    if (!facts.hasAudio) return { footage };
    const sound = await services.invoke<{ audioUrl: string; durationSeconds: number }>('footage/sound', [params.clip, signal]);
    const voice: Voiceover = {
      audioUrl: sound.audioUrl,
      durationSeconds: sound.durationSeconds,
      // Not a voice this app chose: the one on the recording.
      voiceName: footage.name,
      // Undetermined: the recording does not say, and guessing would send the transcriber after the wrong words.
      language: 'und',
      speed: 1,
    };
    log('info', `its sound is ${sound.durationSeconds.toFixed(2)}s`);
    return { footage, voice };
  },
};
