import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RemoteExecutor } from '../remote-executor';
import staticScript from '@/templates/static-script.json';
import type { Graph } from '@/core/engine/graph';

/**
 * The browser side of the executor talks to the server over fetch; here fetch is a log. What is
 * under test is the order requests leave in, because the server applies them in arrival order.
 */
class FakeEventSource {
  static instances: FakeEventSource[] = [];
  listeners = new Map<string, ((e: MessageEvent) => void)[]>();
  constructor(public url: string) { FakeEventSource.instances.push(this); }
  addEventListener(type: string, fn: (e: MessageEvent) => void) { this.listeners.set(type, [...(this.listeners.get(type) ?? []), fn]); }
  close() { /* noop */ }
  set onerror(_: unknown) { /* noop */ }
}

const calls: { url: string; body: Record<string, unknown> }[] = [];
let release: (() => void)[] = [];

beforeEach(() => {
  calls.length = 0;
  release = [];
  vi.stubGlobal('EventSource', FakeEventSource);
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    const body = init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : {};
    calls.push({ url, body });
    // The first executor call (attach) answers at once; later ones wait until the test releases them.
    if (calls.length > 1) await new Promise<void>((r) => release.push(r));
    const payload = url.startsWith('/api/jobs') ? { job: { id: `j${calls.length}`, key: 'k', kind: body.kind, status: 'done', ok: true, createdAt: 0 } } : { runtimes: {}, logs: [], running: false, pending: [], history: [] };
    return new Response(JSON.stringify(payload), { status: 200, headers: { 'content-type': 'application/json' } });
  }));
});
afterEach(() => vi.unstubAllGlobals());

const flush = () => new Promise((r) => setTimeout(r, 0));

describe('RemoteExecutor request order', () => {
  it('sends an invalidate before the node job that follows it, even while the first request is still in flight', async () => {
    const graph = structuredClone(staticScript.graph) as Graph;
    const ex = new RemoteExecutor('k', graph, 'Static');
    await flush();
    expect(calls.map((c) => c.body.action)).toEqual(['graph']);

    ex.invalidate('llm-provider');
    const done = ex.runNode('llm-provider');
    await flush();
    // Only the invalidate has gone out; the job waits its turn behind it.
    expect(calls.length).toBe(2);
    expect(calls[1]!.body).toMatchObject({ action: 'invalidate', nodeId: 'llm-provider' });

    release.shift()!();
    await flush();
    expect(calls.length).toBe(3);
    expect(calls[2]!.url).toBe('/api/jobs');
    expect(calls[2]!.body).toMatchObject({ kind: 'node', nodeId: 'llm-provider' });
    release.shift()!();
    await done;
  });
});

describe('RemoteExecutor job completion', () => {
  it('resolves a node run whose done event arrives before the POST answers', async () => {
    const graph = structuredClone(staticScript.graph) as Graph;
    const ex = new RemoteExecutor('k', graph, 'Static');
    await flush();
    const es = FakeEventSource.instances.at(-1)!;
    // Pending from the POST; the stream says done while the POST is still in flight.
    vi.mocked(fetch).mockImplementationOnce(async (url, init) => {
      const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
      calls.push({ url: String(url), body });
      for (const fn of es.listeners.get('job') ?? []) fn({ data: JSON.stringify({ job: { id: 'fast', key: 'k', kind: 'node', status: 'done', ok: true, createdAt: 0 } }) } as MessageEvent);
      return new Response(JSON.stringify({ job: { id: 'fast', key: 'k', kind: 'node', status: 'pending', createdAt: 0 } }), { status: 200, headers: { 'content-type': 'application/json' } });
    });
    const state = await Promise.race([ex.runNode('llm-provider'), new Promise<string>((r) => setTimeout(() => r('TIMEOUT'), 500))]);
    expect(state).not.toBe('TIMEOUT');
  });
});
