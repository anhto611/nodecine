/**
 * The pack's one scene type: a single quote, filling the frame.
 *
 * One type is deliberate. The video is N of these in a row, so the plan's length comes from what
 * the model wrote rather than from a fixed tuple — which is what makes this pack a different shape
 * from github-showcase, where the three scenes are always the same three.
 */
import { z } from 'zod';
import { registerScene } from '@/core/scenes/registry';
import { PACK_ID } from '../constants';

export const QUOTE = `${PACK_ID}/quote` as const;
export const THEME = `${PACK_ID}/ink` as const;

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'accentColor must be a 6-digit hex colour');

/**
 * Everything the model writes; nothing is bound from facts, because this pack has no facts. The
 * renderer therefore sees exactly this shape, with no optional fields added by the assembler.
 */
export const QuoteModelSchema = z.object({
  text: z.string().min(8).max(220),
  attribution: z.string().min(1).max(60),
  accentColor: hex,
});
export type QuoteProps = z.infer<typeof QuoteModelSchema>;

export function registerQuoteCardsScenes(): void {
  registerScene({ sceneType: QUOTE, propsSchema: QuoteModelSchema });
}
