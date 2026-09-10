import { describe, expect, it } from 'vitest';
import { fitsFrame, parseStock, pick, searchUrl } from '@/server/stock-providers';

describe('fitsFrame', () => {
  it('takes a picture the right way up and big enough', () => {
    expect(fitsFrame({ width: 1920, height: 1280 }, 'landscape')).toBe(true);
    expect(fitsFrame({ width: 1280, height: 1920 }, 'portrait')).toBe(true);
  });
  it('refuses one that would have to be enlarged', () => {
    expect(fitsFrame({ width: 1000, height: 700 }, 'landscape')).toBe(false);
  });
  it('refuses one turned the wrong way, and one too near square to fill after the crop', () => {
    expect(fitsFrame({ width: 1280, height: 1920 }, 'landscape')).toBe(false);
    expect(fitsFrame({ width: 1600, height: 1500 }, 'landscape')).toBe(false);
  });
});

describe('parseStock', () => {
  it('asks Pexels for the original at the height the frame wants, not a ready-made variant', () => {
    const [p] = parseStock('pexels', { photos: [{ width: 4480, height: 6720, url: 'https://pexels.com/p/1', photographer: 'Ann', src: { original: 'https://images.pexels.com/photos/1/x.jpg', large2x: 'https://images.pexels.com/photos/1/x.jpg?w=940' } }] }, 1920);
    expect(p!.url).toBe('https://images.pexels.com/photos/1/x.jpg?auto=compress&h=1920');
    expect(p).toMatchObject({ width: 4480, height: 6720, author: 'Ann', page: 'https://pexels.com/p/1' });
  });

  it('reads Pixabay, and measures the picture itself rather than trusting the library', () => {
    const [p] = parseStock('pixabay', { hits: [{ largeImageURL: 'https://cdn.pixabay.com/1.jpg', pageURL: 'https://pixabay.com/p/1', user: 'Bo', imageWidth: 1280, imageHeight: 853 }] }, 1920);
    expect(p).toEqual({ url: 'https://cdn.pixabay.com/1.jpg', width: 1280, height: 853, author: 'Bo', page: 'https://pixabay.com/p/1' });
    // Pixabay's largest is 1280 on the long edge: over the floor for a landscape frame, but turned
    // the wrong way for a portrait one — which is why the size is measured here and not trusted.
    expect(fitsFrame(p!, 'landscape')).toBe(true);
    expect(fitsFrame(p!, 'portrait')).toBe(false);
  });

  it('is empty, not broken, when the library answers with nothing', () => {
    expect(parseStock('pexels', {}, 1920)).toEqual([]);
    expect(parseStock('pixabay', { hits: [] }, 1920)).toEqual([]);
  });
});

describe('pick', () => {
  const photos = [
    { url: 'a', width: 800, height: 600, author: 'x', page: 'p1' },
    { url: 'b', width: 1920, height: 1280, author: 'x', page: 'p2' },
    { url: 'c', width: 2400, height: 1600, author: 'x', page: 'p3' },
  ];
  it('takes the first that fits', () => {
    expect(pick(photos, 'landscape', new Set())!.page).toBe('p2');
  });
  it('never gives the same video the same photograph twice', () => {
    expect(pick(photos, 'landscape', new Set(['p2']))!.page).toBe('p3');
    expect(pick(photos, 'landscape', new Set(['p2', 'p3']))).toBeUndefined();
  });
});

describe('searchUrl', () => {
  it('keeps the key out of the Pexels address — it goes in a header', () => {
    const url = searchUrl('pexels', 'morning coffee', 'landscape', 'SECRET');
    expect(url).not.toContain('SECRET');
    expect(url).toContain('orientation=landscape');
    expect(url).toContain('query=morning%20coffee');
  });
  it('speaks each library its own word for the shape', () => {
    expect(searchUrl('pixabay', 'x', 'portrait', 'K')).toContain('orientation=vertical');
    expect(searchUrl('pixabay', 'x', 'landscape', 'K')).toContain('orientation=horizontal');
  });
});
