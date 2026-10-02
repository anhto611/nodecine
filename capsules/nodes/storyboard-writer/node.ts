import { z } from 'zod';
import { completeStructured } from '@/contracts/ai/structured-completion';
import { NodeError } from '@/contracts/errors';
import { LLM_NEEDS, resolveLLM } from '@/contracts/resources';
import { readBlockCatalog, readComponentCatalog, readSlots } from '@/contracts/storyboard/blocks';
import { GUIDE_FILE, readGuide } from '@/contracts/storyboard/guide';
import { readStoryboard, spokenLines } from '@/contracts/storyboard/read';
import { storyboardProblems } from '@/contracts/storyboard/validate';
import { assetProjectPath, type Assets } from '@/contracts/types/assets';
import type { Brief } from '@/contracts/types/brief';
import type { Composition } from '@/contracts/types/composition';
import type { Research } from '@/contracts/types/research';
import type { AudioScript } from '@/contracts/types/payloads';
import type { Storyboard } from '@/contracts/types/storyboard';
import type { NodeDefinition, RunContext } from '@/core/nodes/definition';
import { StoryboardWriterErrorCode } from './errors';
import { applyEdits, FrameEditSchema, renameEverywhere, toMarkdown, unwrapJson, WrittenFrameSchema, WrittenStoryboardSchema, type WrittenStoryboard } from './output';
import { repairPrompt, rewriteFramePrompt, writePrompt, type Request, type WriterMaterial } from './prompt';

/** Rounds of "here is what is wrong, fix it" before the node gives up and shows the draft. */
export const REPAIR_ROUNDS = 2;
const WORDS_PER_SECOND: Record<string, number> = { vi: 2.8, en: 2.5 };

/** How the narration sounds. */
export const TONES = ['energetic', 'trustworthy', 'playful', 'expert'] as const;
/** Lengths offered for a video, in seconds. */
export const DURATIONS = [15, 30, 45, 60, 90] as const;

const Params = z.object({
  /** How long the video runs, which sets how much the narration says. */
  durationSeconds: z.number().int().min(10).max(120).default(30),
  /** The narration's language. `auto`: the language the brief is written in. */
  language: z.string().min(2).max(35).default('auto'),
  /** How the narration sounds, set once with the workflow: an explainer speaks as an expert, an ad with energy. */
  tone: z.enum(TONES).default('energetic'),
  /** What the narration must say or must not say. */
  notes: z.string().max(1000).default(''),
  /** The subject as the person corrected it: written in place of the model's wherever the storyboard names it. */
  subject: z.string().max(120).default(''),
  llmProvider: z.string().max(60).default(''),
  llmSettings: z.record(z.string(), z.unknown()).default({}),
  /** Raised by "Write it again": a new take on the whole storyboard. */
  attempt: z.number().int().min(0).default(0),
  /** Scenes rewritten on their own, by index: how many times each has been asked for. */
  rewrites: z.record(z.string(), z.number().int().min(1)).default({}),
  /** What a person changed on each scene, by index. */
  edits: z.record(z.string(), FrameEditSchema).default({}),
});
type WriterParams = z.infer<typeof Params>;

interface Written {
  written: WrittenStoryboard;
  storyboard?: Storyboard;
  markdown: string;
  problems: string[];
}

/**
 * A storyboard written from the brief. A model reads what the person asked for, what Research found out
 * when it ran, the pictures and the workflow's blocks, and writes one scene per idea, each playing a block with its values and its moments tied to the
 * words said over it. The result is checked with the rules the Assemble node holds a storyboard to;
 * what breaks them goes back to the model, twice at most. A person's edits to a scene are laid over
 * what the model wrote and checked the same way.
 */
export const storyboardWriter: NodeDefinition<typeof Params> = {
  type: 'storyboard-writer',
  version: 1,
  kind: 'process',
  inputs: [
    { name: 'brief', type: 'Brief' },
    { name: 'research', type: 'Research', required: false },
    { name: 'composition', type: 'Composition' },
    { name: 'assets', type: 'Assets', required: false },
  ],
  outputs: [
    { name: 'storyboard', type: 'Storyboard' },
    { name: 'script', type: 'AudioScript' },
  ],
  paramsSchema: Params,
  defaultParams: Params.parse({}),
  run: async (ctx) => {
    const { params, inputs, services, log } = ctx;
    const brief = inputs.brief!.payload as Brief;
    const research = inputs.research?.payload as Research | undefined;
    // The narration is written again from the start, in the language asked for: the brief's own unless one is chosen.
    const language = params.language === 'auto' ? brief.language : params.language.toLowerCase();
    const request: Request = { brief, language, durationSeconds: params.durationSeconds, tone: params.tone, notes: params.notes, ...(research ? { research } : {}) };
    const composition = inputs.composition!.payload as Composition;
    const assets = inputs.assets?.payload as Assets | undefined;
    const ref = await resolveLLM(services, params, [...LLM_NEEDS, 'structuredOutput']);
    const catalog = readBlockCatalog(composition.files);
    const components = readComponentCatalog(composition.files);
    const slots = readSlots(composition.files);
    if (!catalog.length) throw new NodeError(StoryboardWriterErrorCode.NO_BLOCKS, 'the composition has no blocks to build scenes from').withFix('add blocks to the composition under compositions/');

    const seen = ref.capabilities.vision?.status === 'ready';
    const items = assets?.items ?? [];
    const guide = readGuide(composition.files[GUIDE_FILE]);
    const material: WriterMaterial = {
      request,
      catalog,
      components,
      slots,
      seen,
      first: guide.first,
      last: guide.last,
      repeat: guide.repeat,
      guide: guide.body,
      pictures: items.map((a) => ({ path: assetProjectPath(a), name: a.name, note: a.note, width: a.width, height: a.height })),
      wordsPerSecond: WORDS_PER_SECOND[language] ?? 2.6,
    };
    const images = seen ? items.map((a) => a.url) : [];
    if (items.length && !seen) log('warn', `${ref.displayName} cannot see pictures: it chooses them by their notes`);
    const rules = {
      catalog,
      assets: material.pictures.map((p) => p.path),
      targetSeconds: params.durationSeconds,
      wordsPerSecond: material.wordsPerSecond,
      first: guide.first,
      last: guide.last,
      repeat: guide.repeat,
      components,
      slots: Object.keys(slots),
    };
    const format = `${composition.width}x${composition.height}`;
    // Asked without `fresh`: a single run of this node (to rewrite one scene) must not rewrite the others.
    const asking: Pick<RunContext, 'signal' | 'progress' | 'fresh' | 'services' | 'log'> = { ...ctx, fresh: false };
    const ask = <S extends z.ZodTypeAny>(schema: S, prompt: string, languageOf: (out: z.infer<S>) => string) =>
      completeStructured(asking, ref, { outputSchema: schema, buildPrompt: () => prompt, languageOf, images }, language);

    const check = (raw: WrittenStoryboard): Written => {
      const written = unwrapJson(raw);
      const markdown = toMarkdown(written, { format });
      const reading = readStoryboard(markdown);
      const problems = reading.storyboard ? storyboardProblems(reading.storyboard, rules) : reading.problems;
      return { written, storyboard: reading.storyboard, markdown, problems };
    };

    ctx.progress(0.1, 'writing');
    let best = check(await ask(WrittenStoryboardSchema, writePrompt(material, params.attempt), (o) => o.language));
    for (let round = 1; round <= REPAIR_ROUNDS && best.problems.length; round++) {
      log('info', `round ${round}: ${best.problems.length} problems to fix`);
      ctx.progress(0.3 + round * 0.2, `fixing ${best.problems.length} problems`);
      const next = check(await ask(WrittenStoryboardSchema, repairPrompt(material, best.written, best.problems), (o) => o.language));
      if (next.problems.length <= best.problems.length) best = next;
    }

    // Scenes a person asked to have rewritten, each on its own, in scene order.
    let written = best.written;
    for (const [index, take] of Object.entries(params.rewrites).sort(([a], [b]) => Number(a) - Number(b))) {
      const i = Number(index);
      if (!written.frames[i]) continue;
      const frame = await ask(WrittenFrameSchema, rewriteFramePrompt(material, written, i, take), () => language);
      written = { ...written, frames: written.frames.map((f, j) => (j === i ? frame : f)) };
    }

    if (params.subject.trim() && written.subject && params.subject.trim() !== written.subject) written = renameEverywhere(written, written.subject, params.subject.trim());
    const final = check(applyEdits(written, params.edits));
    if (final.problems.length || !final.storyboard) {
      throw new NodeError(StoryboardWriterErrorCode.STORYBOARD_UNWRITABLE, final.problems[0] ?? 'the storyboard does not read', false, {
        problems: final.problems,
        markdown: final.markdown,
        written: final.written,
      }).withFix(final.problems.length > 1 ? `and ${final.problems.length - 1} more: edit the scenes, or write it again` : 'edit the scene, or write it again');
    }
    const lines = spokenLines(final.storyboard);
    log('info', `${final.storyboard.subject ?? '?'} · ${final.storyboard.frames.length} scenes · ${lines.join(' ').split(/\s+/).length} words · ${Object.keys(params.edits).length} edited`);
    return {
      storyboard: final.storyboard,
      script: { text: lines.join(' '), language, segments: lines } satisfies AudioScript,
    };
  },
};

export type { WriterParams };
