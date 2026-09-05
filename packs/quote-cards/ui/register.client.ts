'use client';
import { registerNodeBody } from '@/components/nodes/bodies';
import { registerNodeMeta } from '@/lib/node-meta';
import { PACK_ID } from '../constants';
import { QUOTE_DIRECTOR } from '../nodes/quote-director';
import { QuoteDirectorBody } from './QuoteDirectorBody';

/** Studio-side registration: node bodies and library metadata for this pack. */
export function registerQuoteCardsUi(): void {
  registerNodeMeta(QUOTE_DIRECTOR, { icon: 'bot', group: PACK_ID });
  registerNodeBody(QUOTE_DIRECTOR, QuoteDirectorBody);
}
