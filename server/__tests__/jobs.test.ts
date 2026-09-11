import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { JobHub, type HubEvent, type Job } from '../jobs';
import { registerNodes } from '@/nodes';
import { _resetNodeRegistry } from '@/core/nodes/definition';
import { registerFakeEngineSupport, resetEngineSupport } from '@/core/__tests__/fakes';
import { makeFakeServices } from '@/core/__tests__/fakes';
import staticScript from '@/lib/first-run.json';
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
  let dir: string;
  beforeEach(async () => {
    dir = await mkdtemp(path.join(os.tmpdir(), 'nodecine-jobs-'));
    process.env.NODECINE_JOBS_DIR = dir;
    _resetNodeRegistry();
    resetEngineSupport();
    registerNodes();
    registerFakeEngineSupport();
  });
  afterEach(async () => {
    delete process.env.NODECINE_JOBS_DIR;
    await rm(dir, { recursive: true, force: true });
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

  it('writes every job to disk, keeps the run in the history, and reads it all back after a restart', async () => {
    const hub = new JobHub(() => makeFakeServices());
    const events: HubEvent[] = [];
    hub.subscribe((e) => events.push(e));
    const job = hub.submit({ key: 'tab-1', kind: 'run', graph: graph(), name: 'Static' });
    await until(() => hub.get(job.id)?.status === 'done');
    const onDisk = JSON.parse(await readFile(path.join(dir, `${job.id}.json`), 'utf8')) as Job;
    expect(onDisk.status).toBe('done');
    expect(onDisk.result?.ir.beats.length).toBeGreaterThan(0);
    expect(onDisk.result?.engineId).toBe('hyperframes');
    expect(events.some((e) => e.type === 'history' && e.history.length === 1)).toBe(true);
    expect(hub.snapshot('tab-1')!.history[0]!.seq).toBe(1);

    // An export that follows is filed under that run.
    const exp = hub.submit({ key: 'tab-1', kind: 'node', graph: graph(), name: 'Static', nodeId: 'export' });
    await until(() => hub.get(exp.id)?.status === 'done');
    expect(hub.get(exp.id)?.ok).toBe(true);
    expect(hub.history('tab-1')[0]!.exports).toEqual([expect.objectContaining({ fileName: expect.any(String), outputUrl: expect.stringMatching(/^\/api\/media\//) })]);

    // A new process reads the same directory: the history is still there, no executor needed.
    const again = new JobHub(() => makeFakeServices());
    expect(again.list().map((j) => j.id).sort()).toEqual([exp.id, job.id].sort());
    expect(again.history('tab-1')).toHaveLength(1);
    expect(again.history('tab-1')[0]!.exports).toHaveLength(1);
    expect(again.history('tab-1')[0]!.ir).toEqual(onDisk.result!.ir);
  });

  it('marks a job the previous process died on as cancelled, and ignores files that are not jobs', async () => {
    const stale: Job = { id: 'job-stale', key: 'tab-9', kind: 'run', name: 'Old', status: 'running', createdAt: 1, startedAt: 2 } as Job;
    await writeFile(path.join(dir, 'job-stale.json'), JSON.stringify(stale));
    await writeFile(path.join(dir, 'half-written.json'), '{"id": "job-x", ');
    await writeFile(path.join(dir, 'notes.txt'), 'not a job');
    const hub = new JobHub(() => makeFakeServices());
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
    resetEngineSupport();
  });
  afterEach(async () => {
    delete process.env.NODECINE_JOBS_DIR;
    await rm(dir, { recursive: true, force: true });
  });

  it('registers the node types before it reads a graph against them', () => {
    const hub = new JobHub(() => makeFakeServices());
    // Registration used to happen inside the executor's services, which are built after this
    // validation: the first submission a server ever saw called every node NODE_TYPE_UNKNOWN.
    const job = hub.submit({ key: 'cold-1', kind: 'run', graph: graph(), name: 'Static' });
    expect(job.status).toBe('pending');
    hub.cancel(job.id);
  });
});
