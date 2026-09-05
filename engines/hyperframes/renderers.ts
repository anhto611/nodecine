import { registerCoreScenes, TITLE_CARD } from '@/core/scenes/title-card';
import { registerSceneRenderer } from '@/core/scenes/registry';
import { HYPERFRAMES_ENGINE_ID } from './constants';
import { drawTitleCard } from './scenes/title-card';

/**
 * The core scenes this engine can draw. Packs register their own from `packs/installed.client.ts`.
 */
export function registerHyperframesRenderers(): void {
  registerCoreScenes();
  registerSceneRenderer(TITLE_CARD, HYPERFRAMES_ENGINE_ID, drawTitleCard);
}
