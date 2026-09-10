import type { ZodTypeAny, z } from 'zod';
import type { PortType } from '../types/ports';
import type { Packet } from '../types/packet';
import type { NodeServices } from '../engine/services';

/**
 * Node type definition (CORE_CONTRACTS §5).
 * `run` returns outputs keyed by output port name; the executor wraps them into packets.
 */

export type NodeKind =
  /** No inputs, user-provided data (Input Trigger, Static Script). */
  | 'source'
  /** Transforms inputs to outputs. */
  | 'process'
  /** No inputs; run() = probe(); always re-run (EXECUTION_ENGINE §1.1). */
  | 'resource'
  /** Consumes without producing packets (Video Output). */
  | 'sink'
  /** Bypassed by default; runs when explicitly triggered (MP4 Export). */
  | 'ondemand';

export interface PortDef {
  name: string;
  type: PortType;
  /** Defaults to true for inputs. */
  required?: boolean;
  /**
   * Accepts any number of wires. The packets arrive in `RunContext.lists[name]`, in edge order,
   * instead of `inputs[name]`. `required` then means at least one.
   */
  multiple?: boolean;
  /**
   * For reference inputs: capability keys (under payload.capabilities) that must be `ready`
   * for this node to run; otherwise the node is blocked by capability (EXECUTION_ENGINE §1.1 rule 3).
   */
  requires?: string[];
}

export interface NodeIssue {
  code: string;
  message: string;
  port?: string;
}

/** Why a node is blocked. `upstream` = a prior node failed/was bypassed; `capability` = a reference is unavailable. */
export interface BlockReason {
  kind: 'upstream' | 'capability';
  code: string;
  message: string;
  nodeId?: string;
  fix?: string;
}

export type LogLevel = 'info' | 'warn' | 'error';

export interface RunContext<P = Record<string, unknown>> {
  nodeId: string;
  params: P;
  inputs: Record<string, Packet>;
  /** Packets on `multiple` ports, keyed by port name. */
  lists: Record<string, Packet[]>;
  signal: AbortSignal;
  services: NodeServices;
  log: (level: LogLevel, message: string, code?: string) => void;
  /** Report progress for long-running nodes (0..1). */
  progress: (fraction: number, message?: string) => void;
  /**
   * Change this node's own parameters as a result of running (EXECUTION_ENGINE §3). No core node
   * does today; the retired Art Director kept what a model drew. The patch lands in the graph at once — the
   * workflow shows as unsaved, the edit is undoable — and the run's signature is taken over the
   * patched parameters, so the next run reuses this result instead of doing the work again.
   */
  patchParams: (patch: Record<string, unknown>) => void;
}

export interface NodeDefinition<S extends ZodTypeAny = ZodTypeAny> {
  type: string;
  /** Bumped when run() semantics change, so cached results are invalidated (EXECUTION_ENGINE §3). */
  version: number;
  kind: NodeKind;
  inputs: PortDef[];
  outputs: PortDef[];
  paramsSchema: S;
  defaultParams: z.infer<S>;
  defaultBypassed?: boolean;
  /** Continuous validation of params (EXECUTION_ENGINE §2 item 2). */
  validate?: (params: z.infer<S>) => NodeIssue[];
  /** Checked before run with the resolved inputs; a returned reason blocks the node by capability. */
  preflight?: (inputs: Record<string, Packet>, params: z.infer<S>, lists: Record<string, Packet[]>) => BlockReason | null;
  run: (ctx: RunContext<z.infer<S>>) => Promise<Record<string, unknown>>;
}

export type AnyNodeDefinition = NodeDefinition<ZodTypeAny>;

const registry = new Map<string, AnyNodeDefinition>();

export function registerNodeType(def: AnyNodeDefinition): void {
  registry.set(def.type, def);
}
export function getNodeType(type: string): AnyNodeDefinition | undefined {
  return registry.get(type);
}
export function listNodeTypes(): AnyNodeDefinition[] {
  return [...registry.values()];
}
/** Test-only. */
export function _resetNodeRegistry(): void {
  registry.clear();
}

/** Returns the capability object at `key` inside a reference payload, or undefined. */
export function readCapability(payload: unknown, key: string): { status: string; reason?: string; fix?: string; code?: string } | undefined {
  const caps = (payload as { capabilities?: Record<string, unknown> } | undefined)?.capabilities;
  const cap = caps?.[key];
  if (cap && typeof cap === 'object' && 'status' in cap) return cap as { status: string; reason?: string; fix?: string; code?: string };
  return undefined;
}
