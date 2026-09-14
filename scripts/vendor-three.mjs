import { build } from 'esbuild';
import { mkdir, stat } from 'node:fs/promises';
import path from 'node:path';

/**
 * three ships as ES modules only, and a composition page inlines its libraries as plain scripts, so
 * the page's `html-three` scenes need a classic build with a `THREE` global. Made here, once, from
 * the installed package, into `.nodecine/vendor/` (ignored by git, rebuilt by `nodes:prepare`).
 */
const out = path.resolve('.nodecine/vendor/three.iife.js');
const src = path.resolve('node_modules/three/build/three.module.js');
const fresh = await Promise.all([stat(out).catch(() => null), stat(src)]).then(([o, s]) => o && o.mtimeMs >= s.mtimeMs);
if (!fresh) {
  await mkdir(path.dirname(out), { recursive: true });
  await build({ entryPoints: [src], bundle: true, format: 'iife', globalName: 'THREE', minify: true, legalComments: 'none', outfile: out, logLevel: 'error' });
  console.log(`Bundled three for the page: ${path.relative(process.cwd(), out)}`);
}
