import { registerCoreScenes, TITLE_CARD } from '@/core/scenes/title-card';
import { registerSceneRenderer } from '@/core/scenes/registry';
import { REMOTION_ENGINE_ID } from './constants';
import { TitleCard } from './scenes/TitleCard';
import { registerGithubShowcaseRemotion } from '@/packs/github-showcase/remotion';

/**
 * Registers every Remotion renderer this build ships. Imported both by the app (player) and by the
 * Remotion bundle entry (headless render) — the two run in separate module graphs, so each must register.
 * Packs append their renderers here; this is the one place the engine knows a pack by name.
 */
export function registerRemotionRenderers(): void {
  registerCoreScenes();
  registerSceneRenderer(TITLE_CARD, REMOTION_ENGINE_ID, TitleCard);
  registerGithubShowcaseRemotion();
}
