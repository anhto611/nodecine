import { mkdirSync, readdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { Executor } from '@/core/engine/executor';
import type { RunRecord } from '@/core/engine/history';
import type { VideoIR } from '@/core/types/ir';
import type { EngineRef } from '@/core/types/payloads';
import { GraphInvalidError, validateGraph, hasBlockingIssues, type Graph, type GraphIssue } from '@/core/engine/graph';
import { LogBuffer, type LogEntry } from '@/core/engine/log';
import type { NodeRuntime } from '@/core/engine/state';
import type { NodeServices } from '@/core/engine/services';
import { createServerServices } from './services.server';

/**
 * The graph executor lives on the server, behind a queue, the way ComfyUI's prompt queue does
 * (ARCHITECTURE §1.2). The browser edits a graph and submits jobs; one executor per workflow key
 * keeps that graph's runtimes and signature cache between jobs, so a second run re-uses what did not
 * change exactly as before. Jobs run one at a time in the order they arrived. Everything that
 * happens — node states, steps, logs, job status — goes out as events, and the browser mirrors them.
 *
 * Disk is the truth for jobs, the way cutdown keeps a `job.json` per job: every status change is
 * written to `.nodecine/jobs/<id>.json` (write-then-rename), a run that produced a video keeps its
 * IR and exports there, and a restart reads them all back — so the run history survives the
 * process, and a job the process died on comes back marked cancelled rather than forever running.
 */

export type JobKind = 'run' | 'node' | 'probe';
export type JobStatus = 'pending' | 'running' | 'done' | 'failed' | 'cancelled';

export interface Job {
  id: string;
  key: string;
  kind: JobKind;
  nodeId?: string;
  force?: boolean;
  status: JobStatus;
  createdAt: number;
  startedAt?: number;
  finishedAt?: number;
  ok?: boolean;
  error?: { code: string; message: string; issues?: GraphIssue[] };
  /** What a `run` produced, kept so the history outlives the process. */
  result?: { ir: VideoIR; engineId?: string; durationMs: number; exports: { fileName: string; bytes: number; outputUrl: string }[] };
}

export type HubEvent =
  | { type: 'node'; key: string; nodeId: string; runtime: NodeRuntime }
  | { type: 'run:start'; key: string; runId: number; stepTotal: number }
  | { type: 'run:step'; key: string; nodeId: string; step: number; stepTotal: number }
  | { type: 'run:end'; key: string; runId: number; ok: boolean; durationMs: number }
  | { type: 'log'; key: string; entry: LogEntry }
  | { type: 'job'; key: string; job: Job }
  | { type: 'history'; key: string; history: RunRecord[] }
  | { type: 'params'; key: string; nodeId: string; patch: Record<string, unknown> };

interface Slot {
  executor: Executor;
  logs: LogBuffer;
  name: string;
  running: boolean;
}

export interface JobSubmission {
  key: string;
  kind: JobKind;
  graph: Graph;
  name?: string;
  nodeId?: string;
  force?: boolean;
}

const KEY = /^[a-zA-Z0-9_-]{1,80}$/;
const MAX_JOB_FILES = 200;
const HISTORY_PER_KEY = 20;

export function jobsDir(): string {
  return path.resolve(process.cwd(), process.env.NODECINE_JOBS_DIR ?? '.nodecine/jobs');
}

/** History entries for a key, newest first, read off the run jobs that produced a video. */
function historyOf(jobs: Iterable<Job>, key: string): RunRecord[] {
  const runs = [...jobs].filter((j) => j.key === key && j.kind === 'run' && j.result).sort((a, b) => a.createdAt - b.createdAt);
  return runs.map((j, i) => ({ seq: i + 1, startedAt: j.startedAt ?? j.createdAt, durationMs: j.result!.durationMs, ir: j.result!.ir, engineId: j.result!.engineId, exports: j.result!.exports })).reverse().slice(0, HISTORY_PER_KEY);
}

export class JobHub {
  private slots = new Map<string, Slot>();
  private queue: Job[] = [];
  private jobs = new Map<string, Job>();
  private current: Job | null = null;
  private listeners = new Set<(e: HubEvent) => void>();
  private seq = 0;
  private pumping = false;
  /** The last run job per key, so an export that follows can be filed under it. */
  private lastRun = new Map<string, string>();

  constructor(private readonly servicesFor: (slot: () => Slot | undefined) => NodeServices = (slot) => createServerServices({ workflow: () => { const s = slot(); return s ? { name: s.name, graph: s.executor.getGraph() } : null; } })) {
    this.load();
  }

  // ---------- disk ----------

  private load(): void {
    const dir = jobsDir();
    mkdirSync(dir, { recursive: true });
    for (const name of readdirSync(dir)) {
      if (!name.endsWith('.json')) continue;
      try {
        const job = JSON.parse(readFileSync(path.join(dir, name), 'utf8')) as Job;
        if (!job.id || !job.key) continue;
        // The process that was running this is gone; say so instead of showing it running forever.
        if (job.status === 'pending' || job.status === 'running') {
          job.status = 'cancelled';
          job.finishedAt = job.finishedAt ?? Date.now();
          job.error = { code: 'RUN_CANCELLED', message: 'the server restarted while this job was in flight' };
          this.write(job);
        }
        this.jobs.set(job.id, job);
        if (job.kind === 'run' && job.result) {
          const prev = this.lastRun.get(job.key);
          if (!prev || (this.jobs.get(prev)?.createdAt ?? 0) < job.createdAt) this.lastRun.set(job.key, job.id);
        }
      } catch {
        /* a file caught mid-write or hand-edited is not a job */
      }
    }
    this.prune();
  }

  private write(job: Job): void {
    const dir = jobsDir();
    mkdirSync(dir, { recursive: true });
    const target = path.join(dir, `${job.id}.json`);
    const tmp = `${target}.${process.pid}.tmp`;
    writeFileSync(tmp, JSON.stringify(job), 'utf8');
    renameSync(tmp, target);
  }

  /** Keep the newest files; a finished job without a video is the first to go. */
  private prune(): void {
    const all = [...this.jobs.values()].sort((a, b) => b.createdAt - a.createdAt);
    for (const job of all.slice(MAX_JOB_FILES)) {
      this.jobs.delete(job.id);
      try { unlinkSync(path.join(jobsDir(), `${job.id}.json`)); } catch { /* already gone */ }
    }
  }

  history(key: string): RunRecord[] {
    return historyOf(this.jobs.values(), key);
  }

  subscribe(listener: (e: HubEvent) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(e: HubEvent): void {
    for (const l of this.listeners) {
      try { l(e); } catch { /* a dead listener must not stop the run */ }
    }
  }

  /** The executor for a key, created on first sight with the graph given. */
  slot(key: string, graph?: Graph, name?: string): Slot {
    if (!KEY.test(key)) throw Object.assign(new Error(`invalid executor key "${key}"`), { code: 'JOB_KEY_INVALID' });
    let slot = this.slots.get(key);
    if (!slot) {
      const logs = new LogBuffer();
      const holder: { slot?: Slot } = {};
      const executor = new Executor(graph ?? { nodes: [], edges: [] }, this.servicesFor(() => holder.slot), {
        onStateChange: (nodeId, runtime) => this.emit({ type: 'node', key, nodeId, runtime }),
        onParamsPatch: (nodeId, patch) => this.emit({ type: 'params', key, nodeId, patch }),
        onRunStart: (info) => this.emit({ type: 'run:start', key, ...info }),
        onStep: (info) => this.emit({ type: 'run:step', key, ...info }),
        onRunEnd: (info) => this.emit({ type: 'run:end', key, ...info }),
      }, logs);
      logs.subscribe((entry) => this.emit({ type: 'log', key, entry }));
      slot = { executor, logs, name: name ?? key, running: false };
      holder.slot = slot;
      this.slots.set(key, slot);
    } else if (graph) {
      slot.executor.setGraph(graph);
      if (name) slot.name = name;
    }
    return slot;
  }

  hasSlot(key: string): boolean {
    return this.slots.has(key);
  }

  snapshot(key: string): { runtimes: Record<string, NodeRuntime>; logs: readonly LogEntry[]; running: boolean; pending: Job[]; history: RunRecord[] } | null {
    const slot = this.slots.get(key);
    if (!slot) return null;
    const runtimes: Record<string, NodeRuntime> = {};
    for (const [id, rt] of slot.executor.runtimes_()) runtimes[id] = rt;
    return { runtimes, logs: slot.logs.all(), running: slot.running, pending: this.queue.filter((j) => j.key === key), history: this.history(key) };
  }

  /** Validates like ComfyUI's /prompt: a graph that cannot run is refused here, not queued. */
  submit(input: JobSubmission): Job {
    if (input.kind === 'run') {
      const issues = validateGraph(input.graph);
      if (hasBlockingIssues(issues)) throw new GraphInvalidError(issues.filter((i) => i.severity === 'error'));
    }
    if (input.kind === 'node' && !input.nodeId) throw Object.assign(new Error('nodeId is required'), { code: 'JOB_INVALID' });
    this.slot(input.key, input.graph, input.name);
    const job: Job = { id: `job-${Date.now().toString(36)}-${(this.seq++).toString(36)}`, key: input.key, kind: input.kind, nodeId: input.nodeId, force: input.force, status: 'pending', createdAt: Date.now() };
    this.jobs.set(job.id, job);
    this.queue.push(job);
    this.write(job);
    this.emit({ type: 'job', key: job.key, job: { ...job } });
    // Start on the next tick so the caller sees the job as queued, the way ComfyUI answers /prompt.
    queueMicrotask(() => void this.pump());
    return job;
  }

  get(id: string): Job | undefined {
    return this.jobs.get(id);
  }

  list(): Job[] {
    return [...this.jobs.values()].sort((a, b) => b.createdAt - a.createdAt).slice(0, 200);
  }

  /** Cancels a pending job outright, or interrupts the running one. */
  cancel(id: string): 'pending' | 'running' | 'terminal' | 'unknown' {
    const job = this.jobs.get(id);
    if (!job) return 'unknown';
    if (job.status === 'pending') {
      this.queue = this.queue.filter((j) => j.id !== id);
      job.status = 'cancelled';
      job.finishedAt = Date.now();
      this.write(job);
    this.emit({ type: 'job', key: job.key, job: { ...job } });
      return 'pending';
    }
    if (job.status === 'running') {
      this.slots.get(job.key)?.executor.cancel();
      return 'running';
    }
    return 'terminal';
  }

  /** Cancel whatever is running or pending for a key — the Stop button. */
  cancelKey(key: string): void {
    for (const j of [...this.queue]) if (j.key === key) this.cancel(j.id);
    if (this.current?.key === key) this.cancel(this.current.id);
  }

  /** Graph edits that must reach the executor immediately, between jobs. */
  invalidate(key: string, nodeId: string): void {
    this.slots.get(key)?.executor.invalidate(nodeId);
  }

  setBypassed(key: string, nodeId: string, bypassed: boolean): void {
    this.slots.get(key)?.executor.setBypassed(nodeId, bypassed);
  }

  private async pump(): Promise<void> {
    if (this.pumping) return;
    this.pumping = true;
    try {
      while (this.queue.length) {
        const job = this.queue.shift()!;
        const slot = this.slots.get(job.key)!;
        this.current = job;
        job.status = 'running';
        job.startedAt = Date.now();
        slot.running = true;
        this.write(job);
    this.emit({ type: 'job', key: job.key, job: { ...job } });
        try {
          if (job.kind === 'run') {
            const { ok } = await slot.executor.run({ force: job.force });
            job.ok = ok;
            this.recordRun(job, slot);
          } else if (job.kind === 'node') {
            const state = await slot.executor.runNode(job.nodeId!);
            job.ok = state === 'success';
            this.recordExport(job, slot);
          } else {
            await slot.executor.probeResources();
            job.ok = true;
          }
          job.status = job.ok === false && this.wasCancelled(slot) ? 'cancelled' : 'done';
        } catch (e) {
          const err = e as { code?: string; message?: string; issues?: GraphIssue[] };
          job.status = err.code === 'RUN_CANCELLED' ? 'cancelled' : 'failed';
          job.ok = false;
          job.error = { code: err.code ?? 'JOB_FAILED', message: err.message ?? String(e), ...(err.issues ? { issues: err.issues } : {}) };
        } finally {
          slot.running = false;
          job.finishedAt = Date.now();
          this.current = null;
          this.write(job);
    this.emit({ type: 'job', key: job.key, job: { ...job } });
        }
      }
    } finally {
      this.pumping = false;
    }
  }

  /** A run that reached an IR goes into the history, with the engine the player used. */
  private recordRun(job: Job, slot: Slot): void {
    const graph = slot.executor.getGraph();
    const asm = graph.nodes.find((n) => n.type === 'core/timeline-assembler');
    const ir = asm ? (slot.executor.runtime(asm.id).outputs.ir?.payload as VideoIR | undefined) : undefined;
    if (!ir) return;
    const out = graph.nodes.find((n) => n.type === 'core/video-output' && slot.executor.runtime(n.id).state === 'success');
    const engineEdge = out ? graph.edges.find((e) => e.target === out.id && e.targetPort === 'engine') : undefined;
    const engine = engineEdge ? (slot.executor.runtime(engineEdge.source).outputs[engineEdge.sourcePort]?.payload as EngineRef | undefined) : undefined;
    job.result = { ir, engineId: engine?.engineId, durationMs: Date.now() - (job.startedAt ?? job.createdAt), exports: [] };
    this.lastRun.set(job.key, job.id);
    this.emit({ type: 'history', key: job.key, history: this.history(job.key) });
  }

  /** An MP4 export files its result under the run it came from. */
  private recordExport(job: Job, slot: Slot): void {
    if (!job.ok || !job.nodeId) return;
    const node = slot.executor.getGraph().nodes.find((n) => n.id === job.nodeId);
    if (node?.type !== 'core/mp4-export') return;
    const result = slot.executor.runtime(job.nodeId).result as { fileName?: string; bytes?: number; outputUrl?: string } | undefined;
    const runId = this.lastRun.get(job.key);
    const run = runId ? this.jobs.get(runId) : undefined;
    if (!result?.outputUrl || !run?.result) return;
    run.result.exports = [...run.result.exports.filter((x) => x.outputUrl !== result.outputUrl), { fileName: result.fileName ?? 'video.mp4', bytes: result.bytes ?? 0, outputUrl: result.outputUrl }];
    this.write(run);
    this.emit({ type: 'history', key: job.key, history: this.history(job.key) });
  }

  private wasCancelled(slot: Slot): boolean {
    for (const rt of slot.executor.runtimes_().values()) if (rt.state === 'cancelled') return true;
    return false;
  }
}

/** One hub per process. Kept on globalThis so Next's dev reloads do not orphan a running queue. */
export function jobHub(): JobHub {
  const g = globalThis as unknown as { __nodecineJobHub?: JobHub };
  if (!g.__nodecineJobHub) g.__nodecineJobHub = new JobHub();
  return g.__nodecineJobHub;
}
