import { z } from 'zod';

/**
 * Components kept across videos. A template's films share one shelf of them, named after the
 * template (its scope); a second shelf, `shared`, holds the ones any template may borrow. A component
 * there is the same file a kit publishes under `compositions/components/`: an elastic piece that fills
 * the box it is mounted in and wears the theme tokens of the film around it, so one drawn for one film
 * fits the next.
 */
export const SHARED_SCOPE = 'shared';
/** A shelf's name: a template id, or `shared`. */
export const LIBRARY_SCOPE = /^[a-z][a-z0-9-]{0,40}$/;
/** A component's name, as its file under `compositions/components/` is named. */
export const LIBRARY_NAME = /^[a-z][a-z0-9-]{1,40}$/;

export const LibraryItemSchema = z.object({
  name: z.string().regex(LIBRARY_NAME),
  /** Which shelf it came from: the template's own, or the shared one. */
  shelf: z.enum(['scope', 'shared']),
  html: z.string().max(400_000),
  description: z.string().max(500).default(''),
});
export type LibraryItem = z.infer<typeof LibraryItemSchema>;

export const LibrarySchema = z.object({
  scope: z.string().regex(LIBRARY_SCOPE),
  items: z.array(LibraryItemSchema).max(500),
});
export type Library = z.infer<typeof LibrarySchema>;

/** The file a composition keeps beside its parts, naming the components it took from a shelf: `{ scope, components }`. */
export const LIBRARY_MANIFEST = 'library.json';

/** The components a composition took from a shelf, by name. */
export function shelfComponents(files: Record<string, string>): string[] {
  try {
    const names = (JSON.parse(files[LIBRARY_MANIFEST] ?? '{}') as { components?: unknown }).components;
    return Array.isArray(names) ? names.filter((n): n is string => typeof n === 'string') : [];
  } catch {
    return [];
  }
}

/** The shelf a composition read, when a Component shelf is wired into it. */
export function shelfScope(files: Record<string, string>): string | undefined {
  try {
    const scope = (JSON.parse(files[LIBRARY_MANIFEST] ?? '{}') as { scope?: unknown }).scope;
    return typeof scope === 'string' && LIBRARY_SCOPE.test(scope) ? scope : undefined;
  } catch {
    return undefined;
  }
}

/** Where a library component goes in a composition's files. */
export const libraryComponentPath = (name: string): string => `compositions/components/${name}.html`;
