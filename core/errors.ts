/** Stable error and reason codes (EXECUTION_ENGINE §6). UI messages come from locale dictionaries keyed by code. */
export const ErrorCode = {
  INPUT_EMPTY: 'INPUT_EMPTY',
  PROVIDER_NOT_CONNECTED: 'PROVIDER_NOT_CONNECTED',
  PROVIDER_NOT_INSTALLED: 'PROVIDER_NOT_INSTALLED',
  PROVIDER_NOT_AUTHENTICATED: 'PROVIDER_NOT_AUTHENTICATED',
  PROVIDER_PROBE_FAILED: 'PROVIDER_PROBE_FAILED',
  PROVIDER_PROCESS_FAILED: 'PROVIDER_PROCESS_FAILED',
  KEY_MISSING: 'KEY_MISSING',
  KEY_INVALID: 'KEY_INVALID',
  LLM_UPSTREAM: 'LLM_UPSTREAM',
  TTS_UPSTREAM: 'TTS_UPSTREAM',
  TTS_AUDIO_UNREADABLE: 'TTS_AUDIO_UNREADABLE',
  TTS_VOICE_LANGUAGE_MISMATCH: 'TTS_VOICE_LANGUAGE_MISMATCH',
  IR_INVALID: 'IR_INVALID',
  IR_VERSION_UNSUPPORTED: 'IR_VERSION_UNSUPPORTED',
  ENGINE_NOT_READY: 'ENGINE_NOT_READY',
  ENGINE_SCENE_UNSUPPORTED: 'ENGINE_SCENE_UNSUPPORTED',
  EXPORT_FAILED: 'EXPORT_FAILED',
  EXPORT_CANCELLED: 'EXPORT_CANCELLED',
  NODE_BYPASSED_UPSTREAM: 'NODE_BYPASSED_UPSTREAM',
  GRAPH_CYCLE: 'GRAPH_CYCLE',
  GRAPH_PORT_UNCONNECTED: 'GRAPH_PORT_UNCONNECTED',
  GRAPH_PORT_TYPE_MISMATCH: 'GRAPH_PORT_TYPE_MISMATCH',
  GRAPH_NO_SINK: 'GRAPH_NO_SINK',
  NODE_TYPE_UNKNOWN: 'NODE_TYPE_UNKNOWN',
  NODE_PARAMS_INVALID: 'NODE_PARAMS_INVALID',
  NODE_OUTPUT_INVALID: 'NODE_OUTPUT_INVALID',
  RUN_CANCELLED: 'RUN_CANCELLED',
} as const;
export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

/** A node-level failure carrying a stable code. */
export class NodeError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly retryable = false,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'NodeError';
  }
}

export function toNodeError(err: unknown, fallbackCode: string): NodeError {
  if (err instanceof NodeError) return err;
  if (err && typeof err === 'object' && 'code' in err && typeof (err as { code: unknown }).code === 'string') {
    const e = err as { code: string; message?: string; violations?: unknown };
    return new NodeError(e.code, e.message ?? e.code, false, e.violations);
  }
  return new NodeError(fallbackCode, err instanceof Error ? err.message : String(err), true);
}
