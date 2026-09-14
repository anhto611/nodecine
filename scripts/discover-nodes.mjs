import { readdir, readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const nodesDir = path.join(root, 'nodes');
const generatedDir = path.join(nodesDir, '.generated');
const folders = (await readdir(nodesDir, { withFileTypes: true }))
  .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.') && !entry.name.startsWith('_'))
  .map((entry) => entry.name)
  .sort();
const capsules = [];

// Types that no longer exist. Not a capsule, because the whole point is that the capsule is gone.
const retired = JSON.parse(await readFile(path.join(nodesDir, 'retired.json'), 'utf8'));
for (const [type, info] of Object.entries(retired)) {
  if (typeof info?.since !== 'string') throw new Error(`nodes/retired.json: "${type}" needs a since date`);
  if (info.replacedBy !== undefined && typeof info.replacedBy !== 'string') throw new Error(`nodes/retired.json: "${type}" replacedBy must be a type id`);
}

for (const folder of folders) {
  const file = path.join(nodesDir, folder, 'node.manifest.json');
  let manifest;
  try { manifest = JSON.parse(await readFile(file, 'utf8')); }
  catch (error) {
    if (error?.code === 'ENOENT') continue;
    throw new Error(`${path.relative(root, file)}: ${error.message}`);
  }
  capsules.push({ folder, ...manifest });
}

const ids = new Set();
const libraries = new Set();
for (const item of capsules) {
  for (const name of Object.keys(item.libraries || {})) { if (libraries.has(name)) throw new Error(`library "${name}" is declared by two capsules`); libraries.add(name); }
  for (const key of ['id', 'icon', 'group', 'translations']) if (typeof item[key] !== 'string' || !item[key]) throw new Error(`${item.folder}/node.manifest.json: ${key} is required`);
  // A capsule may hold no node at all: an engine is a part the output nodes name, not a node of its
  // own, and it still ships its registration, its locales and its library files from here.
  if ((item.definition === undefined) !== (item.body === undefined)) throw new Error(`${item.folder}/node.manifest.json: definition and body come together, or not at all`);
  if (item.definition !== undefined && (typeof item.definition !== 'string' || !item.definition || typeof item.body !== 'string' || !item.body)) throw new Error(`${item.folder}/node.manifest.json: definition and body must be export names`);
  if (item.locales) throw new Error(`${item.folder}/node.manifest.json: put the name and description in locales.ts as node.<id> and node.desc.<id>, not in the manifest`);
  if (item.errors !== undefined && (typeof item.errors !== 'string' || !item.errors)) throw new Error(`${item.folder}/node.manifest.json: errors must be the name of the code table exported from errors.ts`);
  if (ids.has(item.id)) throw new Error(`duplicate node id: ${item.id}`);
  // Only a capsule that still ships a node may not reuse a retired id: an engine capsule keeps its
  // id for its locales and its registration long after the node of that name is gone.
  if (item.definition && retired[item.id]) throw new Error(`${item.folder}/node.manifest.json: "${item.id}" is listed in retired.json`);
  ids.add(item.id);
}
for (const [type, info] of Object.entries(retired)) {
  if (info.replacedBy && !ids.has(info.replacedBy)) throw new Error(`nodes/retired.json: "${type}" points at "${info.replacedBy}", which no capsule declares`);
}

function imports(side) {
  const modules = new Map();
  if (side !== 'server') {
    for (const item of capsules.filter((entry) => entry.definition)) {
      const file = side === 'definitions' ? 'node' : (item.bodyModule || 'body');
      const name = side === 'definitions' ? item.definition : item.body;
      const key = `${item.folder}/${file}`;
      modules.set(key, [...(modules.get(key) || []), name]);
    }
  }
  if (side === 'definitions') {
    for (const item of capsules.filter((entry) => entry.errors)) {
      const key = `${item.folder}/errors`;
      modules.set(key, [...(modules.get(key) || []), item.errors]);
    }
  }
  if (side === 'server') {
    for (const item of capsules.filter((entry) => entry.services)) {
      const key = `${item.folder}/${item.servicesModule || 'server'}`;
      modules.set(key, [...(modules.get(key) || []), item.services]);
    }
    for (const item of capsules.filter((entry) => entry.register?.server)) {
      const key = `${item.folder}/register.server`;
      modules.set(key, [...(modules.get(key) || []), item.register.server]);
    }
  }
  if (side === 'client') {
    for (const item of capsules.filter((entry) => entry.overlay)) {
      const key = `${item.folder}/${item.overlayModule || 'body'}`;
      modules.set(key, [...(modules.get(key) || []), item.overlay]);
    }
    for (const item of capsules.filter((entry) => entry.register?.client)) {
      const key = `${item.folder}/register.client`;
      modules.set(key, [...(modules.get(key) || []), item.register.client]);
    }
  }
  return [...modules].map(([modulePath, names]) => `import { ${[...new Set(names)].join(', ')} } from '../${modulePath}';`).join('\n');
}

const definitions = `/* Generated by scripts/discover-nodes.mjs. Do not edit. */
import { registerNodeType, registerRetiredNodeType, type AnyNodeDefinition, type RetiredNodeType } from '@/core/nodes/definition';
import { registerContracts } from '@/contracts';
import { registerDocMigrations } from '../migrations';
${imports('definitions')}

export const ALL_NODES: AnyNodeDefinition[] = [
${capsules.filter((item) => item.definition).map((item) => `  ${item.definition},`).join('\n')}
] as unknown as AnyNodeDefinition[];

const expectedIds = ${JSON.stringify(capsules.filter((item) => item.definition).map((item) => item.id))};
ALL_NODES.forEach((definition, index) => {
  if (definition.type !== expectedIds[index]) throw new Error('node manifest id "' + expectedIds[index] + '" does not match definition type "' + definition.type + '"');
});

/** The folders of user-brought files a node reads (music, voice, clips): name → env override and file kinds. */
export const NODE_LIBRARIES: Record<string, { env: string; extensions: readonly string[] }> = ${JSON.stringify(Object.fromEntries(capsules.flatMap((item) => Object.entries(item.libraries || {}))), null, 2)};

/** What a node declares about itself beyond its ports, for the hub: which node carries the IR, the preview, the file export. */
export const NODE_FEATURES: Record<string, string[]> = ${JSON.stringify(Object.fromEntries(capsules.filter((item) => item.definition).map((item) => [item.id, item.features || []])), null, 2)};

/**
 * The failures each capsule owns. A code that belongs to one node lives in that node's errors.ts
 * beside its strings in the capsule's own locales; core carries only what core and the provider
 * layer raise. Listed here so a test can check every one of them can be shown to a person.
 */
export const NODE_ERROR_CODES: Record<string, string[]> = ${JSON.stringify(Object.fromEntries(capsules.filter((item) => item.errors).map((item) => [item.id, []])), null, 2)};
${capsules.filter((item) => item.errors).map((item) => `NODE_ERROR_CODES['${item.id}'] = Object.values(${item.errors});`).join('\n')}

/** Node types that are gone, and what became of them (nodes/retired.json). */
export const RETIRED_NODES: Record<string, RetiredNodeType> = ${JSON.stringify(retired, null, 2)};

/** Nodes speak the video contracts, so registering them registers what runs on their wires first. */
export function registerNodes(): void {
  registerContracts();
  for (const definition of ALL_NODES) registerNodeType(definition);
  for (const [type, info] of Object.entries(RETIRED_NODES)) registerRetiredNodeType(type, info);
  registerDocMigrations();
}
`;

// Server-only: the services capsules contribute pull in node:fs, child processes, puppeteer.
// Kept apart from the definitions so the browser bundle, which registers the same nodes, never sees them.
const server = `/* Generated by scripts/discover-nodes.mjs. Do not edit. Server only. */
import type { NodeService } from '@/core/engine/services';
${imports('server')}

export const NODE_SERVICE_EXTENSIONS: Record<string, NodeService>[] = [
${capsules.filter((item) => item.services).map((item) => `  ${item.services},`).join('\n')}
];

/** What a capsule registers on the server beyond its definition: an engine, a renderer. */
export const NODE_SERVER_REGISTRATIONS: (() => void)[] = [
${capsules.filter((item) => item.register?.server).map((item) => `  ${item.register.server},`).join('\n')}
];
`;

const client = `/* Generated by scripts/discover-nodes.mjs. Do not edit. */
'use client';
import type React from 'react';
import type { BodyProps } from '../kit';
import type { NodeMeta } from '@/lib/node-meta';
${imports('client')}

export const NODE_BODIES: Record<string, React.FC<BodyProps>> = {
${capsules.filter((item) => item.body).map((item) => `  '${item.id}': ${item.body},`).join('\n')}
};

export const NODE_OVERLAYS: React.FC[] = [
${capsules.filter((item) => item.overlay).map((item) => `  ${item.overlay},`).join('\n')}
];

export const NODE_META: Record<string, NodeMeta> = {
${capsules.filter((item) => item.definition).map((item) => `  '${item.id}': { icon: '${item.icon}', group: '${item.group}'${item.layout === 'wide' ? ", layout: 'wide'" : ''} },`).join('\n')}
};

/** What a capsule registers in the browser beyond its body: an engine's player and preview. */
export const NODE_CLIENT_REGISTRATIONS: (() => void)[] = [
${capsules.filter((item) => item.register?.client).map((item) => `  ${item.register.client},`).join('\n')}
];
`;

const locales = `/* Generated by scripts/discover-nodes.mjs. Do not edit. */
${capsules.map((item) => `import { ${item.translations} } from '../${item.folder}/${item.translationsModule || 'locales'}';`).join('\n')}

/** Every string a node shows, by language: its name and description (node.<id>, node.desc.<id>) and its own labels. */
export const NODE_TRANSLATIONS: Record<string, Record<string, string>> = { en: {}, vi: {} };
for (const extension of [${capsules.map((item) => item.translations).join(', ')}]) {
  Object.assign(NODE_TRANSLATIONS.en!, extension.en);
  Object.assign(NODE_TRANSLATIONS.vi!, extension.vi);
}
`;

await mkdir(generatedDir, { recursive: true });
await Promise.all([
  writeFile(path.join(generatedDir, 'definitions.ts'), definitions),
  writeFile(path.join(generatedDir, 'server.ts'), server),
  writeFile(path.join(generatedDir, 'client.ts'), client),
  writeFile(path.join(generatedDir, 'locales.ts'), locales),
]);
console.log(`Discovered ${capsules.length} node capsules.`);
