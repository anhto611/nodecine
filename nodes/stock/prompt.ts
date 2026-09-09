import { z } from 'zod';
import type { SceneScript } from '@/core/types/payloads';
import { stylePrompt, type StockStyle } from './styles';

/**
 * Turning what a scene says into what to search a picture library for (CORE_CONTRACTS §5.19).
 *
 * The libraries index in English, and the narration is in whatever the video is spoken in — a
 * Vietnamese sentence typed into Pexels returns nothing worth using. So a model writes one short
 * English phrase per scene. Without a model the narration is sent as it stands, which is right for
 * an English video and poor for any other; the node says so rather than pretending otherwise.
 */
export const StockQueriesSchema = z.object({
  queries: z.array(z.string().min(2).max(60)),
});

export function buildStockPrompt(script: SceneScript, style: StockStyle): string {
  return [
    'You choose stock photographs for a short video.',
    '',
    'For each scene below, write ONE English search phrase for a stock photo library.',
    '',
    'Rules:',
    '- Two to four words. Nouns and adjectives; no verbs, no sentences, no punctuation.',
    '- Describe a PHOTOGRAPH that could exist, and do not name brands, logos or celebrities.',
    '',
    stylePrompt(style),
    '',
    `Scenes (${script.scenes.length}), in order:`,
    ...script.scenes.map((s, i) => `${i + 1}. [${s.role}] ${s.narration}`),
    '',
    `Answer with JSON: {"queries": [...]} — exactly ${script.scenes.length} phrases, in the same order.`,
  ].join('\n');
}
