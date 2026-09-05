import type { PackDefinition } from '@/core/packs/definition';
import { registerNodeType, type AnyNodeDefinition } from '@/core/nodes/definition';
import { registerTemplate } from '@/core/templates/registry';
import { PACK_ID } from './constants';
import { quoteDirector } from './nodes/quote-director';
import { registerQuoteCardsScenes } from './scenes/schemas';
import { QUOTE_CARDS_TEMPLATE, quoteCardsTemplate } from './template';
import { en, vi } from './locales';

/**
 * The second pack, and the smaller one on purpose: one node, one scene type, no network and no
 * server handler. `registerServer` is absent because nothing here leaves the machine.
 */
export const quoteCards: PackDefinition = {
  id: PACK_ID,
  displayName: 'Quote Cards',
  locales: { en, vi },
  register() {
    registerQuoteCardsScenes();
    registerNodeType(quoteDirector as unknown as AnyNodeDefinition);
    registerTemplate({
      id: QUOTE_CARDS_TEMPLATE,
      nameKey: 'templates.quotes',
      descriptionKey: 'templates.quotesDesc',
      category: 'faceless',
      nodeCount: 8,
      build: quoteCardsTemplate,
    });
  },
};
