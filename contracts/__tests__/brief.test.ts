import { describe, expect, it } from 'vitest';
import { linksIn } from '../types/brief';

describe('the links in a brief', () => {
  it('are found wherever they sit, without the sentence around them, once each', () => {
    expect(linksIn('Xem app ở https://apps.apple.com/vn/app/pig-money/id123. Rất hay, và https://pig.money, https://pig.money')).toEqual([
      'https://apps.apple.com/vn/app/pig-money/id123',
      'https://pig.money',
    ]);
    expect(linksIn('Sổ chi tiêu có AI')).toEqual([]);
  });
});
