import { describe, expect, it } from 'vitest';
import { applyBoxToCode, snapBox } from '../layout-edit';
import { DEFAULT_STAGE } from '@/nodes/art-director/node';
import { buildLookPreview } from '@/core/look/markup';

const FRAME = { w: 1080, h: 1920 };
const rule = (code: string, sel: string) => new RegExp(`${sel.replace(/[.[\]"$]/g, (c) => `\\${c}`)}\\s*\\{([^}]*)\\}`).exec(code)?.[1] ?? '';

describe('applyBoxToCode', () => {
  it('moves a left/top element without inventing a width, and keeps the rest of the rule', () => {
    const out = applyBoxToCode(DEFAULT_STAGE.code.source, 'kicker', { x: 100, y: 300, w: 840, h: 40 }, FRAME);
    const r = rule(out, '.stage .kicker');
    expect(r).toContain('left: 100px;');
    expect(r).toContain('top: 300px;');
    expect(r).not.toContain('right:');
    expect(r).not.toContain('width:');
    expect(r).toContain('font: 600 28px/1 var(--font-body)');
  });

  it('keeps a left/right pair when both are set', () => {
    const out = applyBoxToCode(DEFAULT_STAGE.code.source, 'rule', { x: 100, y: 1200, w: 840, h: 2 }, FRAME);
    const r = rule(out, '.stage .rule');
    expect(r).toContain('left: 100px;'); expect(r).toContain('right: 140px;'); expect(r).toContain('bottom: 718px;');
  });

  it('keeps a bottom-anchored element bottom-anchored', () => {
    const out = applyBoxToCode(DEFAULT_STAGE.code.source, 'captions', { x: 72, y: 1100, w: 840, h: 100 }, FRAME);
    const r = rule(out, '.stage .captions');
    expect(r).toContain('bottom: 720px;');
    expect(r).not.toContain('top:');
  });

  it('resizing a four-edge element writes all four edges and drops width/height', () => {
    const out = applyBoxToCode(DEFAULT_STAGE.code.source, 'content', { x: 100, y: 400, w: 800, h: 700 }, FRAME, { resized: true });
    const r = rule(out, '.stage .content');
    expect(r).toContain('left: 100px;'); expect(r).toContain('right: 180px;'); expect(r).toContain('top: 400px;'); expect(r).toContain('bottom: 820px;');
    expect(r).toContain('display: flex');
  });

  it('an element with no rule gets one, absolutely positioned, inside <style>', () => {
    const code = '<style>\n  .stage { position: absolute; inset: 0; }\n</style>\n<div class="stage"><div class="logo"></div></div>';
    const out = applyBoxToCode(code, 'logo', { x: 72, y: 100, w: 200, h: 60 }, FRAME, { resized: true });
    expect(out.indexOf('.stage .logo {')).toBeLessThan(out.indexOf('</style>'));
    expect(rule(out, '.stage .logo')).toContain('position: absolute; left: 72px; width: 200px; top: 100px; height: 60px;');
    const html = buildLookPreview({ stage: { ...DEFAULT_STAGE, code: { format: 'html-gsap', source: out } }, measure: true });
    expect(html).toContain('nodecine:rects');
  });

  it('expands inset before writing edges', () => {
    const code = '<style>.stage .veil { position: absolute; inset: 0; }</style><div class="stage"><div class="veil"></div></div>';
    const out = applyBoxToCode(code, 'veil', { x: 10, y: 20, w: 1000, h: 1800 }, FRAME);
    const r = rule(out, '.stage .veil');
    expect(r).not.toContain('inset');
    expect(r).toContain('top: 20px;'); expect(r).toContain('right: 70px;'); expect(r).toContain('bottom: 100px;'); expect(r).toContain('left: 10px;');
  });
});

describe('snapBox', () => {
  it('snaps edges near the safe-zone lines and rounds to the 4px grid', () => {
    const z = { left: 72, right: 168, top: 260, bottom: 680 };
    expect(snapBox({ x: 66, y: 253, w: 301, h: 41 }, FRAME, z)).toEqual({ x: 72, y: 260, w: 300, h: 40 });
    // right edge near the right safe line (1080-168 = 912)
    expect(snapBox({ x: 605, y: 500, w: 300, h: 40 }, FRAME, z).x).toBe(612);
  });
});
