import { z } from 'zod';
import { completeStructured, type StructuredContext } from '@/contracts/ai/structured-completion';
import type { StillResult } from '@/contracts/adapters/types';
import { NodeError } from '@/contracts/errors';
import { LLM_NEEDS, resolveLLM } from '@/contracts/resources';
import { readBlockCatalog, readComponentCatalog, type ComponentInfo } from '@/contracts/storyboard/blocks';
import type { Brief } from '@/contracts/types/brief';
import type { Composition } from '@/contracts/types/composition';
import { LIBRARY_NAME, LIBRARY_SCOPE, SHARED_SCOPE, shelfComponents, shelfScope } from '@/contracts/types/library';
import type { LLMRef } from '@/contracts/types/payloads';
import type { Research } from '@/contracts/types/research';
import { contentHash } from '@/core/hash';
import type { NodeDefinition, RunContext } from '@/core/nodes/definition';
import { componentPath, componentProblems, componentSeconds, sampleValuesOf, themeTokens, unfenced, withDescription } from './component';
import { ForgeErrorCode } from './errors';
import { AuthoredSchema, authorPrompt, fixPrompt, MAX_FORGED, PlanSchema, planPrompt, reviewPrompt, VerdictSchema, type AuthorMaterial, type Need } from './prompt';

/** Rounds of "here is what is wrong, fix it" before a component is left out. */
export const FIX_ROUNDS = 2;
/** How far into its own length a component's still is taken: past the entrance, before anything leaves. */
export const STILL_AT = 0.6;
/** Kit components shown to the author as references, at most, and how long one may be. */
const EXAMPLES = 2;
const EXAMPLE_MAX_CHARS = 9_000;

export const ForgedSchema = z.object({
  name: z.string().regex(LIBRARY_NAME),
  description: z.string().max(500),
  html: z.string().max(150_000),
  /** The still it was judged by (`/api/assets/…`), when one was drawn. */
  still: z.string().max(200).default(''),
});
export type Forged = z.infer<typeof ForgedSchema>;

const Params = z.object({
  /** The shelf the forged components are put on: the template whose films share them. Empty puts them on the shared shelf. */
  scope: z.string().max(41).default(''),
  /** How many components to forge at most; 0 passes the composition through. */
  max: z.number().int().min(0).max(MAX_FORGED).default(1),
  llmProvider: z.string().max(60).default(''),
  llmSettings: z.record(z.string(), z.unknown()).default({}),
  /** Raised by "Forge again", which plans and draws from scratch. */
  attempt: z.number().int().min(0).default(0),
  /** What the last forging made, kept so a run with the same film does not forge again. */
  forged: z.array(ForgedSchema).max(MAX_FORGED).default([]),
  /** What that forging was asked, as a fingerprint: a different film or setting forges again. */
  forgedFor: z.string().max(64).default(''),
});
export type ForgeParams = z.infer<typeof Params>;

/** What HyperFrames' linter says, as the Composition node's `composition/inspect` service answers. */
interface Inspection {
  findings: { severity: 'error' | 'warning' | 'info'; code: string; message: string; file?: string }[];
}

type ForgeContext = Pick<RunContext<ForgeParams>, 'params' | 'services' | 'log' | 'progress' | 'signal' | 'fresh'>;

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));
const sameFile = (file: string, path: string) => file.replace(/\\/g, '/').endsWith(path);

/** The kit's components a forged one is drawn after: the largest that are still short enough to read. */
function examplesFrom(files: Record<string, string>, components: ComponentInfo[]): { name: string; html: string }[] {
  return components
    .map((c) => ({ name: c.name, html: files[componentPath(c.name)] ?? '' }))
    .filter((c) => c.html.length > 800 && c.html.length <= EXAMPLE_MAX_CHARS)
    .sort((a, b) => b.html.length - a.html.length)
    .slice(0, EXAMPLES);
}

/** The film's look in a line, for the model that judges a still. */
const styleOf = (tokens: [string, string][]) =>
  tokens
    .filter(([k]) => /^--(bg|fg|brand|font-display|font-body)$/.test(k))
    .map(([k, v]) => `${k.slice(2)} ${v}`)
    .join('; ');

/**
 * One component through its checks: the contract read off its text, HyperFrames' linter over the film
 * with it added, then a still drawn and, when the model can see, shown to it. The problems found, one
 * sentence each; none means it passes.
 */
async function checkComponent(ctx: ForgeContext, ref: LLMRef, composition: Composition, need: Need, html: string): Promise<{ problems: string[]; still?: string }> {
  const contract = componentProblems(html, need.name, need.variables);
  if (contract.length) return { problems: contract };

  const path = componentPath(need.name);
  const inspection = await ctx.services.invoke<Inspection>('composition/inspect', [{ ...composition.files, [path]: html }]);
  const lint = inspection.findings.filter((f) => f.severity === 'error' && (!f.file || sameFile(f.file, path)));
  if (lint.length) return { problems: lint.map((f) => `HyperFrames lint ${f.code}: ${f.message}`) };

  const seconds = componentSeconds(html);
  const samples = Object.fromEntries(need.variables.map((v) => [v.id, v.sample]));
  let still: StillResult;
  try {
    still = await ctx.services.invoke<StillResult>('forge/still', [
      { files: composition.files, media: composition.media, html, width: composition.width, height: composition.height, at: seconds * STILL_AT, seconds, values: sampleValuesOf(html, samples) },
      ctx.signal,
    ]);
  } catch (e) {
    if (ctx.signal.aborted) throw e;
    // An engine that cannot draw here is not the component's fault: it is judged by its text alone.
    if ((e as { code?: string }).code === 'ENGINE_NOT_READY') {
      ctx.log('warn', `${need.name}: no still could be drawn (${message(e)}); checked by its text alone`);
      return { problems: [] };
    }
    return { problems: [`the page did not render: ${message(e)}`] };
  }

  if (ref.capabilities.vision?.status !== 'ready') return { problems: [], still: still.url };
  const verdict = await completeStructured(
    quiet(ctx),
    ref,
    { outputSchema: VerdictSchema, buildPrompt: () => reviewPrompt(need, styleOf(themeTokens(composition.files))), languageOf: () => 'en', images: [still.url] },
    'en',
  );
  if (verdict.ok) return { problems: [], still: still.url };
  return { problems: (verdict.problems.length ? verdict.problems : ['the still does not clearly show what the description says']).map((p) => `looking at the still: ${p}`), still: still.url };
}

/** The run context for a model call, its own progress reports kept out of the node's. */
const quiet = (ctx: ForgeContext): StructuredContext => ({ ...ctx, progress: () => undefined });

/** How a model that ran out of time says so, whichever CLI it is. */
const TIMED_OUT = /did not answer within|timed? ?out/i;
/** What the second asking adds. */
const SMALLER =
  'Your last answer took too long. Write a smaller page this time: under 9000 characters, fewer shapes, a short script, the same contract and rules.';

/** How many components are drawn at once: each is a model at work for minutes, mostly waiting. */
export const FORGE_AT_ONCE = 2;
/**
 * How long the forge may go on before it leaves the rest out. A component already being drawn is
 * finished; one not started yet is skipped, and the film is made with what there is.
 */
export const FORGE_BUDGET_MS = 25 * 60_000;

/** Runs `work` over `items`, at most `limit` at a time, in their order. */
async function inPool<T>(items: T[], limit: number, work: (item: T, index: number) => Promise<void>): Promise<void> {
  let next = 0;
  const lane = async () => {
    while (next < items.length) {
      const i = next++;
      await work(items[i]!, i);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, lane));
}

/**
 * Plans what the film lacks and draws each piece, keeping those that pass their checks. Each one that
 * passes is handed to `onForged` at once — put on the shelf as soon as it is drawn, so stopping the run
 * part-way loses nothing already made.
 */
export async function forgeComponents(
  ctx: ForgeContext,
  composition: Composition,
  film: { brief?: Brief; research?: Research },
  onForged: (forged: Forged) => Promise<void> = async () => {},
  now: () => number = Date.now,
): Promise<Forged[]> {
  const { params, log } = ctx;
  const ref = await resolveLLM(ctx.services, params, [...LLM_NEEDS, 'structuredOutput']);
  const blocks = readBlockCatalog(composition.files);
  const components = readComponentCatalog(composition.files);

  ctx.progress(0.05, 'planning');
  const plan = await completeStructured(
    quiet(ctx),
    ref,
    { outputSchema: PlanSchema, buildPrompt: () => planPrompt({ ...film, blocks, components, max: params.max, attempt: params.attempt }), languageOf: () => 'en' },
    'en',
  );
  const needs: Need[] = [];
  for (const need of plan.needs) {
    if (needs.length >= params.max) break;
    if (composition.files[componentPath(need.name)] !== undefined || blocks.some((b) => b.name === need.name)) {
      log('info', `${need.name}: reused, the kit already has it`);
      continue;
    }
    needs.push(need);
  }
  if (!needs.length) {
    log('info', 'the kit has what this film needs: nothing to forge');
    return [];
  }
  log('info', `to forge: ${needs.map((n) => n.name).join(', ')}`);

  const tokens = themeTokens(composition.files);
  const examples = examplesFrom(composition.files, components);
  const format = `${composition.width}x${composition.height}`;
  const forged: (Forged | undefined)[] = [];
  const done = needs.map(() => 0);
  const started = now();
  await inPool(needs, FORGE_AT_ONCE, async (need, i) => {
    // Several are drawn at once: the bar is how far all of them have got together.
    const step = (part: number, what: string) => {
      done[i] = part;
      ctx.progress(0.1 + (0.85 * done.reduce((a, b) => a + b, 0)) / needs.length, `${need.name}: ${what}`);
    };
    if (now() - started > FORGE_BUDGET_MS) {
      step(1, 'skipped');
      log('warn', `${need.name}: skipped, the forge has used its ${Math.round(FORGE_BUDGET_MS / 60_000)} minutes`, ForgeErrorCode.FORGE_DROPPED);
      return;
    }
    const material: AuthorMaterial = { need, tokens, examples, format };
    const ask = async (prompt: string) => withDescription(unfenced((await completeStructured(quiet(ctx), ref, { outputSchema: AuthoredSchema, buildPrompt: () => prompt, languageOf: () => 'en' }, 'en')).html), need.description);
    // A long page is what runs a model out of time: asked once more, for a smaller one, before giving up.
    const write = async (prompt: string) => {
      try {
        return await ask(prompt);
      } catch (e) {
        if (ctx.signal.aborted || !TIMED_OUT.test(message(e))) throw e;
        log('info', `${need.name}: the model ran out of time; asking again for a smaller page`);
        return ask(`${prompt}

${SMALLER}`);
      }
    };
    try {
      step(0, 'writing');
      let html = await write(authorPrompt(material));
      for (let round = 0; ; round++) {
        step((round + 1) / (FIX_ROUNDS + 2), round ? `checking, round ${round + 1}` : 'checking');
        const { problems, still } = await checkComponent(ctx, ref, composition, need, html);
        if (!problems.length) {
          const made = { name: need.name, description: need.description, html, still: still ?? '' };
          forged[i] = made;
          log('info', `${need.name}: forged${round ? ` after ${round} round${round > 1 ? 's' : ''} of fixes` : ''}`);
          await onForged(made);
          step(1, 'done');
          break;
        }
        if (round >= FIX_ROUNDS) {
          log('warn', `${need.name}: dropped, still failing after ${FIX_ROUNDS} rounds: ${problems.slice(0, 3).join('; ')}${still ? ` (last still: ${still})` : ''}`, ForgeErrorCode.FORGE_DROPPED);
          break;
        }
        log('info', `${need.name}: round ${round + 1}, ${problems.length} problem${problems.length > 1 ? 's' : ''} to fix: ${problems.slice(0, 3).join('; ')}`);
        html = await write(fixPrompt(material, html, problems));
      }
    } catch (e) {
      if (ctx.signal.aborted) throw e;
      log('warn', `${need.name}: dropped, ${message(e)}`, ForgeErrorCode.FORGE_DROPPED);
    }
  });
  // In the plan's order, whichever finished first.
  return forged.filter((f): f is Forged => !!f);
}

/** The composition with the forged components under `compositions/components/`; a file the kit already has keeps the kit's. */
export function withForged(composition: Composition, forged: Forged[]): Composition {
  if (!forged.length) return composition;
  const files = { ...composition.files };
  for (const f of forged) if (files[componentPath(f.name)] === undefined) files[componentPath(f.name)] = f.html;
  return { ...composition, files };
}

/**
 * The pieces a film needs that its kit lacks, drawn for it. A model reads the film (its brief and what
 * research found) and the kit's blocks and components, and names the generic, parameterized components
 * missing; each is written as a HyperFrames component, held to the component contract and the
 * runtime's rules, linted, drawn as a still and, when the model can see, looked at — what fails goes back
 * to be fixed, twice at most, then is left out. What passes is put on the template's shelf, where the
 * Library node finds it for the next film, and added to this film's composition. What was forged is kept
 * on the node, so a run with the same film forges nothing again.
 */
export const forge: NodeDefinition<typeof Params> = {
  type: 'forge',
  version: 1,
  kind: 'process',
  inputs: [
    { name: 'composition', type: 'Composition' },
    { name: 'brief', type: 'Brief', required: false },
    { name: 'research', type: 'Research', required: false },
  ],
  outputs: [{ name: 'composition', type: 'Composition' }],
  paramsSchema: Params,
  defaultParams: Params.parse({}),
  validate: (params) => (params.scope && !LIBRARY_SCOPE.test(params.scope) ? [{ code: ForgeErrorCode.FORGE_SCOPE_INVALID, message: `"${params.scope}" is not a shelf name` }] : []),
  run: async (ctx) => {
    const { params, inputs, services, log } = ctx;
    const composition = inputs.composition!.payload as Composition;
    if (params.max === 0) {
      log('info', 'forging is off: the composition passes through');
      return { composition };
    }
    // The shelf it adds to is the one the film reads, named by the Component shelf wired into the
    // Composition; its own setting only stands in when no shelf is wired.
    const scope = shelfScope(composition.files) ?? (params.scope || SHARED_SCOPE);
    if (!LIBRARY_SCOPE.test(scope)) throw new NodeError(ForgeErrorCode.FORGE_SCOPE_INVALID, `"${scope}" is not a shelf name`).withFix('use lowercase letters, digits and dashes');
    const brief = inputs.brief?.payload as Brief | undefined;
    const research = inputs.research?.payload as Research | undefined;
    if (!brief && !research) {
      log('info', 'no brief or research wired in: nothing to forge for');
      return { composition: withForged(composition, params.forged) };
    }

    // The kit as the question saw it: what this node forged before, and whatever else the shelf lends the
    // composition, come and go with the shelf — a shelf that grew is not a different kit, nor a different film.
    const mine = new Set([...params.forged.map((f) => f.name), ...shelfComponents(composition.files)]);
    const key = contentHash({
      about: brief?.about ?? '',
      research: research ? [research.subject, research.summary] : null,
      blocks: readBlockCatalog(composition.files).map((b) => b.name),
      components: readComponentCatalog(composition.files)
        .map((c) => c.name)
        .filter((n) => !mine.has(n)),
      size: [composition.width, composition.height],
      max: params.max,
      scope,
      attempt: params.attempt,
      llm: [params.llmProvider, params.llmSettings],
    });

    let forged: Forged[];
    if (key === params.forgedFor) {
      forged = params.forged;
      for (const f of forged) log('info', `${f.name}: reused from the last forging`);
    } else {
      forged = await forgeComponents(ctx, composition, { brief, research }, (f) =>
        services
          .invoke('library/write', [scope, f.name, f.html, { description: f.description, from: 'forge' }])
          .then(
            () => log('info', `${f.name}: on the ${scope} shelf`),
            (e: unknown) => log('warn', `${f.name}: not put on the ${scope} shelf: ${message(e)}`),
          ),
      );
      ctx.patchParams({ forged, forgedFor: key });
    }
    const out = withForged(composition, forged);
    log('info', forged.length ? `${forged.length} component${forged.length > 1 ? 's' : ''} on the ${scope} shelf and in the composition: ${forged.map((f) => f.name).join(', ')}` : 'nothing forged');
    return { composition: out };
  },
};
