import { mkdir, readdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { LIBRARY_NAME, LIBRARY_SCOPE, SHARED_SCOPE, type Library, type LibraryItem } from '@/contracts/types/library';

/**
 * The shelves on disk: `.nodecine/library/<scope>/<name>.html`, with `<name>.json` beside it saying
 * what the component is for and where it came from. `NODECINE_LIBRARY_DIR` moves them.
 */
export function libraryDir(): string {
  return path.resolve(process.cwd(), process.env.NODECINE_LIBRARY_DIR ?? '.nodecine/library');
}

export interface LibraryMeta {
  description: string;
  /** The workflow or the tool that put it here. */
  from?: string;
  createdAt: string;
}

const scopeDir = (scope: string): string => {
  if (!LIBRARY_SCOPE.test(scope)) throw Object.assign(new Error(`"${scope}" is not a shelf name`), { code: 'LIBRARY_SCOPE_INVALID' });
  return path.join(libraryDir(), scope);
};

async function readShelf(scope: string, shelf: LibraryItem['shelf']): Promise<LibraryItem[]> {
  const dir = scopeDir(scope);
  const names = await readdir(dir).catch(() => [] as string[]);
  const items: LibraryItem[] = [];
  for (const file of names.filter((n) => n.endsWith('.html')).sort()) {
    const name = file.slice(0, -5);
    if (!LIBRARY_NAME.test(name)) continue;
    const html = await readFile(path.join(dir, file), 'utf8');
    const meta = await readFile(path.join(dir, `${name}.json`), 'utf8')
      .then((t) => JSON.parse(t) as Partial<LibraryMeta>)
      .catch(() => ({}) as Partial<LibraryMeta>);
    items.push({ name, shelf, html, description: String(meta.description ?? '').slice(0, 500) });
  }
  return items;
}

/** A template's shelf, then the shared one; a name on the template's own shelf hides the shared one. */
export async function readLibrary(scope: string, shared = true): Promise<Library> {
  const own = scope === SHARED_SCOPE ? [] : await readShelf(scope, 'scope');
  const common = shared || scope === SHARED_SCOPE ? await readShelf(SHARED_SCOPE, 'shared') : [];
  const taken = new Set(own.map((i) => i.name));
  return { scope, items: [...own, ...common.filter((i) => !taken.has(i.name))] };
}

/** The shelves there are, each with how many components it holds; the shared one always among them. */
export async function listShelves(): Promise<{ scope: string; count: number }[]> {
  const names = await readdir(libraryDir(), { withFileTypes: true }).catch(() => []);
  const scopes = new Set([SHARED_SCOPE, ...names.filter((e) => e.isDirectory() && LIBRARY_SCOPE.test(e.name)).map((e) => e.name)]);
  const out: { scope: string; count: number }[] = [];
  for (const scope of [...scopes].sort()) {
    const files = await readdir(path.join(libraryDir(), scope)).catch(() => [] as string[]);
    out.push({ scope, count: files.filter((f) => f.endsWith('.html') && LIBRARY_NAME.test(f.slice(0, -5))).length });
  }
  return out;
}

/** What a shelf holds, for a person to look at: each component, what it is for, and its page to draw. */
export async function browseLibrary(scope: string, shared = true): Promise<LibraryItem[]> {
  if (!scope || !LIBRARY_SCOPE.test(scope)) return [];
  return (await readLibrary(scope, shared)).items;
}

/** Puts a component on a shelf, replacing one of the same name. Written to a temp file and renamed, so a reader never sees half of it. */
export async function writeLibraryItem(scope: string, name: string, html: string, meta: Omit<LibraryMeta, 'createdAt'>): Promise<{ scope: string; name: string }> {
  if (!LIBRARY_NAME.test(name)) throw Object.assign(new Error(`"${name}" is not a component name`), { code: 'LIBRARY_SCOPE_INVALID' });
  const dir = scopeDir(scope);
  await mkdir(dir, { recursive: true });
  const target = path.join(dir, `${name}.html`);
  await writeFile(`${target}.tmp`, html, 'utf8');
  await rename(`${target}.tmp`, target);
  await writeFile(path.join(dir, `${name}.json`), JSON.stringify({ ...meta, createdAt: new Date().toISOString() }, null, 2), 'utf8');
  return { scope, name };
}
