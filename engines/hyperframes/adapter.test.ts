import { beforeEach, describe, expect, it } from 'vitest';
import { _resetSceneRegistry, getScene, hasRenderer, missingRenderers } from '@/core/scenes/registry';
import { TITLE_CARD } from '@/core/scenes/title-card';
import { createHyperframesAdapter } from './adapter';
import { registerHyperframesRenderers } from './renderers';
import { registerGithubShowcaseHyperframes } from '@/extras/github/hyperframes';
import { HYPERFRAMES_ENGINE_ID } from './constants';
import { CTA, HOOK, MOCKUP } from '@/extras/github/scenes/schemas';
import { wrapText, ramp, easeOut, alpha } from './draw';

describe('Hyperframes adapter', () => {
  it('offers preview and says plainly that export is not implemented', async () => {
    const caps = await createHyperframesAdapter().probe();
    expect(caps.preview.status).toBe('ready');
    expect(caps.render.status).toBe('unavailable');
    if (caps.render.status === 'unavailable') expect(caps.render.code).toBe('ENGINE_NOT_READY');
  });

  it('refuses to mount a player outside the browser instead of pretending', () => {
    expect(() => createHyperframesAdapter().mountPlayer({} as HTMLElement, {} as never)).toThrow();
  });

  it('rejects a render with a code the node can display', async () => {
    await expect(createHyperframesAdapter().render({} as never, {} as never, () => {}, new AbortController().signal)).rejects.toMatchObject({
      code: 'ENGINE_NOT_READY',
    });
  });
});

describe('Hyperframes scene renderers', () => {
  beforeEach(() => {
    _resetSceneRegistry();
    registerHyperframesRenderers();
    // The engine knows no extra; each registers its own renderers, as the app does.
    registerGithubShowcaseHyperframes();
  });

  it('draws the core scene and every scene the GitHub extra adds', () => {
    for (const type of [TITLE_CARD, HOOK, MOCKUP, CTA]) {
      expect(hasRenderer(type, HYPERFRAMES_ENGINE_ID)).toBe(true);
      expect(typeof getScene(type)?.renderers[HYPERFRAMES_ENGINE_ID]).toBe('function');
    }
    expect(missingRenderers([TITLE_CARD, HOOK, MOCKUP, CTA], HYPERFRAMES_ENGINE_ID)).toEqual([]);
  });

  it('registers renderers as plain functions, not React components', () => {
    const draw = getScene(TITLE_CARD)?.renderers[HYPERFRAMES_ENGINE_ID] as { prototype?: unknown };
    expect(typeof draw).toBe('function');
    // A React component would carry $$typeof once wrapped; a draw function is bare.
    expect((draw as Record<string, unknown>).$$typeof).toBeUndefined();
  });
});

describe('draw helpers', () => {
  it('wraps on spaces and keeps a long word whole', () => {
    const measure = (s: string) => s.length * 10;
    // 'three four' is exactly 100 wide, and the fit is inclusive, so it stays on one line.
    expect(wrapText(measure, 'one two three four', 100)).toEqual(['one two', 'three four']);
    expect(wrapText(measure, 'one two three fourth', 100)).toEqual(['one two', 'three', 'fourth']);
    expect(wrapText(measure, 'supercalifragilistic', 50)).toEqual(['supercalifragilistic']);
    expect(wrapText(measure, '   ', 100)).toEqual([]);
  });

  it('ramps between two frames and clamps outside them', () => {
    expect(ramp(0, 10, 20)).toBe(0);
    expect(ramp(15, 10, 20)).toBe(0.5);
    expect(ramp(99, 10, 20)).toBe(1);
    expect(ramp(10, 10, 10)).toBe(1);
  });

  it('eases out and stays inside 0..1', () => {
    expect(easeOut(0)).toBe(0);
    expect(easeOut(1)).toBe(1);
    expect(easeOut(0.5)).toBeGreaterThan(0.5);
    expect(easeOut(2)).toBe(1);
  });

  it('adds alpha to a hex colour and passes anything else through', () => {
    expect(alpha('#7c5cff', 0.5)).toBe('rgba(124, 92, 255, 0.5)');
    expect(alpha('red', 0.5)).toBe('red');
  });
});
