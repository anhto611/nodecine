import { registerTemplate } from '@/core/templates/registry';
import staticScript from './static-script.json';
import githubShowcase from './github-showcase.json';
import quoteCards from './quote-cards.json';

/**
 * The graphs this build ships. Each is a JSON file of the same shape a user saves from the canvas,
 * so anything here could have been made in the Studio — that is the test a template has to pass.
 * Adding one is adding a file and a line; nothing else in the repo learns its name.
 */
export const SHIPPED_TEMPLATES: unknown[] = [staticScript, githubShowcase, quoteCards];

export function registerTemplates(): void {
  for (const t of SHIPPED_TEMPLATES) registerTemplate(t);
}
