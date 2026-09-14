/**
 * Stable error and reason codes (EXECUTION_ENGINE §6). UI messages come from locale dictionaries
 * keyed by code.
 *
 * Only what running a graph raises: a wire, a node, a run. What a model, a voice, an engine or an IR
 * raises is the video contracts' (`contracts/errors.ts`), and a failure of one node belongs in that
 * node's capsule — `nodes/<name>/errors.ts` beside its strings in the capsule's own locales.
 */
export const ErrorCode = {
  INPUT_EMPTY: 'INPUT_EMPTY',
  NODE_BYPASSED_UPSTREAM: 'NODE_BYPASSED_UPSTREAM',
  GRAPH_CYCLE: 'GRAPH_CYCLE',
  GRAPH_PORT_UNCONNECTED: 'GRAPH_PORT_UNCONNECTED',
  GRAPH_PORT_TYPE_MISMATCH: 'GRAPH_PORT_TYPE_MISMATCH',
  GRAPH_NO_SINK: 'GRAPH_NO_SINK',
  NODE_TYPE_UNKNOWN: 'NODE_TYPE_UNKNOWN',
  NODE_PARAMS_INVALID: 'NODE_PARAMS_INVALID',
  NODE_OUTPUT_INVALID: 'NODE_OUTPUT_INVALID',
  /** An input names a capability that is not ready, and whatever reported it gave no code of its own. */
  NODE_NOT_READY: 'NODE_NOT_READY',
  /** A node threw something that carried no code. */
  NODE_RUN_FAILED: 'NODE_RUN_FAILED',
  RUN_CANCELLED: 'RUN_CANCELLED',
} as const;
export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

/** A node-level failure carrying a stable code. */
export class NodeError extends Error {
  /**
   * What the person can do about it: a command to run, a wire to connect. The message says what
   * happened, this says what to do, and the two are shown apart.
   */
  fix?: string;

  constructor(
    public readonly code: string,
    message: string,
    public readonly retryable = false,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'NodeError';
  }

  /** Fluent, because the remedy is optional and is never the fourth thing worth saying. */
  withFix(fix: string): this {
    this.fix = fix;
    return this;
  }
}

export function toNodeError(err: unknown, fallbackCode: string): NodeError {
  if (err instanceof NodeError) return err;
  if (err && typeof err === 'object' && 'code' in err && typeof (err as { code: unknown }).code === 'string') {
    const e = err as { code: string; message?: string; violations?: unknown; fix?: unknown };
    const wrapped = new NodeError(e.code, e.message ?? e.code, false, e.violations);
    // A provider or a subprocess attaches its remedy to a plain object; carry it rather than drop it.
    if (typeof e.fix === 'string') wrapped.withFix(e.fix);
    return wrapped;
  }
  return new NodeError(fallbackCode, err instanceof Error ? err.message : String(err), true);
}
