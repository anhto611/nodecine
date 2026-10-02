import { z } from 'zod';
import { completeStructured, type StructuredContext } from '@/contracts/ai/structured-completion';
import { LLM_NEEDS, resolveLLM } from '@/contracts/resources';
import { languageName } from '@/contracts/text/languages';
import { assetNameFor, type Asset } from '@/contracts/types/assets';
import { linksIn, type Brief } from '@/contracts/types/brief';
import type { FetchedPicture, FoundPicture, LinkedPage } from '@/contracts/types/web';
import type { RunContext } from '@/core/nodes/definition';

/**
 * Finding the pictures a video can show: the pages the brief links to, and the pages a model that can
 * search the web finds for its subject, are read for the pictures they show; those are brought onto this
 * machine, and a model that looks at them picks the ones that show the subject, each with a note saying
 * what it shows.
 */

/** Pages read for pictures, at most. */
export const MAX_PAGES = 8;
/** Pages a web search adds, at most. */
export const MAX_FOUND_PAGES = 6;
/** Pictures taken from one page, at most: the ones it leads with. */
const PER_PAGE = 6;
/** Pictures brought and shown to the model, at most. */
export const MAX_CANDIDATES = 20;
/** Smaller than this on its long side is an icon or a badge, not a picture for a film. */
export const MIN_SIDE = 320;

export const PagesSchema = z.object({
  pages: z
    .array(z.object({ url: z.string().max(2000) }))
    .max(20)
    .default([]),
});

export const PicksSchema = z.object({
  language: z.string().min(2).max(35),
  pictures: z
    .array(z.object({ number: z.number().int().min(1), note: z.string().max(500) }))
    .max(40)
    .default([]),
});

export interface SearchInput {
  brief: Brief;
  pictures: number;
  wanted: string;
  attempt: number;
  /** The pictures a person already brought: a found picture must not show the same thing again. */
  existing: Asset[];
  /** Found pictures a person removed, by address: never offered again. */
  removed?: string[];
}

/** Pictures already in the video shown to the model beside the candidates, at most. */
export const MAX_EXISTING = 12;

type Usable = { picture: FoundPicture; f: FetchedPicture };
type SearchContext = Pick<RunContext, 'services' | 'log' | 'progress' | 'signal' | 'fresh'> & { params: { llmProvider: string; llmSettings?: Record<string, unknown> } };

/** A picture's name from its note: the note's first phrase, a few words of it. */
const nameFrom = (note: string, taken: string[]) =>
  assetNameFor(
    note
      .split(/[,:;(“"«]/)[0]!
      .trim()
      .split(/\s+/)
      .slice(0, 5)
      .join(' ') || note,
    taken,
  );

/** In small batches: a page shows many pictures, and a server asked for all at once may refuse. */
async function inBatches<T, R>(items: T[], size: number, work: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = [];
  for (let i = 0; i < items.length; i += size) out.push(...(await Promise.all(items.slice(i, i + size).map(work))));
  return out;
}

export function pagesPrompt(input: SearchInput, known: string[]): string {
  return `A short video is being made about what the brief below describes. Search the web for the pages that show its subject in pictures: the maker's own site, its store page, its announcement, blog or docs, a press kit, a review with screenshots.

The brief:
${input.brief.about}
${input.wanted.trim() ? `\nThe pictures this workflow's films need:\n${input.wanted.trim()}\n` : ''}${input.existing.length ? `\nThe video already has pictures of: ${input.existing.map((a) => a.note || a.name).join('; ')}. Look for pages with what is still missing.\n` : ''}${known.length ? `\nPages already known (do not list them again): ${known.join(', ')}\n` : ''}
Rules:
- List at most ${MAX_FOUND_PAGES} page addresses, the most useful first. Pages, not picture files.
- Only pages about this subject; prefer its maker's own.
Answer with the JSON object only, no commentary, no code fence, in this shape:
{ "pages": [ { "url": "<page address>" } ] }`;
}

export function picturesPrompt(input: SearchInput, candidates: Usable[], seen: boolean, existing: Asset[] = input.existing.slice(0, MAX_EXISTING)): string {
  const language = languageName(input.brief.language);
  const already = existing.length
    ? `${seen ? `The first ${existing.length} attached pictures are already in the video (A1…A${existing.length}); the candidates follow them.` : 'Pictures already in the video:'}
${existing.map((a, i) => `A${i + 1}. ${a.note || a.name}`).join('\n')}

`
    : '';
  return `A short video is being made. Pick the pictures it can show.

What the video is about (the brief):
${input.brief.about}
${input.wanted.trim() ? `\nThe pictures this workflow's films need:\n${input.wanted.trim()}\n` : ''}
${already}${seen ? `The candidates${existing.length ? ', attached after those,' : ' are attached'} in this order; look at each one:` : 'The candidates (not attached; judge by their description):'}
${candidates.map((c, i) => `${i + 1}. ${c.picture.alt || '(no description)'}${c.f.width ? ` · ${c.f.width}×${c.f.height}` : ''} · on ${c.picture.page}`).join('\n')}

Rules:
- Pick at most ${input.pictures} candidates that show the subject itself (its screens, its product, its logo, its charts), each with a note saying what it shows in a few words, in ${language}, so a storyboard writer can match a scene to it.${
    existing.length
      ? `
- Never pick a candidate that shows the same thing as a picture already in the video (the same screen, the same logo, the same chart), even at another size, crop or quality: the video has it.`
      : ''
  }
- Never pick two candidates that show the same thing; keep the sharper one.
- Leave out banners, ads, avatars, portraits, stock photos, decoration and pictures of something else. Picking none is a fine answer.
Answer with the JSON object only, no commentary, no code fence, in this shape:
{ "language": "<the language code you wrote in>", "pictures": [ { "number": <n>, "note": "<what it shows>" } ] }`;
}

/** The pictures found for a brief, as assets named after what they show. */
export async function findPictures(ctx: SearchContext, input: SearchInput): Promise<Asset[]> {
  const { services, log } = ctx;
  const ref = await resolveLLM(services, ctx.params, [...LLM_NEEDS, 'structuredOutput']);
  // "Find again" runs the node on its own, which asks the model again instead of taking its last answer;
  // a whole run takes the kept answer to the same question.
  const asking = { ...ctx } as StructuredContext;
  const given = linksIn(input.brief.about).slice(0, MAX_PAGES);

  // Pages the brief does not link to, found by a model that can search the web.
  let searched: string[] = [];
  if (ref.capabilities.webSearch?.status === 'ready') {
    ctx.progress(0.05, 'searching for pages');
    const found = await completeStructured(
      asking,
      ref,
      {
        outputSchema: PagesSchema,
        buildPrompt: () => pagesPrompt(input, given),
        languageOf: () => input.brief.language,
        web: true,
      },
      input.brief.language,
    ).catch((e: unknown) => {
      log('warn', `could not search for pages: ${e instanceof Error ? e.message : String(e)}`);
      return { pages: [] };
    });
    searched = found.pages
      .map((p) => p.url)
      .filter((u) => /^https?:\/\//.test(u) && !given.includes(u))
      .slice(0, MAX_FOUND_PAGES);
  } else if (!given.length) {
    log('info', `${ref.displayName} cannot search the web and the brief links to no page: no pictures to find`);
    return [];
  }
  const links = [...given, ...searched].slice(0, MAX_PAGES);
  if (!links.length) {
    log('info', 'no pages to find pictures on');
    return [];
  }

  ctx.progress(0.3, 'reading the pages');
  const pages = (
    await inBatches(links, 4, (link) =>
      services.invoke<LinkedPage>('assets/read-page', [link]).catch((e: unknown) => {
        log('warn', `could not read ${link}: ${e instanceof Error ? e.message : String(e)}`);
        return null;
      }),
    )
  ).filter((p): p is LinkedPage => !!p);

  ctx.progress(0.45, 'bringing the pictures');
  const offered = pages.flatMap((p) => p.pictures.slice(0, PER_PAGE)).slice(0, MAX_CANDIDATES);
  const fetched = await inBatches(offered, 4, (picture) =>
    services.invoke<FetchedPicture>('assets/fetch-picture', [picture.url]).then(
      (f) => ({ picture, f }),
      () => null,
    ),
  );
  const usable = fetched.filter((x): x is Usable => !!x && (!x.f.width || Math.max(x.f.width, x.f.height ?? 0) >= MIN_SIDE));
  // A picture already in the video, byte for byte, is no candidate: its address is its content.
  const have = new Set([...input.existing.map((a) => a.url), ...(input.removed ?? [])]);
  const candidates = usable.filter((x, i) => usable.findIndex((y) => y.f.url === x.f.url) === i && !have.has(x.f.url));
  if (!candidates.length) {
    log('info', `${pages.length} pages read, no pictures a film can use`);
    return [];
  }

  ctx.progress(0.6, 'picking');
  const seen = ref.capabilities.vision?.status === 'ready';
  const existing = input.existing.slice(0, MAX_EXISTING);
  const picks = await completeStructured(
    asking,
    ref,
    {
      outputSchema: PicksSchema,
      buildPrompt: () => picturesPrompt(input, candidates, seen, existing),
      languageOf: (o) => o.language,
      // What the video has first, then the candidates: the prompt names them in that order.
      images: seen ? [...existing.map((a) => a.url), ...candidates.map((x) => x.f.url)] : [],
    },
    input.brief.language,
  );

  const items: Asset[] = [];
  for (const pick of picks.pictures.slice(0, input.pictures)) {
    const chosen = candidates[pick.number - 1];
    if (!chosen || items.some((a) => a.url === chosen.f.url)) continue;
    items.push({
      name: nameFrom(
        pick.note,
        items.map((a) => a.name),
      ),
      url: chosen.f.url,
      note: pick.note,
      ...(chosen.f.width ? { width: chosen.f.width, height: chosen.f.height } : {}),
      source: chosen.picture.page,
    });
  }
  log('info', `${pages.length} pages${searched.length ? ` (${searched.length} found on the web)` : ''} · ${candidates.length} pictures looked at · ${items.length} picked`);
  return items;
}
