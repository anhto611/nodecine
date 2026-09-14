import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { JobHub, type HubEvent, type Job } from '../jobs';
import { _resetNodeRegistry } from '@/core/nodes/definition';
import type { Graph } from '@/core/engine/graph';
import { pipeline, registerTestKit, testServices } from '@/core/__tests__/kit';

const graph = () => pipeline();
async function until(pred: () => boolean, ms = 5000): Promise<void> {
  const t0 = Date.now();
  while (!pred()) {
    if (Date.now() - t0 > ms) throw new Error('timed out');
    await new Promise((r) => setTimeout(r, 5));
  }
}

describe('JobHub', () => {
  let dir: string;
  beforeEach(async () => {
    dir = await mkdtemp(path.join(os.tmpdir(), 'nodecine-jobs-'));
    process.env.NODECINE_JOBS_DIR = dir;
    _resetNodeRegistry();
    registerTestKit();
  });
  afterEach(async () => {
    delete process.env.NODECINE_JOBS_DIR;
    await rm(dir, { recursive: true, force: true });
  });

  it('runs a submitted graph, streams node states and job status, and keeps the executor for the key', async () => {
    const hub = new JobHub(() => testServices());
    const events: HubEvent[] = [];
    hub.subscribe((e) => events.push(e));
    const job = hub.submit({ key: 'tab-1', kind: 'run', graph: graph(), name: 'Static' });
    expect(job.status).toBe('pending');
    await until(() => hub.get(job.id)?.status === 'done');
    expect(hub.get(job.id)?.ok).toBe(true);
    expect(events.some((e) => e.type === 'run:start')).toBe(true);
    expect(events.some((e) => e.type === 'node' && e.nodeId === 'join' && e.runtime.state === 'success')).toBe(true);
    expect(events.filter((e) => e.type === 'job').map((e) => (e as { job: { status: string } }).job.status)).toEqual(['pending', 'running', 'done']);
    const snap = hub.snapshot('tab-1')!;
    expect(snap.runtimes.join!.state).toBe('success');
    expect(snap.logs.length).toBeGreaterThan(0);
    // A second run on the same key reuses what did not change.
    const again = hub.submit({ key: 'tab-1', kind: 'run', graph: graph() });
    await until(() => hub.get(again.id)?.status === 'done');
    expect(hub.snapshot('tab-1')!.runtimes.join!.reused).toBe(true);
  });

  it('refuses a graph that cannot run, with its issues, instead of queueing it', () => {
    const hub = new JobHub(() => testServices());
    const g = graph();
    g.edges.push({ id: 'cyc', source: 'join', sourcePort: 'out', target: 'source', targetPort: 'x' });
    expect(() => hub.submit({ key: 'tab-2', kind: 'run', graph: g })).toThrow(/GRAPH_PORT_UNCONNECTED|invalid/i);
    expect(() => hub.submit({ key: '../x', kind: 'run', graph: graph() })).toThrow(/key/);
  });

  it('queues jobs one after another and drops a pending one on cancel', async () => {
    const hub = new JobHub(() => testServices());
    const a = hub.submit({ key: 'tab-3', kind: 'run', graph: graph() });
    const b = hub.submit({ key: 'tab-4', kind: 'run', graph: graph() });
    const c = hub.submit({ key: 'tab-5', kind: 'run', graph: graph() });
    expect([a, b, c].map((j) => j.status)).toEqual(['pending', 'pending', 'pending']);
    expect(hub.cancel(c.id)).toBe('pending');
    expect(hub.get(c.id)?.status).toBe('cancelled');
    await until(() => hub.get(b.id)?.status === 'done');
    expect(hub.get(a.id)?.status).toBe('done');
    expect(hub.get(a.id)!.finishedAt!).toBeLessThanOrEqual(hub.get(b.id)!.startedAt!);
    expect(hub.cancel(a.id)).toBe('terminal');
  });

  it('runs one node on demand', async () => {
    const hub = new JobHub(() => testServices());
    const run = hub.submit({ key: 'tab-6', kind: 'run', graph: graph() });
    await until(() => hub.get(run.id)?.status === 'done');
    const exp = hub.submit({ key: 'tab-6', kind: 'node', graph: graph(), nodeId: 'export' });
    await until(() => hub.get(exp.id)?.status === 'done');
    expect(hub.get(exp.id)?.ok).toBe(true);
    expect(hub.snapshot('tab-6')!.runtimes.export!.state).toBe('success');
  });

  it('writes every job to disk and reads it all back after a restart', async () => {
    // What goes into the run history needs a node that carries a film; none ships today, so this
    // holds only the half that is the runtime's: the job files and reading them back.
    const hub = new JobHub(() => testServices());
    const job = hub.submit({ key: 'tab-1', kind: 'run', graph: graph(), name: 'Static' });
    await until(() => hub.get(job.id)?.status === 'done');
    const onDisk = JSON.parse(await readFile(path.join(dir, `${job.id}.json`), 'utf8')) as Job;
    expect(onDisk.status).toBe('done');
    const exp = hub.submit({ key: 'tab-1', kind: 'node', graph: graph(), name: 'Static', nodeId: 'export' });
    await until(() => hub.get(exp.id)?.status === 'done');
    expect(hub.get(exp.id)?.ok).toBe(true);

    // A new process reads the same directory, no executor needed.
    const again = new JobHub(() => testServices());
    expect(again.list().map((j) => j.id).sort()).toEqual([exp.id, job.id].sort());
    expect(again.get(job.id)?.status).toBe('done');
  });

  it('marks a job the previous process died on as cancelled, and ignores files that are not jobs', async () => {
    const stale: Job = { id: 'job-stale', key: 'tab-9', kind: 'run', name: 'Old', status: 'running', createdAt: 1, startedAt: 2 } as Job;
    await writeFile(path.join(dir, 'job-stale.json'), JSON.stringify(stale));
    await writeFile(path.join(dir, 'half-written.json'), '{"id": "job-x", ');
    await writeFile(path.join(dir, 'notes.txt'), 'not a job');
    const hub = new JobHub(() => testServices());
    const job = hub.get('job-stale')!;
    expect(job.status).toBe('cancelled');
    expect(job.error?.code).toBe('RUN_CANCELLED');
    expect(hub.list()).toHaveLength(1);
    const files = (await readdir(dir)).sort();
    expect(files).toEqual(['half-written.json', 'job-stale.json', 'notes.txt']);
    expect(JSON.parse(await readFile(path.join(dir, 'job-stale.json'), 'utf8')).status).toBe('cancelled');
  });
});

describe('JobHub on a cold process', () => {
  let dir: string;
  beforeEach(async () => {
    dir = await mkdtemp(path.join(os.tmpdir(), 'nodecine-jobs-cold-'));
    process.env.NODECINE_JOBS_DIR = dir;
    // Nothing registered: exactly what a freshly started server looks like before a request lands.
    _resetNodeRegistry();
  });
  afterEach(async () => {
    delete process.env.NODECINE_JOBS_DIR;
    await rm(dir, { recursive: true, force: true });
  });

  it('registers the node types before it reads a graph against them', () => {
    const hub = new JobHub(() => testServices());
    // Registration used to happen inside the executor's services, which are built after this
    // validation: the first submission a server ever saw called every node NODE_TYPE_UNKNOWN.
    const shipped: Graph = { nodes: [{ id: 'captions', type: 'core/caption-export', params: {}, bypassed: false, position: { x: 0, y: 0 } }], edges: [] };
    const job = hub.submit({ key: 'cold-1', kind: 'run', graph: shipped, name: 'Static' });
    expect(job.status).toBe('pending');
    hub.cancel(job.id);
  });
});
