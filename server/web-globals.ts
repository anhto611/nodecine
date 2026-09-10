/**
 * Keep `Request` and `Response` what Node made them while something else runs.
 *
 * The HyperFrames producer bundles Hono's node server, and Hono's request listener replaces
 * `globalThis.Request` and `globalThis.Response` with lighter classes of its own — its
 * `overrideGlobalObjects` option, on by default and out of reach through the producer. Next checks
 * every route's result with `instanceof Response` against the global, so from the moment a render
 * starts its file server until the process restarts, every API route answers 500: a person saving
 * a workflow while an MP4 exports got "/api/workflows/… failed (500)". Hono works on the originals
 * (that is exactly what `overrideGlobalObjects: false` does), so while a render runs, a definition
 * of those two names on the global is dropped and the classes stay put. Nothing else is touched:
 * other keys, other objects, and the two names once the render is over.
 *
 * Renders may overlap (two workflow keys exporting at once), so the patch is counted, not toggled.
 */
const KEEP = new Set(['Request', 'Response']);
const original = Object.defineProperty;
let depth = 0;

const guarded: typeof Object.defineProperty = (target, key, descriptor) => {
  if (target === globalThis && typeof key === 'string' && KEEP.has(key)) return target;
  return original(target, key, descriptor);
};

export async function keepWebGlobals<T>(run: () => Promise<T>): Promise<T> {
  if (depth++ === 0) Object.defineProperty = guarded;
  try {
    return await run();
  } finally {
    if (--depth === 0) Object.defineProperty = original;
  }
}
