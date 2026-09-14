import type { EngineAdapter, ExportSettings, PlayerHandle, RenderProgress, RenderResult } from '@/contracts/adapters/types';
import type { Capability } from '@/contracts/types/payloads';
import type { VideoIR } from '@/contracts/types/ir';
import { assertValidIR } from '@/contracts/types/validate-ir';
import { COMPOSITION_ID, REMOTION_ENGINE_ID, REMOTION_ADAPTER_VERSION } from './constants';

export type MountPlayer = (element: HTMLElement, ir: VideoIR) => PlayerHandle;
export type ServerRender = (ir: VideoIR, settings: ExportSettings, onProgress: (p: RenderProgress) => void, signal: AbortSignal) => Promise<RenderResult>;

/**
 * Isomorphic Remotion adapter — imports nothing from React or `remotion`, so it is safe in route handlers. The two halves that are environment-specific are injected:
 * `mountPlayer` only in the browser (needs react-dom/client + @remotion/player, see player.client.tsx),
 * `render` only on the server (needs @remotion/bundler + @remotion/renderer, see register.server.ts).
 * probe() reports exactly what this environment can do; the executor blocks consumers accordingly.
 */
export function createRemotionAdapter(settings: Record<string, unknown>, impl: { mountPlayer?: MountPlayer; render?: ServerRender }): EngineAdapter {
  const ready: Capability = { status: 'ready' };
  void settings;
  return {
    engineId: REMOTION_ENGINE_ID,
    displayName: 'Remotion',
    adapterVersion: REMOTION_ADAPTER_VERSION,

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

    async render(ir, exportSettings, onProgress, signal) {
      if (!impl.render) throw Object.assign(new Error('render is only available on the server'), { code: 'ENGINE_NOT_READY' });
      assertValidIR(ir);
      return impl.render(ir, exportSettings, onProgress, signal);
    },
  };
}

export { COMPOSITION_ID, REMOTION_ENGINE_ID };
