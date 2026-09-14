import { readdir, readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

/**
 * The node and engine capsules, discovered from their manifests into registries nobody edits
 * (`capsules/nodes/.generated`, `capsules/engines/.generated`). Providers have their own script,
 * `discover-providers.mjs`, because their split between browser and server is a different one.
 *
 * A node is a step of a workflow: a definition and a body. An engine is a part the output nodes name
 * — a player and a renderer — and registers itself on each side; it is not a node and has no card.
 */

const root = process.cwd();
const capsulesDir = path.join(root, 'capsules');
const nodesDir = path.join(capsulesDir, 'nodes');
const enginesDir = path.join(capsulesDir, 'engines');
const generatedDir = path.join(nodesDir, '.generated');
const engineGeneratedDir = path.join(enginesDir, '.generated');

async function discover(dir, manifestName) {
  const folders = (await readdir(dir, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.') && !entry.name.startsWith('_'))
    .map((entry) => entry.name)
    .sort();
  const found = [];
  for (const folder of folders) {
    const file = path.join(dir, folder, manifestName);
    let manifest;
    try { manifest = JSON.parse(await readFile(file, 'utf8')); }
    catch (error) {
      if (error?.code === 'ENOENT') continue;
      throw new Error(`${path.relative(root, file)}: ${error.message}`);
    }
    found.push({ folder, ...manifest });
  }
  return found;
}

// Types that no longer exist. Not a capsule, because the whole point is that the capsule is gone.
const retired = JSON.parse(await readFile(path.join(capsulesDir, 'retired.json'), 'utf8'));
for (const [type, info] of Object.entries(retired)) {
  if (typeof info?.since !== 'string') throw new Error(`capsules/retired.json: "${type}" needs a since date`);
  if (info.replacedBy !== undefined && typeof info.replacedBy !== 'string') throw new Error(`capsules/retired.json: "${type}" replacedBy must be a type id`);
  if (info.renamedTo !== undefined && typeof info.renamedTo !== 'string') throw new Error(`capsules/retired.json: "${type}" renamedTo must be a type id`);
  if (info.renamedTo && info.replacedBy) throw new Error(`capsules/retired.json: "${type}" is either renamed or replaced, not both`);
}

const capsules = await discover(nodesDir, 'node.manifest.json');
const engines = await discover(enginesDir, 'engine.manifest.json');

const ids = new Set();
for (const item of capsules) {
  if (item.libraries) throw new Error(`${item.folder}/node.manifest.json: libraries are gone; a node that reads the user's files says so in its own code`);
  for (const key of ['id', 'icon', 'group', 'translations', 'definition', 'body']) if (typeof item[key] !== 'string' || !item[key]) throw new Error(`${item.folder}/node.manifest.json: ${key} is required`);
  if (item.register) throw new Error(`${item.folder}/node.manifest.json: a node registers nothing of its own; an engine is a capsule under capsules/engines`);
  if (item.locales) throw new Error(`${item.folder}/node.manifest.json: put the name and description in locales.ts as node.<id> and node.desc.<id>, not in the manifest`);
  if (item.actions !== undefined && (typeof item.actions !== 'string' || !item.actions)) throw new Error(`${item.folder}/node.manifest.json: actions must be the name of the table exported from server.ts`);
  if (item.errors !== undefined && (typeof item.errors !== 'string' || !item.errors)) throw new Error(`${item.folder}/node.manifest.json: errors must be the name of the code table exported from errors.ts`);
  if (ids.has(item.id)) throw new Error(`duplicate node id: ${item.id}`);
  if (retired[item.id]) throw new Error(`${item.folder}/node.manifest.json: "${item.id}" is listed in retired.json`);
  ids.add(item.id);
}
for (const item of engines) {
  for (const key of ['id', 'translations']) if (typeof item[key] !== 'string' || !item[key]) throw new Error(`engines/${item.folder}/engine.manifest.json: ${key} is required`);
  if (typeof item.register?.server !== 'string' || typeof item.register?.client !== 'string') throw new Error(`engines/${item.folder}/engine.manifest.json: register.server and register.client are required`);
  if (ids.has(item.id)) throw new Error(`duplicate capsule id: ${item.id}`);
  ids.add(item.id);
}
for (const [type, info] of Object.entries(retired)) {
  if (info.replacedBy && !ids.has(info.replacedBy)) throw new Error(`capsules/retired.json: "${type}" points at "${info.replacedBy}", which no capsule declares`);
  if (info.renamedTo && !ids.has(info.renamedTo)) throw new Error(`capsules/retired.json: "${type}" is renamed to "${info.renamedTo}", which no capsule declares`);
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
    for (const item of capsules.filter((entry) => entry.actions)) {
      const key = `${item.folder}/${item.servicesModule || 'server'}`;
      modules.set(key, [...(modules.get(key) || []), item.actions]);
    }
  }
  if (side === 'client') {
    for (const item of capsules.filter((entry) => entry.overlay)) {
      const key = `${item.folder}/${item.overlayModule || 'body'}`;
      modules.set(key, [...(modules.get(key) || []), item.overlay]);
    }
  }
  return [...modules].map(([modulePath, names]) => `import { ${[...new Set(names)].join(', ')} } from '../${modulePath}';`).join('\n');
}

const definitions = `/* Generated by scripts/discover-capsules.mjs. Do not edit. */
import { registerNodeType, registerRetiredNodeType, type AnyNodeDefinition, type RetiredNodeType } from '@/core/nodes/definition';
import { registerContracts } from '@/contracts';
import { registerDocMigrations } from '../../migrations';
${imports('definitions')}

export const ALL_NODES: AnyNodeDefinition[] = [
${capsules.filter((item) => item.definition).map((item) => `  ${item.definition},`).join('\n')}
] as unknown as AnyNodeDefinition[];

const expectedIds = ${JSON.stringify(capsules.filter((item) => item.definition).map((item) => item.id))};
ALL_NODES.forEach((definition, index) => {
  if (definition.type !== expectedIds[index]) throw new Error('node manifest id "' + expectedIds[index] + '" does not match definition type "' + definition.type + '"');
});

/** What a node declares about itself beyond its ports, for the hub: which node carries the IR, the preview, the file export. */
export const NODE_FEATURES: Record<string, string[]> = ${JSON.stringify(Object.fromEntries(capsules.filter((item) => item.definition).map((item) => [item.id, item.features || []])), null, 2)};

/**
 * The failures each capsule owns. A code that belongs to one node lives in that node's errors.ts
 * beside its strings in the capsule's own locales; core carries only what core and the provider
 * layer raise. Listed here so a test can check every one of them can be shown to a person.
 */
export const NODE_ERROR_CODES: Record<string, string[]> = ${JSON.stringify(Object.fromEntries(capsules.filter((item) => item.errors).map((item) => [item.id, []])), null, 2)};
${capsules.filter((item) => item.errors).map((item) => `NODE_ERROR_CODES['${item.id}'] = Object.values(${item.errors});`).join('\n')}

/** Node types that are gone, and what became of them (capsules/retired.json). */
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
const server = `/* Generated by scripts/discover-capsules.mjs. Do not edit. Server only. */
import type { NodeService } from '@/core/engine/services';
${imports('server')}

export const NODE_SERVICE_EXTENSIONS: Record<string, NodeService>[] = [
${capsules.filter((item) => item.services).map((item) => `  ${item.services},`).join('\n')}
];

/**
 * What a node's body may ask the server for while a person edits it, outside any run: installing a
 * part into a composition, say. Kept apart from the services so only what a capsule names as an
 * action is reachable from the canvas.
 */
export const NODE_ACTIONS: Record<string, NodeService>[] = [
${capsules.filter((item) => item.actions).map((item) => `  ${item.actions},`).join('\n')}
];

/**
 * The capsule folder of each node type. The server fingerprints the code that runs the node from it:
 * every file there but its tests and its face, and whatever those import (server/fingerprints.ts).
 */
export const NODE_SOURCES: Record<string, string> = ${JSON.stringify(Object.fromEntries(capsules.map((item) => [item.id, `capsules/nodes/${item.folder}`])), null, 2)};
`;

const client = `/* Generated by scripts/discover-capsules.mjs. Do not edit. */
'use client';
import type React from 'react';
import type { BodyProps, NodeMeta } from '@/capsules/sdk/meta';
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

`;

const locales = `/* Generated by scripts/discover-capsules.mjs. Do not edit. */
${capsules.map((item) => `import { ${item.translations} } from '../${item.folder}/${item.translationsModule || 'locales'}';`).join('\n')}

/** Every string a node shows, by language: its name and description (node.<id>, node.desc.<id>) and its own labels. */
export const NODE_TRANSLATIONS: Record<string, Record<string, string>> = { en: {}, vi: {} };
for (const extension of [${capsules.map((item) => item.translations).join(', ')}]) {
  Object.assign(NODE_TRANSLATIONS.en!, extension.en);
  Object.assign(NODE_TRANSLATIONS.vi!, extension.vi);
}
`;

const engineServer = `/* Generated by scripts/discover-capsules.mjs. Do not edit. Server only. */
${engines.map((item) => `import { ${item.register.server} } from '../${item.folder}/register.server';`).join('\n')}

/** What each engine registers on the server: its renderer, its producer, the scripts it serves. */
export const ENGINE_SERVER_REGISTRATIONS: (() => void)[] = [
${engines.map((item) => `  ${item.register.server},`).join('\n')}
];
`;

const engineClient = `/* Generated by scripts/discover-capsules.mjs. Do not edit. */
'use client';
${engines.map((item) => `import { ${item.register.client} } from '../${item.folder}/register.client';`).join('\n')}

/** What each engine registers in the browser: its player and, for one of them, the still preview. */
export const ENGINE_CLIENT_REGISTRATIONS: (() => void)[] = [
${engines.map((item) => `  ${item.register.client},`).join('\n')}
];
`;

const engineLocales = `/* Generated by scripts/discover-capsules.mjs. Do not edit. */
${engines.map((item) => `import { ${item.translations} } from '../${item.folder}/${item.translationsModule || 'locales'}';`).join('\n')}

/** Every string an engine shows, by language. */
export const ENGINE_TRANSLATIONS: Record<string, Record<string, string>> = { en: {}, vi: {} };
for (const extension of [${engines.map((item) => item.translations).join(', ')}]) {
  Object.assign(ENGINE_TRANSLATIONS.en!, extension.en);
  Object.assign(ENGINE_TRANSLATIONS.vi!, extension.vi);
}
`;

await mkdir(generatedDir, { recursive: true });
await mkdir(engineGeneratedDir, { recursive: true });
await Promise.all([
  writeFile(path.join(engineGeneratedDir, 'server.ts'), engineServer),
  writeFile(path.join(engineGeneratedDir, 'client.ts'), engineClient),
  writeFile(path.join(engineGeneratedDir, 'locales.ts'), engineLocales),
  writeFile(path.join(generatedDir, 'definitions.ts'), definitions),
  writeFile(path.join(generatedDir, 'server.ts'), server),
  writeFile(path.join(generatedDir, 'client.ts'), client),
  writeFile(path.join(generatedDir, 'locales.ts'), locales),
]);
console.log(`Discovered ${capsules.length} node capsules and ${engines.length} engine capsules.`);
