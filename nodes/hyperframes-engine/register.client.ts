'use client';
import { registerEngine } from '@/core/adapters/registry';
import { registerCodeRenderer } from '@/core/visual/renderers';
import { HYPERFRAMES_ENGINE_ID } from './constants';
import { createHyperframesAdapter } from './adapter';
import { mountHyperframesPlayer } from './player.client';
import { buildScenePreview } from './markup';

/** Browser registration: the HyperFrames player and the scene preview for `html-gsap`; render is reported by the server. */
export function registerHyperframesClient(): void {
  registerCodeRenderer('html-gsap', HYPERFRAMES_ENGINE_ID, 'hyperframes-player');
  registerEngine(HYPERFRAMES_ENGINE_ID, () => createHyperframesAdapter({ mountPlayer: mountHyperframesPlayer, previewScene: buildScenePreview }));
}
