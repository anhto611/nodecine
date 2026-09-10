import { describe, expect, it } from 'vitest';
import { isPrivateHost, parsePageUrl, parsePageUrls } from '@/core/network/public-url';
import { parsePageMeta } from '../parse-meta';

describe('parsePageUrl', () => {
  it('takes a public web address, adds the scheme to a bare domain, and rebuilds it without the fragment', () => {
    expect(parsePageUrl('the-decoder.com/deepseek')).toMatchObject({ url: 'https://the-decoder.com/deepseek', domain: 'the-decoder.com' });
    expect(parsePageUrl(' https://www.techcrunch.com/a?b=1#top ')).toMatchObject({ url: 'https://www.techcrunch.com/a?b=1', domain: 'techcrunch.com' });
    expect(parsePageUrl('http://example.com')!.url).toBe('http://example.com/');
  });

  it('refuses anything that is not a public page this machine may fetch', () => {
    for (const bad of [
      'not a url', '', 'ftp://example.com/x', 'file:///etc/passwd', 'javascript:alert(1)',
      'http://localhost:3000/api/assets', 'https://127.0.0.1/x', 'https://10.0.0.5/x', 'https://192.168.1.1/',
      'https://169.254.169.254/latest/meta-data/', 'https://[::1]/', 'https://printer.local/', 'https://user:pw@example.com/',
      'https://nodot/',
    ]) expect(parsePageUrl(bad), bad).toBeNull();
  });

  it('knows a private host by name or by address', () => {
    expect(isPrivateHost('172.16.0.1')).toBe(true);
    expect(isPrivateHost('172.32.0.1')).toBe(false);
    expect(isPrivateHost('8.8.8.8')).toBe(false);
    expect(isPrivateHost('[fd00::1]')).toBe(true);
  });
});

describe('parsePageMeta', () => {
  const page = `<html><head>
    <title>Fallback &amp; title</title>
    <meta property="og:title" content="DeepSeek m&#7903; m&#7855;t">
    <meta name="description" content="Plain description">
    <meta property="og:description" content="What   the page says">
    <meta property="og:site_name" content="The Decoder">
    <meta property="article:published_time" content="2026-08-22T06:30:00Z">
    <meta property="og:image" content="/img/cover.png">
  </head><body><meta property="og:title" content="not read, outside the head"></body></html>`;

  it('prefers the open-graph tags, decodes entities and makes the picture absolute', () => {
    expect(parsePageMeta(page, 'https://the-decoder.com/a/b')).toEqual({
      title: 'DeepSeek mở mắt',
      description: 'What the page says',
      siteName: 'The Decoder',
      publishedAt: '2026-08-22T06:30:00Z',
      imageUrl: 'https://the-decoder.com/img/cover.png',
    });
  });

  it('falls back to <title> and leaves out what is missing', () => {
    expect(parsePageMeta('<html><head><title>Only a title</title></head></html>', 'https://x.com/')).toEqual({ title: 'Only a title' });
    expect(parsePageMeta('<html><head></head></html>', 'https://x.com/')).toEqual({});
  });

  it('ignores a picture that is not fetched over http', () => {
    expect(parsePageMeta('<head><meta property="og:image" content="data:image/png;base64,AAA"></head>', 'https://x.com/').imageUrl).toBeUndefined();
  });
});

describe('parsePageUrls', () => {
  it('takes one address per line, wherever in the line it sits, in order and without repeats', () => {
    const notes = [
      'DeepSeek ra V4-Flash-Vision-Exp: đọc tới 600 ảnh mỗi lượt — the-decoder.com',
      'https://nari-labs.com/qwen3-tts rẻ hơn ElevenLabs',
      'a line with no link at all',
      'the-decoder.com again, already seen',
      'news.ycombinator.com',
    ].join('\n');
    expect(parsePageUrls(notes).map((u) => u.url)).toEqual([
      'https://the-decoder.com/',
      'https://nari-labs.com/qwen3-tts',
      'https://news.ycombinator.com/',
    ]);
  });

  it('stops at the cap and finds nothing in plain prose', () => {
    expect(parsePageUrls('a.com\nb.com\nc.com', 2)).toHaveLength(2);
    expect(parsePageUrls('staying focused when progress feels slow')).toEqual([]);
  });
});
