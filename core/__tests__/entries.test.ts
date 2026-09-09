import { describe, expect, it } from 'vitest';
import { EntryContentSchema, SceneContentSchema, type BlockDef } from '@/core/types/payloads';
import { fitOf, fillProps, propValue } from '@/nodes/art-director/cast';
import { describeBlockField, propsSchemaFor } from '@/core/look/props';

/**
 * Several things in one scene (CORE_CONTRACTS §2.11). The vocabulary grows one dimension —
 * repetition — instead of a noun per genre, so a comparison, a ranking and a how-to are the same
 * shape with different counts.
 */

const shot = '/api/assets/0123456789abcdef0123456789abcdef01234567.png';
const other = '/api/assets/89abcdef0123456789abcdef0123456789abcdef.png';
const COMPARE: BlockDef = {
  id: 'compare',
  name: 'Compare',
  doc: { example: '{}', when: 'two things side by side' },
  props: { cards: { type: 'entries', content: 'entries', required: true, min: 2, max: 2, of: ['label', 'image'] } },
  code: { format: 'html-gsap', source: '<div data-prop="cards"><div><img data-prop="image"><span data-prop="label"></span></div></div>' },
};

describe('a scene that carries several things', () => {
  it('takes a list of entries in the same vocabulary', () => {
    const parsed = SceneContentSchema.parse({ title: 'T', entries: [{ label: 'A', image: shot }, { label: 'B', image: other }] });
    expect(parsed.entries).toHaveLength(2);
    // One level only: an entry that carries entries loses them rather than growing a tree.
    expect(EntryContentSchema.parse({ label: 'A', entries: [{ label: 'X' }] } as never)).toEqual({ label: 'A' });
  });

  it('gives a block only the keys it says it draws', () => {
    const rows = propValue(COMPARE.props.cards!, [
      { label: 'A', image: shot, body: 'not asked for' },
      { label: 'B', image: other },
    ]) as Record<string, unknown>[];
    expect(rows).toEqual([{ label: 'A', image: shot }, { label: 'B', image: other }]);
  });

  it('refuses a list too short for the block, and cuts one too long', () => {
    expect(propValue(COMPARE.props.cards!, [{ label: 'only one' }])).toBeUndefined();
    const three = propValue(COMPARE.props.cards!, [{ label: 'A' }, { label: 'B' }, { label: 'C' }]) as unknown[];
    expect(three).toHaveLength(2);
  });

  it('drops an entry with nothing the block draws, rather than rendering an empty card', () => {
    expect(propValue(COMPARE.props.cards!, [{ label: 'A' }, { body: 'ignored' }, { label: 'B' }])).toEqual([{ label: 'A' }, { label: 'B' }]);
  });

  it('keeps a file out of an entry unless it is an uploaded asset', () => {
    expect(propValue(COMPARE.props.cards!, [{ label: 'A', image: 'https://example.com/a.png' }, { label: 'B', image: other }]))
      .toEqual([{ label: 'A' }, { label: 'B', image: other }]);
  });

  it('is content like any other: a block that cannot show it loses it, one that can covers the scene', () => {
    const content = { entries: [{ label: 'A', image: shot }, { label: 'B', image: other }] };
    expect(fitOf(COMPARE, content, new Set()).missing).toEqual([]);
    expect(fitOf(COMPARE, content, new Set()).dropped).toEqual([]);
    const textOnly: BlockDef = { ...COMPARE, id: 'text', props: { headline: { type: 'string', content: 'title', required: false } } };
    expect(fitOf(textOnly, content, new Set()).dropped).toEqual(['entries']);
    expect(fillProps(COMPARE, content, new Set()).cards).toHaveLength(2);
  });

  it('describes itself to the model by what it holds', () => {
    expect(describeBlockField(COMPARE.props.cards!)).toContain('exactly 2 entries, each with label, image');
    // The plan is validated against the same table the block declares.
    expect(propsSchemaFor(COMPARE).safeParse({ cards: [{ label: 'A' }, { label: 'B' }] }).success).toBe(true);
    expect(propsSchemaFor(COMPARE).safeParse({ cards: [{ label: 'A' }] }).success).toBe(false);
  });
});
