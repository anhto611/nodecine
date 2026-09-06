import type { EngineAdapter, ExportSettings, PlayerHandle, RenderProgress, RenderResult } from '@/core/adapters/types';
import type { VideoIR } from '@/core/types/ir';
import type { Capability } from '@/core/types/payloads';
import { assertValidIR } from '@/core/types/validate-ir';
import { HYPERFRAMES_ADAPTER_VERSION, HYPERFRAMES_ENGINE_ID } from './constants';

export type MountPlayer = (element: HTMLElement, ir: VideoIR) => PlayerHandle;
export type ServerRender = (ir: VideoIR, settings: ExportSettings, onProgress: (p: RenderProgress) => void, signal: AbortSignal) => Promise<RenderResult>;

/**
 * HyperFrames: the engine for `html-gsap` (CORE_CONTRACTS §6.3). Every scene is a block's HTML and
 * GSAP timeline on a stage; this engine builds one composition page per IR and hands it to the
 * HyperFrames player in the browser and to the HyperFrames producer on the server. Isomorphic like
 * the Remotion adapter: the two environment-specific halves are injected by the registrations.
 */
export function createHyperframesAdapter(impl: { mountPlayer?: MountPlayer; render?: ServerRender } = {}): EngineAdapter {
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

    async render(ir, settings, onProgress, signal) {
      if (!impl.render) throw Object.assign(new Error('render is only available on the server'), { code: 'ENGINE_NOT_READY' });
      assertValidIR(ir);
      return impl.render(ir, settings, onProgress, signal);
    },
  };
}
