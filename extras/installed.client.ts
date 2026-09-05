'use client';
import { registerGithubShowcaseUi } from './github/ui/register.client';
import { registerGithubShowcaseRemotion } from './github/remotion';
import { registerGithubShowcaseHyperframes } from './github/hyperframes';
import { registerQuoteCardsRemotion } from './quotes/remotion';
import { registerQuoteCardsHyperframes } from './quotes/hyperframes';

/**
 * Studio-side wiring for the extras: node bodies, library metadata and the scene renderers for every
 * engine that can preview in the browser. Separate from `installed.ts` because the server must not
 * import React or a canvas renderer.
 */
export function installClientExtras(): void {
  registerGithubShowcaseUi();
  registerGithubShowcaseRemotion();
  registerGithubShowcaseHyperframes();
  registerQuoteCardsRemotion();
  registerQuoteCardsHyperframes();
}
