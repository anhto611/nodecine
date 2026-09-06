import { describe, expect, it } from 'vitest';
import { drawFieldInCode, isFieldDrawn, isVarUsed } from '../forms';
import { DEFAULT_STAGE } from '../node';
import { buildLookPreview } from '@/core/look/markup';

describe('scene field helpers', () => {
  it('knows which fields the stage code draws', () => {
    expect(isFieldDrawn(DEFAULT_STAGE.code.source, 'kicker')).toBe(true);
    expect(isFieldDrawn(DEFAULT_STAGE.code.source, 'subtitle')).toBe(false);
  });

  it('adds a rule and an element for a new field inside the stage root, before the script, and shows it in the preview', () => {
    const out = drawFieldInCode(DEFAULT_STAGE.code.source, 'subtitle');
    expect(isFieldDrawn(out, 'subtitle')).toBe(true);
    expect(out.indexOf('.stage .subtitle {')).toBeLessThan(out.indexOf('</style>'));
    const el = out.indexOf('data-field="subtitle"');
    expect(el).toBeGreaterThan(out.indexOf('data-slot="captions"'));
    expect(el).toBeLessThan(out.indexOf('<script'));
    expect(drawFieldInCode(out, 'subtitle')).toBe(out);
    const html = buildLookPreview({ stage: { ...DEFAULT_STAGE, sceneFields: [...DEFAULT_STAGE.sceneFields, { name: 'subtitle', rule: 'x' }], code: { format: 'html-gsap', source: out } } });
    expect(html).toContain('data-field="subtitle"');
  });

  it('knows which palette keys the code refers to', () => {
    expect(isVarUsed(DEFAULT_STAGE.code.source, 'accent')).toBe(true);
    expect(isVarUsed(DEFAULT_STAGE.code.source, 'nothing')).toBe(false);
  });
});
