import { registerTemplate } from '@/core/templates/registry';
import githubShowcase from './github-showcase.json';
import quoteCards from './quote-cards.json';
import aiNews from './ai-news.json';
import stillWide from './still-wide.json';
import compareExplainer from './compare-explainer.json';

/**
 * The graphs this build ships. Each is a JSON file of the same shape a user saves from the canvas,
 * so anything here could have been made in the Studio — that is the test a template has to pass.
 * Adding one is adding a file and a line; nothing else in the repo learns its name.
 */
export const SHIPPED_TEMPLATES: unknown[] = [githubShowcase, quoteCards, aiNews, stillWide, compareExplainer];

export function registerTemplates(): void {
  for (const t of SHIPPED_TEMPLATES) registerTemplate(t);
}
