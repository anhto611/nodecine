import { registerSceneRenderer } from '@/core/scenes/registry';
import { REMOTION_ENGINE_ID } from '@/engines/remotion/constants';
import { QUOTE, registerQuoteCardsScenes } from '../scenes/schemas';
import { Quote } from './Quote';

/**
 * One renderer, because the pack has one scene type. The opening card is `core/title-card`, which
 * the engine already renders — a pack only registers what it invented.
 */
export function registerQuoteCardsRemotion(): void {
  registerQuoteCardsScenes();
  registerSceneRenderer(QUOTE, REMOTION_ENGINE_ID, Quote);
}
