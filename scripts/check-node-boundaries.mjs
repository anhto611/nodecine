import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const nodeRoot = path.join(root, 'nodes');
const nodeFolders = new Set((await readdir(nodeRoot, { withFileTypes: true }))
  .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.') && !entry.name.startsWith('_'))
  .map((entry) => entry.name));
const errors = [];

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
  if (relative.includes(`${path.sep}__tests__${path.sep}`)) continue;
  const source = await readFile(file, 'utf8');
  const owner = relative.startsWith('nodes/') ? relative.split(path.sep)[1] : null;
  for (const match of source.matchAll(/(?:from\s*|import\s*\(|require\s*\()\s*['"]@\/nodes\/([^/'"]+)/g)) {
    const target = match[1];
    if (!nodeFolders.has(target)) continue; // shared node SDK files such as nodes/kit.tsx
    if (owner === target) continue;
    if (relative === 'nodes/index.ts' || relative === 'nodes/index.client.ts') continue;
    errors.push(`${relative}: may not import node capsule "${target}"`);
  }
  if (relative.startsWith('core/') && /['"]@\/nodes(?:\/|['"])/.test(source)) errors.push(`${relative}: core may not import nodes`);
}

for (const folder of nodeFolders) {
  const manifest = path.join(nodeRoot, folder, 'node.manifest.json');
  try { if (!(await stat(manifest)).isFile()) throw new Error(); }
  catch { errors.push(`nodes/${folder}: missing node.manifest.json`); }
}

if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}
console.log(`Checked ${nodeFolders.size} isolated node capsules.`);
