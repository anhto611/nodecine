import path from 'node:path';
import type { ZodTypeAny, z } from 'zod';
import type { NodeServices } from '@/core/engine/services';
import { getLLMProviderFactory, getTTSProviderFactory } from '@/contracts/providers/registry';
import { getEngineFactory } from '@/contracts/adapters/registry';
import { makeEngineRef } from '@/contracts/adapters/types';
import { buildTTSRef } from '@/contracts/providers/types';
import { ensureServerRegistrations } from './register';
import { embedWorkflow } from '@/server/contracts/video-meta';
import { ensureTmpDir, fileNameFromMediaUrl, mediaPath, mediaUrl } from '@/server/paths';
import { NODE_SERVICE_EXTENSIONS } from '@/capsules/nodes/.generated/server';
import { concatMp3, measureDurationSeconds } from '@/server/contracts/audio';
import { contentHash } from '@/core/hash';
import fs from 'node:fs/promises';

/**
 * NodeServices for a run on the server — the job queue, a CLI, an end-to-end test. `workflow` names the graph a render came from; when it answers, the MP4 is stamped with it.
 */
/** Model answers by prompt hash; `NODECINE_CACHE_DIR` moves it. Deleting the folder only costs the next run a call. */
export function llmCacheDir(): string {
  return path.resolve(process.cwd(), process.env.NODECINE_CACHE_DIR ?? '.nodecine/cache', 'llm');
}

export function createServerServices(opts: { workflow?: () => { name: string; graph: unknown } | null } = {}): NodeServices {
  ensureServerRegistrations();
  const extensions = Object.assign({}, ...NODE_SERVICE_EXTENSIONS) as Record<string, (...args: unknown[]) => Promise<unknown>>;
  // Typed as the interface itself, not a Partial cast to it: a method dropped from here is a
  // compile error, the way losing `align` from the services was not.
  const services: NodeServices = {
    async invoke<T>(serviceId: string, args: unknown[]): Promise<T> {
      const service = extensions[serviceId];
      if (!service) throw new Error(`unknown node service ${serviceId}`);
      return await service(...args) as T;
    },
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
    async complete<S extends ZodTypeAny>(ref: { providerId: string; settings: Record<string, unknown> }, prompt: string, schema: S, signal: AbortSignal, opts?: { fresh?: boolean }): Promise<z.infer<S>> {
      const f = getLLMProviderFactory(ref.providerId);
      if (!f) throw Object.assign(new Error(`unknown llm provider ${ref.providerId}`), { code: 'PROVIDER_NOT_CONNECTED' });
      // The same prompt to the same provider *set up the same way* is the same answer:
      // kept on disk, never in the graph. The settings belong in the key —
      // without them, switching the model on the Provider node handed back the old model's answer.
      const file = path.join(llmCacheDir(), `${contentHash({ providerId: ref.providerId, settings: ref.settings, prompt })}.json`);
      if (!opts?.fresh) {
        const hit = await fs.readFile(file, 'utf8').then((t) => JSON.parse(t) as unknown, () => undefined);
        if (hit !== undefined) {
          const parsed = schema.safeParse(hit);
          if (parsed.success) return parsed.data as z.infer<S>;
        }
      }
      const raw = await f(ref.settings).complete(prompt, schema, signal);
      const out = schema.parse(raw) as z.infer<S>;
      await fs.mkdir(llmCacheDir(), { recursive: true }).then(() => fs.writeFile(`${file}.part`, JSON.stringify(out))).then(() => fs.rename(`${file}.part`, file)).catch(() => undefined);
      return out;
    },
    async saveText(text, extension) {
      if (!/^[a-z0-9]{1,8}$/.test(extension)) throw new Error(`Invalid file extension: ${extension}`);
      // Named by the text itself: exporting the same captions twice is one file, and the name says nothing about the user.
      const name = `${contentHash({ text, extension })}.${extension}`;
      const bytes = Buffer.byteLength(text, 'utf8');
      const file = mediaPath(name);
      await fs.mkdir(await ensureTmpDir(), { recursive: true });
      await fs.writeFile(`${file}.part`, text, 'utf8');
      await fs.rename(`${file}.part`, file);
      return { url: mediaUrl(name), bytes };
    },
    async concatAudio(parts, gapSeconds, signal) {
      const files = parts.map((p) => mediaPath(fileNameFromMediaUrl(p.audioUrl)));
      // Named by what went in, so the same parts joined twice are one file.
      const name = `${contentHash({ files: files.map((f) => path.basename(f)), gapSeconds })}.mp3`;
      const out = mediaPath(name);
      const exists = await fs.stat(out).then(() => true, () => false);
      if (!exists) await concatMp3(files, gapSeconds, out, signal);
      const durationSeconds = await measureDurationSeconds(out, signal);
      let start = 0;
      const segments = parts.map((p) => { const seg = { start: Math.round(start * 100) / 100, durationSeconds: Math.round((p.durationSeconds + gapSeconds) * 100) / 100 }; start += p.durationSeconds + gapSeconds; return seg; });
      return { audioUrl: mediaUrl(name), durationSeconds, segments };
    },
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
  return services;
}
