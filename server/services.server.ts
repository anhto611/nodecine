import path from 'node:path';
import type { ZodTypeAny, z } from 'zod';
import type { NodeServices } from '@/core/engine/services';
import { getLLMProviderFactory, getTTSProviderFactory } from '@/core/providers/registry';
import { getEngineFactory } from '@/core/adapters/registry';
import { makeEngineRef } from '@/core/adapters/types';
import { getServerOp } from '@/core/server-ops';
import { buildTTSRef } from '@/providers/system-tts';
import { mediaUrl } from '@/server/paths';
import { ensureServerRegistrations } from '@/server/register';

/**
 * NodeServices for a run that lives entirely on the server — a CLI, a scheduled job, an end-to-end
 * test. It does what the API routes do, without HTTP: the browser is not part of the pipeline, only
 * a way to drive it.
 */
export function createServerServices(): NodeServices {
  ensureServerRegistrations();
  return {
    now: () => Date.now(),
    async serverOp(op, input, signal) {
      const handler = getServerOp(op);
      if (!handler) throw Object.assign(new Error(`unknown server op ${op}`), { code: 'NODE_TYPE_UNKNOWN' });
      return handler(input, signal);
    },
    async probeLLM(providerId, settings) {
      const f = getLLMProviderFactory(providerId);
      if (!f) throw Object.assign(new Error(`unknown llm provider ${providerId}`), { code: 'PROVIDER_NOT_CONNECTED' });
      const p = f(settings);
      return { providerId: p.providerId, displayName: p.displayName, transport: p.transport, capabilities: await p.probe(), settings };
    },
    async probeTTS(providerId, settings) {
      const f = getTTSProviderFactory(providerId);
      if (!f) throw Object.assign(new Error(`unknown tts provider ${providerId}`), { code: 'PROVIDER_NOT_CONNECTED' });
      const p = f(settings);
      return buildTTSRef(p, await p.probe(), settings);
    },
    async probeEngine(engineId, settings) {
      const f = getEngineFactory(engineId);
      if (!f) throw Object.assign(new Error(`unknown engine ${engineId}`), { code: 'ENGINE_NOT_READY' });
      const a = f(settings);
      return makeEngineRef(a, await a.probe(), settings);
    },
    async synthesize(ref, text, voice, speed, signal) {
      const f = getTTSProviderFactory(ref.providerId);
      if (!f) throw Object.assign(new Error(`unknown tts provider ${ref.providerId}`), { code: 'PROVIDER_NOT_CONNECTED' });
      const r = await f(ref.settings).synthesize(text, voice, speed, signal);
      return { audioUrl: mediaUrl(path.basename(r.filePath)), durationSeconds: r.durationSeconds, voiceName: r.voice.id, language: r.voice.language, speed };
    },
    async complete<S extends ZodTypeAny>(ref: { providerId: string; settings: Record<string, unknown> }, prompt: string, schema: S, signal: AbortSignal): Promise<z.infer<S>> {
      const f = getLLMProviderFactory(ref.providerId);
      if (!f) throw Object.assign(new Error(`unknown llm provider ${ref.providerId}`), { code: 'PROVIDER_NOT_CONNECTED' });
      const raw = await f(ref.settings).complete(prompt, schema, signal);
      return schema.parse(raw) as z.infer<S>;
    },
    async render(ref, ir, settings, onProgress, signal) {
      const f = getEngineFactory(ref.engineId);
      if (!f) throw Object.assign(new Error(`unknown engine ${ref.engineId}`), { code: 'ENGINE_NOT_READY' });
      return f(ref.settings).render(ir, settings, onProgress, signal);
    },
  };
}
