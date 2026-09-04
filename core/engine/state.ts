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
  error?: { code: string; message: string; retryable: boolean; details?: unknown };
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

/** Allowed transitions (EXECUTION_ENGINE §1 table). */
const TRANSITIONS: Record<NodeState, NodeState[]> = {
  idle: ['queued', 'blocked', 'bypassed'],
  queued: ['running', 'blocked', 'idle', 'cancelled'],
  running: ['success', 'error', 'cancelled'],
  success: ['stale', 'queued', 'blocked', 'bypassed'],
  stale: ['queued', 'blocked', 'bypassed'],
  error: ['queued', 'bypassed'],
  blocked: ['queued', 'idle', 'stale', 'bypassed'],
  cancelled: ['queued', 'bypassed', 'stale'],
  bypassed: ['queued', 'idle', 'stale'],
};

export function canTransition(from: NodeState, to: NodeState): boolean {
  return from === to || TRANSITIONS[from].includes(to);
}
