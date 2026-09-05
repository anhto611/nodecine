import { registerGithubShowcaseRemotion } from './github-showcase/remotion';

/**
 * Scene renderers the Remotion bundle needs. The bundle is its own module graph, so it cannot reuse
 * the registrations the Studio made and has to repeat them here.
 */
export function installRemotionBundlePacks(): void {
  registerGithubShowcaseRemotion();
}
