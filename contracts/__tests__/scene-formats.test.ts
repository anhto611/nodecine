import { describe, expect, it } from 'vitest';
import { SCENE_FORMATS } from '../visual/contract';
import { SCENE_MOUNT, lottieScene, sourceForFormat, splitCode } from '../visual/scene-markup';

describe('the scene formats', () => {
  it('are three, and a Lottie clip becomes a scene that plays its JSON on nodecine.frame', () => {
    expect(SCENE_FORMATS).toEqual(['html-gsap', 'html-three', 'lottie']);
    const json = JSON.stringify({ v: '5.7.4', fr: 30, ip: 0, op: 60, w: 100, h: 100, layers: [], nm: 'x<y' });
    const scene = lottieScene(json);
    const code = splitCode(scene);
    expect(code.markup).toBe('<div class="nc-lottie"></div>');
    expect(code.scripts[0]).toContain('lottie.loadAnimation({ container: root.querySelector(\'.nc-lottie\')');
    expect(code.scripts[0]).toContain('nodecine.frame(function (t)');
    // `<` never reaches the page as markup inside the script.
    expect(code.scripts[0]).not.toContain('x<y');
    expect(code.scripts[0]).toContain('x\\u003cy');
    expect(sourceForFormat('html-gsap', '<p>hi</p>')).toBe('<p>hi</p>');
    expect(sourceForFormat('html-three', '<canvas></canvas>')).toBe('<canvas></canvas>');
    expect(sourceForFormat('lottie', 'not json')).toContain('nc-lottie-broken');
  });

  it('holds the last frame of a Lottie that is shorter than its clip, and starts over only when asked', () => {
    const json = JSON.stringify({ v: '5.7.4', fr: 30, ip: 0, op: 60, w: 100, h: 100, layers: [] });
    // A layer's out point is exclusive, so seeking to the animation's duration draws nothing: the
    // last drawable frame is one before it. Getting this wrong blanked a 13-second layer at 2 seconds.
    const held = splitCode(lottieScene(json)).scripts[0]!;
    expect(held).toContain('var last = Math.max(0, __ncLottie.totalFrames - 1);');
    expect(held).toContain('__ncWant = Math.min(last, f);');
    expect(held).not.toContain('%');
    const looped = splitCode(lottieScene(json, { loop: true })).scripts[0]!;
    expect(looped).toContain('__ncWant = last > 0 ? f % (last + 1) : 0;');
    expect(sourceForFormat('lottie', json, { loop: true })).toContain('f % (last + 1)');
  });

  it('lets nobody but the clip move the animation', () => {
    // The film runtime discovers every registered Lottie and seeks it on the film's clock without a
    // clamp, so a two-second animation in a thirteen-second layer was asked for frame 390 of 60 and
    // its layers fell out of range — the scene went blank eleven seconds early while the markup, the
    // opacity and the geometry all still said it was there. Every seek now redraws the clip's frame.
    const json = JSON.stringify({ v: '5.7.4', fr: 30, ip: 0, op: 60, w: 100, h: 100, layers: [] });
    const script = splitCode(lottieScene(json)).scripts[0]!;
    expect(script).toContain('__ncRaw = __ncLottie.setCurrentRawFrameValue.bind(__ncLottie)');
    expect(script).toContain('__ncLottie.setCurrentRawFrameValue = function () { __ncRaw(__ncWant); };');
    // goToAndStop and every other entry point lands on setCurrentRawFrameValue, so the override is
    // the whole guard: nothing in the scene may call the original by another name.
    expect(script).not.toContain('goToAndStop');
  });

  it('mounts a per-frame drawer on a timeline that spans the scene', () => {
    expect(SCENE_MOUNT).toContain('nodecine.frame = function (fn)');
    expect(SCENE_MOUNT).toContain("driver.to({}, { duration: Math.max(0.01, scene.duration || 4), ease: 'none', onUpdate: tick, onStart: tick }, 0)");
  });
});
