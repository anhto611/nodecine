import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const nodeRoot = path.join(root, 'nodes');
const providerRoot = path.join(root, 'providers');
const errors = [];
const nodeIds = new Map();

const capsuleFolders = async (dir) => new Set((await readdir(dir, { withFileTypes: true }))
  .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.') && !entry.name.startsWith('_'))
  .map((entry) => entry.name));

const nodeFolders = await capsuleFolders(nodeRoot);
// A provider is a capsule on the same terms as a node: one folder, one manifest, no reaching into a
// neighbour. Ollama used to import a JSON helper straight out of the Claude Code provider.
const providerFolders = await capsuleFolders(providerRoot);

for (const folder of nodeFolders) {
  const manifest = path.join(nodeRoot, folder, 'node.manifest.json');
  try {
    if (!(await stat(manifest)).isFile()) throw new Error();
    const parsed = JSON.parse(await readFile(manifest, 'utf8'));
    if (typeof parsed.id !== 'string') throw new Error('missing id');
    nodeIds.set(folder, parsed.id);
  } catch (error) {
    errors.push(`nodes/${folder}: invalid or missing node.manifest.json${error instanceof Error && error.message ? ` (${error.message})` : ''}`);
  }
}

for (const folder of providerFolders) {
  const manifest = path.join(providerRoot, folder, 'provider.manifest.json');
  try {
    if (!(await stat(manifest)).isFile()) throw new Error();
    JSON.parse(await readFile(manifest, 'utf8'));
  } catch (error) {
    errors.push(`providers/${folder}: invalid or missing provider.manifest.json${error instanceof Error && error.message ? ` (${error.message})` : ''}`);
  }
}

async function walk(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '.next' || entry.name === '.git' || entry.name === '.generated') continue;
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await walk(target));
    else if (/\.[cm]?[jt]sx?$/.test(entry.name)) files.push(target);
  }
  return files;
}

for (const file of await walk(root)) {
  const relative = path.relative(root, file);
  // Tests obey the same rule as code: a capsule's tests import only that capsule. The two places a
  // test may reach across are nodes/__tests__ and providers/__tests__, for the ones that put several
  // capsules together — a pipeline of nodes, or the two hosted voices side by side.
  const integration = relative.startsWith(`nodes${path.sep}__tests__${path.sep}`) || relative.startsWith(`providers${path.sep}__tests__${path.sep}`);
  const isTest = relative.includes(`${path.sep}__tests__${path.sep}`) || /\.(test|manual\.test)\.[cm]?[jt]sx?$/.test(relative);
  const source = await readFile(file, 'utf8');
  const barrel = relative === path.join('nodes', 'index.ts') || relative === path.join('nodes', 'index.client.ts');
  const nodeOwner = relative.startsWith(`nodes${path.sep}`) ? relative.split(path.sep)[1] : null;
  const KINDS = [
    { label: 'node', dir: nodeRoot, prefix: '@/nodes/', root: 'nodes', folders: nodeFolders },
    { label: 'provider', dir: providerRoot, prefix: '@/providers/', root: 'providers', folders: providerFolders },
  ];
  /** Which capsule a specifier lands in, or null for anything outside one. */
  const capsuleOf = (specifier, kind) => {
    const resolved = specifier.startsWith(kind.prefix)
      ? path.join(kind.dir, specifier.slice(kind.prefix.length))
      // A capsule's neighbours are one `../` away, so relative imports are the easy way across the
      // wall and have to be resolved, not pattern-matched.
      : specifier.startsWith('.') ? path.resolve(path.dirname(file), specifier) : null;
    if (resolved === null) return null;
    const inside = path.relative(kind.dir, resolved);
    if (!inside || inside.startsWith('..') || path.isAbsolute(inside)) return null;
    const folder = inside.split(path.sep)[0];
    return kind.folders.has(folder) ? folder : null; // shared SDK files such as nodes/kit.tsx
  };
  // `from '…'`, `import '…'` (side effect), `import('…')` and `require('…')` all cross the wall.
  for (const match of source.matchAll(/(?:\bfrom\s*|\bimport\s*\(?\s*|\brequire\s*\(\s*)['"]([^'"]+)['"]/g)) {
    for (const kind of KINDS) {
      const owner = relative.startsWith(`${kind.root}${path.sep}`) ? relative.split(path.sep)[1] : null;
      const target = capsuleOf(match[1], kind);
      if (target === null) continue;
      if (owner === target || integration || barrel) continue;
      errors.push(`${relative}: may not import ${kind.label} capsule "${target}"`);
    }
  }
  // A test builds graphs out of real nodes by name and may run the whole registry; only the capsule-import rule reaches it.
  if (isTest) continue;
  if (relative.startsWith(`core${path.sep}`) && /['"]@\/nodes(?:\/|['"])/.test(source)) errors.push(`${relative}: core may not import nodes`);
  if (relative.startsWith(`core${path.sep}`) && /['"]@\/providers(?:\/|['"])/.test(source)) errors.push(`${relative}: core may not import providers`);
  // The core runs graphs of nodes and knows nothing of video: what runs on a wire, the IR, a model or
  // an engine are the contracts', which register into the core rather than being read by it.
  if (relative.startsWith(`core${path.sep}`) && /['"]@\/contracts(?:\/|['"])/.test(source)) errors.push(`${relative}: core may not import contracts`);
  // Contracts sit between the core and the capsules: they may use the core, never a node or a provider.
  if (relative.startsWith(`contracts${path.sep}`) && /['"]@\/(nodes|providers|server|app|components|store|lib)(?:\/|['"])/.test(source)) errors.push(`${relative}: contracts may not import the app, a node or a provider`);
  // A provider's index.ts spawns processes; only its settings.ts is safe for the browser bundle.
  if (relative.startsWith(`providers${path.sep}`) && /['"]@\/nodes\/(?!form-body|kit)/.test(source)) errors.push(`${relative}: a provider may not import nodes`);
  // The services file pulls in node:fs, child processes and puppeteer: only the server may load it, or the browser bundle breaks.
  if (!relative.startsWith(`server${path.sep}`) && /\.generated\/server['"]/.test(source)) errors.push(`${relative}: only server/ may import a .generated/server registry`);
  // The one file whose whole subject is node ids across time: a migration has to name the type a
  // dead one became, and `retired.json` beside it does the same in data.
  if (relative === path.join('nodes', 'migrations.ts')) continue;
  for (const [folder, id] of nodeIds) {
    if (nodeOwner === folder) continue;
    if (source.includes(`'${id}'`) || source.includes(`"${id}"`)) errors.push(`${relative}: hardcodes node id "${id}" outside its capsule`);
  }
}

if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}
console.log(`Checked ${nodeFolders.size} node capsules and ${providerFolders.size} provider capsules.`);
