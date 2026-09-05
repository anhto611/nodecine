import { contentHash } from '../hash';
import type { NodeServices } from '../engine/services';
import type { EngineRef, LLMRef, TTSRef, Voice, Voiceover } from '../types/payloads';

/** Deterministic fake services for executor tests. Records every call. */
export function makeFakeServices(overrides: Partial<{
  ttsInstalled: boolean;
  encoder: boolean;
  voices: Voice[];
  renderReady: boolean;
  claudeAuthenticated: boolean;
  secondsPerChar: number;
  complete: (prompt: string) => Promise<unknown>;
}> = {}) {
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
    complete: (async () => { throw new Error('not used in core tests'); }) as (prompt: string) => Promise<unknown>,
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
        displayName: engineId === 'remotion' ? 'Remotion' : 'Hyperframes',
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
    async render(_ref, ir, settings, onProgress, signal) {
      calls.push({ name: 'render', args: [settings] });
      for (let f = 0; f <= ir.meta.totalDurationInFrames; f += Math.ceil(ir.meta.totalDurationInFrames / 4)) {
        if (signal.aborted) throw Object.assign(new Error('cancelled'), { code: 'RUN_CANCELLED' });
        onProgress({ renderedFrames: Math.min(f, ir.meta.totalDurationInFrames), totalFrames: ir.meta.totalDurationInFrames });
      }
      return { outputUrl: `/api/media/${contentHash(ir)}.mp4`, bytes: 4_800_000 };
    },
  };
  return services;
}
