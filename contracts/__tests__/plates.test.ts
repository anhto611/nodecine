import { describe, expect, it } from 'vitest';
import { fillPlate, plateFor, shapeKey, signatureOf, signaturesOf } from '../visual/plates';
import type { Plate, PlateSheet } from '../types/payloads';

/**
 * Filling a plate. The whole point is that no model is involved and the same scene
 * always comes out the same, so these check the two halves: which plate a scene asks for, and what
 * the words do to it.
 */

const plate = (id: string, keys: Plate['keys'], source: string): Plate => ({ id, keys, source });
const BIG = plate('big-number', ['number', 'label'], '<div class="bn"><div class="n" data-slot="number">000</div><div class="l" data-slot="label">nhãn</div></div>');
const LIST = plate('list', ['title', 'points'], '<h1 data-slot="title">Tiêu đề</h1><ul data-slot="points"><li data-item>một ý</li></ul>');
const sheet: PlateSheet = { plates: [BIG, LIST] };

describe('what shape a scene is', () => {
  it('is its keys in the vocabulary order, whatever order they were written in', () => {
    expect(signatureOf({ label: 'khách', number: '1.240' })).toEqual(['number', 'label']);
    expect(shapeKey(signatureOf({ title: 'x', points: ['a'] }))).toBe('title+points');
  });

  it('counts an empty string and an empty list as nothing said', () => {
    expect(signatureOf({ title: '', points: [], label: 'có' })).toEqual(['label']);
  });

  it('asks for each shape once, however many scenes share it', () => {
    const shapes = signaturesOf([{ content: { title: 'a', points: ['x'] } }, { content: { title: 'b', points: ['y'] } }, { content: { number: '9', label: 'n' } }]);
    expect(shapes.map((s) => shapeKey(s.keys, s.box))).toEqual(['title+points', 'number+label']);
  });
});

describe('the plate a scene is drawn on', () => {
  it('is the one that answers for exactly those keys', () => {
    expect(plateFor(sheet, { number: '1.240', label: 'khách' })?.id).toBe('big-number');
    expect(plateFor(sheet, { title: 'x', points: ['a'] })?.id).toBe('list');
  });

  it('is none when the shape is one nobody drew', () => {
    expect(plateFor(sheet, { quote: 'một câu', attribution: 'ai đó' })).toBeUndefined();
    // A plate answers for its keys exactly: a scene with one more key is a different shape.
    expect(plateFor(sheet, { number: '1', label: 'n', kicker: 'thêm' })).toBeUndefined();
  });
});

describe('filling one', () => {
  it('puts the words in the holes and leaves the drawing alone', () => {
    const out = fillPlate(BIG, { number: '1.240', label: 'khách mới' });
    expect(out).toContain('<div class="n" data-slot="number">1.240</div>');
    expect(out).toContain('<div class="l" data-slot="label">khách mới</div>');
    expect(out).toContain('class="bn"');
  });

  it('repeats the row a list marks, once per item', () => {
    const out = fillPlate(LIST, { title: 'Ba bước', points: ['một', 'hai', 'ba'] });
    expect(out).toContain('<h1 data-slot="title">Ba bước</h1>');
    expect(out.split('<li data-item>').length - 1).toBe(3);
    expect(out).toContain('>hai<');
    expect(out).not.toContain('một ý');
  });

  it('escapes what the person wrote, because a plate is markup and a title is not', () => {
    expect(fillPlate(BIG, { number: '<b>9</b>', label: 'a & b' })).toContain('&lt;b&gt;9&lt;/b&gt;');
    expect(fillPlate(BIG, { number: '9', label: 'a & b' })).toContain('a &amp; b');
  });

  it('leaves a hole the scene said nothing for, so a half-written scene still draws', () => {
    expect(fillPlate(BIG, { number: '7' })).toContain('>nhãn<');
  });

  it('gives the same markup every time, which is the whole point', () => {
    const once = fillPlate(LIST, { title: 'x', points: ['a', 'b'] });
    expect(fillPlate(LIST, { title: 'x', points: ['a', 'b'] })).toBe(once);
  });
});

/**
 * A list's hole is a container with a row inside it, and a row is usually the same tag as the
 * container. Ending the hole at the first closing tag ends it at the row's, which throws away
 * whatever the plate drew after the list and leaves the stray close behind.
 */
describe('a hole with something nested in it', () => {
  const GRID: Plate = {
    id: 'grid',
    keys: ['title', 'points'],
    source: '<div class="b"><h2 data-slot="title">tít</h2><div class="grid" data-slot="points"><div data-item>một ý</div></div><div class="rule"></div></div>',
  };

  it('ends where its own tag closes, not where the row inside it does', () => {
    const out = fillPlate(GRID, { title: 'Ba bước', points: ['a', 'b', 'c'] });
    expect(out.split('<div data-item>').length - 1).toBe(3);
    expect(out).toContain('<div class="rule"></div>');
    expect(out.split('<div').length).toBe(out.split('</div>').length);
  });
});

/**
 * The phrase a line leans on. The screenwriter is asked to mark it with asterisks and the
 * Illustrator used to turn that into markup while it drew; nothing did once it was gone, so
 * `*mất rồi?*` went on screen with the asterisks still in it.
 */
describe('the phrase a scene leans on', () => {
  const T: Plate = { id: 't', keys: ['title', 'points'], source: '<h1 data-slot="title">tít</h1><ul data-slot="points"><li data-item>x</li></ul>' };

  it('becomes emphasis, in a title and in a list alike', () => {
    const out = fillPlate(T, { title: 'Tiền đi đâu *mất rồi?*', points: ['một *hai* ba'] });
    expect(out).toContain('Tiền đi đâu <em class="nc-emph">mất rồi?</em>');
    expect(out).toContain('một <em class="nc-emph">hai</em> ba');
    expect(out).not.toContain('*');
  });

  it('leaves a lone asterisk alone, and never lets markup through', () => {
    expect(fillPlate(T, { title: '5 * 3 = 15' })).toContain('5 * 3 = 15');
    expect(fillPlate(T, { title: '*<b>x</b>*' })).toContain('<em class="nc-emph">&lt;b&gt;x&lt;/b&gt;</em>');
  });
});
