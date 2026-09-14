'use client';
import { registerEngine } from '@/contracts/adapters/registry';
import { registerCodeRenderer } from '@/contracts/visual/renderers';
import { HYPERFRAMES_ENGINE_ID } from './constants';
import { createHyperframesAdapter } from './adapter';
import { mountHyperframesPlayer } from './player.client';
import { buildScenePreview } from './markup';
import { registerHyperframesTransitions } from './transitions';

/** Browser registration: the HyperFrames player and the scene preview for `html-gsap`; render is reported by the server. */
export function registerHyperframesClient(): void {
  registerCodeRenderer('html-gsap', HYPERFRAMES_ENGINE_ID, 'hyperframes-player');
  // The same page draws the two other formats; the libraries are inlined only when a clip asks (libs.ts).
  registerCodeRenderer('html-three', HYPERFRAMES_ENGINE_ID, 'hyperframes-player');
  registerCodeRenderer('lottie', HYPERFRAMES_ENGINE_ID, 'hyperframes-player');
  registerHyperframesTransitions();
  // This half is the half that can draw a still, so this is where the job is claimed; the server
  // registration of the same engine renders films and claims nothing.
  registerEngine(HYPERFRAMES_ENGINE_ID, () => createHyperframesAdapter({ mountPlayer: mountHyperframesPlayer, previewScene: buildScenePreview }), { drawsStills: true });
}
