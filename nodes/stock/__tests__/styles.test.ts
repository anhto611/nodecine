import { describe, expect, it } from 'vitest';
import { STOCK_GROUPS, STOCK_STYLES, stylePrompt } from '../styles';
import { buildStockPrompt } from '../prompt';
import type { SceneScript } from '@/contracts/types/payloads';

const script: SceneScript = {
  language: 'vi',
  scenes: [
    { role: 'open', weight: 1, narration: 'Mỗi cảnh là một tấm hình.', content: {} },
    { role: 'next', weight: 1, narration: 'Chọn ảnh rồi bấm chạy.', content: {} },
  ],
};

describe('the style table', () => {
  it('names the groups from itself, so a new style cannot be missed in one of three places', () => {
    // auto and mixed are ways of choosing among the groups, not groups.
    expect(STOCK_GROUPS).not.toContain('auto');
    expect(STOCK_GROUPS).not.toContain('mixed');
    expect(STOCK_GROUPS.length).toBe(STOCK_STYLES.length - 2);
    for (const g of STOCK_GROUPS) expect(stylePrompt('auto')).toContain(g);
    for (const g of STOCK_GROUPS) expect(stylePrompt('mixed')).toContain(g);
  });

  it('carries no keyword list a model could walk in order', () => {
    // The whole reason the `query` field was dropped: four videos in a row opened the same way.
    for (const s of STOCK_STYLES) expect(Object.keys(s).sort()).toEqual(['hint', 'id']);
  });

  it('says the same three things whichever style is picked', () => {
    for (const s of STOCK_STYLES) {
      const p = stylePrompt(s.id);
      expect(p, s.id).toContain('must NOT illustrate the narration');
      expect(p, s.id).toContain('Anchor each query on ONE concrete thing');
      expect(p, s.id).toContain('Do NOT follow the');
    }
  });

  it('pins a chosen style, and lets auto and mixed roam', () => {
    expect(stylePrompt('nature')).toContain('Every query must stay inside it');
    expect(stylePrompt('auto')).toContain('Choose ONE kind of place for the whole video');
    expect(stylePrompt('mixed')).toContain('Every scene comes from a different kind of place');
  });
});

describe('buildStockPrompt', () => {
  it('asks for one phrase per scene, in order, and carries the style', () => {
    const p = buildStockPrompt(script, 'cinematic-dark');
    expect(p).toContain('1. [open] Mỗi cảnh là một tấm hình.');
    expect(p).toContain('2. [next] Chọn ảnh rồi bấm chạy.');
    expect(p).toContain('exactly 2 phrases, in the same order');
    expect(p).toContain('one hard light source');
  });
});
