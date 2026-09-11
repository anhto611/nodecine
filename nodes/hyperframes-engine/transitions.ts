import { REQUIRED_TRANSITIONS } from '@/core/types/ir';
import { GSAP_TRANSITION_CATALOG, gsapTransitionCatalogScript } from '@/core/visual/gsap-transitions';
import { registerTransition } from '@/core/visual/transitions';
import { HYPERFRAMES_ENGINE_ID } from './constants';

/** What HyperFrames draws: the core's gsap catalogue, whole, on the page's master timeline. */
export const TRANSITION_CATALOG = GSAP_TRANSITION_CATALOG;

/** The catalogue as the page's own JavaScript: one function per name, keyed by name. */
export const transitionCatalogScript = (): string => gsapTransitionCatalogScript();

/** Both halves of the engine register the same names; the page draws them, so the impl is the body. */
export function registerHyperframesTransitions(): void {
  for (const name of REQUIRED_TRANSITIONS) if (!(name in TRANSITION_CATALOG)) throw new Error(`HyperFrames catalogue is missing the required transition "${name}"`);
  for (const [name, body] of Object.entries(TRANSITION_CATALOG)) registerTransition(name, HYPERFRAMES_ENGINE_ID, body);
}
