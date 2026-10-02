import { describe, expect, it } from 'vitest';
import { videoOutput } from '../node';
import { readCapability } from '@/core/nodes/definition';
import { makeFakeServices } from '@/contracts/__tests__/fakes';
import type { Composition } from '@/contracts/types/composition';

const composition: Composition = {
  engine: 'hyperframes',
  width: 1080,
  height: 1920,
  fps: 30,
  files: { 'index.html': '<html><body><div data-composition-id="main"></div></body></html>' },
  media: {},
  variables: [{ id: 'title', type: 'string', default: 'Hello' }],
  values: { title: 'Hi' },
};

/**
 * What the player node hands back to the card. The card mounts the player only when the engine says
 * preview is ready, and the only place it can read that is this node's result — so the result is the
 * engine's ref, with the page the player loads and the size to draw it at.
 */
describe('the player node’s result', () => {
  const run = async (services = makeFakeServices()) =>
    (await videoOutput.run({
      params: {},
      inputs: { composition: { type: 'Composition', payload: composition } },
      lists: {},
      services,
      signal: new AbortController().signal,
      log: () => {},
      progress: () => {},
    } as never)) as Record<string, unknown>;

  it('carries the engine’s capabilities, so the card can mount the player', async () => {
    expect(readCapability(await run(), 'preview')?.status).toBe('ready');
  });

  it('asks the engine the composition names for a page, and says what size to draw it', async () => {
    const services = makeFakeServices();
    const result = await run(services);
    expect(services.calls.find((c) => c.name === 'probeEngine')?.args[0]).toBe('hyperframes');
    expect(result).toMatchObject({ engineId: 'hyperframes', width: 1080, height: 1920 });
    expect(String(result.url)).toMatch(/^\/api\/projects\//);
  });
});
