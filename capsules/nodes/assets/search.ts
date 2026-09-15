import { z } from 'zod';
import { completeStructured, type StructuredContext } from '@/contracts/ai/structured-completion';
import { LLM_NEEDS, resolveLLM } from '@/contracts/resources';
import { assetNameFor, type Asset } from '@/contracts/types/assets';
import { linksIn, type Brief } from '@/contracts/types/brief';
import type { Research } from '@/contracts/types/research';
import type { FetchedPicture, FoundPicture, LinkedPage } from '@/contracts/types/web';
import type { RunContext } from '@/core/nodes/definition';

/**
 * Finding the pictures a video can show: the pages the brief links to and the pages Research read are
 * read for the pictures they show, those are brought onto this machine, and a model that looks at them
 * picks the ones that show the subject, each with a note saying what it shows.
 */

/** Pages read for pictures, at most. */
export const MAX_PAGES = 8;
/** Pictures taken from one page, at most: the ones it leads with. */
const PER_PAGE = 6;
/** Pictures brought and shown to the model, at most. */
export const MAX_CANDIDATES = 20;
/** Smaller than this on its long side is an icon or a badge, not a picture for a film. */
export const MIN_SIDE = 320;

const LANGUAGE_NAMES: Record<string, string> = { vi: 'Vietnamese', en: 'English' };

export const PicksSchema = z.object({
  language: z.string().min(2).max(35),
  pictures: z.array(z.object({ number: z.number().int().min(1), note: z.string().max(500) })).max(40).default([]),
});

export interface SearchInput { brief?: Brief; research?: Research; pictures: number; wanted: string; attempt: number }
type Usable = { picture: FoundPicture; f: FetchedPicture };

/** A picture's name from its note: the note's first phrase, a few words of it. */
const nameFrom = (note: string, taken: string[]) => assetNameFor(note.split(/[,:;(“"«]/)[0]!.trim().split(/\s+/).slice(0, 5).join(' ') || note, taken);

/** In small batches: a page shows many pictures, and a server asked for all at once may refuse. */
async function inBatches<T, R>(items: T[], size: number, work: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = [];
  for (let i = 0; i < items.length; i += size) out.push(...(await Promise.all(items.slice(i, i + size).map(work))));
  return out;
}

export function picturesPrompt(input: SearchInput, candidates: Usable[], seen: boolean): string {
  const language = LANGUAGE_NAMES[input.brief?.language ?? input.research?.language ?? 'en'] ?? 'English';
  const { brief, research } = input;
  return `A short video is being made. Pick the pictures it can show.

${brief ? `What the video is about (the brief):\n${brief.about}\n` : ''}${research ? `\nWhat was found out about ${research.subject || 'it'}:\n${research.summary}\n` : ''}${input.wanted.trim() ? `\nThe pictures this workflow's films need:\n${input.wanted.trim()}\n` : ''}
${seen ? 'The pictures are attached in this order; look at each one:' : 'The pictures (not attached; judge by their description):'}
${candidates.map((c, i) => `${i + 1}. ${c.picture.alt || '(no description)'}${c.f.width ? ` · ${c.f.width}×${c.f.height}` : ''} · on ${c.picture.page}`).join('\n')}

Rules:
- Pick at most ${input.pictures} pictures that show the subject itself (its screens, its product, its logo, its charts), each with a note saying what it shows in a few words, in ${language}, so a storyboard writer can match a scene to it.
- Leave out banners, ads, avatars, portraits, stock photos, decoration and pictures of something else. Picking none is a fine answer.
${input.attempt > 0 ? `- This is look number ${input.attempt + 1}: pick differently where the pictures allow.\n` : ''}
Answer with the JSON object only, no commentary, no code fence, in this shape:
{ "language": "<the language code you wrote in>", "pictures": [ { "number": <n>, "note": "<what it shows>" } ] }`;
}

/** The pictures found for a brief and its research, as assets named after what they show. */
export async function findPictures(ctx: Pick<RunContext, 'services' | 'log' | 'progress' | 'signal' | 'fresh'> & { params: { llmProvider: string; llmSettings?: Record<string, unknown> } }, input: SearchInput): Promise<Asset[]> {
  const { services, log } = ctx;
  const links = [...new Set([...linksIn(input.brief?.about ?? ''), ...(input.research?.sources ?? []).map((s) => s.url).filter((u) => /^https?:\/\//.test(u))])].slice(0, MAX_PAGES);
  if (!links.length) {
    log('info', 'no pages to find pictures on');
    return [];
  }
  ctx.progress(0.1, 'reading the pages');
  const pages = (await inBatches(links, 4, (link) => services.invoke<LinkedPage>('assets/read-page', [link]).catch((e: unknown) => {
    log('warn', `could not read ${link}: ${e instanceof Error ? e.message : String(e)}`);
    return null;
  }))).filter((p): p is LinkedPage => !!p);

  ctx.progress(0.3, 'bringing the pictures');
  const offered = pages.flatMap((p) => p.pictures.slice(0, PER_PAGE)).slice(0, MAX_CANDIDATES);
  const fetched = await inBatches(offered, 4, (picture) => services.invoke<FetchedPicture>('assets/fetch-picture', [picture.url]).then((f) => ({ picture, f }), () => null));
  const usable = fetched.filter((x): x is Usable => !!x && (!x.f.width || Math.max(x.f.width, x.f.height ?? 0) >= MIN_SIDE));
  const candidates = usable.filter((x, i) => usable.findIndex((y) => y.f.url === x.f.url) === i);
  if (!candidates.length) {
    log('info', `${pages.length} pages read, no pictures a film can use`);
    return [];
  }

  ctx.progress(0.5, 'picking');
  const ref = await resolveLLM(services, ctx.params as { llmProvider: string; llmSettings?: Record<string, unknown> }, [...LLM_NEEDS, 'structuredOutput']);
  const seen = ref.capabilities.vision?.status === 'ready';
  const language = input.brief?.language ?? input.research?.language ?? 'en';
  const picks = await completeStructured({ ...ctx, fresh: false } as StructuredContext, ref, {
    outputSchema: PicksSchema,
    buildPrompt: () => picturesPrompt(input, candidates, seen),
    languageOf: (o) => o.language,
    images: seen ? candidates.map((x) => x.f.url) : [],
  }, language);

  const items: Asset[] = [];
  for (const pick of picks.pictures.slice(0, input.pictures)) {
    const chosen = candidates[pick.number - 1];
    if (!chosen || items.some((a) => a.url === chosen.f.url)) continue;
    items.push({ name: nameFrom(pick.note, items.map((a) => a.name)), url: chosen.f.url, note: pick.note, ...(chosen.f.width ? { width: chosen.f.width, height: chosen.f.height } : {}), source: chosen.picture.page });
  }
  log('info', `${pages.length} pages · ${candidates.length} pictures looked at · ${items.length} picked`);
  return items;
}
