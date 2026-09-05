import { z, type ZodTypeAny } from 'zod';
import { registerLLMProvider } from '@/core/providers/registry';
import type { LLMProvider } from '@/core/providers/types';
import { ErrorCode } from '@/core/errors';
import type { Capability, LLMRef } from '@/core/types/payloads';
import { extractJson } from '../claude-code';

/**
 * Ollama provider (CORE_CONTRACTS §7): a local model server, offline and without a key.
 *
 * It is the second way to get a language model without signing up for anything, and unlike Claude
 * Code it is not a CLI: the same node now covers both a subprocess provider and an HTTP one, which
 * is the point of having one node per port type.
 *
 * The server address is infrastructure, not graph data, so it comes from the environment the way
 * binary paths do. A shared graph therefore cannot aim this machine's requests anywhere; only the
 * model name travels with the graph.
 */

export const OLLAMA_ID = 'ollama';
const ready: Capability = { status: 'ready' };
const DEFAULT_URL = 'http://127.0.0.1:11434';
const DEFAULT_MODEL = 'llama3.2';

/** Where the server lives: the override first, then Ollama's own default port on this machine. */
export function ollamaUrl(): string {
  const raw = process.env.NODECINE_OLLAMA_URL?.trim();
  if (!raw) return DEFAULT_URL;
  try {
    const u = new URL(raw);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return DEFAULT_URL;
    return u.origin;
  } catch {
    return DEFAULT_URL;
  }
}

/** `llama3.2` should match the `llama3.2:latest` the server reports, and any explicit tag exactly. */
export function modelIsPulled(model: string, tags: string[]): boolean {
  const want = model.trim();
  if (!want) return false;
  return tags.some((t) => t === want || t === `${want}:latest` || (!want.includes(':') && t.split(':')[0] === want));
}

export interface OllamaDeps {
  fetch: typeof fetch;
  timeoutMs: number;
}

const defaultDeps = (): OllamaDeps => ({ fetch: globalThis.fetch, timeoutMs: 4000 });

function withTimeout(signal: AbortSignal | undefined, ms: number): AbortSignal {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(new Error('timeout')), ms);
  signal?.addEventListener('abort', () => ctrl.abort(signal.reason), { once: true });
  ctrl.signal.addEventListener('abort', () => clearTimeout(t), { once: true });
  return ctrl.signal;
}

export function createOllamaProvider(settings: Record<string, unknown>, deps: OllamaDeps = defaultDeps()): LLMProvider {
  const model = ((settings.model as string | undefined) || DEFAULT_MODEL).trim();

  return {
    providerId: OLLAMA_ID,
    displayName: 'Ollama',
    transport: 'api',

    async probe(): Promise<LLMRef['capabilities']> {
      const base = ollamaUrl();
      let tags: string[];
      try {
        const res = await deps.fetch(`${base}/api/tags`, { signal: withTimeout(undefined, deps.timeoutMs) });
        if (!res.ok) throw new Error(`responded ${res.status}`);
        const body = (await res.json()) as { models?: { name?: string }[] };
        tags = (body.models ?? []).map((m) => m.name).filter((n): n is string => typeof n === 'string');
      } catch {
        // Nothing answered, so nothing downstream can be judged: report all three the same way.
        const offline: Capability = {
          status: 'unavailable',
          code: ErrorCode.PROVIDER_NOT_CONNECTED,
          reason: `No Ollama server at ${base}`,
          fix: 'brew install ollama, then: ollama serve',
        };
        return { installed: offline, authenticated: offline, structuredOutput: offline };
      }

      const installed: Capability = modelIsPulled(model, tags)
        ? ready
        : {
            status: 'unavailable',
            code: ErrorCode.PROVIDER_NOT_INSTALLED,
            reason: tags.length === 0 ? 'The server has no models' : `Model "${model}" is not pulled`,
            fix: `ollama pull ${model}`,
          };

      // Best-effort: an older server without /api/version still works, it just reports no version.
      let version: string | undefined;
      try {
        const res = await deps.fetch(`${base}/api/version`, { signal: withTimeout(undefined, deps.timeoutMs) });
        if (res.ok) {
          const body = (await res.json()) as { version?: unknown };
          if (typeof body.version === 'string') version = body.version;
        }
      } catch {
        /* the tag call already proved the server is up */
      }

      // The server needs no credential, and every version can be asked for JSON.
      return { installed, authenticated: ready, structuredOutput: ready, ...(version ? { version } : {}) };
    },

    async complete<S extends ZodTypeAny>(prompt: string, outputSchema: S, signal: AbortSignal): Promise<z.infer<S>> {
      const base = ollamaUrl();
      let res: Response;
      try {
        res = await deps.fetch(`${base}/api/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          // `format: json` constrains the decoder; the schema is still enforced below, because the
          // server only promises valid JSON, not the shape this caller asked for.
          body: JSON.stringify({ model, prompt, stream: false, format: 'json', options: { temperature: 0 } }),
          signal: withTimeout(signal, 120_000),
        });
      } catch (e) {
        throw Object.assign(new Error(`could not reach Ollama at ${base}: ${e instanceof Error ? e.message : String(e)}`), {
          code: ErrorCode.PROVIDER_NOT_CONNECTED,
        });
      }
      if (!res.ok) {
        const detail = await res.text().catch(() => '');
        throw Object.assign(new Error(`ollama responded ${res.status}: ${detail.slice(0, 300)}`), { code: ErrorCode.LLM_UPSTREAM });
      }
      const envelope = (await res.json()) as { response?: unknown; error?: unknown };
      if (typeof envelope.error === 'string') throw Object.assign(new Error(envelope.error), { code: ErrorCode.LLM_UPSTREAM });
      if (typeof envelope.response !== 'string') throw Object.assign(new Error('ollama returned no response text'), { code: ErrorCode.LLM_UPSTREAM });

      const text = extractJson(envelope.response);
      let json: unknown;
      try {
        json = JSON.parse(text);
      } catch {
        throw Object.assign(new Error('ollama did not return JSON'), { code: 'LLM_SCHEMA_INVALID', raw: envelope.response });
      }
      const parsed = outputSchema.safeParse(json);
      if (!parsed.success) {
        throw Object.assign(new Error(parsed.error.issues.map((i) => i.message).join('; ')), { code: 'LLM_SCHEMA_INVALID', raw: envelope.response });
      }
      return parsed.data as z.infer<S>;
    },
  };
}

export function registerOllama(): void {
  registerLLMProvider({
    id: OLLAMA_ID,
    displayName: 'Ollama',
    factory: (settings) => createOllamaProvider(settings),
    settingsSchema: z.object({ model: z.string().default(DEFAULT_MODEL) }),
    defaultSettings: { model: DEFAULT_MODEL },
  });
}
