import { ErrorCode, NodeError, toNodeError } from '../errors';
import { makePacket, type Packet } from '../types/packet';
import { getPortType } from '../types/ports';
import { getNodeType, readCapability, type AnyNodeDefinition, type BlockReason } from '../nodes/definition';
import { downstreamOf, flowNodes, hasBlockingIssues, incomingEdges, nodeById, topoSort, validateGraph, GraphInvalidError, type Graph } from './graph';
import { canTransition, initialRuntime, type NodeRuntime, type NodeState } from './state';
import { computeSignature } from './signature';
import { MemoryResultCache, type CachedResult, type ResultCache } from './result-cache';
import { LogBuffer } from './log';
import type { NodeServices } from './services';

export interface ExecutorHooks {
  onStateChange?: (nodeId: string, runtime: NodeRuntime) => void;
  /** A node changed its own parameters while running (RunContext.patchParams). */
  onParamsPatch?: (nodeId: string, patch: Record<string, unknown>) => void;
  onRunStart?: (info: { runId: number; stepTotal: number }) => void;
  onRunEnd?: (info: { runId: number; ok: boolean; durationMs: number }) => void;
  onStep?: (info: { nodeId: string; step: number; stepTotal: number }) => void;
}

export interface RunOptions {
  /** Ignore the signature cache for every node (Shift+Run). */
  force?: boolean;
}

export interface ExecutorOptions {
  /** Where results are kept by signature. One in memory for this executor when the host gives none. */
  cache?: ResultCache;
  /** How many nodes may run at once. Only nodes that do not wait on each other ever do. */
  maxParallel?: number;
  /** A hash of the code that runs a node type, when the host can measure it; part of every signature. */
  fingerprint?: (type: string) => string | undefined;
}

/** Enough to run a voice and a drawing side by side, not so many that one film starves the machine. */
export const DEFAULT_MAX_PARALLEL = 4;

/**
 * Graph executor. Runs on the server behind the job queue (server/jobs.ts).
 * A node starts once everything it waits on has finished, several at a time; results are kept by
 * signature; bypass; blocked propagation; single-node runs.
 */
type Gathered = { inputs: Record<string, Packet>; lists: Record<string, Packet[]>; blockedBy?: BlockReason; missing?: string };

export class Executor {
  readonly logs: LogBuffer;
  private runtimes = new Map<string, NodeRuntime>();
  private abort: AbortController | null = null;
  private runId = 0;
  private readonly cache: ResultCache;

  constructor(
    private graph: Graph,
    private readonly services: NodeServices,
    private readonly hooks: ExecutorHooks = {},
    logs?: LogBuffer,
    private readonly options: ExecutorOptions = {},
  ) {
    this.logs = logs ?? new LogBuffer();
    this.cache = options.cache ?? new MemoryResultCache();
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

  /**
   * Bring the runtime map in line with the graph. Called on every graph the canvas pushes — moving a
   * node is one — so it must only reconcile, never undo work.
   *
   * The bypassed flag of an **on-demand** node is not a user's toggle: it is what the type is, so it
   * never takes part in a Run and only runs when its own button is pressed. Forcing its state back
   * to `bypassed` here threw away a finished result on the next graph push: render a cover, drag the
   * node an inch, and the picture vanished — a state change with no cause the person could see.
   */
  private syncRuntimes(): void {
    for (const n of this.graph.nodes) {
      // An on-demand node is never bypassed: it is out of every Run by type, so a flag left over in
      // a saved graph must not grey its card out and must not follow it into a run.
      const ondemand = getNodeType(n.type)?.kind === 'ondemand';
      if (!this.runtimes.has(n.id)) {
        this.runtimes.set(n.id, initialRuntime(!ondemand && n.bypassed));
        continue;
      }
      if (ondemand) continue;
      if (n.bypassed && this.runtimes.get(n.id)!.state !== 'bypassed') this.setState(n.id, { state: 'bypassed' });
      else if (!n.bypassed && this.runtimes.get(n.id)!.state === 'bypassed') this.setState(n.id, { state: 'idle' });
    }
    for (const id of [...this.runtimes.keys()]) if (!nodeById(this.graph, id)) this.runtimes.delete(id);
  }

  private setState(nodeId: string, patch: Partial<NodeRuntime> & { state?: NodeState }): NodeRuntime {
    const prev = this.runtime(nodeId);
    const next: NodeRuntime = { ...prev, ...patch };
    // The state machine is a spec only as long as something reads it, and until now nothing did.
    // Under test it is an assertion, so a new path that skips a state fails the suite that added it.
    // In development it is a line in the log bar: a badge nobody can explain says where it came
    // from. In production, nothing — a wrong badge must never take a good run down with it.
    if (process.env.NODE_ENV !== 'production' && !canTransition(prev.state, next.state)) {
      const message = `illegal state change on ${nodeId}: ${prev.state} → ${next.state}`;
      if (process.env.NODE_ENV === 'test') throw new Error(message);
      this.log(nodeId, 'warn', message);
    }
    this.runtimes.set(nodeId, next);
    this.hooks.onStateChange?.(nodeId, next);
    return next;
  }

  private log(nodeId: string, level: 'info' | 'warn' | 'error', message: string, code?: string): void {
    this.logs.push({ ts: this.services.now(), nodeId, level, code, message });
  }

  // ---------- user actions ----------

  /** A param changed: this node and everything downstream becomes stale. */
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

  /**
   * Runs the flow. A node starts as soon as every node it waits on has finished, up to `maxParallel`
   * at a time, so a voice and a drawing that share nothing do not queue behind each other.
   */
  async run(opts: RunOptions = {}): Promise<{ ok: boolean }> {
    if (this.abort) throw new Error('A run is already in progress');
    const issues = validateGraph(this.graph);
    if (hasBlockingIssues(issues)) throw new GraphInvalidError(issues.filter((i) => i.severity === 'error'));

    const sorted = topoSort(this.graph);
    if ('cycleEdges' in sorted) throw new GraphInvalidError([{ severity: 'error', code: ErrorCode.GRAPH_CYCLE, message: 'cycle', edgeIds: sorted.cycleEdges }]);

    const runId = ++this.runId;
    const startedAt = this.services.now();
    const abort = new AbortController();
    this.abort = abort;
    // Only the flow runs: a node with no wire on it is not part of the film, so it is not started
    // and cannot report a failure after a run it was never in.
    // "Not in the flow" only means something once there is a flow: a graph where nothing is wired
    // at all is run whole, which is what a single node on its own is.
    const flow = flowNodes(this.graph);
    const inFlow = (id: string) => flow.size === 0 || flow.has(id);
    /**
     * An on-demand node is never part of a Run. Its bypass flag is a property
     * of the type, not a switch, so honouring the flag here let a saved graph put a render at the
     * end of every Run with the player waiting behind it. Its own button still runs it, via runNode.
     */
    const onDemand = (id: string) => getNodeType(nodeById(this.graph, id)!.type)?.kind === 'ondemand';
    // Bypassed nodes stay in the list: they are logged and skipped, which is how a person sees that
    // the node they switched off was reached. They are not queued, and not counted.
    const toRun = sorted.order.filter((id) => inFlow(id) && !onDemand(id));
    const willRun = toRun.filter((id) => !nodeById(this.graph, id)!.bypassed);
    for (const id of willRun) this.setState(id, { state: 'queued', reused: false, error: undefined, blockedBy: undefined, progress: undefined });
    this.hooks.onRunStart?.({ runId, stepTotal: willRun.length });
    this.log('run', 'info', `run #${runId} started · ${willRun.length} nodes`);

    // What each node waits on, among the nodes of this run. A wire from outside the run — an
    // on-demand node's old result — is read when the node starts, not waited for.
    const members = new Set(toRun);
    const waitsOn = new Map(
      toRun.map(
        (id) =>
          [
            id,
            new Set(
              incomingEdges(this.graph, id)
                .map((e) => e.source)
                .filter((src) => members.has(src)),
            ),
          ] as const,
      ),
    );
    const limit = Math.max(1, Math.floor(this.options.maxParallel ?? DEFAULT_MAX_PARALLEL));

    let ok = true;
    let step = 0;
    let cancelledAt: string | undefined;
    let thrown: { error: unknown } | undefined;
    // Whatever happens in here, the run has to end: an escaping throw used to leave `abort` set, and
    // from then on every Run answered "A run is already in progress" until the server was restarted.
    try {
      await new Promise<void>((settle) => {
        const pending = [...toRun];
        const finished = new Set<string>();
        let running = 0;
        const pump = (): void => {
          for (let i = 0; i < pending.length && !thrown && running < limit;) {
            const nodeId = pending[i]!;
            if (![...waitsOn.get(nodeId)!].every((id) => finished.has(id))) {
              i++;
              continue;
            }
            pending.splice(i, 1);
            // Something may have become ready by this one finishing on the spot; look again from the top.
            i = 0;
            const node = nodeById(this.graph, nodeId);
            // The canvas can push a graph while this runs; a node that left it has nothing to run.
            if (!node) {
              finished.add(nodeId);
              continue;
            }
            if (node.bypassed) {
              this.log(nodeId, 'info', 'bypassed');
              finished.add(nodeId);
              continue;
            }
            if (cancelledAt || abort.signal.aborted) {
              this.setState(nodeId, { state: 'blocked', blockedBy: { kind: 'upstream', code: ErrorCode.RUN_CANCELLED, message: 'run cancelled', ...(cancelledAt ? { nodeId: cancelledAt } : {}) } });
              finished.add(nodeId);
              continue;
            }
            step += 1;
            running += 1;
            this.hooks.onStep?.({ nodeId, step, stepTotal: willRun.length });
            this.executeNode(nodeId, { force: opts.force ?? false })
              .then(
                (outcome) => {
                  if (outcome === 'cancelled') {
                    cancelledAt ??= nodeId;
                    ok = false;
                  } else if (outcome === 'error' || outcome === 'blocked') ok = false;
                },
                (error: unknown) => {
                  ok = false;
                  thrown ??= { error };
                },
              )
              .finally(() => {
                running -= 1;
                finished.add(nodeId);
                pump();
              });
          }
          if (running === 0 && (pending.length === 0 || thrown)) settle();
        };
        pump();
      });
      if (thrown) throw thrown.error;
    } catch (err) {
      ok = false;
      throw err;
    } finally {
      const durationMs = this.services.now() - startedAt;
      this.log('run', 'info', `run #${runId} ${ok ? 'finished' : 'ended with issues'} · ${durationMs}ms`);
      this.abort = null;
      this.hooks.onRunEnd?.({ runId, ok, durationMs });
    }
    return { ok };
  }

  /**
   * Runs exactly one node with whatever packets are on its inputs, bypassing the cache
   * (retry, "Check again" on resource nodes, "Render" on MP4 Export).
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

  /**
   * In single-node mode only packet presence matters: the user runs one node with whatever is on its
   * wires. A `multiple` port gathers every wire into `lists[name]` in edge order and is satisfied by
   * one; every other port takes its single wire into `inputs[name]`.
   */
  private gatherInputs(nodeId: string, def: AnyNodeDefinition, single: boolean): Gathered {
    const inputs: Record<string, Packet> = {};
    const lists: Record<string, Packet[]> = {};
    const fail = (blockedBy: BlockReason): Gathered => ({ inputs, lists, blockedBy });
    for (const port of def.inputs) {
      const edges = incomingEdges(this.graph, nodeId).filter((e) => e.targetPort === port.name);
      if (port.multiple) lists[port.name] = [];
      if (edges.length === 0) {
        if (port.required === false) continue;
        return { inputs, lists, missing: port.name };
      }
      for (const edge of port.multiple ? edges : edges.slice(0, 1)) {
        const upstreamNode = nodeById(this.graph, edge.source)!;
        const upstream = this.runtime(edge.source);
        const packet = upstream.outputs[edge.sourcePort];
        if (!packet && single) return { inputs, lists, missing: port.name };
        if (!single) {
          if (upstreamNode.bypassed) {
            // An optional port behind a bypassed node is an unwired optional port: switch off what
            // makes the subtitles and the film is still made, without them.
            if (port.required === false && !port.multiple) continue;
            return fail({ kind: 'upstream', code: ErrorCode.NODE_BYPASSED_UPSTREAM, message: `upstream node ${edge.source} is bypassed`, nodeId: edge.source });
          }
          // A node that ran and chose to say nothing on that port is not a failure: an output that
          // exists only for some films is empty for the rest, and a wire to an optional port must not
          // turn that silence into a blocked consumer. A node that did not run, or failed, still blocks.
          if (!packet && port.required === false && upstream.state === 'success') continue;
          if (!packet || upstream.state === 'error' || upstream.state === 'cancelled' || upstream.state === 'blocked') {
            // Carry the original reason down the chain, whichever way it was reported: blocked
            // upstream keeps it under blockedBy, a failed one under error. Without this the whole
            // tail claims a port is unwired when the real cause is a missing encoder several nodes
            // back — and the remedy travels with the code for the same reason.
            const cause = upstream.error ?? upstream.blockedBy;
            return fail({
              kind: 'upstream',
              code: cause?.code ?? ErrorCode.GRAPH_PORT_UNCONNECTED,
              message: `upstream node ${edge.source} has no result`,
              ...(cause?.fix ? { fix: cause.fix } : {}),
              nodeId: edge.source,
            });
          }
        }
        if (!packet) continue;
        for (const key of port.requires ?? []) {
          const cap = readCapability(packet.payload, key);
          if (!cap || cap.status !== 'ready') {
            return fail({
              kind: 'capability',
              code: cap?.code ?? ErrorCode.NODE_NOT_READY,
              message: cap?.reason ?? `capability "${key}" of "${port.name}" is unavailable`,
              fix: cap?.fix,
              ...(single ? {} : { nodeId: edge.source }),
            });
          }
        }
        if (port.multiple) (lists[port.name] ??= []).push(packet);
        else inputs[port.name] = packet;
      }
    }
    return { inputs, lists };
  }

  private async executeNode(nodeId: string, opts: { force: boolean; single?: boolean }): Promise<NodeState> {
    const node = nodeById(this.graph, nodeId)!;
    const def = getNodeType(node.type);
    if (!def) {
      this.setState(nodeId, { state: 'error', error: { code: ErrorCode.NODE_TYPE_UNKNOWN, message: node.type, retryable: false } });
      return 'error';
    }
    // A pinned node is frozen: it hands back what the graph keeps and does not run, whatever its
    // inputs say and however hard the run is forced. That is the whole point — a look you approved
    // must not be redrawn because the script changed, and must not be paid for twice.
    if (node.pinned) {
      const outputs: Record<string, Packet> = {};
      const bad: string[] = [];
      for (const port of def.outputs) {
        const payload = node.pinned.outputs[port.name];
        if (payload === undefined) continue;
        const schema = getPortType(port.type)?.schema;
        if (schema && !schema.safeParse(payload).success) {
          bad.push(port.name);
          continue;
        }
        outputs[port.name] = makePacket({ sourceNodeId: nodeId, sourcePort: port.name, targetPort: '', payloadType: port.type, payload, now: () => this.services.now() });
      }
      // A pin this build can no longer read is worse than no pin: it would feed the film something
      // shaped wrong. Say which port, and say how to get out of it.
      if (bad.length || Object.keys(outputs).length === 0) {
        const message = bad.length ? `the pinned output "${bad[0]}" no longer fits this build` : 'the pin holds nothing this node emits';
        this.setState(nodeId, { state: 'error', error: { code: ErrorCode.NODE_OUTPUT_INVALID, message, retryable: false, fix: 'unpin the node and run it again' } });
        this.log(nodeId, 'error', message, ErrorCode.NODE_OUTPUT_INVALID);
        return 'error';
      }
      this.setState(nodeId, { state: 'success', outputs, reused: true, error: undefined, blockedBy: undefined, progress: undefined });
      this.log(nodeId, 'info', `pinned ${new Date(node.pinned.at).toISOString().slice(0, 16).replace('T', ' ')}; not run`);
      return 'success';
    }

    // Params the schema refuses are this node's failure, not the run's. Throwing here took the whole
    // run down with it, and a graph pushed mid-run is not validated per node the way a submission is.
    const parsedParams = def.paramsSchema.safeParse(node.params);
    if (!parsedParams.success) {
      const message = parsedParams.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
      this.setState(nodeId, { state: 'error', error: { code: ErrorCode.NODE_PARAMS_INVALID, message, retryable: false } });
      this.log(nodeId, 'error', message, ErrorCode.NODE_PARAMS_INVALID);
      return 'error';
    }
    const params = parsedParams.data as Record<string, unknown>;

    const gathered = this.gatherInputs(nodeId, def, opts.single ?? false);
    if (gathered.missing) {
      if (opts.single) throw new NodeError(ErrorCode.GRAPH_PORT_UNCONNECTED, `Input "${gathered.missing}" has no packet`);
      this.setState(nodeId, { state: 'blocked', blockedBy: { kind: 'upstream', code: ErrorCode.GRAPH_PORT_UNCONNECTED, message: `input "${gathered.missing}" has no packet` } });
      return 'blocked';
    }
    if (gathered.blockedBy) {
      this.log(nodeId, 'warn', gathered.blockedBy.message, gathered.blockedBy.code);
      this.setState(nodeId, { state: 'blocked', blockedBy: gathered.blockedBy });
      return 'blocked';
    }
    const preflight = def.preflight?.(gathered.inputs, params, gathered.lists);
    if (preflight) {
      this.log(nodeId, 'warn', preflight.message, preflight.code);
      this.setState(nodeId, { state: 'blocked', blockedBy: preflight });
      return 'blocked';
    }

    const inputHashes: Record<string, string> = {};
    for (const [port, packet] of Object.entries(gathered.inputs)) inputHashes[port] = packet.contentHash;
    for (const [port, packets] of Object.entries(gathered.lists)) inputHashes[port] = packets.map((p) => p.contentHash).join(',');
    const fingerprint = this.options.fingerprint?.(def.type);
    const signature = computeSignature({ type: def.type, version: def.version, fingerprint, params, inputHashes });

    const prev = this.runtime(nodeId);
    // A sink shows or writes something every time; a resource asks the world again. Neither is kept.
    const cacheable = def.kind !== 'resource' && def.outputs.length > 0;
    if (cacheable && !opts.force) {
      if (prev.signature === signature && Object.keys(prev.outputs).length > 0 && prev.state !== 'error') {
        this.setState(nodeId, { state: 'success', reused: true, error: undefined, blockedBy: undefined });
        this.log(nodeId, 'info', 'reused (signature unchanged)');
        return 'success';
      }
      const kept = await this.readCache(nodeId, def, signature);
      if (kept) {
        this.setState(nodeId, {
          state: 'success',
          outputs: kept.outputs,
          signature,
          reused: true,
          durationMs: kept.durationMs,
          warnings: kept.warnings,
          result: undefined,
          error: undefined,
          blockedBy: undefined,
          progress: undefined,
        });
        this.log(nodeId, 'info', 'reused (kept result)');
        return 'success';
      }
    }

    const signal = this.abort!.signal;
    const startedAt = this.services.now();
    this.setState(nodeId, { state: 'running', reused: false, progress: undefined, warnings: undefined });
    const warnings: { code?: string; message: string }[] = [];
    let patched: Record<string, unknown> | null = null;
    try {
      const raw = await def.run({
        nodeId,
        params,
        inputs: gathered.inputs,
        lists: gathered.lists,
        signal,
        services: this.services,
        // A forced run (Shift+Run, Retry, a single node) wants a new answer from whatever the node
        // asks, not the one a service kept. The core does not know which services keep answers.
        fresh: opts.force,
        log: (level, message, code) => {
          if (level === 'warn') warnings.push({ code, message });
          this.log(nodeId, level, message, code);
        },
        progress: (fraction, message) => this.setState(nodeId, { progress: { fraction, message } }),
        patchParams: (patch) => {
          patched = { ...(patched ?? {}), ...patch };
          this.graph = { ...this.graph, nodes: this.graph.nodes.map((n) => (n.id === nodeId ? { ...n, params: { ...n.params, ...patch } } : n)) };
          this.hooks.onParamsPatch?.(nodeId, patch);
        },
      });
      if (signal.aborted) throw new NodeError(ErrorCode.RUN_CANCELLED, 'cancelled');

      const outputs: Record<string, Packet> = {};
      for (const port of def.outputs) {
        const value = raw[port.name];
        if (value === undefined) continue;
        const schema = getPortType(port.type)?.schema;
        if (schema) {
          const parsed = schema.safeParse(value);
          if (!parsed.success)
            throw new NodeError(
              ErrorCode.NODE_OUTPUT_INVALID,
              `output "${port.name}"${parsed.error.issues[0]?.path.length ? `.${parsed.error.issues[0]!.path.join('.')}` : ''}: ${parsed.error.issues[0]?.message ?? 'invalid'}`,
            );
        }
        outputs[port.name] = makePacket({ sourceNodeId: nodeId, sourcePort: port.name, targetPort: '', payloadType: port.type, payload: value, now: () => this.services.now() });
      }
      const result = def.outputs.length === 0 ? raw : undefined;
      const durationMs = this.services.now() - startedAt;
      // Signed over what the node ended up with, so a run after a self-patch reuses this one.
      const finalSignature = patched ? computeSignature({ type: def.type, version: def.version, fingerprint, params: nodeById(this.graph, nodeId)!.params, inputHashes }) : signature;
      this.setState(nodeId, { state: 'success', outputs, signature: finalSignature, durationMs, reused: false, result, progress: undefined, warnings: warnings.length ? warnings : undefined });
      this.log(nodeId, 'info', `done in ${durationMs}ms`);
      if (cacheable)
        await this.writeCache(nodeId, finalSignature, {
          outputs: Object.fromEntries(Object.entries(outputs).map(([port, p]) => [port, { payloadType: p.payloadType, payload: p.payload, contentHash: p.contentHash }])),
          durationMs,
          ...(warnings.length ? { warnings } : {}),
        });
      return 'success';
    } catch (err) {
      const e = toNodeError(err, ErrorCode.NODE_RUN_FAILED);
      if (signal.aborted || e.code === ErrorCode.RUN_CANCELLED) {
        this.setState(nodeId, { state: 'cancelled', progress: undefined });
        this.log(nodeId, 'warn', 'cancelled', ErrorCode.RUN_CANCELLED);
        return 'cancelled';
      }
      this.setState(nodeId, { state: 'error', error: { code: e.code, message: e.message, retryable: e.retryable, details: e.details, ...(e.fix ? { fix: e.fix } : {}) }, progress: undefined });
      this.log(nodeId, 'error', e.message, e.code);
      return 'error';
    }
  }

  /**
   * A kept result, as packets — or nothing, when there is none or it no longer fits.
   *
   * Checked against the port schemas the way a pin is: a result kept by an older build that no
   * longer parses is a miss, and the node runs, rather than a wrong shape fed downstream.
   */
  private async readCache(nodeId: string, def: AnyNodeDefinition, signature: string): Promise<(CachedResult & { outputs: Record<string, Packet> }) | undefined> {
    let kept: CachedResult | undefined;
    try {
      kept = await this.cache.get(signature);
    } catch (err) {
      this.log(nodeId, 'warn', `could not read the kept result: ${err instanceof Error ? err.message : String(err)}`);
      return undefined;
    }
    if (!kept) return undefined;
    const outputs: Record<string, Packet> = {};
    for (const port of def.outputs) {
      const entry = kept.outputs[port.name];
      if (!entry) continue;
      const schema = getPortType(port.type)?.schema;
      if (entry.payloadType !== port.type || (schema && !schema.safeParse(entry.payload).success)) return undefined;
      outputs[port.name] = {
        sourceNodeId: nodeId,
        sourcePort: port.name,
        targetPort: '',
        payloadType: port.type,
        timestamp: this.services.now(),
        payload: entry.payload,
        contentHash: entry.contentHash,
      };
    }
    if (Object.keys(outputs).length === 0) return undefined;
    return { ...kept, outputs };
  }

  /** Keeping a result is a saving, never a condition: a store that cannot write costs the next run, not this one. */
  private async writeCache(nodeId: string, signature: string, result: CachedResult): Promise<void> {
    try {
      await this.cache.set(signature, result);
    } catch (err) {
      this.log(nodeId, 'warn', `could not keep the result: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
}
