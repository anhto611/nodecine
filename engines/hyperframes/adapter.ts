import type { EngineAdapter, PlayerHandle } from '@/core/adapters/types';
import type { VideoIR } from '@/core/types/ir';
import type { Capability } from '@/core/types/payloads';
import { HYPERFRAMES_ADAPTER_VERSION, HYPERFRAMES_ENGINE_ID } from './constants';

/**
 * Hyperframes: a canvas runtime, the second engine (CORE_CONTRACTS §6.3). It exists to keep the
 * engine-independence claim honest — the same Video IR previews here with no React and no Remotion.
 * Rendering to a file is not implemented, and the capability says so rather than the adapter throwing
 * at an awkward moment.
 */

export type MountPlayer = (element: HTMLElement, ir: VideoIR) => PlayerHandle;

const ready: Capability = { status: 'ready' };
const noRender: Capability = {
  status: 'unavailable',
  code: 'ENGINE_NOT_READY',
  reason: 'Hyperframes previews only; file export arrives in a later version',
  fix: 'Use the Remotion Engine node for MP4 export',
};

/** Isomorphic: the browser passes a real `mountPlayer`, the server leaves it out. */
export function createHyperframesAdapter(impl: { mountPlayer?: MountPlayer } = {}): EngineAdapter {
  return {
    engineId: HYPERFRAMES_ENGINE_ID,
    displayName: 'Hyperframes',
    adapterVersion: HYPERFRAMES_ADAPTER_VERSION,

    async probe() {
      // Preview needs nothing but a canvas, which every browser this app runs in has.
      return { preview: ready, render: noRender };
    },

    mountPlayer(element, ir) {
      if (!impl.mountPlayer) throw Object.assign(new Error('Hyperframes preview is browser-only'), { code: 'ENGINE_NOT_READY' });
      return impl.mountPlayer(element, ir);
    },

    async render() {
      throw Object.assign(new Error(noRender.status === 'unavailable' ? noRender.reason : 'not available'), { code: 'ENGINE_NOT_READY' });
    },
  };
}
