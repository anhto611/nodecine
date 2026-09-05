import type { PackDefinition } from '@/core/packs/definition';
import { registerNodeType, type AnyNodeDefinition } from '@/core/nodes/definition';
import { registerTemplate } from '@/core/templates/registry';
import { PACK_ID } from './constants';
import { githubFetcher } from './nodes/github-fetcher';
import { aiDirector } from './nodes/ai-director';
import { registerGithubShowcaseScenes } from './scenes/schemas';
import { GITHUB_SHOWCASE_TEMPLATE, githubShowcaseTemplate } from './template';
import { en, vi } from './locales';
import { registerGithubShowcaseServer } from './server';

/**
 * The pack as the core sees it. Isomorphic on purpose: no React, no canvas, no node built-ins, so
 * the server can install it without dragging an engine in. Renderers and Studio bodies are wired
 * from `packs/installed.client.ts` and `packs/installed.remotion.ts` instead.
 */
export const githubShowcase: PackDefinition = {
  id: PACK_ID,
  displayName: 'GitHub Showcase',
  locales: { en, vi },
  register() {
    registerGithubShowcaseScenes();
    registerNodeType(githubFetcher as unknown as AnyNodeDefinition);
    registerNodeType(aiDirector as unknown as AnyNodeDefinition);
    registerTemplate({
      id: GITHUB_SHOWCASE_TEMPLATE,
      nameKey: 'templates.github',
      descriptionKey: 'templates.githubDesc',
      category: 'tech',
      nodeCount: 10,
      build: githubShowcaseTemplate,
    });
  },
  registerServer() {
    registerGithubShowcaseServer();
  },
};
