import { describe, expect, it, afterAll } from 'vitest';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { KOKORO_VOICES, kokoroVoice } from '../kokoro';
import { vieneuVoices } from '../vieneu';
import { sampleVoices } from '../omnivoice';
import { findPythonEnv } from '../voice-workers';
import { migrateGraph } from '@/core/engine/migrate';
import { registerNodes } from '@/capsules/nodes';
import type { Graph } from '@/core/engine/graph';

/** The local voices without running them: what each offers, where it looks, and what became of Piper. */

const tmp = mkdtempSync(path.join(os.tmpdir(), 'nodecine-local-voices-'));
afterAll(() => rmSync(tmp, { recursive: true, force: true }));

describe('Kokoro voices', () => {
  it('names each voice and its language from its id', () => {
    expect(kokoroVoice('af_heart')).toEqual({ id: 'af_heart', displayName: 'Heart · ♀', language: 'en-US' });
    expect(kokoroVoice('jm_kumo').language).toBe('ja');
    expect(KOKORO_VOICES).toHaveLength(54);
    expect(KOKORO_VOICES.indexOf('af_heart')).toBe(3);
  });
});

describe('VieNeu voices', () => {
  it('are the pinned Vietnamese voices', () => {
    const voices = vieneuVoices();
    expect(voices.length).toBeGreaterThan(10);
    expect(voices.every((v) => v.language === 'vi')).toBe(true);
    expect(voices[0]!.id).toBe('Hải Đăng');
    expect(voices.at(-1)!.id).toBe('Adam bựa');
  });
});

describe('OmniVoice samples', () => {
  it('counts a recording as a voice only with its words beside it', () => {
    const dir = path.join(tmp, 'voices');
    mkdirSync(dir, { recursive: true });
    writeFileSync(path.join(dir, 'Tôi.wav'), 'x');
    writeFileSync(path.join(dir, 'Tôi.txt'), 'Xin chào.\n');
    writeFileSync(path.join(dir, 'lẻ.mp3'), 'x');
    writeFileSync(path.join(dir, 'ghi-chú.txt'), 'không phải mẫu');
    const voices = sampleVoices(dir);
    expect(voices.map((v) => [v.id, v.language, v.words])).toEqual([['Tôi', 'mul', 'Xin chào.']]);
  });
});

describe('finding a Python environment', () => {
  it('finds the libraries in a venv and runs them on its base interpreter', () => {
    const base = path.join(tmp, 'python', 'bin');
    mkdirSync(base, { recursive: true });
    writeFileSync(path.join(base, 'python3'), '');
    const venv = path.join(tmp, 'tool', '.venv');
    mkdirSync(path.join(venv, 'lib', 'python3.12', 'site-packages', 'vieneu'), { recursive: true });
    writeFileSync(path.join(venv, 'pyvenv.cfg'), `home = ${base}\nversion_info = 3.12\n`);
    const env = findPythonEnv(path.join(tmp, 'tool'), 'vieneu');
    expect(env?.python).toBe(path.join(base, 'python3'));
    expect(env?.args('w.py')).toContain(path.join(venv, 'lib', 'python3.12', 'site-packages'));
  });

  it('passes over a venv whose interpreter is gone', () => {
    const venv = path.join(tmp, 'orphan');
    mkdirSync(path.join(venv, 'lib', 'python3.12', 'site-packages', 'vieneu'), { recursive: true });
    writeFileSync(path.join(venv, 'pyvenv.cfg'), `home = ${path.join(tmp, 'removed', 'bin')}\n`);
    expect(findPythonEnv(venv, 'vieneu')).toBeNull();
  });
});

describe('a workflow that spoke with Piper or the OS voice', () => {
  it('speaks with VieNeu when its voice was Vietnamese, with Kokoro otherwise, the voice left automatic', () => {
    registerNodes();
    const tts = (id: string, provider: string, voice: string) => ({
      id,
      type: 'tts',
      params: { ttsProvider: provider, ttsSettings: { rate: 1 }, voice, speed: 1 },
      bypassed: false,
      position: { x: 0, y: 0 },
    });
    const graph: Graph = {
      nodes: [tts('a', 'piper', 'vi_VN-vais1000-medium'), tts('b', 'piper', 'en_US-amy-medium'), tts('c', 'system-tts', 'Linh'), tts('d', 'system-tts', 'Samantha')],
      edges: [],
    };
    const { graph: g, notes } = migrateGraph(graph);
    expect(g.nodes.map((n) => [n.params.ttsProvider, n.params.voice])).toEqual([
      ['vieneu', undefined],
      ['kokoro', undefined],
      ['vieneu', undefined],
      ['kokoro', undefined],
    ]);
    expect(notes.filter((n) => n.message.includes('is gone'))).toHaveLength(4);
    expect(migrateGraph(g).notes.filter((n) => n.message.includes('is gone'))).toEqual([]);
  });
});
