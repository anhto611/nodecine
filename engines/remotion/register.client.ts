'use client';
import { registerEngine } from '@/core/adapters/registry';
import { createRemotionAdapter, REMOTION_ENGINE_ID } from './adapter';
import { mountRemotionPlayer } from './player.client';
import { registerRemotionRenderers } from './renderers';

/** Browser registration: preview only; render is reported unavailable here and provided by the server. */
export function registerRemotionClient(): void {
  registerRemotionRenderers();
  registerEngine(REMOTION_ENGINE_ID, (settings) => createRemotionAdapter(settings, { mountPlayer: mountRemotionPlayer }));
}
