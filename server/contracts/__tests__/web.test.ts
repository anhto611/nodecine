import { describe, expect, it } from 'vitest';
import { pagePictures, pageText } from '../web';

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
