import { describe, it, expect, afterAll } from 'vitest';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { collectKit, kitProblems } from '../kit-session';
import { applyAgentActions } from '@/contracts/agent/actions';
import { describeSample, type SampleProfile } from '@/contracts/agent/sample';
import { ensureServerRegistrations } from '../register';
import type { Graph } from '@/core/engine/graph';

/** What NodeCine checks in a kit a coding agent built, what it takes back from the folder, and how the agent asks for one. */

const tmp = mkdtempSync(path.join(os.tmpdir(), 'nodecine-kit-'));
afterAll(() => rmSync(tmp, { recursive: true, force: true }));

const block = (name: string, role: string, description = `The ${name} scene`) =>
  `<!doctype html><html lang="en" data-composition-duration="4" data-role="${role}" data-composition-variables="[]"><head><meta charset="UTF-8" /><meta name="description" content="${description}" /></head><body><template><div id="root" data-composition-id="${name}" data-width="1080" data-height="1920" data-duration="4"></div><script>var tl = gsap.timeline({ paused: true }); window.__timelines = window.__timelines || {}; window.__timelines['${name}'] = tl;</script></template></body></html>`;

describe("a kit's contract", () => {
  it('finds what a kit lacks', async () => {
    ensureServerRegistrations();
    const problems = await kitProblems({ 'compositions/one.html': block('one', 'banner', '') });
    expect(problems.join('\n')).toMatch(/index\.html is missing/);
    expect(problems.join('\n')).toMatch(/only 1 block/);
    expect(problems.join('\n')).toMatch(/data-role> must be one of/);
    expect(problems.join('\n')).toMatch(/description"> is missing/);
    expect(problems.join('\n')).toMatch(/no block has data-role="hook"/);
    expect(problems.join('\n')).toMatch(/storyboard-guide\.md is missing/);
  });

  it('passes a kit that keeps it', async () => {
    const index = `<!doctype html><html><head><script src="gsap.min.js"></script></head><body><div id="root" data-composition-id="shell" data-start="0" data-width="1080" data-height="1920" data-duration="10"><!-- nodecine:frames --></div><script>const tl = gsap.timeline({ paused: true }); window.__timelines = { shell: tl };</script></body></html>`;
    const problems = await kitProblems({
      'index.html': index,
      'compositions/open.html': block('open', 'hook'),
      'compositions/part.html': block('part', 'scene'),
      'compositions/close.html': block('close', 'outro'),
      'storyboard-guide.md': '---\nfirst: hook\nlast: outro\n---\nShort films.',
    });
    expect(problems).toEqual([]);
    // Every block is played in a headless browser too.
  }, 120_000);
});

describe('collecting a kit', () => {
  it('takes the text files the agent wrote, not what NodeCine put there for it', async () => {
    const dir = path.join(tmp, 'k');
    mkdirSync(path.join(dir, 'compositions'), { recursive: true });
    mkdirSync(path.join(dir, 'sample'), { recursive: true });
    mkdirSync(path.join(dir, '.claude'), { recursive: true });
    writeFileSync(path.join(dir, 'index.html'), '<html></html>');
    writeFileSync(path.join(dir, 'compositions', 'a.html'), '<html></html>');
    writeFileSync(path.join(dir, 'NODECINE-KIT.md'), 'guide');
    writeFileSync(path.join(dir, 'SAMPLE.md'), 'sample');
    writeFileSync(path.join(dir, 'sample', '01.jpg'), 'x');
    writeFileSync(path.join(dir, '.claude', 'settings.json'), '{}');
    writeFileSync(path.join(dir, 'logo.png'), 'x');
    expect(Object.keys(await collectKit(dir)).sort()).toEqual(['compositions/a.html', 'index.html']);
  });
});

describe('asking for a kit', () => {
  it('is only for a Composition node', () => {
    ensureServerRegistrations();
    const graph: Graph = {
      nodes: [
        { id: 'c', type: 'composition', params: {}, bypassed: false, position: { x: 0, y: 0 } },
        { id: 'b', type: 'brief', params: { about: '', hint: {} }, bypassed: false, position: { x: 0, y: 0 } },
      ],
      edges: [],
    };
    const r = applyAgentActions(graph, [
      { op: 'buildKit', node: 'b', request: 'x' },
      { op: 'buildKit', node: 'c', request: 'vertical, three.js diagrams' },
    ]);
    expect(r.results.map((x) => x.ok)).toEqual([false, true]);
    expect(r.kit).toEqual({ nodeId: 'c', request: 'vertical, three.js diagrams' });
  });
});

describe('speech in a language the transcriber does not know', () => {
  it('is left out, and said to be unknown', () => {
    const p: SampleProfile = {
      id: '0123456789abcdef',
      name: 'v.mp4',
      durationSeconds: 10,
      width: 720,
      height: 1280,
      fps: 30,
      segments: [{ start: 0, end: 10, by: 'start' }],
      frames: [],
      audio: { present: true },
      speech: { language: 'yue', lines: [{ start: 0, end: 2, text: '乱码' }] },
    };
    const text = describeSample(p);
    expect(text).not.toContain('乱码');
    expect(text).toContain('not in a language the transcriber knows');
  });
});
