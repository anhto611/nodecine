'use client';
import type { ZodTypeAny, z } from 'zod';
import type { NodeServices } from '@/core/engine/services';
import { EngineRefSchema, LLMRefSchema, TTSRefSchema, VoiceoverSchema } from '@/core/types/payloads';
import type { RenderResult } from '@/core/adapters/types';

/** Browser implementation of NodeServices: every call goes to a local API route (ARCHITECTURE §1.2). */

/** What a render should stamp into the MP4; the store provides it, so this module never imports the store. */
let workflowProvider: () => { name: string; graph: unknown } | null = () => null;
export function provideWorkflowForRenders(fn: typeof workflowProvider): void {
  workflowProvider = fn;
}

async function postJson<T>(url: string, body: unknown, signal?: AbortSignal): Promise<T> {
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal });
  const data = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
  if (!res.ok) throw Object.assign(new Error(data.message ?? data.error ?? `${url} failed (${res.status})`), { code: data.error ?? 'PROVIDER_PROCESS_FAILED' });
  return data as T;
}

export const clientServices: NodeServices = {
  now: () => Date.now(),
  async serverOp(op, input, signal) {
    return postJson<unknown>(`/api/ops/${encodeURIComponent(op)}`, input, signal);
  },

  async probeLLM(providerId, settings) {
    return LLMRefSchema.parse(await postJson('/api/providers/probe', { kind: 'llm', id: providerId, settings }));
  },
  async probeTTS(providerId, settings) {
    return TTSRefSchema.parse(await postJson('/api/providers/probe', { kind: 'tts', id: providerId, settings }));
  },
  async probeEngine(engineId, settings) {
    return EngineRefSchema.parse(await postJson('/api/providers/probe', { kind: 'engine', id: engineId, settings }));
  },
  async synthesize(ref, text, voice, speed, signal) {
    return VoiceoverSchema.parse(await postJson('/api/tts', { providerId: ref.providerId, settings: ref.settings, text, voice, speed }, signal));
  },
  async complete<S extends ZodTypeAny>(ref: { providerId: string; settings: Record<string, unknown> }, prompt: string, schema: S, signal: AbortSignal): Promise<z.infer<S>> {
    const raw = await postJson<unknown>('/api/director', { providerId: ref.providerId, settings: ref.settings, prompt }, signal);
    return schema.parse(raw) as z.infer<S>;
  },
  async render(ref, ir, settings, onProgress, signal) {
    const res = await fetch('/api/render', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ engineId: ref.engineId, settings: ref.settings, ir, exportSettings: settings, workflow: workflowProvider() ?? undefined }),
      signal,
    });
    if (!res.ok || !res.body) {
      const data = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
      throw Object.assign(new Error(data.message ?? 'render request failed'), { code: data.error ?? 'EXPORT_FAILED' });
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let result: RenderResult | null = null;
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let idx: number;
      while ((idx = buffer.indexOf('\n\n')) >= 0) {
        const chunk = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 2);
        const event = /^event: (.+)$/m.exec(chunk)?.[1];
        const data = /^data: (.+)$/m.exec(chunk)?.[1];
        if (!event || !data) continue;
        const payload = JSON.parse(data) as Record<string, unknown>;
        if (event === 'progress') onProgress(payload as { renderedFrames: number; totalFrames: number });
        else if (event === 'done') result = payload as unknown as RenderResult;
        else if (event === 'error') throw Object.assign(new Error(String(payload.message)), { code: payload.code });
      }
    }
    if (!result) throw Object.assign(new Error('render stream ended without a result'), { code: 'EXPORT_FAILED' });
    return result;
  },
};
