'use client';
import { GraphInvalidError, type Graph, type GraphIssue } from '@/core/engine/graph';
import type { ExecutorHooks } from '@/core/engine/executor';
import type { RunRecord } from '@/core/engine/history';
import { LogBuffer, type LogEntry } from '@/core/engine/log';
import { initialRuntime, type NodeRuntime } from '@/core/engine/state';
import type { Job } from '@/server/jobs';

/**
 * The browser's view of an executor that runs on the server (ARCHITECTURE §1.2). It offers the
 * store the surface the in-browser executor had — runtimes, logs, run, runNode, probe, invalidate,
 * bypass, cancel — and behind it submits jobs, listens to the event stream and mirrors what comes
 * back. One instance follows the active tab: switching tabs switches the key it speaks for.
 */

type Snapshot = { runtimes: Record<string, NodeRuntime>; logs: LogEntry[]; running: boolean; pending: Job[]; history?: RunRecord[] };
export type RemoteHooks = ExecutorHooks & { onHistory?: (history: RunRecord[]) => void };

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} failed (${res.status})`);
  return (await res.json()) as T;
}

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
  /**
   * Every request to the server goes out in the order it was issued. Without this an invalidate sent
   * from a param edit could land after the single-node job that followed it, and mark the fresh
   * result stale again — which is what "switching provider does not reload" looked like.
   */
  private chain: Promise<void> = Promise.resolve();
  /**
   * Jobs the stream reported finished. A short job can finish before the POST that created it
   * returns, so its done event arrives before anyone waits for it; without this record that wait
   * never ends and the store stays "running" until a reload.
   */
  private finished = new Map<string, Job>();

  private inOrder<T>(fn: () => Promise<T>): Promise<T> {
    const next = this.chain.then(fn, fn);
    this.chain = next.then(() => undefined, () => undefined);
    return next;
  }

  constructor(key: string, graph: Graph, name: string, private readonly hooks: RemoteHooks = {}) {
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

  /** `graph` queues that graph instead of the one held here: one run of a batch, without editing the canvas. */
  async run(opts: { force?: boolean; graph?: Graph } = {}): Promise<{ ok: boolean }> {
    const job = await this.submit('run', { force: opts.force }, opts.graph);
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

  private async submit(kind: 'run' | 'node' | 'probe', extra: { nodeId?: string; force?: boolean }, graph?: Graph): Promise<Job> {
    if (this.pushGraph) { clearTimeout(this.pushGraph); this.pushGraph = null; }
    const { job } = await this.inOrder(() => postJson<{ job: Job }>('/api/jobs', { key: this.key, kind, graph: graph ?? this.graph, name: this.name, ...extra }));
    const early = this.finished.get(job.id);
    if (early) { this.finished.delete(job.id); return early; }
    if (job.status === 'done' || job.status === 'failed' || job.status === 'cancelled') return job;
    return new Promise<Job>((resolve) => {
      this.waiting.set(job.id, resolve);
      // Belt and braces: if the stream drops the event, ask the server directly now and then.
      const poll = setInterval(async () => {
        if (!this.waiting.has(job.id)) { clearInterval(poll); return; }
        try {
          const { job: now } = await getJson<{ job: Job }>(`/api/jobs/${encodeURIComponent(job.id)}`);
          if (now && (now.status === 'done' || now.status === 'failed' || now.status === 'cancelled')) { this.waiting.delete(job.id); clearInterval(poll); resolve(now); }
        } catch { /* next tick */ }
      }, 2000);
    });
  }

  private async send(body: unknown, quiet: boolean): Promise<void> {
    try {
      await this.inOrder(() => postJson(`/api/executors/${encodeURIComponent(this.key)}`, body));
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
      this.hooks.onHistory?.(snap.history ?? []);
    }
    const es = new EventSource(`/api/jobs/events?key=${encodeURIComponent(key)}`);
    this.source = es;
    es.addEventListener('node', (m) => { const e = JSON.parse((m as MessageEvent).data) as { nodeId: string; runtime: NodeRuntime }; this.setRuntime(e.nodeId, e.runtime); });
    es.addEventListener('run:start', (m) => { const e = JSON.parse((m as MessageEvent).data) as { runId: number; stepTotal: number }; this.hooks.onRunStart?.(e); });
    es.addEventListener('run:step', (m) => { const e = JSON.parse((m as MessageEvent).data) as { nodeId: string; step: number; stepTotal: number }; this.hooks.onStep?.(e); });
    es.addEventListener('run:end', (m) => { const e = JSON.parse((m as MessageEvent).data) as { runId: number; ok: boolean; durationMs: number }; this.hooks.onRunEnd?.(e); });
    es.addEventListener('history', (m) => { const e = JSON.parse((m as MessageEvent).data) as { history: RunRecord[] }; this.hooks.onHistory?.(e.history); });
    es.addEventListener('params', (m) => {
      const e = JSON.parse((m as MessageEvent).data) as { nodeId: string; patch: Record<string, unknown> };
      // Mirror it here first so the next graph push does not undo what the node just did.
      this.graph = { ...this.graph, nodes: this.graph.nodes.map((n) => (n.id === e.nodeId ? { ...n, params: { ...n.params, ...e.patch } } : n)) };
      this.hooks.onParamsPatch?.(e.nodeId, e.patch);
    });
    es.addEventListener('log', (m) => { const e = JSON.parse((m as MessageEvent).data) as { entry: LogEntry }; this.logs.push(e.entry); });
    es.addEventListener('job', (m) => {
      const { job } = JSON.parse((m as MessageEvent).data) as { job: Job };
      if (job.status === 'running') this.runningJob = job.id;
      if (job.status === 'done' || job.status === 'failed' || job.status === 'cancelled') {
        if (this.runningJob === job.id) this.runningJob = null;
        if (job.error && job.status === 'failed') this.logs.push({ ts: Date.now(), nodeId: 'run', level: 'error', code: job.error.code, message: job.error.message });
        const waiter = this.waiting.get(job.id);
        if (waiter) { waiter(job); this.waiting.delete(job.id); }
        else { this.finished.set(job.id, job); if (this.finished.size > 50) this.finished.delete(this.finished.keys().next().value!); }
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
