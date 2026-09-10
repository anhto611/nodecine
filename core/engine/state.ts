import type { Packet } from '../types/packet';
import type { BlockReason } from '../nodes/definition';

/** The nine node states (EXECUTION_ENGINE §1). */
export type NodeState =
  | 'idle'
  | 'queued'
  | 'running'
  | 'success'
  | 'stale'
  | 'error'
  | 'blocked'
  | 'cancelled'
  | 'bypassed';

export interface NodeRuntime {
  state: NodeState;
  /** Outputs by port name from the last successful run. Kept across stale/blocked (results are preserved). */
  outputs: Record<string, Packet>;
  /** Signature of the last successful run, for cache reuse. */
  signature?: string;
  /** True when the last pass reused the cached result instead of running. */
  reused: boolean;
  durationMs?: number;
  error?: { code: string; message: string; retryable: boolean; details?: unknown; fix?: string };
  /** Warnings the node raised during its last run: it produced a result, but a degraded one. */
  warnings?: { code?: string; message: string }[];
  blockedBy?: BlockReason;
  progress?: { fraction: number; message?: string };
  /** On-demand nodes (MP4 Export) keep their non-packet result here. */
  result?: unknown;
}

export function initialRuntime(bypassed: boolean): NodeRuntime {
  return { state: bypassed ? 'bypassed' : 'idle', outputs: {}, reused: false };
}

/**
 * Where a node may go next (EXECUTION_ENGINE §1 table). The executor checks this on every state it
 * writes, outside production, so a state change with no path to it shows up as a warning in the log
 * bar rather than as a badge nobody can explain.
 *
 * The user-facing table in the spec lists what *running* a node produces. These three are what a
 * person does to the node instead, and they are reachable from anywhere: bypassing it, un-bypassing
 * it, and putting it in the queue — every non-bypassed node is queued at the top of a run, whatever
 * it was before.
 */
const FROM_ANYWHERE: NodeState[] = ['bypassed', 'idle', 'queued'];

const TRANSITIONS: Record<NodeState, NodeState[]> = {
  idle: ['blocked'],
  /**
   * `success` without running is the signature cache: the node is reused, not executed. `error`
   * without running is a node type that is not registered, or params the schema refuses.
   */
  queued: ['running', 'success', 'blocked', 'error', 'cancelled'],
  running: ['success', 'error', 'cancelled'],
  success: ['stale', 'blocked'],
  stale: ['blocked'],
  error: [],
  blocked: ['stale'],
  cancelled: ['stale'],
  bypassed: [],
};

export function canTransition(from: NodeState, to: NodeState): boolean {
  return from === to || FROM_ANYWHERE.includes(to) || TRANSITIONS[from].includes(to);
}
