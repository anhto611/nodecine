import { stat } from 'node:fs/promises';
import { measureDurationSeconds } from '@/server/contracts/audio';

/**
 * What the hosted voice providers share: a key that comes from the
 * environment and never from the graph, a timeout on every call, and a fetch handed in through
 * parameters so a test never touches the network.
 */

export interface ApiDeps {
  fetch: typeof fetch;
  /** Milliseconds a probe may take; synthesis gets a longer, fixed budget. */
  timeoutMs: number;
  /** Reads a produced file's duration; the real one runs ffprobe. */
  measure: (filePath: string, signal?: AbortSignal) => Promise<number>;
}

export const defaultApiDeps = (): ApiDeps => ({ fetch: globalThis.fetch, timeoutMs: 8000, measure: measureDurationSeconds });

/** The first non-empty variable among the names. Provider keys use the plain names the services themselves document. */
export function envFirst(...names: string[]): string | undefined {
  for (const n of names) {
    const v = process.env[n]?.trim();
    if (v) return v;
  }
  return undefined;
}

export function withTimeout(signal: AbortSignal | undefined, ms: number): AbortSignal {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(new Error('timeout')), ms);
  const onAbort = () => ctrl.abort(signal?.reason);
  ctrl.signal.addEventListener(
    'abort',
    () => {
      clearTimeout(t);
      signal?.removeEventListener('abort', onAbort);
    },
    { once: true },
  );
  if (signal?.aborted) ctrl.abort(signal.reason);
  else signal?.addEventListener('abort', onAbort, { once: true });
  return ctrl.signal;
}

export const exists = (p: string): Promise<boolean> =>
  stat(p).then(
    () => true,
    () => false,
  );

export const clamp = (n: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, n));

/** A provider error with a code the executor's table knows. */
export function codedError(code: string, message: string): Error {
  return Object.assign(new Error(message), { code });
}
