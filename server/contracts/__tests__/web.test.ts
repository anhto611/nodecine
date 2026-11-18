import { describe, expect, it } from 'vitest';
import { commonsPictures, pagePictures, pageText } from '../web';

describe('a page, read', () => {
  it('excludes mapped IPv6 loopback pictures before trying to fetch them', () => {
    expect(pagePictures('<img src="http://[::ffff:127.0.0.1]/secret.png">', 'https://example.com/')).toEqual([]);
  });
  it('keeps the title, the descriptions and the visible words, not the scripts', () => {
    const html = `<html><head><title>Pig Money – App Store</title><meta name="description" content="Sổ chi tiêu &amp; chia tiền">
      <script type="application/ld+json">{"@type":"SoftwareApplication","description":"Ghi chi tiêu bằng một câu chat."}</script>
      <script>var tracking = 1;</script></head><body><nav>Menu</nav><h1>Pig Money</h1><p>Chia tiền nhóm tự động.</p></body></html>`;
    const page = pageText(html, 'https://apps.apple.com/app/pig-money');
    expect(page.title).toBe('Pig Money – App Store');
    expect(page.text).toContain('Sổ chi tiêu & chia tiền');
    expect(page.text).toContain('Ghi chi tiêu bằng một câu chat.');
    expect(page.text).toContain('Chia tiền nhóm tự động.');
    expect(page.text).not.toContain('tracking');
    expect(page.text).not.toContain('Menu');
  });

  it('finds the pictures it shows, the largest of each, once, and leaves out icons and private addresses', () => {
    const shot = 'https://is1-ssl.mzstatic.com/image/thumb/PurpleSource211/v4/f0/_U767d1.jpg';
    const html = `<meta property="og:image" content="/cover.png"><meta property="og:title" content="Pig Money">
      <picture><source srcset="${shot}/300x650bb.webp 300w,${shot}/157x340bb.webp 157w"><img src="${shot}/300x650bb.jpg" alt="Lịch tháng"></picture>
      <img src="/logo.svg" alt="logo"><img src="data:image/png;base64,AAAA"><img src="http://192.168.1.4/x.png"><img data-src="shots/chart.jpg" alt="Biểu đồ">`;
    expect(pagePictures(html, 'https://pig.money/app/')).toEqual([
      { url: 'https://pig.money/cover.png', alt: 'Pig Money', page: 'https://pig.money/app/' },
      { url: `${shot}/738x1600bb.jpg`, alt: '', page: 'https://pig.money/app/' },
      { url: 'https://pig.money/app/shots/chart.jpg', alt: 'Biểu đồ', page: 'https://pig.money/app/' },
    ]);
  });
});

describe('a picture from Wikipedia', () => {
  it('is asked for at 1280 px, then as its original, before the thumbnail the page showed', async () => {
    const { pictureCandidates } = await import('../web');
    expect(pictureCandidates('https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/Four_stroke_engine.jpg/250px-Four_stroke_engine.jpg')).toEqual([
      'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/Four_stroke_engine.jpg/1280px-Four_stroke_engine.jpg',
      'https://upload.wikimedia.org/wikipedia/commons/a/ab/Four_stroke_engine.jpg',
      'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/Four_stroke_engine.jpg/250px-Four_stroke_engine.jpg',
    ]);
  });

  it('asks for a drawing as a large PNG and never for its SVG original', async () => {
    const { pictureCandidates } = await import('../web');
    expect(pictureCandidates('https://upload.wikimedia.org/wikipedia/commons/thumb/d/dc/4StrokeEngine.svg/330px-4StrokeEngine.svg.png')).toEqual([
      'https://upload.wikimedia.org/wikipedia/commons/thumb/d/dc/4StrokeEngine.svg/1280px-4StrokeEngine.svg.png',
      'https://upload.wikimedia.org/wikipedia/commons/thumb/d/dc/4StrokeEngine.svg/330px-4StrokeEngine.svg.png',
    ]);
    expect(pictureCandidates('https://example.com/a.jpg')).toEqual(['https://example.com/a.jpg']);
  });

  it('reads a thumbnail from the newer thumb host, with its tracking parameters', async () => {
    const { pictureCandidates } = await import('../web');
    const link = 'https://thumb.wikimedia.org/wikipedia/commons/thumb/c/c5/Tipper_%285984019428%29.jpg/250px-Tipper_%285984019428%29.jpg?utm_source=commons.wikimedia.org&utm_campaign=gallery';
    expect(pictureCandidates(link)).toEqual([
      'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c5/Tipper_%285984019428%29.jpg/1280px-Tipper_%285984019428%29.jpg',
      'https://upload.wikimedia.org/wikipedia/commons/c/c5/Tipper_%285984019428%29.jpg',
      link,
    ]);
  });
});

describe('a Commons search, read', () => {
  it('keeps the pictures large enough for a film, in the order Commons ranks them, described by their own words', () => {
    const info = (o: Record<string, unknown>) => [{ mime: 'image/jpeg', width: 2000, height: 1400, descriptionurl: 'https://commons.wikimedia.org/wiki/File:X', ...o }];
    expect(
      commonsPictures({
        query: {
          pages: {
            '3': { index: 2, title: 'File:Four stroke cycle.svg', imageinfo: info({ mime: 'image/svg+xml', width: 300, height: 300, thumburl: 'https://upload.wikimedia.org/a.svg.png' }) },
            '1': { index: 1, title: 'File:Engine cutaway.jpg', imageinfo: info({ thumburl: 'https://upload.wikimedia.org/b.jpg', extmetadata: { ImageDescription: { value: '<p>A <b>cutaway</b> &amp; its valves</p>' } } }) },
            '4': { index: 3, title: 'File:Tiny.png', imageinfo: info({ mime: 'image/png', width: 200, height: 120, thumburl: 'https://upload.wikimedia.org/c.png' }) },
            '5': { index: 4, title: 'File:Run.webm', imageinfo: info({ mime: 'video/webm', thumburl: 'https://upload.wikimedia.org/d.jpg' }) },
          },
        },
      }),
    ).toEqual([
      { url: 'https://upload.wikimedia.org/b.jpg', alt: 'Engine cutaway — A cutaway & its valves', page: 'https://commons.wikimedia.org/wiki/File:X' },
      { url: 'https://upload.wikimedia.org/a.svg.png', alt: 'Four stroke cycle', page: 'https://commons.wikimedia.org/wiki/File:X' },
    ]);
    expect(commonsPictures({})).toEqual([]);
  });
});
