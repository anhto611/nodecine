'use client';
import { registerEngine } from '@/core/adapters/registry';
import { createRemotionAdapter, REMOTION_ENGINE_ID } from './adapter';
import { mountRemotionPlayer } from './player.client';

/** Browser registration: preview only; render is reported unavailable here and provided by the server. Remotion draws no `html-gsap` scene yet, so the output nodes block on it. */
export function registerRemotionClient(): void {
  registerEngine(REMOTION_ENGINE_ID, (settings) => createRemotionAdapter(settings, { mountPlayer: mountRemotionPlayer }));
}
