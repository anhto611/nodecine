import { z } from 'zod';
import { resolveEngine } from '@/contracts/resources';
import type { Composition } from '@/contracts/types/composition';
import type { NodeDefinition } from '@/core/nodes/definition';

const Params = z.object({});

/** What the card needs to play a composition: the engine that plays it, and the page it loads. */
export type VideoOutputResult = { engineId: string; url: string; width: number; height: number } & Record<string, unknown>;

/**
 * The player on the canvas. The composition names its engine; this node asks that engine for a page
 * its player can load, filled with the composition's values, and the card mounts the player on it.
 */
export const videoOutput: NodeDefinition<typeof Params> = {
  type: 'video-output',
  version: 2,
  kind: 'sink',
  inputs: [{ name: 'composition', type: 'Composition' }],
  outputs: [],
  paramsSchema: Params,
  defaultParams: {},
  // Version 1 chose its engine on the node; a composition names its own now.
  migrate: () => ({}),
  run: async ({ inputs, services, signal, log }) => {
    const composition = inputs.composition!.payload as Composition;
    // The whole ref, not its id: the card decides whether to mount the player by reading the
    // engine's `preview` capability off it.
    const engine = await resolveEngine(services, composition.engine, ['preview']);
    const { url } = await services.preview(engine, composition, signal);
    log('info', `${engine.displayName} · ${composition.width}×${composition.height} · ${Object.keys(composition.values).length} values`);
    return { ...engine, url, width: composition.width, height: composition.height } satisfies VideoOutputResult;
  },
};
