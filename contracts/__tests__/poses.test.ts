import { beforeEach, describe, expect, it } from 'vitest';
import { registerForms } from '@/forms';
import { _resetForms, getForm, listForms } from '../forms/registry';
import { posed, shapeKey } from '../visual/plates';
import { safeZonesFor } from '../visual/safe-zones';
import { captionBandBox } from '../visual/scene-markup';

/**
 * Poses: where a frame's things go, written by hand (CORE_CONTRACTS §6.1).
 *
 * The whole argument for them is that geometry a person wrote once cannot be wrong. A model asked
 * where to put a headline put it on the captions; a model asked only to fill a rectangle somebody
 * measured cannot. So the rectangles are what this file checks, and it checks them for every form
 * that ships — a pose is only worth having if its numbers hold.
 */

const frame = { width: 1080, height: 1920 };
const zone = safeZonesFor(frame.width, frame.height);
/** A caption band as a drawn style puts it: low, just under the safe area. */
const band = captionBandBox(frame.width, frame.height, { left: 72, right: 168, bottom: 150, size: 46 });
/** What a device drawn to the home this app gives it comes out as. */
const DEVICE = { width: 300, height: 620 };

type Rect = { x: number; y: number; width: number; height: number };
const hit = (a: Rect, b: Rect) => a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
const inside = (a: Rect, b: Rect) => a.x >= b.x && a.y >= b.y && a.x + a.width <= b.x + b.width && a.y + a.height <= b.y + b.height;
const safe: Rect = { x: zone.left, y: zone.top, width: frame.width - zone.left - zone.right, height: frame.height - zone.top - zone.bottom };
const placed = (s: { x: number; y: number; scale: number }): Rect => ({
  x: Math.round(s.x - (DEVICE.width * s.scale) / 2),
  y: Math.round(s.y - (DEVICE.height * s.scale) / 2),
  width: Math.round(DEVICE.width * s.scale),
  height: Math.round(DEVICE.height * s.scale),
});

beforeEach(() => { _resetForms(); registerForms(); });

describe('every pose a shipped form declares', () => {
  it('keeps its words inside the safe area, where the platform draws nothing', () => {
    for (const form of listForms()) {
      for (const pose of form.poses) expect(inside(pose.text, safe), `${form.id}/${pose.id}`).toBe(true);
    }
  });

  it('keeps the things it places clear of the words and of the spoken line', () => {
    for (const form of listForms()) {
      for (const pose of form.poses) {
        for (const [id, at] of Object.entries(pose.stage)) {
          const rect = placed(at);
          expect(hit(rect, pose.text), `${form.id}/${pose.id}: "${id}" sits on the words`).toBe(false);
          expect(hit(rect, band), `${form.id}/${pose.id}: "${id}" sits on the captions`).toBe(false);
          expect(inside(rect, { x: 0, y: 0, ...frame }), `${form.id}/${pose.id}: "${id}" leaves the frame`).toBe(true);
        }
      }
    }
  });

  it('moves the things far enough to read as a camera, not a wobble', () => {
    // The first set of poses shifted the phone forty pixels and turned it six degrees, which on a
    // 1080-wide frame is a thing standing still and shivering. A tenth of the frame is the floor.
    for (const form of listForms()) {
      if (form.poses.length < 2) continue;
      const ids = [...new Set(form.poses.flatMap((p) => Object.keys(p.stage)))];
      for (const id of ids) {
        const at = form.poses.map((p) => p.stage[id]).filter((s): s is NonNullable<typeof s> => !!s);
        if (at.length < 2) continue;
        const span = (ns: number[]) => Math.max(...ns) - Math.min(...ns);
        const travel = Math.max(span(at.map((s) => s.x)) / frame.width, span(at.map((s) => s.y)) / frame.height);
        expect(travel, `${form.id}: "${id}" barely moves`).toBeGreaterThan(0.1);
        expect(new Set(at.map((s) => s.scale)).size, `${form.id}: "${id}" is the same size in every pose`).toBeGreaterThan(1);
      }
    }
  });
});

describe('which pose a scene is laid out in', () => {
  const scenes = [{ pose: undefined }, { pose: undefined }, { pose: 'b' }, { pose: undefined }];

  it('is its own when it names one this film has', () => {
    expect(posed(scenes, ['a', 'b', 'c'])[2]!.pose).toBe('b');
  });

  it('is the next in the cycle otherwise, so consecutive scenes differ', () => {
    expect(posed(scenes, ['a', 'b', 'c']).map((s) => s.pose)).toEqual(['a', 'b', 'b', 'a']);
  });

  it('is nothing at all for a film whose form has no poses', () => {
    expect(posed(scenes, []).every((s) => s.pose === undefined)).toBe(true);
  });

  it('decides what a layout answers for through its box, not its name', () => {
    const top = { x: 72, y: 260, width: 840, height: 300 };
    const foot = { x: 72, y: 940, width: 840, height: 300 };
    // Two poses that give the same rectangle want the same drawing: the device standing elsewhere
    // is no reason to buy the layout twice.
    expect(shapeKey(['title'], top)).toBe(shapeKey(['title'], { ...top }));
    expect(shapeKey(['title'], top)).not.toBe(shapeKey(['title'], foot));
    expect(shapeKey(['title'])).toBe('title');
  });

  it('asks for one layout per box, however many poses share it', () => {
    // A property of the mechanism, not of today's numbers: two set-ups that frame the words the
    // same way want one drawing, even when the device stands somewhere else in each.
    const box = { x: 72, y: 260, width: 840, height: 300 };
    const same = [{ id: 'a', text: box, stage: {} }, { id: 'b', text: { ...box }, stage: {} }];
    expect(new Set(same.map((p) => shapeKey(['title'], p.text))).size).toBe(1);
  });
});
