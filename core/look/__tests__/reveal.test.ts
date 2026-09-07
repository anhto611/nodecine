import { describe, expect, it } from 'vitest';
import { keyword, revealMap, revealTimes } from '../reveal';

const words = (text: string, step = 0.4) => text.split(' ').map((t, i) => ({ text: t, start: Math.round(i * step * 100) / 100 }));

describe('revealTimes', () => {
  it('spreads items over the spoken part of the scene when there are no word timings', () => {
    expect(revealTimes(['a', 'b', 'c'], [], 8)).toEqual([0.45, 3.925, 7.4]);
    expect(revealTimes(['only'], [], 8)).toEqual([0.45]);
    // A scene shorter than the head and tail still gets ascending, sane times.
    expect(revealTimes(['a', 'b'], [], 0.5)).toEqual([0.45, 0.45]);
  });

  it('shows an item when the voice reaches its longest word, scanning forward only', () => {
    const w = words('first we set up typed routes then the middleware layer and finally streaming');
    const t = revealTimes(['Typed routes', 'Middleware', 'Streaming'], w, 8);
    // 'routes' (the longest word of the first label) is word 5, 'middleware' word 8, 'streaming' word 12.
    expect(t).toEqual([w[5]!.start, w[8]!.start, w[12]!.start]);
  });

  it('keeps an unmatched item on its spread slot and enforces order and spacing', () => {
    const w = words('streaming comes first then nothing about the rest');
    const t = revealTimes(['Streaming', 'Middleware', 'Typed routes'], w, 8);
    expect(t[0]).toBe(0.45); // matched at 0 but never earlier than the head
    expect(t[1]).toBe(3.925); // spread slot
    expect(t[2]).toBe(7.4);
    expect(revealTimes(['a b', 'c'], words('c a'), 8)[1]).toBeGreaterThanOrEqual(revealTimes(['a b', 'c'], words('c a'), 8)[0]! + 0.28);
  });

  it('picks the longest word of a label and keeps Vietnamese diacritics', () => {
    expect(keyword('Chỉ chạy lại phần thay đổi')).toBe('chạy');
    expect(keyword('a, b: cd!')).toBe('cd');
  });
});

describe('revealMap', () => {
  it('times every list prop and ignores the rest', () => {
    const m = revealMap({ headline: 'x', points: ['one', 'two'], tags: ['a'] }, [], 6);
    expect(Object.keys(m)).toEqual(['points', 'tags']);
    expect(m.points).toEqual([0.45, 5.4]);
  });
});
