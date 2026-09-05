import { beforeEach, describe, expect, it } from 'vitest';
import { JobHub, type HubEvent } from '../jobs';
import { registerNodes } from '@/nodes';
import { _resetNodeRegistry } from '@/core/nodes/definition';
import { _resetCodeRenderers, registerCodeRenderer } from '@/core/look/renderers';
import { makeFakeServices } from '@/core/__tests__/fakes';
import staticScript from '@/templates/static-script.json';
import type { Graph } from '@/core/engine/graph';

const graph = () => structuredClone(staticScript.graph) as Graph;
async function until(pred: () => boolean, ms = 5000): Promise<void> {
  const t0 = Date.now();
  while (!pred()) {
    if (Date.now() - t0 > ms) throw new Error('timed out');
    await new Promise((r) => setTimeout(r, 5));
  }
}

describe('JobHub', () => {
  beforeEach(() => {
    _resetNodeRegistry();
    _resetCodeRenderers();
    registerNodes();
    registerCodeRenderer('html-gsap', 'hyperframes', () => null);
  });

  it('runs a submitted graph, streams node states and job status, and keeps the executor for the key', async () => {
    const hub = new JobHub(() => makeFakeServices());
    const events: HubEvent[] = [];
    hub.subscribe((e) => events.push(e));
    const job = hub.submit({ key: 'tab-1', kind: 'run', graph: graph(), name: 'Static' });
    expect(job.status).toBe('pending');
    await until(() => hub.get(job.id)?.status === 'done');
    expect(hub.get(job.id)?.ok).toBe(true);
    expect(events.some((e) => e.type === 'run:start')).toBe(true);
    expect(events.some((e) => e.type === 'node' && e.nodeId === 'assembler' && e.runtime.state === 'success')).toBe(true);
    expect(events.filter((e) => e.type === 'job').map((e) => (e as { job: { status: string } }).job.status)).toEqual(['pending', 'running', 'done']);
    const snap = hub.snapshot('tab-1')!;
    expect(snap.runtimes.assembler!.state).toBe('success');
    expect(snap.logs.length).toBeGreaterThan(0);
    // A second run on the same key reuses what did not change.
    const again = hub.submit({ key: 'tab-1', kind: 'run', graph: graph() });
    await until(() => hub.get(again.id)?.status === 'done');
    expect(hub.snapshot('tab-1')!.runtimes.assembler!.reused).toBe(true);
  });

  it('refuses a graph that cannot run, with its issues, instead of queueing it', () => {
    const hub = new JobHub(() => makeFakeServices());
    const g = graph();
    g.edges = g.edges.filter((e) => e.id !== 'e3');
    expect(() => hub.submit({ key: 'tab-2', kind: 'run', graph: g })).toThrow(/PROVIDER_NOT_CONNECTED|invalid/i);
    expect(() => hub.submit({ key: '../x', kind: 'probe', graph: g })).toThrow(/key/);
  });

  it('queues jobs one after another and drops a pending one on cancel', async () => {
    const hub = new JobHub(() => makeFakeServices({ secondsPerChar: 0.01 }));
    const a = hub.submit({ key: 'tab-3', kind: 'run', graph: graph() });
    const b = hub.submit({ key: 'tab-4', kind: 'run', graph: graph() });
    const c = hub.submit({ key: 'tab-5', kind: 'probe', graph: graph() });
    expect([a, b, c].map((j) => j.status)).toEqual(['pending', 'pending', 'pending']);
    expect(hub.cancel(c.id)).toBe('pending');
    expect(hub.get(c.id)?.status).toBe('cancelled');
    await until(() => hub.get(b.id)?.status === 'done');
    expect(hub.get(a.id)?.status).toBe('done');
    expect(hub.get(a.id)!.finishedAt!).toBeLessThanOrEqual(hub.get(b.id)!.startedAt!);
    expect(hub.cancel(a.id)).toBe('terminal');
  });

  it('runs one node on demand and probes resources', async () => {
    const hub = new JobHub(() => makeFakeServices());
    const probe = hub.submit({ key: 'tab-6', kind: 'probe', graph: graph() });
    await until(() => hub.get(probe.id)?.status === 'done');
    expect(hub.snapshot('tab-6')!.runtimes['tts-provider']!.state).toBe('success');
    const run = hub.submit({ key: 'tab-6', kind: 'run', graph: graph() });
    await until(() => hub.get(run.id)?.status === 'done');
    const exp = hub.submit({ key: 'tab-6', kind: 'node', graph: graph(), nodeId: 'export' });
    await until(() => hub.get(exp.id)?.status === 'done');
    expect(hub.get(exp.id)?.ok).toBe(true);
    expect(hub.snapshot('tab-6')!.runtimes.export!.state).toBe('success');
  });
});
