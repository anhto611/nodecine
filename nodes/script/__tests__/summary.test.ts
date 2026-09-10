import { describe, expect, it } from 'vitest';
import { contentChips, moveScene, narrationLead } from '../summary';

describe('narrationLead', () => {
  it('keeps a short line whole and folds its spacing', () => {
    expect(narrationLead('Mỗi cảnh   là\n một tấm hình.')).toBe('Mỗi cảnh là một tấm hình.');
  });
  it('cuts a long line at a word, never inside one', () => {
    const lead = narrationLead('Website ai vào cũng thấy như nhau, còn web app thì mỗi người một màn hình.', 30);
    expect(lead).toBe('Website ai vào cũng thấy như…');
    expect(lead.length).toBeLessThanOrEqual(31);
  });
  it('cuts mid-word only when there is no space to cut at', () => {
    expect(narrationLead('a'.repeat(60), 20)).toBe(`${'a'.repeat(20)}…`);
  });
});

describe('contentChips', () => {
  it('lists what is on screen in vocabulary order, with a count for entries', () => {
    expect(contentChips({ entries: [{ label: 'a' }, { label: 'b' }], title: 'T', image: '/api/assets/0123456789abcdef.png' })).toEqual([
      { key: 'title' },
      { key: 'entries', count: 2 },
      { key: 'image' },
    ]);
  });
  it('shows nothing for empty values', () => {
    expect(contentChips({ title: '', points: [], entries: [] })).toEqual([]);
  });
});

describe('moveScene', () => {
  it('moves one step either way and leaves the ends alone', () => {
    expect(moveScene(['a', 'b', 'c'], 0, 1)).toEqual(['b', 'a', 'c']);
    expect(moveScene(['a', 'b', 'c'], 2, 1)).toEqual(['a', 'c', 'b']);
    const same = ['a', 'b', 'c'];
    expect(moveScene(same, 0, -1)).toBe(same);
    expect(moveScene(same, 2, 3)).toBe(same);
  });
});
