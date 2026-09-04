import { registerSceneRenderer } from '@/core/scenes/registry';
import { REMOTION_ENGINE_ID } from '@/engines/remotion/constants';
import { CTA, HOOK, MOCKUP, registerGithubShowcaseScenes } from '../scenes/schemas';
import { Hook } from './Hook';
import { Mockup } from './Mockup';
import { Cta } from './Cta';

/**
 * Remotion renderers for the pack's three scene types (spec §4). Registered through the scene
 * registry only — the pack never imports the engine adapter (ARCHITECTURE §2). Called from the
 * engine's renderer list so both the browser player and the headless bundle get them.
 */
export function registerGithubShowcaseRemotion(): void {
  registerGithubShowcaseScenes();
  registerSceneRenderer(HOOK, REMOTION_ENGINE_ID, Hook);
  registerSceneRenderer(MOCKUP, REMOTION_ENGINE_ID, Mockup);
  registerSceneRenderer(CTA, REMOTION_ENGINE_ID, Cta);
}
