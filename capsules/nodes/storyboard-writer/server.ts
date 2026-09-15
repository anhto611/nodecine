import type { LinkedPage } from './material';

/**
 * A linked page as text: its title, its description, the description in its structured data (an App
 * Store page carries the app's whole description there), then its visible words, cut to a length a
 * prompt can carry. Only public web addresses: a description must not make the server read its own network.
 */

const MAX_BYTES = 3 * 1024 * 1024;
const MAX_TEXT = 12_000;
const PRIVATE_HOST = /^(localhost|127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|0\.|\[?::1\]?$|\[?f[cd][0-9a-f]{2}:)/i;

const decode = (s: string) => s.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)));

export function pageText(html: string, url: string): LinkedPage {
  const meta = (name: string) => decode(new RegExp(`<meta[^>]+(?:name|property)=["']${name}["'][^>]*content=["']([^"']*)["']`, 'i').exec(html)?.[1] ?? '').trim();
  const title = decode(/<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1] ?? '').trim() || meta('og:title');
  const described: string[] = [];
  for (const m of html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const walk = (v: unknown): void => {
        if (Array.isArray(v)) v.forEach(walk);
        else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) { if (k === 'description' && typeof x === 'string') described.push(x); else walk(x); }
      };
      walk(JSON.parse(m[1]!));
    } catch { /* structured data that does not parse says nothing */ }
  }
  const body = decode(html
    .replace(/<(script|style|noscript|svg|nav|footer|header)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<br\s*\/?>|<\/(p|div|li|h\d)>/gi, '\n')
    .replace(/<[^>]+>/g, ' '))
    .replace(/[ \t]+/g, ' ').replace(/\s*\n\s*/g, '\n').trim();
  const text = [meta('description') || meta('og:description'), ...described, body].filter(Boolean).join('\n\n').slice(0, MAX_TEXT);
  return { url, title, text };
}

export async function readPage(link: string): Promise<LinkedPage> {
  let url: URL;
  try { url = new URL(link); } catch { throw new Error('not a web address'); }
  if (!/^https?:$/.test(url.protocol)) throw new Error('only http and https addresses can be read');
  if (PRIVATE_HOST.test(url.hostname)) throw new Error('that address is not on the public web');
  const res = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0 (NodeCine brief reader)', 'accept-language': 'vi,en;q=0.8' }, redirect: 'follow', signal: AbortSignal.timeout(15_000) });
  if (!res.ok) throw new Error(`the page answered ${res.status}`);
  const type = res.headers.get('content-type') ?? '';
  if (!/html|text/.test(type)) throw new Error(`the page is ${type || 'not text'}`);
  const buf = await res.arrayBuffer();
  return pageText(new TextDecoder().decode(buf.slice(0, MAX_BYTES)), res.url || url.toString());
}

export const storyboardWriterServices = { 'storyboard-writer/read-page': readPage };
