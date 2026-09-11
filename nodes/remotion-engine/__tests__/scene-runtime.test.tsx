import { describe, expect, it } from 'vitest';
import { migrateIR } from '@/core/types/migrate-ir';
import lumenV2 from '@/core/__tests__/fixtures/ir-v2-lumen.json';
import { SceneInstance, prepareFilm } from '../scene-runtime';

/**
 * The html-gsap machinery under Remotion, driven in jsdom the way the composition drives it: the
 * film prepared once, one scene mounted, seeked to a second of itself. gsap writes inline styles,
 * which jsdom keeps, so what a frame would show can be read back.
 */

describe('prepareFilm', () => {
  it('gives every code clip its markup, styles, scripts, caption lines and the words it hears', () => {
    const ir = migrateIR(lumenV2);
    const film = prepareFilm(ir);
    expect(film.scenes.map((s) => s.id)).toEqual(ir.beats.map((b) => b.clipId));
    const first = film.scenes[0]!;
    expect(first.html).toContain('class="nc-cap-line"');
    expect(first.words.length).toBeGreaterThan(0);
    expect(first.words[0]!.start).toBeGreaterThanOrEqual(0);
    expect(first.css).toContain('@scope ([data-scene="scene-1"])');
    // A fade of 0.4 s between beats: every beat but the last stays up 12 frames longer, and knows what comes in and out.
    expect(first.overlapFrames).toBe(12);
    expect(first.transitionIn).toBeNull();
    expect(first.transitionOut).toEqual({ name: 'fade', seconds: 0.4, atFrame: ir.beats[1]!.startFrame });
    expect(film.scenes.at(-1)!.overlapFrames).toBe(0);
    expect(film.scenes.at(-1)!.transitionOut).toBeNull();
    expect(film.beats[1]!.start).toBeCloseTo(ir.beats[1]!.startFrame / 30);
  });

  it('points the scenes\' files at the render origin', () => {
    const ir = migrateIR(lumenV2);
    const clip = ir.tracks[0]!.clips[0]!;
    if (clip.kind === 'code') clip.source = `${clip.source}<img src="/api/assets/0123456789abcdef0123456789abcdef01234567.png">`;
    const film = prepareFilm(ir, 'http://127.0.0.1:3000');
    expect(film.scenes[0]!.html).toContain('src="http://127.0.0.1:3000/api/assets/');
  });
});

describe('SceneInstance', () => {
  it('mounts a scene, runs its script with the scoped gsap, and shows a frame when seeked', () => {
    const scene = {
      id: 's1', index: 0, start: 0, duration: 4,
      html: '<div class="card"><h1 class="title">Hello</h1><div id="nc-cap-0-0" class="nc-cap-line"><span id="nc-cap-0-0-w0" class="nc-cap-w">Hi</span></div></div>',
      css: '', scripts: ["nodecine.timeline(gsap.timeline().fromTo('.title', { opacity: 0 }, { opacity: 1, duration: 1 }, 0));"],
      facts: {}, words: [{ text: 'Hi', start: 1 }],
      cues: [{ id: 'nc-cap-0-0', show: 1, hide: 2, style: 'karaoke' as const, words: [{ id: 'nc-cap-0-0-w0', text: 'Hi', at: 1.2 }] }],
      overlapFrames: 0, transitionIn: null, transitionOut: null,
    };
    const root = document.createElement('div');
    document.body.append(root);
    root.innerHTML = scene.html;
    const inst = new SceneInstance(root, scene, { vars: {}, beats: [], analysis: {} });
    const title = root.querySelector<HTMLElement>('.title')!;
    const line = root.querySelector<HTMLElement>('#nc-cap-0-0')!;
    inst.seek(0);
    expect(Number(title.style.opacity)).toBe(0);
    expect(line.style.visibility).not.toBe('visible');
    inst.seek(0.5);
    expect(Number(title.style.opacity)).toBeGreaterThan(0.3);
    inst.seek(1.5);
    expect(Number(title.style.opacity)).toBe(1);
    expect(line.style.visibility).toBe('inherit');
    expect(root.querySelector<HTMLElement>('#nc-cap-0-0-w0')!.style.color).toContain('var(--caption-on');
    inst.seek(3);
    expect(line.style.visibility).toBe('hidden');
    inst.dispose();
    root.remove();
  });
});
