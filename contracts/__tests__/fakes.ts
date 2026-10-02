import { contentHash } from '@/core/hash';
import type { NodeServices } from '@/core/engine/services';
import type { EngineRef, LLMRef, TTSRef, Voice, Voiceover } from '../types/payloads';

/** Deterministic fake services for executor tests. Records every call. */
export function makeFakeServices(
  overrides: Partial<{
    ttsInstalled: boolean;
    encoder: boolean;
    voices: Voice[];
    renderReady: boolean;
    claudeAuthenticated: boolean;
    secondsPerChar: number;
    complete: (prompt: string) => Promise<unknown>;
  }> = {},
) {
  const o = {
    ttsInstalled: true,
    encoder: true,
    voices: [
      { id: 'samantha', displayName: 'Samantha', language: 'en-US' },
      { id: 'linh', displayName: 'Linh', language: 'vi-VN' },
    ],
    renderReady: true,
    claudeAuthenticated: true,
    secondsPerChar: 0.07,
    // No shipped node asks a model today; a test that wants an answer passes its own.
    complete: (async () => {
      throw new Error('no model answer was faked for this test');
    }) as (prompt: string) => Promise<unknown>,
    ...overrides,
  };
  const calls: { name: string; args: unknown[] }[] = [];
  let clock = 1_000_000;
  const ready = { status: 'ready' as const };
  const unavailable = (reason: string, code?: string, fix?: string) => ({ status: 'unavailable' as const, reason, code, fix });

  const services: NodeServices & { calls: typeof calls; setOptions: (p: Partial<typeof o>) => void } = {
    calls,
    setOptions: (p) => Object.assign(o, p),
    now: () => (clock += 7),
    async probeLLM(providerId, settings): Promise<LLMRef> {
      calls.push({ name: 'probeLLM', args: [providerId, settings] });
      return {
        providerId,
        displayName: 'Claude Code',
        transport: 'cli',
        capabilities: {
          installed: ready,
          authenticated: o.claudeAuthenticated ? ready : unavailable('Claude Code is not logged in', 'PROVIDER_NOT_AUTHENTICATED', 'claude login'),
          structuredOutput: ready,
          version: '2.1.260',
        },
        settings,
      };
    },
    async probeTTS(providerId, settings): Promise<TTSRef> {
      calls.push({ name: 'probeTTS', args: [providerId, settings] });
      return {
        providerId,
        displayName: 'System TTS',
        transport: 'local',
        capabilities: {
          installed: o.ttsInstalled ? ready : unavailable('say not found', 'PROVIDER_NOT_INSTALLED'),
          encoder: o.encoder ? ready : unavailable('ffmpeg not found', 'PROVIDER_NOT_INSTALLED', 'brew install ffmpeg'),
        },
        voices: o.voices,
        settings: { rate: (settings.rate as number) ?? 1, defaultVoice: settings.defaultVoice as string | undefined },
      };
    },
    async probeEngine(engineId, settings): Promise<EngineRef> {
      calls.push({ name: 'probeEngine', args: [engineId, settings] });
      const notReady = unavailable('render is only available on the server', 'ENGINE_NOT_READY');
      return {
        engineId,
        displayName: 'Hyperframes',
        adapterVersion: '1.0.0',
        capabilities: { preview: ready, render: o.renderReady ? ready : notReady },
        settings,
      };
    },
    async synthesize(_ref, text, voice, speed): Promise<Voiceover> {
      calls.push({ name: 'synthesize', args: [text, voice.id, speed] });
      const durationSeconds = Math.round(((text.length * o.secondsPerChar) / speed) * 100) / 100;
      return { audioUrl: `/api/media/${contentHash({ text, voice: voice.id, speed })}.mp3`, durationSeconds, voiceName: voice.id, language: voice.language, speed };
    },
    async complete(_ref, prompt, schema) {
      calls.push({ name: 'complete', args: [prompt] });
      return schema.parse(await o.complete(prompt));
    },
    async invoke<T>(serviceId: string, args: unknown[]): Promise<T> {
      calls.push({ name: serviceId, args });
      if (serviceId === 'transcribe/align') {
        const [, text] = args as [string, string];
        const words = text.trim().split(/\s+/).filter(Boolean);
        const step = 0.3;
        return words.map((word, index) => ({ text: word, start: Math.round(index * step * 1000) / 1000, end: Math.round((index * step + 0.25) * 1000) / 1000 })) as T;
      }
      throw new Error(`unknown fake node service ${serviceId}`);
    },
    async saveText(text, extension) {
      calls.push({ name: 'saveText', args: [text, extension] });
      return { url: `/api/media/${contentHash({ text, extension })}.${extension}`, bytes: text.length };
    },
    async concatAudio(parts, gapSeconds) {
      calls.push({ name: 'concatAudio', args: [parts.map((p) => p.audioUrl), gapSeconds] });
      let start = 0;
      const segments = parts.map((p) => {
        const seg = { start: Math.round(start * 100) / 100, durationSeconds: Math.round((p.durationSeconds + gapSeconds) * 100) / 100 };
        start += p.durationSeconds + gapSeconds;
        return seg;
      });
      return { audioUrl: `/api/media/${contentHash({ parts: parts.map((p) => p.audioUrl), gapSeconds })}.mp3`, durationSeconds: Math.round(start * 100) / 100, segments };
    },
    async preview(ref, composition) {
      calls.push({ name: 'preview', args: [ref.engineId] });
      return { url: `/api/projects/${contentHash(composition)}/preview.html` };
    },
    async render(_ref, composition, settings, onProgress, signal) {
      calls.push({ name: 'render', args: [settings] });
      for (const fraction of [0, 0.25, 0.5, 0.75, 1]) {
        if (signal.aborted) throw Object.assign(new Error('cancelled'), { code: 'RUN_CANCELLED' });
        onProgress({ fraction });
      }
      return { outputUrl: `/api/media/${contentHash(composition)}.mp4`, bytes: 4_800_000 };
    },
  };
  return services;
}
