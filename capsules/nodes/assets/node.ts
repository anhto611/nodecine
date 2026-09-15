import { z } from 'zod';
import { NodeError } from '@/contracts/errors';
import { ASSET_NAME, AssetSchema, assetNameFor, type Asset, type Assets } from '@/contracts/types/assets';
import type { Brief } from '@/contracts/types/brief';
import type { Research } from '@/contracts/types/research';
import { contentHash } from '@/core/hash';
import type { NodeDefinition } from '@/core/nodes/definition';
import { AssetsErrorCode } from './errors';
import { findPictures } from './search';

/** Pictures found at most, whatever a workflow asks. */
export const MAX_FOUND = 20;

const Params = z.object({
  /** The pictures a person added, in the order they were added. */
  items: z.array(AssetSchema).max(200).default([]),
  /** Found pictures a person left out, by address. */
  dropped: z.array(z.string().max(200)).max(200).default([]),
  /** Notes a person rewrote on found pictures, by address. */
  notes: z.record(z.string(), z.string().max(500)).default({}),
  /** How many pictures to find at most; 0 finds none. */
  pictures: z.number().int().min(0).max(MAX_FOUND).default(8),
  /** Which pictures this workflow's films need, for the model: set once with the workflow. */
  wanted: z.string().max(4000).default(''),
  llmProvider: z.string().max(60).default(''),
  llmSettings: z.record(z.string(), z.unknown()).default({}),
  /** Raised by "Find again". */
  attempt: z.number().int().min(0).default(0),
  /** The pictures the last search found, kept so leaving one out or rewriting a note does not search again. */
  found: z.array(AssetSchema).max(MAX_FOUND).default([]),
  /** What that search was asked, as a fingerprint: a different brief, research or setting searches again. */
  foundFor: z.string().max(64).default(''),
});

/** What is wrong with a set of assets, one sentence per problem. */
export function assetProblems(items: Pick<Asset, 'name'>[]): string[] {
  const problems: string[] = [];
  const seen = new Set<string>();
  for (const { name } of items) {
    if (!ASSET_NAME.test(name)) problems.push(`"${name}" is not a name: use lowercase letters, digits and dashes`);
    else if (seen.has(name)) problems.push(`two assets are named "${name}"`);
    seen.add(name);
  }
  return problems;
}

/** A name for an uploaded file, from its file name, that no other asset has. */
export const nameFor = assetNameFor;

/**
 * The pictures a video is made with: those found for it on the pages its brief and its research read,
 * less the ones a person left out, then the ones a person brought, named from their files. What was found
 * is kept on the node, so leaving a picture out or rewriting a note costs no search; a found picture keeps
 * its choice and its note across a new search, held by its address, which is its content. The Assemble
 * node puts them into the project under `assets/`, where a storyboard refers to them by name.
 */
export const assets: NodeDefinition<typeof Params> = {
  type: 'assets', version: 1, kind: 'process',
  inputs: [
    { name: 'brief', type: 'Brief', required: false },
    { name: 'research', type: 'Research', required: false },
  ],
  outputs: [{ name: 'assets', type: 'Assets' }],
  paramsSchema: Params, defaultParams: Params.parse({}),
  validate: (params) => assetProblems(params.items).map((message) => ({ code: AssetsErrorCode.ASSETS_INVALID, message })),
  run: async (ctx) => {
    const { params, inputs, log } = ctx;
    const problems = assetProblems(params.items);
    if (problems.length) throw new NodeError(AssetsErrorCode.ASSETS_INVALID, problems[0]!, false, problems).withFix('give every asset its own name');
    const brief = inputs.brief?.payload as Brief | undefined;
    const research = inputs.research?.payload as Research | undefined;
    let offered: Asset[] = [];
    if (params.pictures > 0 && (brief || research)) {
      const input = { brief, research, pictures: params.pictures, wanted: params.wanted, attempt: params.attempt };
      const key = contentHash({ about: brief?.about, language: brief?.language, subject: research?.subject, summary: research?.summary, sources: research?.sources.map((s) => s.url), pictures: params.pictures, wanted: params.wanted, attempt: params.attempt, llm: [params.llmProvider, params.llmSettings] });
      if (key === params.foundFor) offered = params.found;
      else {
        offered = await findPictures(ctx, input);
        ctx.patchParams({ found: offered, foundFor: key });
      }
    }
    const dropped = new Set(params.dropped);
    // A found picture gives way to a brought one of the same name: the brought one was named by a person.
    const taken = params.items.map((a) => a.name);
    const kept: Asset[] = [];
    for (const found of offered) {
      if (dropped.has(found.url) || params.items.some((a) => a.url === found.url) || kept.some((a) => a.url === found.url)) continue;
      const name = assetNameFor(found.name, [...taken, ...kept.map((a) => a.name)]);
      kept.push({ ...found, name, note: params.notes[found.url] ?? found.note });
    }
    const items = [...kept, ...params.items];
    log('info', items.length ? `${items.length} assets${offered.length ? ` · ${kept.length} of ${offered.length} found` : ''}` : 'no assets');
    return { assets: { items } satisfies Assets };
  },
};
