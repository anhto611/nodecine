import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { JobHub, type HubEvent, type Job, type JobRecorder } from '../jobs';
import { _resetNodeRegistry } from '@/core/nodes/definition';
import { pipeline, registerTestKit, testServices } from '@/core/__tests__/kit';
import { MemoryResultCache } from '@/core/engine/result-cache';
import { DiskResultCache } from '../result-cache';

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
    const hub = new JobHub(() => testServices(), { cache: new MemoryResultCache() });
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
    const hub = new JobHub(() => testServices(), { cache: new MemoryResultCache() });
    const g = graph();
    g.edges.push({ id: 'cyc', source: 'join', sourcePort: 'out', target: 'source', targetPort: 'x' });
    expect(() => hub.submit({ key: 'tab-2', kind: 'run', graph: g })).toThrow(/GRAPH_PORT_UNCONNECTED|invalid/i);
    expect(() => hub.submit({ key: '../x', kind: 'run', graph: graph() })).toThrow(/key/);
  });

  it('runs one workflow\'s jobs one after another, and drops a pending one on cancel', async () => {
    const hub = new JobHub(() => testServices(), { cache: new MemoryResultCache() });
    const a = hub.submit({ key: 'tab-3', kind: 'run', graph: graph() });
    const b = hub.submit({ key: 'tab-3', kind: 'run', graph: graph(), force: true });
    const c = hub.submit({ key: 'tab-3', kind: 'run', graph: graph() });
    expect([a, b, c].map((j) => j.status)).toEqual(['pending', 'pending', 'pending']);
    expect(hub.cancel(c.id)).toBe('pending');
    expect(hub.get(c.id)?.status).toBe('cancelled');
    await until(() => hub.get(b.id)?.status === 'done');
    expect(hub.get(a.id)?.status).toBe('done');
    expect(hub.get(a.id)!.finishedAt!).toBeLessThanOrEqual(hub.get(b.id)!.startedAt!);
    expect(hub.cancel(a.id)).toBe('terminal');
  });

  it('runs different workflows side by side, never more at once than it is allowed', async () => {
    // Each voice takes a while, so jobs that run together overlap and jobs that queue do not.
    const slow = () => { const s = testServices(); s.delay('voice', 40); return s; };
    const spans = (hub: JobHub, ids: string[]) => ids.map((id) => hub.get(id)!).map((j) => [j.startedAt!, j.finishedAt!] as const);
    const overlap = ([a0, a1]: readonly [number, number], [b0, b1]: readonly [number, number]) => a0 < b1 && b0 < a1;

    const wide = new JobHub(slow, { cache: new MemoryResultCache(), maxJobs: 2 });
    const x = wide.submit({ key: 'wf-x', kind: 'run', graph: graph() });
    const y = wide.submit({ key: 'wf-y', kind: 'run', graph: graph() });
    await until(() => [x, y].every((j) => wide.get(j.id)?.status === 'done'));
    const [sx, sy] = spans(wide, [x.id, y.id]);
    expect(overlap(sx!, sy!), 'two workflows waited for each other').toBe(true);

    const narrow = new JobHub(slow, { cache: new MemoryResultCache(), maxJobs: 1 });
    const p = narrow.submit({ key: 'wf-p', kind: 'run', graph: graph() });
    const q = narrow.submit({ key: 'wf-q', kind: 'run', graph: graph() });
    await until(() => [p, q].every((j) => narrow.get(j.id)?.status === 'done'));
    const [sp, sq] = spans(narrow, [p.id, q.id]);
    expect(overlap(sp!, sq!), 'ran more workflows at once than allowed').toBe(false);
  });

  it('reuses results a previous process kept on disk', async () => {
    const cacheDir = await mkdtemp(path.join(os.tmpdir(), 'nodecine-results-'));
    try {
      const first = testServices();
      const hub = new JobHub(() => first, { cache: new DiskResultCache(() => cacheDir) });
      const job = hub.submit({ key: 'tab-r', kind: 'run', graph: graph() });
      await until(() => hub.get(job.id)?.status === 'done');
      expect(first.calls.filter((c) => c.name === 'voice')).toHaveLength(1);

      // A restarted server: a new hub, new executors, nothing in memory — the same directory.
      const second = testServices();
      const again = new JobHub(() => second, { cache: new DiskResultCache(() => cacheDir) });
      const rerun = again.submit({ key: 'tab-r', kind: 'run', graph: graph() });
      await until(() => again.get(rerun.id)?.status === 'done');
      expect(second.calls.filter((c) => c.name === 'voice')).toHaveLength(0);
      expect(again.snapshot('tab-r')!.runtimes.voice!.reused).toBe(true);
    } finally {
      await rm(cacheDir, { recursive: true, force: true });
    }
  });

  it('runs one node on demand', async () => {
    const hub = new JobHub(() => testServices(), { cache: new MemoryResultCache() });
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
    const hub = new JobHub(() => testServices(), { cache: new MemoryResultCache() });
    const job = hub.submit({ key: 'tab-1', kind: 'run', graph: graph(), name: 'Static' });
    await until(() => hub.get(job.id)?.status === 'done');
    const onDisk = JSON.parse(await readFile(path.join(dir, `${job.id}.json`), 'utf8')) as Job;
    expect(onDisk.status).toBe('done');
    const exp = hub.submit({ key: 'tab-1', kind: 'node', graph: graph(), name: 'Static', nodeId: 'export' });
    await until(() => hub.get(exp.id)?.status === 'done');
    expect(hub.get(exp.id)?.ok).toBe(true);

    // A new process reads the same directory, no executor needed.
    const again = new JobHub(() => testServices(), { cache: new MemoryResultCache() });
    expect(again.list().map((j) => j.id).sort()).toEqual([exp.id, job.id].sort());
    expect(again.get(job.id)?.status).toBe('done');
  });

  it('keeps what its recorder says a run and a node leave behind, and reads it back after a restart', async () => {
    // A recorder that keeps the joined text of a run and files every export under it: the shape of
    // the film history, without a film.
    const recorder: JobRecorder = {
      run: (_job, ex) => { const text = (ex.runtime('join').outputs.out?.payload as { text?: string } | undefined)?.text; return text ? { text, exports: [] as string[] } : undefined; },
      node: (job, ex, last) => {
        const kept = last?.result as { exports: string[] } | undefined;
        const file = ex.runtime(job.nodeId!).result as { fileName?: string } | undefined;
        if (!kept || !file?.fileName) return false;
        kept.exports.push(file.fileName);
        return true;
      },
      load: (result) => ((result as { text?: unknown }).text === 'stale' ? undefined : result),
      history: (jobs, key) => jobs.filter((j) => j.key === key && j.result).map((j) => j.result),
    };
    const events: HubEvent[] = [];
    const hub = new JobHub(() => testServices(), { cache: new MemoryResultCache(), recorder });
    hub.subscribe((e) => events.push(e));
    const run = hub.submit({ key: 'tab-h', kind: 'run', graph: graph() });
    await until(() => hub.get(run.id)?.status === 'done');
    const exp = hub.submit({ key: 'tab-h', kind: 'node', graph: graph(), nodeId: 'export' });
    await until(() => hub.get(exp.id)?.status === 'done');
    expect(hub.history('tab-h')).toEqual([{ text: 'hello@1', exports: ['film.mp4'] }]);
    expect(events.filter((e) => e.type === 'history')).toHaveLength(2);

    // A result the recorder no longer reads is dropped as it comes off disk; one it reads survives.
    await writeFile(path.join(dir, 'job-old.json'), JSON.stringify({ id: 'job-old', key: 'tab-h', kind: 'run', status: 'done', createdAt: 1, result: { text: 'stale' } }));
    const again = new JobHub(() => testServices(), { cache: new MemoryResultCache(), recorder });
    expect(again.history('tab-h')).toEqual([{ text: 'hello@1', exports: ['film.mp4'] }]);
    expect(again.get('job-old')?.result).toBeUndefined();
  });

  it('marks a job the previous process died on as cancelled, and ignores files that are not jobs', async () => {
    const stale: Job = { id: 'job-stale', key: 'tab-9', kind: 'run', name: 'Old', status: 'running', createdAt: 1, startedAt: 2 } as Job;
    await writeFile(path.join(dir, 'job-stale.json'), JSON.stringify(stale));
    await writeFile(path.join(dir, 'half-written.json'), '{"id": "job-x", ');
    await writeFile(path.join(dir, 'notes.txt'), 'not a job');
    const hub = new JobHub(() => testServices(), { cache: new MemoryResultCache() });
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

  it('prepares the registries before it reads a graph against them', () => {
    // Registration used to happen inside the executor's services, which are built after this
    // validation: the first submission a server ever saw called every node NODE_TYPE_UNKNOWN.
    const hub = new JobHub(() => testServices(), { cache: new MemoryResultCache(), prepare: registerTestKit });
    const job = hub.submit({ key: 'cold-1', kind: 'run', graph: graph(), name: 'Static' });
    expect(job.status).toBe('pending');
    hub.cancel(job.id);
  });
});
