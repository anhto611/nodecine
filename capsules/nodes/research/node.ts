import { z } from 'zod';
import { completeStructured } from '@/contracts/ai/structured-completion';
import { LLM_NEEDS, resolveLLM } from '@/contracts/resources';
import { linksIn, type Brief } from '@/contracts/types/brief';
import type { Research } from '@/contracts/types/research';
import type { LinkedPage } from '@/contracts/types/web';
import type { NodeDefinition } from '@/core/nodes/definition';
import { ResearchErrorCode } from './errors';
import { FindingsSchema, ResearchEditsSchema } from './material';
import { researchPrompt } from './prompt';

/** Links read from one brief, at most. */
export const MAX_LINKS = 5;
export const SEARCH = ['sources', 'web'] as const;

const Params = z.object({
  /** `sources`: read only the pages the brief links to. `web`: search the web too, when the model can. */
  search: z.enum(SEARCH).default('sources'),
  /** What this workflow's films need found out, for the model: set once with the workflow. */
  guide: z.string().max(8000).default(''),
  llmProvider: z.string().max(60).default(''),
  llmSettings: z.record(z.string(), z.unknown()).default({}),
  /** Raised by "Research again": a new look at the subject. */
  attempt: z.number().int().min(0).default(0),
  /** What a person corrected in the findings. */
  edits: ResearchEditsSchema.default({}),
});

/**
 * What the video's subject is, found out before anything is written: the pages the brief links to are
 * read, the web searched when the workflow asks and the model can, and the facts worth saying come back
 * with where each was read. What a film needs found out is the workflow's to say, in this node's
 * settings; the node itself knows no kind of film. Pictures are the Assets node's to find.
 */
export const research: NodeDefinition<typeof Params> = {
  type: 'research', version: 1, kind: 'process',
  inputs: [{ name: 'brief', type: 'Brief' }],
  outputs: [{ name: 'research', type: 'Research' }],
  paramsSchema: Params, defaultParams: Params.parse({}),
  run: async (ctx) => {
    const { params, inputs, services, log } = ctx;
    const brief = inputs.brief!.payload as Brief;

    ctx.progress(0.05, 'reading');
    const pages: LinkedPage[] = [];
    const unread: { url: string; why: string }[] = [];
    for (const link of linksIn(brief.about).slice(0, MAX_LINKS)) {
      try {
        const page = await services.invoke<LinkedPage>('research/read-page', [link]);
        pages.push(page);
        log('info', `read ${page.url}: ${page.text.length} characters`);
      } catch (e) {
        const why = e instanceof Error ? e.message : String(e);
        unread.push({ url: link, why });
        log('warn', `could not read ${link}: ${why}`, ResearchErrorCode.SOURCE_UNREADABLE);
      }
    }

    const ref = await resolveLLM(services, params, [...LLM_NEEDS, 'structuredOutput']);
    const web = params.search === 'web' && ref.capabilities.webSearch?.status === 'ready';
    if (params.search === 'web' && !web) log('warn', `${ref.displayName} cannot search the web: only the linked pages are read`, ResearchErrorCode.NO_WEB_SEARCH);

    ctx.progress(0.3, web ? 'searching' : 'reading the sources');
    const findings = await completeStructured({ ...ctx, fresh: false }, ref, {
      outputSchema: FindingsSchema,
      buildPrompt: () => researchPrompt({ brief, pages, unread, guide: params.guide, web }, params.attempt),
      languageOf: (o) => o.language,
      web,
    }, brief.language);

    const edits = params.edits;
    const out: Research = {
      language: findings.language,
      subject: (edits.subject ?? findings.subject).trim(),
      summary: (edits.summary ?? findings.summary).trim(),
      points: edits.points ?? findings.points.map((p) => ({ text: p.text, source: p.source ?? '' })),
      sources: findings.sources.map((s) => ({ url: s.url, title: s.title ?? '' })),
    };
    log('info', `${out.subject || '?'} · ${out.points.length} points · ${out.sources.length} sources${web ? ' · searched the web' : ''}`);
    return { research: out };
  },
};
