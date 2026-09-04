import { ErrorCode, NodeError, toNodeError } from '../errors';
import { makePacket, type Packet } from '../types/packet';
import { PAYLOAD_SCHEMAS } from '../types/payloads';
import { getNodeType, readCapability, type AnyNodeDefinition, type BlockReason } from '../nodes/definition';
import {
  downstreamOf,
  hasBlockingIssues,
  incomingEdges,
  nodeById,
  topoSort,
  validateGraph,
  GraphInvalidError,
  type Graph,
} from './graph';
import { initialRuntime, type NodeRuntime, type NodeState } from './state';
import { computeSignature } from './signature';
import { LogBuffer } from './log';
import type { NodeServices } from './services';

export interface ExecutorHooks {
  onStateChange?: (nodeId: string, runtime: NodeRuntime) => void;
  onRunStart?: (info: { runId: number; stepTotal: number }) => void;
  onRunEnd?: (info: { runId: number; ok: boolean; durationMs: number }) => void;
  onStep?: (info: { nodeId: string; step: number; stepTotal: number }) => void;
}

export interface RunOptions {
  /** Ignore the signature cache for every node (Shift+Run). */
  force?: boolean;
}

/**
 * Graph executor (EXECUTION_ENGINE §2–§4). Runs on the client; sequential topological order;
 * signature cache with resource nodes always re-probed; bypass; blocked propagation; single-node runs.
 */
export class Executor {
  readonly logs: LogBuffer;
  private runtimes = new Map<string, NodeRuntime>();
  private abort: AbortController | null = null;
  private runId = 0;

  constructor(
    private graph: Graph,
    private readonly services: NodeServices,
    private readonly hooks: ExecutorHooks = {},
    logs?: LogBuffer,
  ) {
    this.logs = logs ?? new LogBuffer();
    this.syncRuntimes();
  }

  // ---------- graph & runtime access ----------

  setGraph(graph: Graph): void {
    this.graph = graph;
    this.syncRuntimes();
  }

  getGraph(): Graph {
    return this.graph;
  }

  runtime(nodeId: string): NodeRuntime {
    const rt = this.runtimes.get(nodeId);
    if (!rt) throw new Error(`Unknown node ${nodeId}`);
    return rt;
  }

  runtimes_(): ReadonlyMap<string, NodeRuntime> {
    return this.runtimes;
  }

  isRunning(): boolean {
    return this.abort !== null;
  }

  private syncRuntimes(): void {
    for (const n of this.graph.nodes) {
      if (!this.runtimes.has(n.id)) this.runtimes.set(n.id, initialRuntime(n.bypassed));
      else if (n.bypassed && this.runtimes.get(n.id)!.state !== 'bypassed') this.setState(n.id, { state: 'bypassed' });
      else if (!n.bypassed && this.runtimes.get(n.id)!.state === 'bypassed') this.setState(n.id, { state: 'idle' });
    }
    for (const id of [...this.runtimes.keys()]) if (!nodeById(this.graph, id)) this.runtimes.delete(id);
  }

  private setState(nodeId: string, patch: Partial<NodeRuntime> & { state?: NodeState }): NodeRuntime {
    const prev = this.runtime(nodeId);
    const next: NodeRuntime = { ...prev, ...patch };
    this.runtimes.set(nodeId, next);
    this.hooks.onStateChange?.(nodeId, next);
    return next;
  }

  private log(nodeId: string, level: 'info' | 'warn' | 'error', message: string, code?: string): void {
    this.logs.push({ ts: this.services.now(), nodeId, level, code, message });
  }

  // ---------- user actions ----------

  /** A param changed: this node and everything downstream becomes stale (EXECUTION_ENGINE §1). */
  invalidate(nodeId: string): void {
    for (const id of [nodeId, ...downstreamOf(this.graph, nodeId)]) {
      const rt = this.runtime(id);
      if (rt.state === 'success' || rt.state === 'blocked' || rt.state === 'cancelled') this.setState(id, { state: 'stale', reused: false });
    }
  }

  setBypassed(nodeId: string, bypassed: boolean): void {
    const node = nodeById(this.graph, nodeId);
    if (!node) return;
    node.bypassed = bypassed;
    this.setState(nodeId, { state: bypassed ? 'bypassed' : 'idle' });
    if (!bypassed) this.invalidate(nodeId);
  }

  cancel(): void {
    this.abort?.abort();
  }

  /** Runs the whole graph in topological order. */
  async run(opts: RunOptions = {}): Promise<{ ok: boolean }> {
    if (this.abort) throw new Error('A run is already in progress');
    const issues = validateGraph(this.graph);
    if (hasBlockingIssues(issues)) throw new GraphInvalidError(issues.filter((i) => i.severity === 'error'));

    const sorted = topoSort(this.graph);
    if ('cycleEdges' in sorted) throw new GraphInvalidError([{ severity: 'error', code: ErrorCode.GRAPH_CYCLE, message: 'cycle', edgeIds: sorted.cycleEdges }]);

    const runId = ++this.runId;
    const startedAt = this.services.now();
    this.abort = new AbortController();
    const toRun = sorted.order.filter((id) => !nodeById(this.graph, id)!.bypassed);
    for (const id of toRun) this.setState(id, { state: 'queued', reused: false, error: undefined, blockedBy: undefined, progress: undefined });
    this.hooks.onRunStart?.({ runId, stepTotal: toRun.length });
    this.log('run', 'info', `run #${runId} started · ${toRun.length} nodes`);

    let ok = true;
    let step = 0;
    let cancelledAt: string | undefined;
    for (const nodeId of sorted.order) {
      const node = nodeById(this.graph, nodeId)!;
      if (node.bypassed) {
        this.log(nodeId, 'info', 'bypassed');
        continue;
      }
      if (cancelledAt) {
        this.setState(nodeId, { state: 'blocked', blockedBy: { kind: 'upstream', code: ErrorCode.RUN_CANCELLED, message: 'run cancelled', nodeId: cancelledAt } });
        continue;
      }
      step += 1;
      this.hooks.onStep?.({ nodeId, step, stepTotal: toRun.length });
      const outcome = await this.executeNode(nodeId, { force: opts.force ?? false });
      if (outcome === 'cancelled') { cancelledAt = nodeId; ok = false; }
      else if (outcome === 'error' || outcome === 'blocked') ok = false;
    }

    const durationMs = this.services.now() - startedAt;
    this.log('run', 'info', `run #${runId} ${ok ? 'finished' : 'ended with issues'} · ${durationMs}ms`);
    this.abort = null;
    this.hooks.onRunEnd?.({ runId, ok, durationMs });
    return { ok };
  }

  /** Runs every resource node once, e.g. when the studio opens or settings change (EXECUTION_ENGINE §1.1). */
  async probeResources(): Promise<void> {
    if (this.abort) return;
    this.abort = new AbortController();
    try {
      for (const node of this.graph.nodes) {
        const def = getNodeType(node.type);
        if (!def || def.kind !== 'resource' || node.bypassed) continue;
        this.setState(node.id, { state: 'queued', error: undefined, blockedBy: undefined, reused: false });
        await this.executeNode(node.id, { force: true, single: true });
      }
    } finally {
      this.abort = null;
    }
  }

  /**
   * Runs exactly one node with whatever packets are on its inputs, bypassing the cache
   * (retry, "Check again" on resource nodes, "Render" on MP4 Export). EXECUTION_ENGINE §3.
   */
  async runNode(nodeId: string): Promise<NodeState> {
    if (this.abort) throw new Error('A run is already in progress');
    const node = nodeById(this.graph, nodeId);
    if (!node) throw new Error(`Unknown node ${nodeId}`);
    this.abort = new AbortController();
    try {
      this.setState(nodeId, { state: 'queued', error: undefined, blockedBy: undefined, reused: false });
      await this.executeNode(nodeId, { force: true, single: true });
      return this.runtime(nodeId).state;
    } finally {
      this.abort = null;
    }
  }

  // ---------- core step ----------

  /** In single-node mode only packet presence matters: the user runs one node with whatever is on its wires. */
  private gatherInputs(nodeId: string, def: AnyNodeDefinition, single: boolean): { inputs: Record<string, Packet>; block?: BlockReason; missing?: string } {
    const inputs: Record<string, Packet> = {};
    for (const port of def.inputs) {
      const edge = incomingEdges(this.graph, nodeId).find((e) => e.targetPort === port.name);
      if (!edge) {
        if (port.required === false) continue;
        return { inputs, missing: port.name };
      }
      const upstreamNode = nodeById(this.graph, edge.source)!;
      const upstream = this.runtime(edge.source);
      const packet = upstream.outputs[edge.sourcePort];
      if (single) {
        if (!packet) return { inputs, missing: port.name };
        inputs[port.name] = packet;
        continue;
      }
      if (upstreamNode.bypassed) {
        return { inputs, block: { kind: 'upstream', code: ErrorCode.NODE_BYPASSED_UPSTREAM, message: `upstream node ${edge.source} is bypassed`, nodeId: edge.source } };
      }
      if (!packet || upstream.state === 'error' || upstream.state === 'cancelled' || upstream.state === 'blocked') {
        return { inputs, block: { kind: 'upstream', code: upstream.error?.code ?? ErrorCode.GRAPH_PORT_UNCONNECTED, message: `upstream node ${edge.source} has no result`, nodeId: edge.source } };
      }
      inputs[port.name] = packet;
      for (const key of port.requires ?? []) {
        const cap = readCapability(packet.payload, key);
        if (!cap || cap.status !== 'ready') {
          return {
            inputs,
            block: {
              kind: 'capability',
              code: cap?.code ?? ErrorCode.ENGINE_NOT_READY,
              message: cap?.reason ?? `capability "${key}" of "${port.name}" is unavailable`,
              fix: cap?.fix,
              nodeId: edge.source,
            },
          };
        }
      }
    }
    if (single) {
      for (const port of def.inputs) {
        const packet = inputs[port.name];
        if (!packet) continue;
        for (const key of port.requires ?? []) {
          const cap = readCapability(packet.payload, key);
          if (!cap || cap.status !== 'ready') {
            return { inputs, block: { kind: 'capability', code: cap?.code ?? ErrorCode.ENGINE_NOT_READY, message: cap?.reason ?? `capability "${key}" of "${port.name}" is unavailable`, fix: cap?.fix } };
          }
        }
      }
    }
    return { inputs };
  }

  private async executeNode(nodeId: string, opts: { force: boolean; single?: boolean }): Promise<NodeState> {
    const node = nodeById(this.graph, nodeId)!;
    const def = getNodeType(node.type);
    if (!def) {
      this.setState(nodeId, { state: 'error', error: { code: ErrorCode.NODE_TYPE_UNKNOWN, message: node.type, retryable: false } });
      return 'error';
    }
    const params = def.paramsSchema.parse(node.params) as Record<string, unknown>;

    const gathered = this.gatherInputs(nodeId, def, opts.single ?? false);
    if (gathered.missing) {
      if (opts.single) throw new NodeError(ErrorCode.GRAPH_PORT_UNCONNECTED, `Input "${gathered.missing}" has no packet`);
      this.setState(nodeId, { state: 'blocked', blockedBy: { kind: 'upstream', code: ErrorCode.GRAPH_PORT_UNCONNECTED, message: `input "${gathered.missing}" has no packet` } });
      return 'blocked';
    }
    if (gathered.block) {
      this.log(nodeId, 'warn', gathered.block.message, gathered.block.code);
      this.setState(nodeId, { state: 'blocked', blockedBy: gathered.block });
      return 'blocked';
    }
    const preflight = def.preflight?.(gathered.inputs, params);
    if (preflight) {
      this.log(nodeId, 'warn', preflight.message, preflight.code);
      this.setState(nodeId, { state: 'blocked', blockedBy: preflight });
      return 'blocked';
    }

    const inputHashes: Record<string, string> = {};
    for (const [port, packet] of Object.entries(gathered.inputs)) inputHashes[port] = packet.contentHash;
    const signature = computeSignature({ type: def.type, version: def.version, params, inputHashes });

    const prev = this.runtime(nodeId);
    const cacheable = def.kind !== 'resource' && !opts.force;
    if (cacheable && prev.signature === signature && Object.keys(prev.outputs).length > 0 && prev.state !== 'error') {
      this.setState(nodeId, { state: 'success', reused: true, error: undefined, blockedBy: undefined });
      this.log(nodeId, 'info', 'reused (signature unchanged)');
      return 'success';
    }

    const signal = this.abort!.signal;
    const startedAt = this.services.now();
    this.setState(nodeId, { state: 'running', reused: false, progress: undefined, warnings: undefined });
    const warnings: { code?: string; message: string }[] = [];
    try {
      const raw = await def.run({
        nodeId,
        params,
        inputs: gathered.inputs,
        signal,
        services: this.services,
        log: (level, message, code) => {
          if (level === 'warn') warnings.push({ code, message });
          this.log(nodeId, level, message, code);
        },
        progress: (fraction, message) => this.setState(nodeId, { progress: { fraction, message } }),
      });
      if (signal.aborted) throw new NodeError(ErrorCode.RUN_CANCELLED, 'cancelled');

      const outputs: Record<string, Packet> = {};
      for (const port of def.outputs) {
        const value = raw[port.name];
        if (value === undefined) continue;
        const schema = PAYLOAD_SCHEMAS[port.type as keyof typeof PAYLOAD_SCHEMAS];
        if (schema) {
          const parsed = schema.safeParse(value);
          if (!parsed.success) throw new NodeError(ErrorCode.NODE_OUTPUT_INVALID, `output "${port.name}": ${parsed.error.issues[0]?.message ?? 'invalid'}`);
        }
        outputs[port.name] = makePacket({ sourceNodeId: nodeId, sourcePort: port.name, targetPort: '', payloadType: port.type, payload: value, now: () => this.services.now() });
      }
      const result = def.outputs.length === 0 ? raw : undefined;
      const durationMs = this.services.now() - startedAt;
      this.setState(nodeId, { state: 'success', outputs, signature, durationMs, reused: false, result, progress: undefined, warnings: warnings.length ? warnings : undefined });
      this.log(nodeId, 'info', `done in ${durationMs}ms`);
      return 'success';
    } catch (err) {
      const e = toNodeError(err, ErrorCode.PROVIDER_PROCESS_FAILED);
      if (signal.aborted || e.code === ErrorCode.RUN_CANCELLED) {
        this.setState(nodeId, { state: 'cancelled', progress: undefined });
        this.log(nodeId, 'warn', 'cancelled', ErrorCode.RUN_CANCELLED);
        return 'cancelled';
      }
      this.setState(nodeId, { state: 'error', error: { code: e.code, message: e.message, retryable: e.retryable, details: e.details }, progress: undefined });
      this.log(nodeId, 'error', e.message, e.code);
      return 'error';
    }
  }
}
