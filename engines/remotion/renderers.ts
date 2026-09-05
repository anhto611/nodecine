import { registerCoreScenes, TITLE_CARD } from '@/core/scenes/title-card';
import { registerSceneRenderer } from '@/core/scenes/registry';
import { REMOTION_ENGINE_ID } from './constants';
import { TitleCard } from './scenes/TitleCard';

/**
 * Registers every Remotion renderer this build ships. Imported both by the app (player) and by the
 * Remotion bundle entry (headless render) — the two run in separate module graphs, so each must register.
 * Only the core scenes: packs register their own renderers from `packs/installed.*`, so the engine
 * never names a pack.
 */
export function registerRemotionRenderers(): void {
  registerCoreScenes();
  registerSceneRenderer(TITLE_CARD, REMOTION_ENGINE_ID, TitleCard);
}
