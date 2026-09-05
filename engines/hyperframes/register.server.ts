import { registerEngine } from '@/core/adapters/registry';
import { HYPERFRAMES_ENGINE_ID } from './constants';
import { createHyperframesAdapter } from './adapter';

/** Server registration: probe only. Preview is a browser concern and export is not implemented. */
export function registerHyperframesServer(): void {
  registerEngine(HYPERFRAMES_ENGINE_ID, () => createHyperframesAdapter());
}
