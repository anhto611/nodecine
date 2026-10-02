import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

/**
 * The walls between the layers, checked on every `capsules:prepare`.
 *
 *   core/        how nodes run; knows no video, imports no layer above it
 *   contracts/   what video capsules agree on; uses the core, never a capsule or the app
 *   capsules/    nodes, engines and providers; each folder keeps to itself, and knows the Studio only
 *                through capsules/sdk/
 *   server/      the runtime host; server/contracts/ is the server half of contracts/
 *
 * ESLint's import rules could say some of this, but not "a capsule may not reach into its
 * neighbour", which is most of what goes wrong.
 */

const root = process.cwd();
const sep = path.sep;
const errors = [];

const KINDS = [
  { label: 'node', dir: 'capsules/nodes', manifest: 'node.manifest.json' },
  { label: 'engine', dir: 'capsules/engines', manifest: 'engine.manifest.json' },
  { label: 'provider', dir: 'capsules/providers', manifest: 'provider.manifest.json' },
];

const nodeIds = new Map();
for (const kind of KINDS) {
  const abs = path.join(root, kind.dir);
  kind.abs = abs;
  kind.folders = new Set((await readdir(abs, { withFileTypes: true })).filter((entry) => entry.isDirectory() && !entry.name.startsWith('.') && !entry.name.startsWith('_')).map((entry) => entry.name));
  for (const folder of kind.folders) {
    const manifest = path.join(abs, folder, kind.manifest);
    try {
      if (!(await stat(manifest)).isFile()) throw new Error();
      const parsed = JSON.parse(await readFile(manifest, 'utf8'));
      if (typeof parsed.id !== 'string') throw new Error('missing id');
      if (kind.label === 'node') nodeIds.set(folder, parsed.id);
    } catch (error) {
      errors.push(`${kind.dir}/${folder}: invalid or missing ${kind.manifest}${error instanceof Error && error.message ? ` (${error.message})` : ''}`);
    }
  }
}

async function walk(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (['node_modules', '.next', '.git', '.generated', '.nodecine'].includes(entry.name)) continue;
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await walk(target)));
    else if (/\.[cm]?[jt]sx?$/.test(entry.name)) files.push(target);
  }
  return files;
}

const under = (relative, dir) => relative === dir || relative.startsWith(`${dir.split('/').join(sep)}${sep}`);
const imports = (source, pattern) => new RegExp(`['"]@/${pattern}(?:/|['"])`).test(source);

for (const file of await walk(root)) {
  const relative = path.relative(root, file);
  const source = await readFile(file, 'utf8');
  const isTest = relative.includes(`${sep}__tests__${sep}`) || /\.(test|manual\.test)\.[cm]?[jt]sx?$/.test(relative);
  // Where several capsules may meet: the tests that put them together, and the barrels that list them.
  const integration = ['capsules/__tests__', 'capsules/nodes/__tests__', 'capsules/providers/__tests__'].some((d) => under(relative, d));
  const barrel = ['capsules/nodes/index.ts', 'capsules/nodes/index.client.ts'].some((f) => relative === f.split('/').join(sep));

  // A capsule may not import another capsule of any kind, by alias or by `../`: a neighbour is one
  // folder away, so relative paths are resolved rather than pattern-matched.
  for (const match of source.matchAll(/(?:\bfrom\s*|\bimport\s*\(?\s*|\brequire\s*\(\s*)['"]([^'"]+)['"]/g)) {
    const specifier = match[1];
    const resolved = specifier.startsWith('@/') ? path.join(root, specifier.slice(2)) : specifier.startsWith('.') ? path.resolve(path.dirname(file), specifier) : null;
    if (resolved === null) continue;
    for (const kind of KINDS) {
      const inside = path.relative(kind.abs, resolved);
      if (!inside || inside.startsWith('..') || path.isAbsolute(inside)) continue;
      const target = inside.split(sep)[0];
      // Shared files of a kind — capsules/nodes/kit.tsx, capsules/providers/installed.ts — belong to no capsule.
      if (!kind.folders.has(target)) continue;
      const ownInside = path.relative(kind.abs, file);
      const owner = !ownInside.startsWith('..') ? ownInside.split(sep)[0] : null;
      if (owner === target || integration || barrel) continue;
      errors.push(`${relative}: may not import ${kind.label} capsule "${target}"`);
    }
  }

  // A test builds graphs out of real nodes by name and may run the whole registry; only the capsule-import rule reaches it.
  if (isTest) continue;

  // The core runs graphs of nodes and knows nothing of video: what runs on a wire, the IR, a model or
  // an engine are the contracts', which register into the core rather than being read by it.
  if (under(relative, 'core') && imports(source, '(contracts|capsules|server|app|components|store|lib)')) errors.push(`${relative}: core may import nothing above it`);
  // Contracts sit between the core and the capsules: they may use the core, never a capsule or the app.
  if (under(relative, 'contracts') && imports(source, '(capsules|server|app|components|store|lib)')) errors.push(`${relative}: contracts may not import a capsule, the server or the app`);
  // The server mirrors the layers above it. Its top level is the runtime host — the job queue, kept
  // results, fingerprints, workflow files — and knows no more about video than the core does.
  // server/contracts/ is the server half of contracts/: the services, tools and history those
  // contracts promise. It may use the host; the host never reaches back.
  const hostFile = under(relative, 'server') && !under(relative, 'server/contracts');
  if (hostFile && imports(source, 'contracts')) errors.push(`${relative}: the server's runtime host may not import contracts; put it in server/contracts/`);
  // Nor does it know which capsules there are, or anything of the Studio: registering the capsules
  // is server/contracts/'s job, handed to the host as `prepare`.
  if (hostFile && imports(source, '(capsules|app|components|store|lib)')) errors.push(`${relative}: the server's runtime host may not import capsules or the Studio; wire it in server/contracts/`);
  if (hostFile && (imports(source, 'server/contracts') || /['"]\.\/contracts(?:\/|['"])/.test(source))) errors.push(`${relative}: the server's runtime host may not import server/contracts/`);
  // Capsules know the Studio only through the SDK (capsules/sdk/): the host a body is handed, the kit
  // it draws with. The Studio imports the capsules; a capsule importing the Studio back is a cycle.
  const capsuleFile = under(relative, 'capsules') && !under(relative, 'capsules/sdk');
  if (capsuleFile && imports(source, '(app|components|store|lib|locales)')) errors.push(`${relative}: a capsule may not import the Studio; use capsules/sdk/`);
  // The SDK is what capsules stand on, so it stands on nothing above the contracts: no capsule, no Studio, no server.
  if (under(relative, 'capsules/sdk') && imports(source, '(capsules/(nodes|engines|providers)|app|components|store|lib|locales|server)'))
    errors.push(`${relative}: the SDK may use only the core and the contracts`);
  // A server registry pulls in node:fs, child processes and puppeteer: only the server may load it, or the browser bundle breaks.
  if (!under(relative, 'server') && /\.generated\/server['"]/.test(source)) errors.push(`${relative}: only server/ may import a .generated/server registry`);
  // The one file whose whole subject is node ids across time: a migration has to name the type a
  // dead one became, and `retired.json` beside it does the same in data.
  if (relative === path.join('capsules', 'migrations.ts')) continue;
  // Ids are bare words now (`tts`, `transcribe`), and a provider kind is `'tts'` too, so only a string
  // used as a node type counts: a `type` compared or assigned, or a type looked up by name.
  const nodeOwner = under(relative, 'capsules/nodes') ? relative.split(sep)[2] : null;
  for (const [folder, id] of nodeIds) {
    if (nodeOwner === folder) continue;
    const quoted = `['"]${id.replace(/[.*+?^${}()|[\]\\/-]/g, '\\$&')}['"]`;
    const asType = new RegExp(`(?:\\btype\\s*(?:===?|!==?|:)\\s*${quoted}|(?:getNodeType|NODE_(?:FEATURES|META|BODIES|SOURCES))\\s*(?:\\(|\\[)\\s*${quoted})`);
    if (asType.test(source)) errors.push(`${relative}: hardcodes node type "${id}" outside its capsule`);
  }
}

if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}
console.log(`Checked ${KINDS.map((k) => `${k.folders.size} ${k.label}`).join(', ')} capsules.`);
