'use client';
import { registerGithubShowcaseUi } from './github-showcase/ui/register.client';
import { registerGithubShowcaseRemotion } from './github-showcase/remotion';
import { registerGithubShowcaseHyperframes } from './github-showcase/hyperframes';

/**
 * Studio-side pack wiring: node bodies, library metadata and the scene renderers for every engine
 * that can preview in the browser. Separate from `installed.ts` because the server must not import
 * React or a canvas renderer.
 */
export function installClientPacks(): void {
  registerGithubShowcaseUi();
  registerGithubShowcaseRemotion();
  registerGithubShowcaseHyperframes();
}
