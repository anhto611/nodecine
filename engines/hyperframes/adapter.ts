import { registerEngine } from '@/core/adapters/registry';
import type { EngineAdapter } from '@/core/adapters/types';
import type { Capability } from '@/core/types/payloads';

/** Hyperframes skeleton (CORE_CONTRACTS §6.3): honours the contract, declares itself unavailable, never throws on probe. */
export const HYPERFRAMES_ENGINE_ID = 'hyperframes';

export function createHyperframesAdapter(): EngineAdapter {
  const notReady: Capability = { status: 'unavailable', code: 'ENGINE_NOT_READY', reason: 'Hyperframes Engine arrives in v0.2' };
  return {
    engineId: HYPERFRAMES_ENGINE_ID,
    displayName: 'Hyperframes',
    adapterVersion: '0.1.0-skeleton',
    async probe() {
      return { preview: notReady, render: notReady };
    },
    mountPlayer(): never {
      throw Object.assign(new Error('Hyperframes preview is not available in v0.1'), { code: 'ENGINE_NOT_READY' });
    },
    async render() {
      throw Object.assign(new Error('Hyperframes render is not available in v0.1'), { code: 'ENGINE_NOT_READY' });
    },
  };
}

export function registerHyperframes(): void {
  registerEngine(HYPERFRAMES_ENGINE_ID, () => createHyperframesAdapter());
}
