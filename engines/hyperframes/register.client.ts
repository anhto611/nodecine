'use client';
import { registerEngine } from '@/core/adapters/registry';
import { HYPERFRAMES_ENGINE_ID } from './constants';
import { createHyperframesAdapter } from './adapter';
import { mountHyperframesPlayer } from './player.client';
import { registerHyperframesRenderers } from './renderers';

/** Browser registration: the canvas preview plus every scene renderer this engine can draw. */
export function registerHyperframesClient(): void {
  registerHyperframesRenderers();
  registerEngine(HYPERFRAMES_ENGINE_ID, () => createHyperframesAdapter({ mountPlayer: mountHyperframesPlayer }));
}
