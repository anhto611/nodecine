import { describe, expect, it } from 'vitest';
import { spanningLane } from '@/contracts/visual/spanning';
import { safeZonesFor } from '@/contracts/visual/safe-zones';
import { STYLE } from '@/contracts/__tests__/scene-fixtures';
import type { LayerSpec, SceneScript, StyleSheet } from '@/contracts/types/payloads';

/**
 * Where a thing that spans the film lives, and what the scenes may therefore do with the rest.
 *
 * A layout is drawn once and poured into many times, so it cannot know where a travelling thing
 * will be in any one scene — it can only avoid everywhere that thing might go. On a portrait frame
 * that is the whole safe area, and a model told to avoid all of it puts the words below the safe
 * area, on top of the captions. A declared home turns an impossible instruction into a small one.
 */

const frame = { width: 1080, height: 1920 };
const sheet: StyleSheet = { style: STYLE, guide: 'g', frame, transparent: false };
const script: SceneScript = { language: 'vi', scenes: [{ role: 'a', weight: 1, narration: 'n', content: { title: 't' } }] };
const HOME = { x: 240, y: 580, width: 600, height: 640 };
const phone = (home?: typeof HOME): LayerSpec => ({ kind: 'code', id: 'phone', brief: 'một chiếc điện thoại', placement: 'over', source: '<div></div>', startSeconds: 0, width: 300, height: 620, ...(home ? { home } : {}) });

import { buildPlatePrompt, lintPlate } from '../prompt';
import { plates } from '../node';
import { makeFakeServices } from '@/contracts/__tests__/fakes';
import { fakePlate } from '@/contracts/__tests__/scene-fixtures';

describe('the room a layout is asked to leave', () => {
  it('is the thing’s home, named with its own numbers', () => {
    const p = buildPlatePrompt({ keys: ['title'], sheet, script, layers: [phone(HOME)] });
    expect(p).toContain('600×640 px at 240,580');
    expect(p).toContain('Keep your layout entirely out of that rectangle');
  });

  it('is nothing at all when the thing has no home, because there is no answer to give', () => {
    // The lane is bigger than the safe area, so reserving it leaves the words nowhere legal.
    const lane = spanningLane(frame);
    const safe = safeZonesFor(frame.width, frame.height);
    expect(lane.height).toBeGreaterThan((frame.height - safe.bottom - safe.top) * 0.75);

    const p = buildPlatePrompt({ keys: ['title'], sheet, script, layers: [phone()] });
    expect(p).toContain('it moves about the frame');
    expect(p).not.toContain('Keep your layout entirely out of');
  });

  it('is nothing for a thing under the scenes: it takes no room from the words', () => {
    const ground: LayerSpec = { ...phone(HOME), id: 'ground', placement: 'under' };
    expect(buildPlatePrompt({ keys: ['title'], sheet, script, layers: [ground] })).not.toContain('OVER every scene');
  });
});


/**
 * What the lint says back when a layout comes out wrong.
 *
 * A run on 2026-09-13 failed on "kicker has 2 holes; a value is shown once", twice in a row: the
 * model had drawn the whole block twice and the message told it the count without telling it what
 * to do. A layout that fails stops the film, so the sentence has to be actionable.
 */
describe('a layout drawn wrong', () => {
  it('is told which mistake it made, not how many holes it counted', () => {
    const twice = '<div data-slot="title">a</div><div data-slot="title">a</div>';
    const said = lintPlate(twice, ['title']).join(' ');
    expect(said).toContain('drawn 2 times');
    expect(said).toContain('delete the rest');
    expect(said).toContain('do not draw the same block twice');
  });

  it('is told plainly when a key has no hole at all', () => {
    expect(lintPlate('<div>a</div>', ['title']).join(' ')).toContain('no hole for "title"');
  });

  it('passes a layout with exactly one hole per key', () => {
    expect(lintPlate('<div data-slot="kicker">k</div><h1 data-slot="title">t</h1>', ['kicker', 'title'])).toEqual([]);
  });
});

/**
 * The form is one fact about the film that two nodes have to know — the Screenwriter writes for it,
 * the Set needs it to tell a caged thing from one the scenes move — and no wire runs between them.
 * Nothing stops them disagreeing, so the one place both facts are in hand has to say when they do.
 */
describe('a set drawn for one form under a script written for another', () => {
  const run = async (setForm: string, scriptForm: string) => {
    const said: string[] = [];
    await plates.run({
      nodeId: 'p',
      params: { llmProvider: 'claude-code', llmSettings: {}, redraw: false },
      inputs: {
        scenes: { type: 'SceneScript', payload: { ...script, form: scriptForm } } as never,
        style: { type: 'StyleSheet', payload: { ...sheet, form: setForm } } as never,
      },
      lists: {},
      services: makeFakeServices({ complete: async (p: string) => fakePlate(p) }),
      signal: new AbortController().signal,
      log: (level: string, message: string) => { if (level === 'warn') said.push(message); },
      progress: () => {},
    } as never);
    return said;
  };

  it('is said out loud, naming both', async () => {
    const said = (await run('kinetic-type', 'device-demo')).join(' ');
    expect(said).toContain('kinetic-type');
    expect(said).toContain('device-demo');
  });

  it('is silent when they agree', async () => {
    expect(await run('device-demo', 'device-demo')).toEqual([]);
  });
});
