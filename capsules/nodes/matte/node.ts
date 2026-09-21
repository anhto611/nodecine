import { z } from 'zod';
import { NodeError } from '@/contracts/errors';
import type { Footage } from '@/contracts/types/footage';
import type { ClipFacts } from '@/server/contracts/video';
import type { CutOut, MatteDetail } from './server';
import type { NodeDefinition } from '@/core/nodes/definition';
import { MatteErrorCode } from './errors';

export const MATTE_DETAIL = ['fast', 'fine'] as const;

const Params = z.object({
  /** How big the model is asked to work; `fast` halves the frame. See `matteSize`. */
  detail: z.enum(MATTE_DETAIL).default('fast'),
});

/**
 * The speaker, lifted off the room they were filmed in.
 *
 * A recording comes in and a second recording goes out: the same person on the same clock, with
 * everything behind them made clear. Laid over a film's own graphics it does the one thing framing
 * alone cannot — a title sits *behind* somebody's head, and the top of their head breaks out over the
 * edge of a card instead of being clipped by it.
 *
 * It comes out on the Footage wire because that is what it is: a clip, the same length and speed as
 * the one it came from, only transparent. Everything that already knows how to take footage — the
 * Data Merge node, a block that plays a clip — takes this unchanged; `hasAlpha` is the only thing
 * that tells them apart, and the only thing that had to be added anywhere to make this work.
 *
 * A node of its own rather than a switch on the Footage node, because this is the slowest thing in
 * the app: minutes of work per clip. Kept apart, changing the transcription model or letting the
 * Coverage node think again never spends those minutes twice, and changing the detail here never
 * throws away the reading of the clip itself.
 */
export const matte: NodeDefinition<typeof Params> = {
  type: 'matte', version: 2, kind: 'process',
  inputs: [{ name: 'footage', type: 'Footage' }],
  outputs: [{ name: 'footage', type: 'Footage' }],
  paramsSchema: Params, defaultParams: Params.parse({}),
  run: async ({ params, inputs, services, signal, log }) => {
    const source = inputs.footage!.payload as Footage;
    if (source.hasAlpha) throw new NodeError(MatteErrorCode.MATTE_FAILED, 'that clip has already been cut out').withFix('wire the recording itself in, not a cut-out of it');
    const facts = await services.invoke<ClipFacts>('footage/read', [source.url, signal]);
    const cut = await services.invoke<CutOut>('matte/cut', [source.url, facts, params.detail as MatteDetail, signal]);
    log('info', cut.frames
      ? `${cut.frames} frames cut at ${cut.width}×${cut.height} in ${cut.seconds.toFixed(0)}s`
      : `already cut at ${cut.width}×${cut.height}`);
    const footage: Footage = {
      ...source,
      url: cut.url,
      name: `${source.name} (cut out)`,
      width: cut.width,
      height: cut.height,
      // Nothing is said on a cut-out: the sound stays with the recording it came from.
      hasAudio: false,
      hasAlpha: true,
    };
    return { footage };
  },
};
