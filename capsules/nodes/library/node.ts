import { z } from 'zod';
import { NodeError } from '@/contracts/errors';
import { LIBRARY_NAME, LIBRARY_SCOPE, SHARED_SCOPE, type Library } from '@/contracts/types/library';
import type { NodeDefinition } from '@/core/nodes/definition';
import { LibraryErrorCode } from './errors';

const Params = z.object({
  /** The shelf: the template whose videos gather these components. Empty reads the shared shelf alone. */
  scope: z.string().max(41).default(''),
  /** Whether the shared shelf is read too, after the template's own. */
  shared: z.boolean().default(true),
  /**
   * The components this video took from the shelf, by name, written at its first run. Null until then.
   * A shelf grows with every video made from the template; a video already made keeps the shelf it was
   * made with, so running it again changes nothing downstream and every later node reuses its result.
   * "Refresh" clears it, and the next run takes the shelf as it is now.
   */
  pinned: z.array(z.string().regex(LIBRARY_NAME)).max(500).nullable().default(null),
});

/** The shelf as this video uses it: what it pinned, or everything on it when it has pinned nothing yet. */
export function pinnedShelf(shelf: Library, pinned: string[] | null): Library {
  if (!pinned) return shelf;
  const keep = new Set(pinned);
  return { ...shelf, items: shelf.items.filter((i) => keep.has(i.name)) };
}

/**
 * The components a template's videos have gathered, read from disk each run. A resource, so it is
 * read every time; but a video keeps the components it took at its first run, so the Composition it
 * feeds sees the same packet until a person refreshes the shelf for it.
 */
export const library: NodeDefinition<typeof Params> = {
  type: 'library',
  version: 2,
  kind: 'resource',
  inputs: [],
  outputs: [{ name: 'library', type: 'Library' }],
  paramsSchema: Params,
  defaultParams: Params.parse({}),
  migrate: (params) => ({ ...params, pinned: params.pinned ?? null }),
  validate: (params) => (params.scope && !LIBRARY_SCOPE.test(params.scope) ? [{ code: LibraryErrorCode.LIBRARY_SCOPE_INVALID, message: `"${params.scope}" is not a shelf name` }] : []),
  run: async ({ params, services, log, patchParams }) => {
    const scope = params.scope || SHARED_SCOPE;
    if (!LIBRARY_SCOPE.test(scope)) throw new NodeError(LibraryErrorCode.LIBRARY_SCOPE_INVALID, `"${scope}" is not a shelf name`).withFix('use lowercase letters, digits and dashes');
    const all = await services.invoke<Library>('library/read', [scope, params.shared]);
    const shelf = pinnedShelf(all, params.pinned);
    if (!params.pinned) patchParams({ pinned: shelf.items.map((i) => i.name) });
    const own = shelf.items.filter((i) => i.shelf === 'scope').length;
    const newer = all.items.length - shelf.items.length;
    log('info', shelf.items.length ? `${shelf.items.length} components · ${own} on ${scope} · ${shelf.items.length - own} shared` : `nothing on ${scope} yet`);
    if (params.pinned && newer > 0) log('info', `${newer} newer on the shelf, not taken: refresh to take them`);
    const missing = (params.pinned ?? []).filter((n) => !shelf.items.some((i) => i.name === n));
    if (missing.length) log('warn', `no longer on the shelf: ${missing.join(', ')}`);
    return { library: shelf };
  },
};
