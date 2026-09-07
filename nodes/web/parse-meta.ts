/**
 * What a page says about itself: the tags a link preview reads (CORE_CONTRACTS §5.14). Pure, so
 * the shape of a page is testable without the network. No HTML parser: the tags wanted are all
 * single elements in the head, and a regex over the head cannot be tricked into running anything.
 */

export interface PageMeta {
  title?: string;
  description?: string;
  siteName?: string;
  publishedAt?: string;
  /** Absolute URL of the page's own picture, when it names one. */
  imageUrl?: string;
}

const decode = (s: string): string =>
  s
    .replace(/&(#\d+|#x[0-9a-f]+|[a-z]+);/gi, (m, e: string) => {
      if (e[0] === '#') return String.fromCodePoint(Number(e[1]?.toLowerCase() === 'x' ? `0x${e.slice(2)}` : e.slice(1)));
      return { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', '#39': "'" }[e.toLowerCase()] ?? m;
    })
    .replace(/\s+/g, ' ')
    .trim();

/** The content of the first `<meta>` whose name or property matches, in the head. */
function meta(head: string, keys: string[]): string | undefined {
  for (const key of keys) {
    const re = new RegExp(`<meta[^>]+(?:property|name)\\s*=\\s*["']${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["'][^>]*>`, 'i');
    const tag = re.exec(head)?.[0];
    const value = tag ? /content\s*=\s*["']([^"']*)["']/i.exec(tag)?.[1] : undefined;
    if (value?.trim()) return decode(value);
  }
  return undefined;
}

export function parsePageMeta(html: string, pageUrl: string): PageMeta {
  const head = html.slice(0, html.search(/<\/head>/i) + 1 || 200_000);
  const title = meta(head, ['og:title', 'twitter:title']) ?? decode(/<title[^>]*>([\s\S]*?)<\/title>/i.exec(head)?.[1] ?? '');
  const image = meta(head, ['og:image:secure_url', 'og:image', 'twitter:image', 'twitter:image:src']);
  let imageUrl: string | undefined;
  if (image) {
    try {
      const abs = new URL(image, pageUrl);
      // Only a picture fetched over http(s); `data:` and the rest are refused here, not downstream.
      if (abs.protocol === 'https:' || abs.protocol === 'http:') imageUrl = abs.toString();
    } catch { /* a broken tag is no picture */ }
  }
  return {
    ...(title ? { title: title.slice(0, 300) } : {}),
    ...(meta(head, ['og:description', 'twitter:description', 'description']) ? { description: meta(head, ['og:description', 'twitter:description', 'description'])!.slice(0, 600) } : {}),
    ...(meta(head, ['og:site_name', 'application-name']) ? { siteName: meta(head, ['og:site_name', 'application-name'])!.slice(0, 120) } : {}),
    ...(meta(head, ['article:published_time', 'datePublished', 'date']) ? { publishedAt: meta(head, ['article:published_time', 'datePublished', 'date'])!.slice(0, 40) } : {}),
    ...(imageUrl ? { imageUrl } : {}),
  };
}
