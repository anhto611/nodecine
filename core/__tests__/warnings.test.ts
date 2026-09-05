import { beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { Executor } from '../engine/executor';
import type { Graph } from '../engine/graph';
import { _resetNodeRegistry, registerNodeType, type AnyNodeDefinition, type NodeDefinition } from '../nodes/definition';
import { registerNodes } from '@/nodes';
import { makeFakeServices } from './fakes';
import { STAGE, TEXT_CARD } from './look-fixtures';

/**
 * A stand-in director: emits a plan that binds facts, which the core's own
 * Static Script cannot do (its params schema has no factBindings).
 */
const Params = z.object({ bindFacts: z.boolean().default(true) });
const fakeDirector: NodeDefinition<typeof Params> = {
  type: 'test/director',
  version: 1,
  namespace: 'test',
  kind: 'source',
  inputs: [],
  outputs: [
    { name: 'plan', type: 'DirectorPlan' },
    { name: 'script', type: 'AudioScript' },
  ],
  paramsSchema: Params,
  defaultParams: { bindFacts: true },
  run: async ({ params }) => ({
    plan: {
      language: 'en',
      stage: STAGE,
      blocks: [TEXT_CARD],
      scenes: [{ blockId: TEXT_CARD.id, weight: 1, props: { headline: 'ONE' }, ...(params.bindFacts ? { factBindings: { headline: 'name' } } : {}) }],
    },
    script: { text: 'A short script for the test, long enough to synthesize.', language: 'en' },
  }),
};

function graph(): Graph {
  return {
    nodes: [
      { id: 'dir', type: 'test/director', params: { bindFacts: true }, bypassed: false, position: { x: 0, y: 0 } },
      { id: 'tts-provider', type: 'core/tts-provider', params: { providerId: 'system-tts', settings: { rate: 1 } }, bypassed: false, position: { x: 0, y: 0 } },
      { id: 'tts', type: 'core/tts-engine', params: { speed: 1 }, bypassed: false, position: { x: 0, y: 0 } },
      { id: 'asm', type: 'core/timeline-assembler', params: { fps: 30, width: 1080, height: 1920, minTotalFrames: 270, title: 'T' }, bypassed: false, position: { x: 0, y: 0 } },
    ],
    edges: [
      { id: 'e1', source: 'dir', sourcePort: 'plan', target: 'asm', targetPort: 'plan' },
      { id: 'e2', source: 'dir', sourcePort: 'script', target: 'tts', targetPort: 'script' },
      { id: 'e3', source: 'tts-provider', sourcePort: 'tts', target: 'tts', targetPort: 'tts' },
      { id: 'e4', source: 'tts', sourcePort: 'voiceover', target: 'asm', targetPort: 'voiceover' },
    ],
  };
}

describe('run warnings surface on the node', () => {
  beforeEach(() => {
    _resetNodeRegistry();
    registerNodes();
    registerNodeType(fakeDirector as unknown as AnyNodeDefinition);
  });

  it('warns when a plan binds facts but nothing is wired into the facts port', async () => {
    const ex = new Executor(graph(), makeFakeServices());
    const { ok } = await ex.run();
    expect(ok).toBe(true); // degraded, not failed: the video is still produced
    const rt = ex.runtimes_().get('asm')!;
    expect(rt.state).toBe('success');
    expect(rt.warnings?.[0]?.code).toBe('FACTS_NOT_CONNECTED');
  });

  it('stays quiet when the plan binds no facts', async () => {
    const g = graph();
    g.nodes.find((n) => n.id === 'dir')!.params.bindFacts = false;
    const ex = new Executor(g, makeFakeServices());
    await ex.run();
    expect(ex.runtimes_().get('asm')!.warnings).toBeUndefined();
  });

  it('clears the warning once a Fact Sheet is wired in', async () => {
    const g = graph();
    const ex = new Executor(g, makeFakeServices());
    await ex.run();
    expect(ex.runtimes_().get('asm')!.warnings).toHaveLength(1);

    g.nodes.push({ id: 'facts', type: 'test/facts', params: {}, bypassed: false, position: { x: 0, y: 0 } });
    g.edges.push({ id: 'e5', source: 'facts', sourcePort: 'facts', target: 'asm', targetPort: 'facts' });
    registerNodeType({
      type: 'test/facts',
      version: 1,
      namespace: 'test',
      kind: 'source',
      inputs: [],
      outputs: [{ name: 'facts', type: 'FactSheet' }],
      paramsSchema: z.object({}),
      defaultParams: {},
      run: async () => ({ facts: { facts: { name: 'BOUND' }, sourceLabel: 't', fetchedAt: '2026-09-05T00:00:00.000Z', mode: 'fetched' } }),
    } as unknown as AnyNodeDefinition);
    ex.setGraph(g);
    await ex.run({ force: true });
    const rt = ex.runtimes_().get('asm')!;
    expect(rt.warnings).toBeUndefined();
    expect(rt.state).toBe('success');
  });
});
