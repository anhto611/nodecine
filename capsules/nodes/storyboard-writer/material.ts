import { z } from 'zod';

/**
 * What a person tells the writer: a link to the app's store page or website, or a few sentences about
 * it, or both, in one box. Everything else a storyboard needs — the product's name, what it does, its
 * features, which picture shows which — the model works out from that, the linked page and the pictures.
 */

export const TONES = ['energetic', 'trustworthy', 'playful', 'expert'] as const;
export const DURATIONS = [15, 30, 45, 60, 90] as const;

/** A page a description links to, as text: what the model reads of it. */
export const LinkedPageSchema = z.object({ url: z.string(), title: z.string(), text: z.string().max(12_000) });
export type LinkedPage = z.infer<typeof LinkedPageSchema>;

/** The first web address in a description: the page to read. */
export const linkIn = (about: string): string | undefined => /https?:\/\/[^\s<>"')]+/i.exec(about)?.[0]?.replace(/[.,;!?]+$/, '');
