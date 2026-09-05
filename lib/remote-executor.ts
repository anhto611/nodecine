'use client';
import { GraphInvalidError, type Graph, type GraphIssue } from '@/core/engine/graph';
import type { ExecutorHooks } from '@/core/engine/executor';
import { LogBuffer, type LogEntry } from '@/core/engine/log';
import { initialRuntime, type NodeRuntime } from '@/core/engine/state';
import type { Job } from '@/server/jobs';

/**
 * The browser's view of an executor that runs on the server (ARCHITECTURE §1.2). It offers the
 * store the surface the in-browser executor had — runtimes, logs, run, runNode, probe, invalidate,
 * bypass, cancel — and behind it submits jobs, listens to the event stream and mirrors what comes
 * back. One instance follows the active tab: switching tabs switches the key it speaks for.
 */

type Snapshot = { runtimes: Record<string, NodeRuntime>; logs: LogEntry[]; running: boolean; pending: Job[] };

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const data = (await res.json().catch(() => ({}))) as T & { error?: string; message?: string; issues?: GraphIssue[] };
  if (!res.ok) {
    if (data.error === 'GRAPH_INVALID' && data.issues) throw new GraphInvalidError(data.issues);
    throw Object.assign(new Error(data.message ?? data.error ?? `${url} failed (${res.status})`), { code: data.error ?? 'JOB_FAILED' });
  }
  return data;
}

export class RemoteExecutor {
  readonly logs = new LogBuffer();
  private runtimes = new Map<string, NodeRuntime>();
  private graph: Graph;
  private key: string;
  private name: string;
  private source: EventSource | null = null;
  private waiting = new Map<string, (job: Job) => void>();
  private pushGraph: ReturnType<typeof setTimeout> | null = null;
  private runningJob: string | null = null;

  constructor(key: string, graph: Graph, name: string, private readonly hooks: ExecutorHooks = {}) {
    this.key = key;
    this.graph = graph;
    this.name = name;
    this.syncRuntimes();
    void this.attach();
  }

  // ---------- the surface the store uses ----------

  getGraph(): Graph {
    return this.graph;
  }

  runtime(nodeId: string): NodeRuntime {
    const node = this.graph.nodes.find((n) => n.id === nodeId);
    return this.runtimes.get(nodeId) ?? initialRuntime(node?.bypassed ?? false);
  }

  runtimes_(): ReadonlyMap<string, NodeRuntime> {
    return this.runtimes;
  }

  isRunning(): boolean {
    return this.runningJob !== null;
  }

  /** A graph edit: mirrored here at once, sent to the server a moment later. */
  setGraph(graph: Graph): void {
    this.graph = graph;
    this.syncRuntimes();
    if (this.pushGraph) clearTimeout(this.pushGraph);
    this.pushGraph = setTimeout(() => { void this.send({ action: 'graph', graph: this.graph, name: this.name }, false); }, 250);
  }

  setName(name: string): void {
    this.name = name;
  }

  /** Follow another tab: new key, new graph, new stream, state read back from the server. */
  async switchTo(key: string, graph: Graph, name: string): Promise<void> {
    this.key = key;
    this.graph = graph;
    this.name = name;
    this.runtimes.clear();
    this.syncRuntimes();
    this.logs.clear();
    await this.attach();
  }

  invalidate(nodeId: string): void {
    const rt = this.runtimes.get(nodeId);
    if (rt && (rt.state === 'success' || rt.state === 'blocked' || rt.state === 'cancelled')) this.setRuntime(nodeId, { ...rt, state: 'stale' });
    void this.send({ action: 'invalidate', nodeId }, false);
  }

  setBypassed(nodeId: string, bypassed: boolean): void {
    const rt = this.runtime(nodeId);
    this.setRuntime(nodeId, { ...rt, state: bypassed ? 'bypassed' : 'idle' });
    void this.send({ action: 'bypass', nodeId, bypassed }, false);
  }

  cancel(): void {
    void this.send({ action: 'cancel' }, false);
  }

  async run(opts: { force?: boolean } = {}): Promise<{ ok: boolean }> {
    const job = await this.submit('run', { force: opts.force });
    return { ok: job.ok === true };
  }

  async runNode(nodeId: string): Promise<string> {
    const job = await this.submit('node', { nodeId });
    return this.runtime(nodeId).state;
  }

  async probeResources(): Promise<void> {
    await this.submit('probe', {});
  }

  dispose(): void {
    this.source?.close();
    this.source = null;
  }

  // ---------- wire ----------

  private async submit(kind: 'run' | 'node' | 'probe', extra: { nodeId?: string; force?: boolean }): Promise<Job> {
    if (this.pushGraph) { clearTimeout(this.pushGraph); this.pushGraph = null; }
    const { job } = await postJson<{ job: Job }>('/api/jobs', { key: this.key, kind, graph: this.graph, name: this.name, ...extra });
    if (job.status === 'done' || job.status === 'failed' || job.status === 'cancelled') return job;
    return new Promise<Job>((resolve) => { this.waiting.set(job.id, resolve); });
  }

  private async send(body: unknown, quiet: boolean): Promise<void> {
    try {
      await postJson(`/api/executors/${encodeURIComponent(this.key)}`, body);
    } catch (e) {
      if (!quiet) this.logs.push({ ts: Date.now(), nodeId: 'server', level: 'warn', message: `could not reach the executor: ${e instanceof Error ? e.message : String(e)}` });
    }
  }

  private async attach(): Promise<void> {
    this.source?.close();
    const key = this.key;
    // Make sure the server has this graph, and take its state — a reload gets last run's results back.
    let snap: Snapshot | null = null;
    try {
      snap = await postJson<Snapshot>(`/api/executors/${encodeURIComponent(key)}`, { action: 'graph', graph: this.graph, name: this.name });
    } catch {
      snap = null;
    }
    if (this.key !== key) return;
    if (snap) {
      for (const [id, rt] of Object.entries(snap.runtimes)) this.setRuntime(id, rt);
      for (const entry of snap.logs.slice(-500)) this.logs.push(entry);
      this.runningJob = snap.running ? 'unknown' : null;
    }
    const es = new EventSource(`/api/jobs/events?key=${encodeURIComponent(key)}`);
    this.source = es;
    es.addEventListener('node', (m) => { const e = JSON.parse((m as MessageEvent).data) as { nodeId: string; runtime: NodeRuntime }; this.setRuntime(e.nodeId, e.runtime); });
    es.addEventListener('run:start', (m) => { const e = JSON.parse((m as MessageEvent).data) as { runId: number; stepTotal: number }; this.hooks.onRunStart?.(e); });
    es.addEventListener('run:step', (m) => { const e = JSON.parse((m as MessageEvent).data) as { nodeId: string; step: number; stepTotal: number }; this.hooks.onStep?.(e); });
    es.addEventListener('run:end', (m) => { const e = JSON.parse((m as MessageEvent).data) as { runId: number; ok: boolean; durationMs: number }; this.hooks.onRunEnd?.(e); });
    es.addEventListener('log', (m) => { const e = JSON.parse((m as MessageEvent).data) as { entry: LogEntry }; this.logs.push(e.entry); });
    es.addEventListener('job', (m) => {
      const { job } = JSON.parse((m as MessageEvent).data) as { job: Job };
      if (job.status === 'running') this.runningJob = job.id;
      if (job.status === 'done' || job.status === 'failed' || job.status === 'cancelled') {
        if (this.runningJob === job.id) this.runningJob = null;
        if (job.error && job.status === 'failed') this.logs.push({ ts: Date.now(), nodeId: 'run', level: 'error', code: job.error.code, message: job.error.message });
        this.waiting.get(job.id)?.(job);
        this.waiting.delete(job.id);
      }
    });
  }

  private setRuntime(nodeId: string, rt: NodeRuntime): void {
    this.runtimes.set(nodeId, rt);
    this.hooks.onStateChange?.(nodeId, rt);
  }

  private syncRuntimes(): void {
    const ids = new Set(this.graph.nodes.map((n) => n.id));
    for (const id of [...this.runtimes.keys()]) if (!ids.has(id)) this.runtimes.delete(id);
    for (const n of this.graph.nodes) if (!this.runtimes.has(n.id)) this.runtimes.set(n.id, initialRuntime(n.bypassed));
  }
}
