import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const nodeRoot = path.join(root, 'nodes');
const nodeFolders = new Set((await readdir(nodeRoot, { withFileTypes: true }))
  .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.') && !entry.name.startsWith('_'))
  .map((entry) => entry.name));
const errors = [];
const nodeIds = new Map();

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
  // Tests obey the same rule as code: a capsule's tests import only that capsule. The one place a test
  // may reach across is nodes/__tests__, for the pipeline tests that run several nodes together.
  const integration = relative.startsWith(`nodes${path.sep}__tests__${path.sep}`);
  const isTest = relative.includes(`${path.sep}__tests__${path.sep}`) || /\.(test|manual\.test)\.[cm]?[jt]sx?$/.test(relative);
  const source = await readFile(file, 'utf8');
  const owner = relative.startsWith('nodes/') ? relative.split(path.sep)[1] : null;
  for (const match of source.matchAll(/(?:from\s*|import\s*\(|require\s*\()\s*['"]@\/nodes\/([^/'"]+)/g)) {
    const target = match[1];
    if (!nodeFolders.has(target)) continue; // shared node SDK files such as nodes/kit.tsx
    if (owner === target || integration) continue;
    if (relative === 'nodes/index.ts' || relative === 'nodes/index.client.ts') continue;
    errors.push(`${relative}: may not import node capsule "${target}"`);
  }
  // A test builds graphs out of real nodes by name and may run the whole registry; only the capsule-import rule reaches it.
  if (isTest) continue;
  if (relative.startsWith('core/') && /['"]@\/nodes(?:\/|['"])/.test(source)) errors.push(`${relative}: core may not import nodes`);
  // The services file pulls in node:fs, child processes and puppeteer: only the server may load it, or the browser bundle breaks.
  if (!relative.startsWith('server/') && /\.generated\/server['"]/.test(source)) errors.push(`${relative}: only server/ may import nodes/.generated/server`);
  for (const [folder, id] of nodeIds) {
    if (owner === folder) continue;
    if (source.includes(`'${id}'`) || source.includes(`"${id}"`)) errors.push(`${relative}: hardcodes node id "${id}" outside its capsule`);
  }
}

if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}
console.log(`Checked ${nodeFolders.size} isolated node capsules.`);
