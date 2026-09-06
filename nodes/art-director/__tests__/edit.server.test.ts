import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { buildLookEditPrompt, editLook, lintLookSource, type LookEditRequest } from '../edit.server';
import { DEFAULT_STAGE } from '@/nodes/art-director/node';
import { DEFAULT_BLOCK } from '@/nodes/art-director/blocks';

const { code: _c, ...stageMeta } = DEFAULT_STAGE;
const { code: _b, ...blockMeta } = DEFAULT_BLOCK;
const portrait = { width: 1080, height: 1920 };

describe('buildLookEditPrompt', () => {
  it('carries the rules, the tokens, the fields, the instruction and the current code', () => {
    const p = buildLookEditPrompt({ kind: 'stage', source: DEFAULT_STAGE.code.source, instruction: 'đưa kicker xuống dưới', stage: stageMeta, providerId: 'claude-code', settings: {}, locale: 'vi', frame: portrait });
    expect(p).toContain('data-slot="content"');
    expect(p).toContain('data-slot="captions"');
    expect(p).toContain('fromTo only, never from');
    expect(p).toContain('accent=#7c5cff');
    expect(p).toContain('kicker —');
    expect(p).toContain('đưa kicker xuống dưới');
    expect(p).toContain(DEFAULT_STAGE.code.source.slice(0, 60));
    expect(p).toContain('"source"');
  });

  it('states the workflow frame and the zones that go with it', () => {
    const p = buildLookEditPrompt({ kind: 'stage', source: '<div></div>', instruction: 'x', providerId: 'claude-code', settings: {}, locale: 'en', frame: { width: 1920, height: 1080 } });
    expect(p).toContain('1920×1080 landscape');
    expect(p).toContain('left 96px, right 96px, top 96px, bottom 96px');
    expect(p).not.toContain('bottom 680px');
  });

  it('describes a block by its props', () => {
    const p = buildLookEditPrompt({ kind: 'block', source: DEFAULT_BLOCK.code.source, instruction: 'bigger headline', block: blockMeta, stage: stageMeta, providerId: 'ollama', settings: { model: 'llama3.2' }, locale: 'en', frame: portrait });
    expect(p).toContain('data-prop');
    expect(p).toContain('headline:');
    expect(p).not.toContain('Scene fields (data-field)'.repeat(2));
  });
});

describe('lintLookSource', () => {
  it('is quiet on the shipped stage and block', () => {
    expect(lintLookSource('stage', DEFAULT_STAGE.code.source)).toEqual([]);
    expect(lintLookSource('block', DEFAULT_BLOCK.code.source, DEFAULT_BLOCK)).toEqual([]);
  });

  it('flags the mistakes the rules forbid', () => {
    const bad = '<html><style>.x{color:red !important}</style><div></div><script>nodecine.timeline(gsap.timeline().from(".x",{opacity:0}))</script></html>';
    const w = lintLookSource('stage', bad);
    expect(w.some((x) => x.includes('.from()'))).toBe(true);
    expect(w.some((x) => x.includes('<html>'))).toBe(true);
    expect(w.some((x) => x.includes('!important'))).toBe(true);
    expect(w.some((x) => x.includes('no data-slot="content"'))).toBe(true);
    expect(w.some((x) => x.includes('no data-slot="captions"'))).toBe(true);
    expect(lintLookSource('block', '<div></div>', { props: { headline: { type: 'string', required: true } } })).toEqual(['prop "headline" has no data-prop element']);
  });
});

describe('editLook', () => {
  it('asks the model once, strips a code fence from the answer, and lints the result', async () => {
    const calls: string[] = [];
    const req: LookEditRequest = { kind: 'stage', source: DEFAULT_STAGE.code.source, instruction: 'x', stage: stageMeta, providerId: 'claude-code', settings: {}, locale: 'en', frame: portrait };
    const complete = (async (prompt: string, schema: z.ZodTypeAny) => { calls.push(prompt); return schema.parse({ source: '```html\n<div data-slot="content"></div>\n```', summary: 'moved it' }); }) as Parameters<typeof editLook>[1];
    const r = await editLook(req, complete, new AbortController().signal);
    expect(calls).toHaveLength(1);
    expect(r.source).toBe('<div data-slot="content"></div>');
    expect(r.summary).toBe('moved it');
    expect(r.warnings).toEqual(['no data-slot="captions": subtitles fall back to the default band']);
  });

  it('carries the definition parts the model returns, drops tone keys that are not colours, and names the changes', async () => {
    const req: LookEditRequest = { kind: 'stage', source: DEFAULT_STAGE.code.source, instruction: 'pastel', stage: stageMeta, providerId: 'claude-code', settings: {}, locale: 'en', frame: portrait };
    const complete = (async (_p: string, schema: z.ZodTypeAny) => schema.parse({
      source: DEFAULT_STAGE.code.source,
      summary: 'pastel now',
      tokens: { palette: { ...stageMeta.tokens.palette, bg: '#f6f1ff', accent: '#b48cff', extra: '#ffffff' }, fonts: stageMeta.tokens.fonts },
      tones: { soft: { accent: '#ffd6e7', glow: '#fff' } },
      sceneFields: [...stageMeta.sceneFields, { name: 'mood', rule: 'one word' }],
    })) as Parameters<typeof editLook>[1];
    const r = await editLook(req, complete, new AbortController().signal);
    expect(r.tokens?.palette.bg).toBe('#f6f1ff');
    expect(r.tones).toEqual({ soft: { accent: '#ffd6e7' } });
    expect(r.warnings.some((w) => w.includes('"glow"'))).toBe(true);
    expect(r.warnings.some((w) => w.includes('scene field "mood"'))).toBe(true);
    // The answer replaced the tones wholesale: one new, the three shipped ones gone — and the label says so.
    expect(r.changes).toEqual(['palette: 2 changed +1', 'tones: +1 −3', 'fields: +mood']);
  });

  it('a code-only answer reports no definition changes', async () => {
    const req: LookEditRequest = { kind: 'block', source: DEFAULT_BLOCK.code.source, instruction: 'x', block: blockMeta, stage: stageMeta, providerId: 'claude-code', settings: {}, locale: 'en', frame: portrait };
    const complete = (async (_p: string, schema: z.ZodTypeAny) => schema.parse({ source: DEFAULT_BLOCK.code.source, summary: '' })) as Parameters<typeof editLook>[1];
    const r = await editLook(req, complete, new AbortController().signal);
    expect(r.changes).toEqual([]);
    expect('props' in r).toBe(false);
  });
});
