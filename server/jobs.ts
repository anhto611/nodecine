import { mkdirSync, readdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { Executor, type ExecutorOptions } from '@/core/engine/executor';
import { GraphInvalidError, validateGraph, hasBlockingIssues, type Graph, type GraphIssue } from '@/core/engine/graph';
import { LogBuffer, type LogEntry } from '@/core/engine/log';
import type { NodeRuntime } from '@/core/engine/state';
import type { NodeServices } from '@/core/engine/services';
import { DiskResultCache } from './result-cache';

/**
 * The graph executor lives on the server, behind a queue, the way ComfyUI's prompt queue does.
 * The browser edits a graph and submits jobs; one executor per workflow key
 * keeps that graph's runtimes between jobs, and every executor shares one store of results kept by
 * signature, on disk, so a second run — or a run after a restart — re-uses what did not change.
 *
 * Each workflow has its own line: two jobs of one workflow run in the order they arrived, because
 * they share an executor, while different workflows run side by side, up to `maxJobs` at once. One
 * queue for the whole server made a caption export wait behind another workflow's render. Everything
 * that happens — node states, steps, logs, job status — goes out as events, and the browser mirrors them.
 *
 * Disk is the truth for jobs, the way cutdown keeps a `job.json` per job: every status change is
 * written to `.nodecine/jobs/<id>.json` (write-then-rename), and a restart reads them all back — so
 * a job the process died on comes back marked cancelled rather than forever running.
 *
 * The hub knows nothing of what a run makes. What a finished job keeps — a film and its exports, for
 * the history panel — is the `JobRecorder`'s business, given by whoever builds the hub
 * (`server/contracts/hub.ts`).
 */

export type JobKind = 'run' | 'node';
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
  /** What a `run` produced, as the recorder kept it, so the history outlives the process. */
  result?: unknown;
}

/**
 * What a finished job leaves behind beyond its status (the run history). The hub calls it and writes
 * whatever it says to disk with the job; it never looks inside.
 */
export interface JobRecorder {
  /** A run ended: what to keep on the job, or nothing. */
  run(job: Job, executor: Executor): unknown | undefined;
  /** A single node ended: amend the result of the last run of the same workflow; true if it changed. */
  node(job: Job, executor: Executor, lastRun: Job | undefined): boolean;
  /** A result read back from disk: brought forward to this build, or nothing to drop it. */
  load(result: unknown): unknown | undefined;
  /** The history a workflow's panel lists, from its jobs. */
  history(jobs: Job[], key: string): unknown[];
}

export type HubEvent =
  | { type: 'node'; key: string; nodeId: string; runtime: NodeRuntime }
  | { type: 'run:start'; key: string; runId: number; stepTotal: number }
  | { type: 'run:step'; key: string; nodeId: string; step: number; stepTotal: number }
  | { type: 'run:end'; key: string; runId: number; ok: boolean; durationMs: number }
  | { type: 'log'; key: string; entry: LogEntry }
  | { type: 'job'; key: string; job: Job }
  | { type: 'history'; key: string; history: unknown[] }
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
  /**
   * The browser's id for this submission, so submitting it twice queues it once.
   *
   * The client retries a request the server answered with an empty 5xx — in development that is a
   * route being rebuilt, and the handler never ran. "Never ran" is a guess, though, and guessing
   * wrong on a submit means two renders of the same film. With this it cannot: the second arrival
   * gets back the job the first one made.
   */
  requestId?: string;
}

export interface HubOptions {
  /** Where results are kept by signature. On disk under `.nodecine/cache/results` by default. */
  cache?: ExecutorOptions['cache'];
  /** The fingerprint of a node type's code, when the host can measure it. */
  fingerprint?: ExecutorOptions['fingerprint'];
  /** How many workflows may run a job at the same time. `NODECINE_MAX_PARALLEL_JOBS`, else 2. */
  maxJobs?: number;
  /** What a finished job keeps. Nothing but its status when absent. */
  recorder?: JobRecorder;
  /**
   * Fill the registries a graph is read against — node types, port types, engines. Called before
   * every submission is validated and every executor is built, not once: see `server/contracts/register.ts`.
   */
  prepare?: () => void;
}

const KEY = /^[a-zA-Z0-9_-]{1,80}$/;
const MAX_JOB_FILES = 200;

export function jobsDir(): string {
  return path.resolve(process.cwd(), process.env.NODECINE_JOBS_DIR ?? '.nodecine/jobs');
}

export class JobHub {
  private slots = new Map<string, Slot>();
  private queue: Job[] = [];
  private jobs = new Map<string, Job>();
  /** The job each workflow is running now; a workflow runs one at a time. */
  private active = new Map<string, Job>();
  private listeners = new Set<(e: HubEvent) => void>();
  private seq = 0;
  private readonly cache: NonNullable<ExecutorOptions['cache']>;
  private readonly fingerprint: ExecutorOptions['fingerprint'];
  private readonly maxJobs: number;
  private readonly recorder: JobRecorder | undefined;
  private readonly prepare: () => void;
  /** The last run job per key, so an export that follows can be filed under it. */
  private lastRun = new Map<string, string>();
  /** Submissions already accepted, by the browser's request id: a retry must not queue a second job. */
  private byRequest = new Map<string, string>();
  /** A queued job owns the graph it was submitted with, independent of later edits or submissions. */
  private submissions = new Map<string, { graph: Graph; name: string }>();

  constructor(
    /** The services a workflow's nodes are given; `slot` is that workflow, read when a service needs it. */
    private readonly servicesFor: (slot: () => { name: string; graph: Graph } | null) => NodeServices,
    options: HubOptions = {},
  ) {
    this.recorder = options.recorder;
    this.prepare = options.prepare ?? (() => {});
    this.cache = options.cache ?? new DiskResultCache();
    this.fingerprint = options.fingerprint;
    this.maxJobs = Math.max(1, Math.floor(options.maxJobs ?? (Number(process.env.NODECINE_MAX_PARALLEL_JOBS) || 2)));
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
        // A result recorded by an older build is brought forward here, once, as it comes off disk;
        // one this build cannot read is dropped rather than left to break the panel that lists it.
        if (job.result !== undefined) {
          let kept: unknown;
          try { kept = this.recorder ? this.recorder.load(job.result) : undefined; } catch { kept = undefined; }
          if (kept === undefined) delete job.result; else job.result = kept;
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

  /** Keep the newest files. Runs on every submission, so a session that never restarts stays bounded. */
  private prune(): void {
    const all = [...this.jobs.values()].sort((a, b) => b.createdAt - a.createdAt);
    const gone = new Set<string>();
    for (const job of all.slice(MAX_JOB_FILES)) {
      this.jobs.delete(job.id);
      gone.add(job.id);
      try { unlinkSync(path.join(jobsDir(), `${job.id}.json`)); } catch { /* already gone */ }
    }
    // The request ids of jobs that are gone point at nothing; dropping them keeps that map as small
    // as the queue it speaks for, instead of growing for as long as the process lives.
    if (gone.size) for (const [requestId, jobId] of this.byRequest) if (gone.has(jobId)) this.byRequest.delete(requestId);
  }

  history(key: string): unknown[] {
    return this.recorder ? this.recorder.history([...this.jobs.values()], key) : [];
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
    this.prepare();
    if (!KEY.test(key)) throw Object.assign(new Error(`invalid executor key "${key}"`), { code: 'JOB_KEY_INVALID' });
    let slot = this.slots.get(key);
    if (!slot) {
      const logs = new LogBuffer();
      const holder: { slot?: Slot } = {};
      const executor = new Executor(graph ?? { nodes: [], edges: [] }, this.servicesFor(() => (holder.slot ? { name: holder.slot.name, graph: holder.slot.executor.getGraph() } : null)), {
        onStateChange: (nodeId, runtime) => this.emit({ type: 'node', key, nodeId, runtime }),
        onParamsPatch: (nodeId, patch) => this.emit({ type: 'params', key, nodeId, patch }),
        onRunStart: (info) => this.emit({ type: 'run:start', key, ...info }),
        onStep: (info) => this.emit({ type: 'run:step', key, ...info }),
        onRunEnd: (info) => this.emit({ type: 'run:end', key, ...info }),
      }, logs, { cache: this.cache, fingerprint: this.fingerprint });
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

  snapshot(key: string): { runtimes: Record<string, NodeRuntime>; logs: readonly LogEntry[]; running: boolean; pending: Job[]; history: unknown[] } | null {
    const slot = this.slots.get(key);
    if (!slot) return null;
    const runtimes: Record<string, NodeRuntime> = {};
    for (const [id, rt] of slot.executor.runtimes_()) runtimes[id] = rt;
    return { runtimes, logs: slot.logs.all(), running: slot.running, pending: this.queue.filter((j) => j.key === key), history: this.history(key) };
  }

  /** Validates like ComfyUI's /prompt: a graph that cannot run is refused here, not queued. */
  submit(input: JobSubmission): Job {
    // Before the graph is read against the node registry, not after: validating first and
    // registering later (inside the executor's services) meant a cold process could answer the very
    // first submission with every node reported NODE_TYPE_UNKNOWN.
    this.prepare();
    if (input.kind === 'run') {
      const issues = validateGraph(input.graph);
      if (hasBlockingIssues(issues)) throw new GraphInvalidError(issues.filter((i) => i.severity === 'error'));
    }
    if (input.kind === 'node' && !input.nodeId) throw Object.assign(new Error('nodeId is required'), { code: 'JOB_INVALID' });
    const seen = input.requestId ? this.jobs.get(this.byRequest.get(input.requestId) ?? '') : undefined;
    if (seen) return seen;
    this.slot(input.key);
    const job: Job = { id: `job-${Date.now().toString(36)}-${(this.seq++).toString(36)}`, key: input.key, kind: input.kind, nodeId: input.nodeId, force: input.force, status: 'pending', createdAt: Date.now() };
    this.submissions.set(job.id, { graph: structuredClone(input.graph), name: input.name ?? input.key });
    this.jobs.set(job.id, job);
    if (input.requestId) this.byRequest.set(input.requestId, job.id);
    this.queue.push(job);
    this.write(job);
    this.prune();
    this.emit({ type: 'job', key: job.key, job: { ...job } });
    // Start on the next tick so the caller sees the job as queued, the way ComfyUI answers /prompt.
    queueMicrotask(() => this.pump());
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
      this.submissions.delete(id);
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
    const running = this.active.get(key);
    if (running) this.cancel(running.id);
  }

  /** Graph edits that must reach the executor immediately, between jobs. */
  invalidate(key: string, nodeId: string): void {
    this.slots.get(key)?.executor.invalidate(nodeId);
  }

  setBypassed(key: string, nodeId: string, bypassed: boolean): void {
    this.slots.get(key)?.executor.setBypassed(nodeId, bypassed);
  }

  /**
   * Start every job that may start: the oldest pending job of each workflow that is not already
   * running one, while fewer than `maxJobs` workflows are busy. Called whenever a job arrives or ends.
   */
  private pump(): void {
    for (const job of [...this.queue]) {
      if (this.active.size >= this.maxJobs) return;
      if (this.active.has(job.key)) continue;
      this.queue = this.queue.filter((j) => j !== job);
      this.active.set(job.key, job);
      void this.execute(job).finally(() => {
        this.active.delete(job.key);
        this.pump();
      });
    }
  }

  private async execute(job: Job): Promise<void> {
    const slot = this.slots.get(job.key)!;
    const submission = this.submissions.get(job.id)!;
    slot.executor.setGraph(submission.graph);
    slot.name = submission.name;
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
      } else {
        const state = await slot.executor.runNode(job.nodeId!);
        job.ok = state === 'success';
        this.recordNode(job, slot);
      }
      job.status = job.ok === false && this.wasCancelled(slot) ? 'cancelled' : 'done';
    } catch (e) {
      const err = e as { code?: string; message?: string; issues?: GraphIssue[] };
      job.status = err.code === 'RUN_CANCELLED' ? 'cancelled' : 'failed';
      job.ok = false;
      job.error = { code: err.code ?? 'JOB_FAILED', message: err.message ?? String(e), ...(err.issues ? { issues: err.issues } : {}) };
    } finally {
      this.submissions.delete(job.id);
      slot.running = false;
      job.finishedAt = Date.now();
      this.write(job);
      this.emit({ type: 'job', key: job.key, job: { ...job } });
    }
  }

  /** A run that the recorder keeps something of goes into the history. */
  private recordRun(job: Job, slot: Slot): void {
    const kept = this.recorder?.run(job, slot.executor);
    if (kept === undefined) return;
    job.result = kept;
    this.lastRun.set(job.key, job.id);
    this.emit({ type: 'history', key: job.key, history: this.history(job.key) });
  }

  /** A single node may add to the run it followed — an export filed under its film. */
  private recordNode(job: Job, slot: Slot): void {
    if (!this.recorder) return;
    const runId = this.lastRun.get(job.key);
    const run = runId ? this.jobs.get(runId) : undefined;
    if (!this.recorder.node(job, slot.executor, run) || !run) return;
    this.write(run);
    this.emit({ type: 'history', key: job.key, history: this.history(job.key) });
  }

  private wasCancelled(slot: Slot): boolean {
    for (const rt of slot.executor.runtimes_().values()) if (rt.state === 'cancelled') return true;
    return false;
  }
}
