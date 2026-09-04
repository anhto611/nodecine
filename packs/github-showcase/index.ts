/**
 * github-showcase pack — isomorphic registrations: scene schemas and nodes (renderers and the
 * template arrive with the Remotion module and template.ts).
 * Server-only handlers live in ./server, UI in ./ui; both import from here, never the reverse.
 */
import { registerNodeType, type AnyNodeDefinition } from '@/core/nodes/definition';
import { githubFetcher } from './nodes/github-fetcher';
import { aiDirector } from './nodes/ai-director';
import { registerGithubShowcaseScenes } from './scenes/schemas';
import { registerTemplate } from '@/core/templates/registry';
import { GITHUB_SHOWCASE_TEMPLATE, githubShowcaseTemplate } from './template';

export { PACK_ID, PACK_VERSION } from './constants';
export { GITHUB_SHOWCASE_TEMPLATE } from './template';

let done = false;
export function registerGithubShowcase(): void {
  if (done) return;
  done = true;
  registerGithubShowcaseScenes();
  registerNodeType(githubFetcher as unknown as AnyNodeDefinition);
  registerNodeType(aiDirector as unknown as AnyNodeDefinition);
  registerTemplate(GITHUB_SHOWCASE_TEMPLATE, githubShowcaseTemplate);
}
