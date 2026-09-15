import { describe, expect, it } from 'vitest';
import { pageText } from '../server';

describe('a linked page as text', () => {
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
});
