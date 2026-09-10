import { describe, expect, it } from 'vitest';
import { expandBeats, listBeats, toPackets, type Beat } from '../beats';
import { resolveFacts } from '@/nodes/assembler/build-ir';
import { readFactPath, factListAt } from '@/core/types/payloads';

const beat = (over: Partial<Beat> = {}): Beat => ({ role: 'item', brief: '', weight: 1, count: 5, factBindings: {}, ...over });
const facts = {
  count: 3,
  items: [
    { title: 'One', source: 'a.com', image: '/api/assets/1111111111111111111111111111111111111111.png' },
    { title: 'Two', source: 'b.com', image: null },
    { title: 'Three', source: 'c.com', image: '/api/assets/3333333333333333333333333333333333333333.png' },
  ],
};

describe('a beat that runs over a list', () => {
  const b = beat({ factList: 'items', factBindings: { title: 'title', source: 'source', image: 'image' } });

  it('gives one scene per item, capped by count, each bound to its own item', () => {
    const scenes = expandBeats([b], facts);
    expect(scenes).toHaveLength(3);
    expect(scenes[1]!.factBindings).toEqual({ title: 'items.1.title', source: 'items.1.source', image: 'items.1.image' });
    expect(scenes[2]!.item).toEqual(facts.items[2]);
    expect(expandBeats([beat({ ...b, count: 2 })], facts)).toHaveLength(2);
  });

  it('gives no scenes when the facts have no such list, and says so', () => {
    expect(expandBeats([b], { items: 'not a list' })).toEqual([]);
    expect(expandBeats([b])).toEqual([]);
    expect(listBeats([b], facts)).toEqual([{ role: 'item', key: 'items', found: 3 }]);
    expect(listBeats([b], { other: 1 })).toEqual([{ role: 'item', key: 'items', found: null }]);
    // A plain beat is untouched by any of this.
    expect(expandBeats([beat({ count: 2 })], facts)).toHaveLength(2);
  });

  it('carries the paths through the packets to the assembler, which reads them', () => {
    const scenes = expandBeats([b], facts);
    const { scenes: script } = toPackets({ language: 'vi', scenes: scenes.map((_, i) => ({ narration: `n${i}`, body: `b${i}` })) }, scenes);
    expect(script.scenes[1]!.factBindings).toEqual({ title: 'items.1.title', source: 'items.1.source', image: 'items.1.image' });
    // What the assembler does with them: the title of scene 2 comes from item 2, not from the model.
    expect(resolveFacts({ title: 'items.1.title' }, facts)).toEqual({ title: 'Two' });
    // A path that leads nowhere leaves the drawing as it was.
    expect(resolveFacts({ title: 'items.9.title' }, facts)).toBeUndefined();
  });
});

describe('readFactPath / factListAt', () => {
  it('reads a key, an index and a field, and knows a list of things from a list of words', () => {
    expect(readFactPath(facts, 'count')).toBe(3);
    expect(readFactPath(facts, 'items.0.source')).toBe('a.com');
    expect(readFactPath(facts, 'items.1.image')).toBeNull();
    expect(readFactPath(facts, 'items.x.title')).toBeUndefined();
    expect(readFactPath(facts, 'nope')).toBeUndefined();
    expect(factListAt(facts, 'items')).toHaveLength(3);
    expect(factListAt({ tags: ['a', 'b'] }, 'tags')).toBeNull();
  });
});
