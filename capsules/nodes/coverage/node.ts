import { z } from 'zod';
import { completeStructured } from '@/contracts/ai/structured-completion';
import { NodeError } from '@/contracts/errors';
import { LLM_NEEDS, resolveLLM } from '@/contracts/resources';
import { checkBlockValues, readBlockCatalog, readComponentCatalog, readSlots } from '@/contracts/storyboard/blocks';
import { detectLanguage } from '@/contracts/text/detect-language';
import { ASSETS_DIR, assetProjectPath, type Assets } from '@/contracts/types/assets';
import type { Composition } from '@/contracts/types/composition';
import type { Storyboard, StoryboardFrame } from '@/contracts/types/storyboard';
import type { NodeDefinition, RunContext } from '@/core/nodes/definition';
import { CoverageErrorCode } from './errors';
import { buildCoveragePrompt, CoverageAnswerSchema, type CoverageMaterial } from './prompt';

const Params = z.object({
  llmProvider: z.string().max(60).default(''),
  llmSettings: z.record(z.string(), z.unknown()).default({}),
  /** Bumped by hand to ask again for a different cut of the same scenes. */
  attempt: z.number().int().min(0).default(0),
});

/**
 * What each scene of a recorded film shows: its coverage.
 *
 * The scenes are not this node's business. The Rough Cut node put them where the speech stops, by the
 * clock, without a model, and re-running this must never move them — so every frame comes out with the
 * number, the words, the length and the second of the recording it started from exactly as they came in.
 * What this decides is the picture: the person filling the frame, or moved into a card with something
 * to look at beside them, and the few words worth putting on screen.
 *
 * A model that answers with a block the composition does not have, or values the block would refuse,
 * loses that scene and only that scene: it keeps what the rough cut gave it, and the run says so.
 */
export const coverage: NodeDefinition<typeof Params> = {
  type: 'coverage', version: 1, kind: 'process',
  inputs: [
    { name: 'storyboard', type: 'Storyboard' },
    { name: 'composition', type: 'Composition' },
    { name: 'assets', type: 'Assets', required: false },
  ],
  outputs: [{ name: 'storyboard', type: 'Storyboard' }],
  paramsSchema: Params, defaultParams: Params.parse({}),
  run: async (ctx) => {
    const { params, inputs, services, log } = ctx;
    const storyboard = inputs.storyboard!.payload as Storyboard;
    const composition = inputs.composition!.payload as Composition;
    const pictures = (inputs.assets?.payload as Assets | undefined)?.items ?? [];
    const catalog = readBlockCatalog(composition.files).filter((b) => b.role !== 'overlay');
    // A film-wide overlay is assemble.json's to run; only the pieces a scene can throw are offered here.
    const components = readComponentCatalog(composition.files).filter((c) => c.role !== 'overlay');
    const slots = Object.keys(readSlots(composition.files));
    if (!catalog.length) {
      throw new NodeError(CoverageErrorCode.COVERAGE_NO_BLOCKS, 'the composition has no blocks to show these scenes with')
        .withFix('add blocks to the composition under compositions/');
    }
    const ref = await resolveLLM(services, params, [...LLM_NEEDS, 'structuredOutput']);
    const seen = ref.capabilities.vision?.status === 'ready';
    const said = storyboard.frames.map((f) => f.voiceover ?? '').join(' ');
    const language = detectLanguage(said);

    const material: CoverageMaterial = {
      frames: storyboard.frames,
      catalog,
      components,
      slots,
      pictures: pictures.map((a) => ({ path: assetProjectPath(a), name: a.name, ...(a.note ? { note: a.note } : {}) })),
      subject: storyboard.subject ?? 'what the person is talking about',
      seen,
    };
    if (pictures.length && !seen) log('warn', `${ref.displayName} cannot see pictures: it places them by their notes`);

    const answer = await completeStructured(
      { ...ctx, fresh: ctx.fresh } as Pick<RunContext, 'signal' | 'progress' | 'fresh' | 'services' | 'log'>,
      ref,
      {
        outputSchema: CoverageAnswerSchema,
        buildPrompt: (lang, strict) => `${buildCoveragePrompt(material, lang, strict)}${params.attempt ? `\n\n(Attempt ${params.attempt + 1}: cut it differently.)` : ''}`,
        languageOf: (out) => out.language,
        ...(seen ? { images: pictures.map((a) => a.url) } : {}),
      },
      language,
    );

    const byNumber = new Map(answer.scenes.map((s) => [s.number, s] as const));
    const offered = new Set(material.pictures.map((p) => p.path));
    const problems: string[] = [];
    let dressed = 0;
    let pieces = 0;
    const frames: StoryboardFrame[] = storyboard.frames.map((frame) => {
      const said = byNumber.get(frame.number);
      const block = said ? catalog.find((b) => b.name === said.block) : undefined;
      if (!said || !block) {
        if (said) problems.push(`scene ${frame.number}: no block called "${said.block}"`);
        return frame;
      }
      // The cut and the clock are the Rough Cut node's; only the look comes from here. A block that
      // shows no recording — a card, a cutaway — declares no `from`, and must not be given one.
      const showsTheClip = block.variables.some((v) => v.id === 'from');
      const values: Record<string, unknown> = { ...said.values };
      if (showsTheClip && frame.values.from !== undefined) values.from = frame.values.from; else delete values.from;
      delete values.seconds;
      // A model naming a picture nobody has is a model imagining one: the scene keeps what it had.
      const invented = Object.values(values).find((v) => typeof v === 'string' && v.startsWith(ASSETS_DIR) && !offered.has(v));
      if (invented) { problems.push(`scene ${frame.number}: there is no picture at ${String(invented)}`); return frame; }
      const checked = checkBlockValues(`scene ${frame.number}`, values, block.variables);
      if (checked.problems.length) { problems.push(...checked.problems); return frame; }
      if (said.block !== frame.block) dressed++;

      // One piece thrown over the scene, if the model asked for one the composition actually has.
      let mounts = frame.mounts;
      if (said.mount) {
        const piece = components.find((c) => c.name === said.mount!.component);
        const box = slots.includes(said.mount.box) ? said.mount.box : null;
        const at = said.mount.at;
        const cue = typeof at === 'number' ? at >= 0 : /^@\S/.test(at.trim());
        const held = piece ? checkBlockValues(`scene ${frame.number}, ${said.mount.component}`, said.mount.values, piece.variables) : null;
        if (!piece) problems.push(`scene ${frame.number}: there is no piece called "${said.mount.component}"`);
        else if (!box) problems.push(`scene ${frame.number}: no box named "${said.mount.box}" (${slots.join(', ') || 'none'})`);
        else if (!cue) problems.push(`scene ${frame.number}: "${String(at)}" is neither seconds nor an @word`);
        else if (held!.problems.length) problems.push(...held!.problems);
        else { mounts = [{ component: piece.name, box, at, values: { ...said.mount.values, ...held!.values } }]; pieces++; }
      }
      return { ...frame, block: said.block, values: { ...values, ...checked.values }, mounts };
    });

    for (const problem of problems.slice(0, 6)) log('warn', `${problem} · that scene keeps the rough cut`);
    log('info', `${dressed} of ${frames.length} scenes given something to show${pieces ? ` · ${pieces} with a piece thrown over` : ''}${pictures.length ? ` · ${pictures.length} pictures offered` : ''}`);
    return { storyboard: { ...storyboard, frames } satisfies Storyboard };
  },
};
