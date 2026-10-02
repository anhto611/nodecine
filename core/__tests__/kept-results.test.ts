import { beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { Executor } from '../engine/executor';
import { MemoryResultCache, type CachedResult, type ResultCache } from '../engine/result-cache';
import { _resetNodeRegistry, registerNodeType, type AnyNodeDefinition } from '../nodes/definition';
import { _resetPortTypes, registerPortType } from '../types/ports';
import { pipeline, registerTestKit, testServices, TEXT } from './kit';

/**
 * Results kept by what produced them.
 *
 * The runtime map held one result per node, the last. Going back to a setting already paid for paid
 * again, and a restart forgot everything. These hold the three things that changes: going back is
 * free, a new process sharing the store is free, and a node whose code changed runs again even when
 * nobody bumped its version.
 */

beforeEach(() => {
  _resetNodeRegistry();
  _resetPortTypes();
  registerTestKit();
});

const voices = (services: ReturnType<typeof testServices>) => services.calls.filter((c) => c.name === 'voice').length;
const setSpeed = (ex: Executor, speed: number) => {
  const graph = ex.getGraph();
  graph.nodes.find((n) => n.id === 'voice')!.params.speed = speed;
  ex.setGraph(graph);
  ex.invalidate('voice');
};

describe('a result already paid for', () => {
  it('is not paid for again when a setting goes back to what it was', async () => {
    const services = testServices();
    const ex = new Executor(pipeline(), services);
    await ex.run();
    setSpeed(ex, 2);
    await ex.run();
    expect(voices(services)).toBe(2);

    setSpeed(ex, 1);
    await ex.run();
    // The runtime held only the speed-2 result; the first one comes back from the kept results.
    expect(voices(services)).toBe(2);
    expect(ex.runtime('voice').reused).toBe(true);
    expect(ex.runtime('join').outputs.out!.payload).toEqual({ text: 'hello@1' });
  });

  it('outlives the executor that made it, when the store does', async () => {
    const cache = new MemoryResultCache();
    const first = testServices();
    await new Executor(pipeline(), first, {}, undefined, { cache }).run();
    expect(voices(first)).toBe(1);

    // A new executor is what a restarted server builds; the store is what it reads back.
    const second = testServices();
    const ex = new Executor(pipeline(), second, {}, undefined, { cache });
    const { ok } = await ex.run();
    expect(ok).toBe(true);
    expect(voices(second)).toBe(0);
    expect(ex.runtime('voice').reused).toBe(true);
    // A sink is never kept: it shows its result every time.
    expect(second.calls.filter((c) => c.name === 'show')).toHaveLength(1);
  });

  it('is not used when a forced run asks for a new one, and the new one is kept', async () => {
    const cache = new MemoryResultCache();
    const services = testServices();
    await new Executor(pipeline(), services, {}, undefined, { cache }).run();
    const ex = new Executor(pipeline(), services, {}, undefined, { cache });
    await ex.run({ force: true });
    expect(voices(services)).toBe(2);
  });

  it('keeps the warnings it was produced with', async () => {
    const cache = new MemoryResultCache();
    const graph = () => {
      const g = pipeline();
      g.nodes.find((n) => n.id === 'join')!.params.wantsExtra = true;
      return g;
    };
    await new Executor(graph(), testServices(), {}, undefined, { cache }).run();
    const ex = new Executor(graph(), testServices(), {}, undefined, { cache });
    await ex.run();
    expect(ex.runtime('join').reused).toBe(true);
    expect(ex.runtime('join').warnings?.[0]?.code).toBe('EXTRA_NOT_CONNECTED');
  });

  it('is a miss when it no longer fits the wire, and the node runs instead', async () => {
    const cache = new MemoryResultCache();
    await new Executor(pipeline(), testServices(), {}, undefined, { cache }).run();
    // The wire's shape changed in a later build: the kept text is no longer what a TestText is.
    registerPortType(TEXT, { labelKey: 'port.testText', schema: z.object({ text: z.string(), lang: z.string() }) });
    const services = testServices();
    const ex = new Executor(pipeline(), services, {}, undefined, { cache });
    await ex.run();
    // The source emits no `lang`, so it now fails its own output check: the kept result was not used.
    expect(ex.runtime('source').state).toBe('error');
    expect(ex.runtime('source').error?.code).toBe('NODE_OUTPUT_INVALID');
  });

  it('never fails a run when the store cannot read or write', async () => {
    const broken: ResultCache = {
      get: async () => {
        throw new Error('disk gone');
      },
      set: async (_s: string, _r: CachedResult) => {
        throw new Error('disk full');
      },
    };
    const services = testServices();
    const ex = new Executor(pipeline(), services, {}, undefined, { cache: broken });
    const { ok } = await ex.run();
    expect(ok).toBe(true);
    expect(ex.logs.all().some((l) => l.level === 'warn' && l.message.includes('disk full'))).toBe(true);
  });
});

describe('the code that runs a node', () => {
  it('is part of its signature: changed code runs again, unchanged code is reused', async () => {
    const cache = new MemoryResultCache();
    const code = { voice: 'aaaa' };
    const fingerprint = (type: string) => (type === 'test/voice' ? code.voice : undefined);
    await new Executor(pipeline(), testServices(), {}, undefined, { cache, fingerprint }).run();

    const same = testServices();
    await new Executor(pipeline(), same, {}, undefined, { cache, fingerprint }).run();
    expect(voices(same)).toBe(0);

    // Somebody edited the voice node and forgot to bump its version.
    code.voice = 'bbbb';
    const edited = testServices();
    const ex = new Executor(pipeline(), edited, {}, undefined, { cache, fingerprint });
    await ex.run();
    expect(voices(edited)).toBe(1);
    expect(ex.runtime('source').reused).toBe(true);
    expect(ex.runtime('voice').reused).toBe(false);
  });
});

describe('a forced run', () => {
  it('tells the node it wants new answers; a normal run does not', async () => {
    const seen: boolean[] = [];
    registerNodeType({
      type: 'test/asks',
      version: 1,
      kind: 'source',
      inputs: [],
      outputs: [{ name: 'out', type: TEXT }],
      paramsSchema: z.object({}),
      defaultParams: {},
      run: async ({ fresh }: { fresh: boolean }) => {
        seen.push(fresh);
        return { out: { text: 'x' } };
      },
    } as unknown as AnyNodeDefinition);
    const ex = new Executor({ nodes: [{ id: 'a', type: 'test/asks', params: {}, bypassed: false, position: { x: 0, y: 0 } }], edges: [] }, testServices());
    await ex.run();
    await ex.run({ force: true });
    await ex.runNode('a');
    expect(seen).toEqual([false, true, true]);
  });
});
