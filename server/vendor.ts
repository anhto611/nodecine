/**
 * Scripts a browser-side engine needs from the app's own `node_modules` (a player runtime, gsap),
 * served at `/api/vendor/<name>`. Empty registry: a capsule that needs one registers it at server
 * startup with a loader that reads a fixed file — never a path from a request — so the route can
 * only ever serve what an engine asked for. Answers are cached for the life of the process.
 */
const loaders = new Map<string, () => Promise<string>>();
const cache = new Map<string, Promise<string>>();

export function registerVendorSource(name: string, load: () => Promise<string>): void {
  loaders.set(name, load);
}

export const hasVendorSource = (name: string): boolean => loaders.has(name);

export function vendorSource(name: string): Promise<string> {
  const load = loaders.get(name);
  if (!load) return Promise.reject(Object.assign(new Error(`no vendor script "${name}"`), { code: 'ENGINE_NOT_READY' }));
  let p = cache.get(name);
  if (!p) {
    p = load().catch((e: unknown) => { cache.delete(name); throw e; });
    cache.set(name, p);
  }
  return p;
}
