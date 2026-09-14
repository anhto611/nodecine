import type { EngineAdapter, ExportSettings, PlayerHandle, PlayerOptions, RenderProgress, RenderResult } from '@/contracts/adapters/types';
import type { Composition } from '@/contracts/types/composition';
import type { Capability } from '@/contracts/types/payloads';
import { HYPERFRAMES_ADAPTER_VERSION, HYPERFRAMES_ENGINE_ID } from './constants';

export type ServerPreview = (composition: Composition, signal: AbortSignal) => Promise<{ url: string }>;
export type ServerRender = (composition: Composition, settings: ExportSettings, onProgress: (p: RenderProgress) => void, signal: AbortSignal) => Promise<RenderResult>;
export type MountPlayer = (element: HTMLElement, preview: PlayerOptions) => PlayerHandle;

const notHere = (what: string, side: string) => Object.assign(new Error(`${what} is only available ${side}`), { code: 'ENGINE_NOT_READY' });

/** A composition written for another engine is not this engine's to draw. */
function mine(composition: Composition): void {
  if (composition.engine !== HYPERFRAMES_ENGINE_ID) {
    throw Object.assign(new Error(`this composition is written for "${composition.engine}", not HyperFrames`), { code: 'ENGINE_NOT_READY' });
  }
}

/**
 * HyperFrames, used the way HyperFrames is used: a composition is an HTML project whose root
 * declares its variables, previewed in `<hyperframes-player>` and rendered by `@hyperframes/producer`
 * with values for those variables. Each side of the app registers the half it can run.
 */
export function createHyperframesAdapter(impl: { preview?: ServerPreview; render?: ServerRender; mountPlayer?: MountPlayer } = {}): EngineAdapter {
  const ready: Capability = { status: 'ready' };
  const unavailable = (reason: string): Capability => ({ status: 'unavailable', code: 'ENGINE_NOT_READY', reason });
  return {
    engineId: HYPERFRAMES_ENGINE_ID,
    displayName: 'HyperFrames',
    adapterVersion: HYPERFRAMES_ADAPTER_VERSION,
    async probe() {
      return {
        preview: impl.preview || impl.mountPlayer ? ready : unavailable('preview is not available here'),
        render: impl.render ? ready : unavailable('render is only available on the server'),
      };
    },
    async preview(composition, signal) {
      if (!impl.preview) throw notHere('preparing a preview', 'on the server');
      mine(composition);
      return impl.preview(composition, signal);
    },
    mountPlayer(element, preview) {
      if (!impl.mountPlayer) throw notHere('the player', 'in the browser');
      return impl.mountPlayer(element, preview);
    },
    async render(composition, settings, onProgress, signal) {
      if (!impl.render) throw notHere('render', 'on the server');
      mine(composition);
      return impl.render(composition, settings, onProgress, signal);
    },
  };
}
