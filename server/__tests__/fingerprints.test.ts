import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { _forgetFingerprints, fingerprintFor, fingerprintOfFolder } from '../fingerprints';
import { NODE_SOURCES } from '@/capsules/nodes/.generated/server';

/**
 * The fingerprint of the code that runs a node: it moves when that code moves
 * and stays put when only the node's face or its tests do.
 */

let root = '';
let capsule = '';
let shared = '';

async function write(file: string, text: string) {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, text);
  // Remembered by modification time; forgetting makes each check independent of the clock's grain.
  _forgetFingerprints();
}

beforeEach(async () => {
  root = await mkdtemp(path.join(os.tmpdir(), 'nodecine-fp-'));
  capsule = path.join(root, 'nodes', 'voice');
  shared = path.join(root, 'shared');
  await write(path.join(capsule, 'node.ts'), "import { helper } from '../../shared/helper';\nimport { z } from 'zod';\nexport const node = helper(z);\n");
  await write(path.join(capsule, 'script.py'), 'print("align")\n');
  await write(path.join(capsule, 'body.tsx'), 'export const Body = () => null;\n');
  await write(path.join(capsule, 'locales.ts'), 'export const t = { en: {} };\n');
  await write(path.join(capsule, '__tests__', 'node.test.ts'), "it('x', () => {});\n");
  await write(path.join(shared, 'helper.ts'), 'export const helper = (x: unknown) => x;\n');
});
afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

describe("a node's code fingerprint", () => {
  it('changes when a file the node imports changes, however far away', async () => {
    const before = fingerprintOfFolder(capsule);
    await write(path.join(shared, 'helper.ts'), 'export const helper = (x: unknown) => [x];\n');
    expect(fingerprintOfFolder(capsule)).not.toBe(before);
  });

  it('changes when a script the node runs changes, though nothing imports it', async () => {
    const before = fingerprintOfFolder(capsule);
    await write(path.join(capsule, 'script.py'), 'print("align more")\n');
    expect(fingerprintOfFolder(capsule)).not.toBe(before);
  });

  it("stays put when only the node's face, its strings or its tests change", async () => {
    const before = fingerprintOfFolder(capsule);
    await write(path.join(capsule, 'body.tsx'), 'export const Body = () => "new look";\n');
    await write(path.join(capsule, 'locales.ts'), "export const t = { en: { a: 'b' } };\n");
    await write(path.join(capsule, '__tests__', 'node.test.ts'), "it('y', () => {});\n");
    expect(fingerprintOfFolder(capsule)).toBe(before);
  });

  it('is the same for the same code, read twice', () => {
    expect(fingerprintOfFolder(capsule)).toBe(fingerprintOfFolder(capsule));
  });
});

describe('the shipped node types', () => {
  it('each have one, and a type this build did not ship has none', () => {
    _forgetFingerprints();
    const nodeFingerprint = fingerprintFor(NODE_SOURCES);
    const tts = nodeFingerprint('tts');
    expect(tts).toMatch(/^[a-f0-9]{16}$/);
    expect(nodeFingerprint('transcribe')).not.toBe(tts);
    expect(nodeFingerprint('test/voice')).toBeUndefined();
  });
});
