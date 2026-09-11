'use client';
import { registerEngine } from '@/core/adapters/registry';
import { registerCodeRenderer } from '@/core/visual/renderers';
import { registerRemotionTransitions } from './transitions';
import { createRemotionAdapter, REMOTION_ENGINE_ID } from './adapter';
import { mountRemotionPlayer } from './player.client';

/** Browser registration: preview only; render is reported unavailable here and provided by the server. */
export function registerRemotionClient(): void {
  // `html-gsap` through the core's scene machinery (scene-runtime.ts), and the catalogue drawn as styles per frame.
  registerCodeRenderer('html-gsap', REMOTION_ENGINE_ID, 'html-gsap-clip');
  registerRemotionTransitions();
  registerEngine(REMOTION_ENGINE_ID, (settings) => createRemotionAdapter(settings, { mountPlayer: mountRemotionPlayer }));
}
