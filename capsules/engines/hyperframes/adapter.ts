import type { EngineAdapter, ExportSettings, PlayerHandle, RenderProgress, RenderResult, ScenePreviewOptions } from '@/contracts/adapters/types';
import type { VideoIR } from '@/contracts/types/ir';
import type { Capability } from '@/contracts/types/payloads';
import { assertValidIR } from '@/contracts/types/validate-ir';
import { HYPERFRAMES_ADAPTER_VERSION, HYPERFRAMES_ENGINE_ID } from './constants';

export type MountPlayer = (element: HTMLElement, ir: VideoIR) => PlayerHandle;
export type ServerRender = (ir: VideoIR, settings: ExportSettings, onProgress: (p: RenderProgress) => void, signal: AbortSignal) => Promise<RenderResult>;
export type PreviewScene = (options: ScenePreviewOptions) => string;

/**
 * HyperFrames: the engine for `html-gsap`. Every scene is its own HTML and
 * GSAP timeline in the film's style; this engine builds one composition page per IR and hands it to the
 * HyperFrames player in the browser and to the HyperFrames producer on the server. Isomorphic like
 * any engine adapter: the two environment-specific halves are injected by the registrations.
 */
export function createHyperframesAdapter(impl: { mountPlayer?: MountPlayer; previewScene?: PreviewScene; render?: ServerRender } = {}): EngineAdapter {
  const ready: Capability = { status: 'ready' };
  return {
    engineId: HYPERFRAMES_ENGINE_ID,
    displayName: 'Hyperframes',
    adapterVersion: HYPERFRAMES_ADAPTER_VERSION,

    async probe() {
      return {
        preview: ready,
        render: impl.render ? ready : { status: 'unavailable', code: 'ENGINE_NOT_READY', reason: 'render is only available on the server' },
      };
    },

    mountPlayer(element, ir) {
      if (!impl.mountPlayer) throw Object.assign(new Error('the player is only available in the browser'), { code: 'ENGINE_NOT_READY' });
      assertValidIR(ir);
      return impl.mountPlayer(element, ir);
    },

    ...(impl.previewScene ? { previewScene: impl.previewScene } : {}),

    async render(ir, settings, onProgress, signal) {
      if (!impl.render) throw Object.assign(new Error('render is only available on the server'), { code: 'ENGINE_NOT_READY' });
      assertValidIR(ir);
      return impl.render(ir, settings, onProgress, signal);
    },
  };
}
