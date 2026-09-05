import { Executor } from '@/core/engine/executor';
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
}

export type HubEvent =
  | { type: 'node'; key: string; nodeId: string; runtime: NodeRuntime }
  | { type: 'run:start'; key: string; runId: number; stepTotal: number }
  | { type: 'run:step'; key: string; nodeId: string; step: number; stepTotal: number }
  | { type: 'run:end'; key: string; runId: number; ok: boolean; durationMs: number }
  | { type: 'log'; key: string; entry: LogEntry }
  | { type: 'job'; key: string; job: Job };

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

export class JobHub {
  private slots = new Map<string, Slot>();
  private queue: Job[] = [];
  private jobs = new Map<string, Job>();
  private current: Job | null = null;
  private listeners = new Set<(e: HubEvent) => void>();
  private seq = 0;
  private pumping = false;

  constructor(private readonly servicesFor: (slot: () => Slot | undefined) => NodeServices = (slot) => createServerServices({ workflow: () => { const s = slot(); return s ? { name: s.name, graph: s.executor.getGraph() } : null; } })) {}

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

  snapshot(key: string): { runtimes: Record<string, NodeRuntime>; logs: readonly LogEntry[]; running: boolean; pending: Job[] } | null {
    const slot = this.slots.get(key);
    if (!slot) return null;
    const runtimes: Record<string, NodeRuntime> = {};
    for (const [id, rt] of slot.executor.runtimes_()) runtimes[id] = rt;
    return { runtimes, logs: slot.logs.all(), running: slot.running, pending: this.queue.filter((j) => j.key === key) };
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
        this.emit({ type: 'job', key: job.key, job: { ...job } });
        try {
          if (job.kind === 'run') {
            const { ok } = await slot.executor.run({ force: job.force });
            job.ok = ok;
          } else if (job.kind === 'node') {
            const state = await slot.executor.runNode(job.nodeId!);
            job.ok = state === 'success';
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
          this.emit({ type: 'job', key: job.key, job: { ...job } });
        }
      }
    } finally {
      this.pumping = false;
    }
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
