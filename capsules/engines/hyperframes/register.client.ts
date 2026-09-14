'use client';
import { registerEngine } from '@/contracts/adapters/registry';
import { HYPERFRAMES_ENGINE_ID } from './constants';
import { createHyperframesAdapter } from './adapter';
import { mountHyperframesPlayer } from './player.client';

/** Browser registration: the HyperFrames player. Previews are prepared and renders run on the server. */
export function registerHyperframesClient(): void {
  registerEngine(HYPERFRAMES_ENGINE_ID, () => createHyperframesAdapter({ mountPlayer: mountHyperframesPlayer }));
}
