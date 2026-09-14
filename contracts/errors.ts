import { ErrorCode as RunErrorCode } from '@/core/errors';

export { NodeError, toNodeError } from '@/core/errors';

/**
 * Every code a video workflow can raise outside one capsule: the core's, for a wire, a node and a
 * run, and these, for a model, a voice, an engine and the IR. Capsules and the app import this table;
 * the core only ever sees its own half.
 */
export const ErrorCode = {
  ...RunErrorCode,
  PROVIDER_NOT_CONNECTED: 'PROVIDER_NOT_CONNECTED',
  PROVIDER_NOT_INSTALLED: 'PROVIDER_NOT_INSTALLED',
  PROVIDER_NOT_AUTHENTICATED: 'PROVIDER_NOT_AUTHENTICATED',
  PROVIDER_PROBE_FAILED: 'PROVIDER_PROBE_FAILED',
  PROVIDER_PROCESS_FAILED: 'PROVIDER_PROCESS_FAILED',
  KEY_MISSING: 'KEY_MISSING',
  KEY_INVALID: 'KEY_INVALID',
  LLM_UPSTREAM: 'LLM_UPSTREAM',
  /** A provider could not get schema-valid JSON out of the model. Thrown by providers, so shared. */
  LLM_SCHEMA_INVALID: 'LLM_SCHEMA_INVALID',
  /** A model was asked for one language and wrote in another, twice (contracts/ai/structured-completion). */
  LLM_LANGUAGE_MISMATCH: 'LLM_LANGUAGE_MISMATCH',
  TTS_UPSTREAM: 'TTS_UPSTREAM',
  TTS_AUDIO_UNREADABLE: 'TTS_AUDIO_UNREADABLE',
  ENGINE_NOT_READY: 'ENGINE_NOT_READY',
} as const;
export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];
