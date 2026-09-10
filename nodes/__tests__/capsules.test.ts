import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { ALL_NODES, NODE_FEATURES } from '@/nodes';
import { NODE_SERVER_REGISTRATIONS, NODE_SERVICE_EXTENSIONS } from '@/nodes/.generated/server';
import { NODE_CLIENT_REGISTRATIONS } from '@/nodes/index.client';
import { _resetEngineRegistry, listEngineIds, previewEngine } from '@/core/adapters/registry';
import { STYLE, SCENE_SOURCE } from '@/core/__tests__/scene-fixtures';
import { hasTranslation } from '@/lib/i18n';
import { NODE_TRANSLATIONS } from '@/nodes/.generated/locales';
import { makeFakeServices } from '@/core/__tests__/fakes';

/**
 * What the capsule layout promises (ARCHITECTURE §2): every node is one folder with a manifest,
 * the generated registries keep the browser away from server code, the hub's feature flags are
 * declared by exactly the nodes that carry them, and every string a body asks for exists.
 */

const root = process.cwd();
const walk = (dir: string): string[] => readdirSync(dir).flatMap((name) => {
  const p = path.join(dir, name);
  if (name === 'node_modules' || name === '.generated' || name === '__tests__') return [];
  return statSync(p).isDirectory() ? walk(p) : /\.tsx?$/.test(name) ? [p] : [];
});

describe('node capsules', () => {
  it('the definitions registry is isomorphic: it names no server module, and the server registry names only those', () => {
    const definitions = readFileSync(path.join(root, 'nodes/.generated/definitions.ts'), 'utf8');
    expect(definitions).not.toMatch(/\/server'/);
    const server = readFileSync(path.join(root, 'nodes/.generated/server.ts'), 'utf8');
    expect(server.match(/^import \{ \w+ \} from '\.\.\/[\w-]+\/server';$/gm)).toHaveLength(NODE_SERVICE_EXTENSIONS.length);
    expect(server).not.toMatch(/\/node'/);
  });

  it('the hub can find the one node that carries the IR, the one that previews it, and the one that exports a file', () => {
    const carriers = (feature: string) => Object.entries(NODE_FEATURES).filter(([, f]) => f.includes(feature)).map(([id]) => id);
    expect(carriers('history-ir')).toEqual(['core/timeline-assembler']);
    expect(carriers('history-preview')).toEqual(['core/video-output']);
    expect(carriers('history-file-export')).toEqual(['core/mp4-export']);
    expect(Object.keys(NODE_FEATURES).sort()).toEqual(ALL_NODES.map((n) => n.type).sort());
  });

  it('every service a node invokes is contributed by some capsule, and an unknown name is an error, not undefined', async () => {
    const provided = new Set(NODE_SERVICE_EXTENSIONS.flatMap((ext) => Object.keys(ext)));
    const invoked = new Set<string>();
    for (const file of walk(path.join(root, 'nodes'))) for (const m of readFileSync(file, 'utf8').matchAll(/services\.invoke<[^>]*>\(\s*'([^']+)'/g)) invoked.add(m[1]!);
    expect(invoked.size).toBeGreaterThan(0);
    for (const id of invoked) expect(provided, `service "${id}" invoked but no capsule provides it`).toContain(id);
    await expect(makeFakeServices().invoke('nobody/nothing', [])).rejects.toThrow(/unknown/);
  });

  it('every node names and describes itself in both languages, from its own locales.ts', () => {
    for (const n of ALL_NODES) for (const key of [`node.${n.type}`, `node.desc.${n.type}`]) {
      expect(NODE_TRANSLATIONS.en![key], `${n.type}: ${key} (en)`).toBeTruthy();
      expect(NODE_TRANSLATIONS.vi![key], `${n.type}: ${key} (vi)`).toBeTruthy();
    }
  });

  it('every string a node body asks for exists in a dictionary', () => {
    const missing: string[] = [];
    for (const file of [...walk(path.join(root, 'nodes')), ...walk(path.join(root, 'components/node-runtime'))]) {
      for (const m of readFileSync(file, 'utf8').matchAll(/\bt\(\s*'([a-zA-Z0-9./_-]+)'/g)) if (!hasTranslation(m[1]!)) missing.push(`${path.relative(root, file)}: ${m[1]}`);
    }
    expect(missing).toEqual([]);
  });

  it('an engine registers itself from its capsule, on both sides, and the Studio finds one that draws a still', () => {
    expect(NODE_SERVER_REGISTRATIONS).toHaveLength(2);
    expect(NODE_CLIENT_REGISTRATIONS).toHaveLength(2);
    _resetEngineRegistry();
    for (const register of NODE_CLIENT_REGISTRATIONS) register();
    expect(listEngineIds().sort()).toEqual(['hyperframes', 'remotion']);
    const html = previewEngine()!.previewScene!({ style: STYLE, source: SCENE_SOURCE, vars: { channel: 'AIDev' } });
    expect(html).toContain('<h1 class="title">Hello</h1>');
    expect(html).toContain('@layer nc-style');
    _resetEngineRegistry();
  });
});
