import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RETRY, RemoteExecutor } from '../remote-executor';
import { pipeline } from '@/core/__tests__/kit';

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
    const graph = pipeline();
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
    const graph = pipeline();
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

/**
 * A 5xx with an empty body did not reach the route — in development, Next rebuilding it after a file
 * changed. It clears on its own in a moment, so the browser tries once more instead of handing the
 * person `/api/jobs failed (500)`, which says nothing about what to do. A refusal the route wrote
 * itself always names an error, and is final.
 */
describe('RemoteExecutor when the server is not ready', () => {
  const emptyServerError = () => new Response('', { status: 500 });
  // The real gaps add up to thirteen seconds, which is the point of them; here they are instant.
  const realDelays = RETRY.delaysMs;
  beforeEach(() => { RETRY.delaysMs = [1, 1, 1, 1]; });
  afterEach(() => { RETRY.delaysMs = realDelays; });

  it('retries an empty 500, and carries the same requestId so the job cannot be queued twice', async () => {
    const graph = pipeline();
    const ex = new RemoteExecutor('k', graph, 'Static');
    await flush();
    release.shift()?.();
    calls.length = 0;
    vi.mocked(fetch).mockImplementationOnce(async (url, init) => {
      calls.push({ url: String(url), body: JSON.parse(String(init?.body)) as Record<string, unknown> });
      return emptyServerError();
    });
    vi.mocked(fetch).mockImplementationOnce(async (url, init) => {
      calls.push({ url: String(url), body: JSON.parse(String(init?.body)) as Record<string, unknown> });
      return new Response(JSON.stringify({ job: { id: 'j', key: 'k', kind: 'node', status: 'done', ok: true, createdAt: 0 } }), { status: 200, headers: { 'content-type': 'application/json' } });
    });
    const state = await Promise.race([ex.runNode('llm-provider'), new Promise<string>((r) => setTimeout(() => r('TIMEOUT'), 3000))]);
    expect(state).not.toBe('TIMEOUT');
    const jobs = calls.filter((c) => c.url === '/api/jobs');
    expect(jobs).toHaveLength(2);
    expect(jobs[0]!.body.requestId).toBeTruthy();
    expect(jobs[1]!.body.requestId).toBe(jobs[0]!.body.requestId);
  });

  it('keeps trying through a rebuild, then gives up with a code that says what happened', async () => {
    const graph = pipeline();
    const ex = new RemoteExecutor('k', graph, 'Static');
    await flush();
    release.shift()?.();
    let tries = 0;
    vi.mocked(fetch).mockImplementation(async () => { tries++; return emptyServerError(); });
    await expect(ex.runNode('llm-provider')).rejects.toMatchObject({ code: 'SERVER_NOT_READY' });
    // One try per gap, plus the first: a wedged server is not hammered for ever.
    expect(tries).toBe(RETRY.delaysMs.length + 1);
  });

  it('does not retry a refusal the route wrote itself', async () => {
    const graph = pipeline();
    const ex = new RemoteExecutor('k', graph, 'Static');
    await flush();
    release.shift()?.();
    calls.length = 0;
    vi.mocked(fetch).mockImplementation(async (url, init) => {
      calls.push({ url: String(url), body: JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown> });
      return new Response(JSON.stringify({ error: 'JOB_INVALID', message: 'nodeId is required' }), { status: 400, headers: { 'content-type': 'application/json' } });
    });
    await expect(ex.runNode('llm-provider')).rejects.toMatchObject({ code: 'JOB_INVALID' });
    expect(calls.filter((c) => c.url === '/api/jobs')).toHaveLength(1);
  });
});

describe('RemoteExecutor running state', () => {
  it('shows a workflow running when its tab comes back mid-run, until the job ends', async () => {
    vi.mocked(fetch).mockImplementation(async (url) => {
      calls.push({ url: String(url), body: {} });
      return new Response(JSON.stringify({ runtimes: {}, logs: [], running: true, pending: [{ id: 'queued', key: 'k', kind: 'run', status: 'pending', createdAt: 0 }], history: [] }), { status: 200, headers: { 'content-type': 'application/json' } });
    });
    const ex = new RemoteExecutor('other', pipeline(), 'Other');
    await flush();
    await ex.switchTo('k', pipeline(), 'Static');
    expect(ex.isRunning()).toBe(true);
    const es = FakeEventSource.instances.at(-1)!;
    const send = (job: object) => { for (const fn of es.listeners.get('job') ?? []) fn({ data: JSON.stringify({ job }) } as MessageEvent); };
    send({ id: 'first', key: 'k', kind: 'run', status: 'done', ok: true, createdAt: 0 });
    expect(ex.isRunning()).toBe(true);
    send({ id: 'queued', key: 'k', kind: 'run', status: 'running', createdAt: 0 });
    send({ id: 'queued', key: 'k', kind: 'run', status: 'done', ok: true, createdAt: 0 });
    expect(ex.isRunning()).toBe(false);
  });
});
