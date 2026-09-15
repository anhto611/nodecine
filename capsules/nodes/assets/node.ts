import { z } from 'zod';
import { NodeError } from '@/contracts/errors';
import { ASSET_NAME, AssetSchema, type Asset, type Assets } from '@/contracts/types/assets';
import type { NodeDefinition } from '@/core/nodes/definition';
import { AssetsErrorCode } from './errors';

const Params = z.object({
  /** The pictures, in the order they were added. */
  items: z.array(AssetSchema).max(200).default([]),
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
export function nameFor(fileName: string, taken: Iterable<string>): string {
  const used = new Set(taken);
  const base = fileName.replace(/\.[^.]+$/, '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 36) || 'image';
  if (!used.has(base)) return base;
  let n = 2;
  while (used.has(`${base}-${n}`)) n++;
  return `${base}-${n}`;
}

/**
 * The pictures a video is made with, brought by a person and named from their files: an app's screens, a
 * logo, a product photo. The Assemble node puts them into the project under `assets/`, where a
 * storyboard refers to them by name.
 */
export const assets: NodeDefinition<typeof Params> = {
  type: 'assets', version: 1, kind: 'source',
  inputs: [],
  outputs: [{ name: 'assets', type: 'Assets' }],
  paramsSchema: Params, defaultParams: { items: [] },
  validate: (params) => assetProblems(params.items).map((message) => ({ code: AssetsErrorCode.ASSETS_INVALID, message })),
  run: async ({ params, log }) => {
    const problems = assetProblems(params.items);
    if (problems.length) throw new NodeError(AssetsErrorCode.ASSETS_INVALID, problems[0]!, false, problems).withFix('give every asset its own name');
    log('info', params.items.length ? `${params.items.length} assets` : 'no assets');
    return { assets: { items: params.items } satisfies Assets };
  },
};
