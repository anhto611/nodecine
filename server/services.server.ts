import path from 'node:path';
import type { ZodTypeAny, z } from 'zod';
import type { NodeServices } from '@/core/engine/services';
import { getLLMProviderFactory, getTTSProviderFactory } from '@/core/providers/registry';
import { getEngineFactory } from '@/core/adapters/registry';
import { makeEngineRef } from '@/core/adapters/types';
import { buildTTSRef } from '@/providers/system-tts';
import { mediaUrl } from '@/server/paths';
import { ensureServerRegistrations } from '@/server/register';
import { embedWorkflow } from '@/server/video-meta';
import { fileNameFromMediaUrl, mediaPath } from '@/server/paths';
import { alignWordsOnServer } from '@/server/align';

/**
 * NodeServices for a run on the server — the job queue, a CLI, an end-to-end test (ARCHITECTURE
 * §1.2). `workflow` names the graph a render came from; when it answers, the MP4 is stamped with it.
 */
export function createServerServices(opts: { workflow?: () => { name: string; graph: unknown } | null } = {}): NodeServices {
  ensureServerRegistrations();
  return {
    now: () => Date.now(),
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
    alignWords: alignWordsOnServer,
    async render(ref, ir, settings, onProgress, signal) {
      const f = getEngineFactory(ref.engineId);
      if (!f) throw Object.assign(new Error(`unknown engine ${ref.engineId}`), { code: 'ENGINE_NOT_READY' });
      const result = await f(ref.settings).render(ir, settings, onProgress, signal);
      const workflow = opts.workflow?.();
      if (workflow) {
        // Best-effort, like a ComfyUI PNG carrying its workflow: a video without the tag is still a video.
        await embedWorkflow(mediaPath(fileNameFromMediaUrl(result.outputUrl)), { ...workflow, ir }, signal).catch(() => undefined);
      }
      return result;
    },
  };
}
