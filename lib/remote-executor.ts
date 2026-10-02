'use client';
import { GraphInvalidError, type Graph, type GraphIssue } from '@/core/engine/graph';
import type { ExecutorHooks } from '@/core/engine/executor';
import type { RunRecord } from '@/contracts/history';
import { LogBuffer, type LogEntry } from '@/core/engine/log';
import { initialRuntime, type NodeRuntime } from '@/core/engine/state';
import type { Job } from '@/server/jobs';

/**
 * The browser's view of an executor that runs on the server. It offers the
 * store the surface the in-browser executor had — runtimes, logs, run, runNode, invalidate,
 * bypass, cancel — and behind it submits jobs, listens to the event stream and mirrors what comes
 * back. One instance follows the active tab: switching tabs switches the key it speaks for.
 */

type Snapshot = { runtimes: Record<string, NodeRuntime>; logs: LogEntry[]; running: boolean; pending: Job[]; history?: RunRecord[] };
export type RemoteHooks = ExecutorHooks & {
  onHistory?: (history: RunRecord[]) => void;
  /**
   * The server's state has been read for the workflow shown: whether it is running now. A page loaded
   * while a run goes on hears no `run:start`, so without this its Run button looked idle until the run ended.
   */
  onAttached?: (state: { running: boolean }) => void;
};

/**
 * A server that answers 5xx with **nothing in the body** did not reach the route: in development
 * that is Next rebuilding the route's modules after a file changed, and it lasts a moment. The route
 * answering an error of its own always says which one, so a body with an `error` is a real refusal
 * and is never retried.
 */
const isNotReady = (status: number, data: { error?: string }): boolean => status >= 500 && !data.error;

/**
 * How long to keep trying, and the gaps between tries.
 *
 * Measured, not guessed: rebuilding the `/api/jobs` module graph — the whole node registry and both
 * engines hang off it — took a good ten seconds after a file everything imports had changed. One
 * retry at 0.7 s was inside that window and the person got the error anyway. Mutable so a test can
 * shrink it; nothing else writes to it.
 */
export const RETRY = { delaysMs: [700, 2000, 5000, 5000] };

/** One request, retried while the server is still coming up. `body` absent is a GET. */
async function request<T>(url: string, body?: unknown, requestId?: string): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    const res = body === undefined
      ? await fetch(url)
      : await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(requestId ? { ...(body as object), requestId } : body) });
    const data = (await res.json().catch(() => ({}))) as T & { error?: string; message?: string; issues?: GraphIssue[] };
    if (res.ok) return data;
    if (data.error === 'GRAPH_INVALID' && data.issues) throw new GraphInvalidError(data.issues);
    const wait = RETRY.delaysMs[attempt];
    if (isNotReady(res.status, data) && wait !== undefined) {
      // Safe to send again: a submission carries the same `requestId`, so if the first one did reach
      // the queue after all, the server hands back that job instead of queueing a second.
      await new Promise((r) => setTimeout(r, wait));
      continue;
    }
    if (isNotReady(res.status, data)) throw Object.assign(new Error(`the server is not answering yet (${res.status} from ${url})`), { code: 'SERVER_NOT_READY' });
    throw Object.assign(new Error(data.message ?? data.error ?? `${url} failed (${res.status})`), { code: data.error ?? 'JOB_FAILED' });
  }
}

const getJson = <T,>(url: string): Promise<T> => request<T>(url);
const postJson = <T,>(url: string, body: unknown, requestId?: string): Promise<T> => request<T>(url, body, requestId);

const RUNNING_BEFORE_ATTACH = 'running-before-attach';

/** An id for one submission, so a retry of it is recognised as the same one. */
let submissionSeq = 0;
const newRequestId = (): string => `req-${Date.now().toString(36)}-${(submissionSeq++).toString(36)}`;

export class RemoteExecutor {
  readonly logs = new LogBuffer();
  private runtimes = new Map<string, NodeRuntime>();
  private graph: Graph;
  private key: string;
  private name: string;
  private source: EventSource | null = null;
  private waiting = new Map<string, (job: Job) => void>();
  private pushGraph: ReturnType<typeof setTimeout> | null = null;
  /**
   * This workflow's jobs the server has not finished: running or waiting their turn. Read from the
   * server when a tab is shown, so coming back to a workflow mid-run shows it running, and a second
   * Run is not queued behind the first by a button that looked idle.
   */
  private activeJobs = new Set<string>();
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
    return this.activeJobs.size > 0;
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
    if (this.pushGraph) { clearTimeout(this.pushGraph); this.pushGraph = null; }
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

  /** `graph` queues that graph instead of the one held here, without editing the canvas. */
  async run(opts: { force?: boolean; graph?: Graph } = {}): Promise<{ ok: boolean }> {
    const job = await this.submit('run', { force: opts.force }, opts.graph);
    return { ok: job.ok === true };
  }

  async runNode(nodeId: string): Promise<string> {
    await this.submit('node', { nodeId });
    return this.runtime(nodeId).state;
  }


  dispose(): void {
    this.source?.close();
    this.source = null;
  }

  // ---------- wire ----------

  private async submit(kind: 'run' | 'node', extra: { nodeId?: string; force?: boolean }, graph?: Graph): Promise<Job> {
    if (this.pushGraph) { clearTimeout(this.pushGraph); this.pushGraph = null; }
    const requestId = newRequestId();
    const submission = { key: this.key, kind, graph: structuredClone(graph ?? this.graph), name: this.name, ...extra };
    const { job } = await this.inOrder(() => postJson<{ job: Job }>('/api/jobs', submission, requestId));
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
    const key = this.key;
    try {
      await this.inOrder(() => postJson(`/api/executors/${encodeURIComponent(key)}`, body));
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
      this.activeJobs.clear();
      // The job running now is not in the snapshot by id; it stands in until a job of this workflow ends.
      if (snap.running) this.activeJobs.add(RUNNING_BEFORE_ATTACH);
      for (const job of snap.pending ?? []) this.activeJobs.add(job.id);
      this.hooks.onHistory?.(snap.history ?? []);
      this.hooks.onAttached?.({ running: this.isRunning() });
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
      if (job.status === 'pending' || job.status === 'running') this.activeJobs.add(job.id);
      if (job.status === 'done' || job.status === 'failed' || job.status === 'cancelled') {
        this.activeJobs.delete(job.id);
        this.activeJobs.delete(RUNNING_BEFORE_ATTACH);
        // The last of this workflow's jobs ended: a page that attached mid-run heard no run:start to pair with run:end.
        if (!this.isRunning()) this.hooks.onAttached?.({ running: false });
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
