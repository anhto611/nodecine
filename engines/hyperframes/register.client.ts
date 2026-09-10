'use client';
import { registerEngine } from '@/core/adapters/registry';
import { registerCodeRenderer } from '@/core/visual/renderers';
import { HYPERFRAMES_ENGINE_ID } from './constants';
import { createHyperframesAdapter } from './adapter';
import { mountHyperframesPlayer } from './player.client';

/** Browser registration: the HyperFrames player for `html-gsap`; render is reported by the server. */
export function registerHyperframesClient(): void {
  registerCodeRenderer('html-gsap', HYPERFRAMES_ENGINE_ID, 'hyperframes-player');
  registerEngine(HYPERFRAMES_ENGINE_ID, () => createHyperframesAdapter({ mountPlayer: mountHyperframesPlayer }));
}
