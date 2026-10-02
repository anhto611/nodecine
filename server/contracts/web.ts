import { createHash } from 'node:crypto';
import { rename, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { exec } from '@/server/exec';
import { assetPath, assetUrl, ensureAssetsDir } from '@/server/paths';
import { ffprobeBin } from './audio';
import type { FetchedPicture, FoundPicture, LinkedPage } from '@/contracts/types/web';

/**
 * The web, read on the server: a page as text with the pictures it shows, and a picture brought onto
 * this machine as an asset. Only public web addresses: a brief must not make the server read its own
 * network.
 */

const MAX_PAGE_BYTES = 3 * 1024 * 1024;
const MAX_TEXT = 12_000;
const MAX_PICTURE_BYTES = 8 * 1024 * 1024;
const MAX_CANDIDATES = 40;
const PRIVATE_HOST = /^(localhost|127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|0\.|\[?::1\]?$|\[?f[cd][0-9a-f]{2}:)/i;
const PICTURE_TYPES: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' };

const decode = (s: string) => s.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)));

function publicUrl(link: string, base?: string): URL {
  let url: URL;
  try { url = new URL(link, base); } catch { throw new Error('not a web address'); }
  if (!/^https?:$/.test(url.protocol)) throw new Error('only http and https addresses can be read');
  if (PRIVATE_HOST.test(url.hostname)) throw new Error('that address is not on the public web');
  return url;
}

/**
 * Image CDNs that serve any size from one address: asked for a size a film can use. Apple's store
 * thumbnails are 300 pixels wide in the page and the same picture at 1290 on request.
 */
function largest(url: string): string {
  return url.replace(/(\/[^/]*mzstatic\.com\/image\/thumb\/.+\/)(\d+)x(\d+)(bb|wa|w|h)(-\d+)?\.(webp|jpg|jpeg|png)$/i, (_all, head: string, w: string, h: string) => {
    const scale = 1600 / Math.max(Number(w), Number(h));
    return `${head}${Math.round(Number(w) * scale)}x${Math.round(Number(h) * scale)}bb.jpg`;
  });
}

/** The same picture at several sizes or formats is one picture: its address without the size and the extension. */
const sameness = (url: string) => url.replace(/\/\d+x\d+[a-z]*(-\d+)?\.[a-z]+$/i, '').replace(/\.(webp|jpe?g|png)(\?.*)?$/i, '');

/** The pictures a page shows, largest version of each, in the order a reader meets them. */
export function pagePictures(html: string, pageUrl: string): FoundPicture[] {
  const found: FoundPicture[] = [];
  const seen = new Set<string>();
  const add = (raw: string | undefined, alt = '') => {
    if (!raw || raw.startsWith('data:')) return;
    let url: URL;
    try { url = publicUrl(decode(raw.trim()), pageUrl); } catch { return; }
    if (/\.(svg|gif|ico)(\?|$)/i.test(url.pathname)) return;
    const href = largest(url.toString());
    const key = sameness(href);
    if (seen.has(key)) return;
    seen.add(key);
    found.push({ url: href, alt: decode(alt).trim().slice(0, 200), page: pageUrl });
  };
  const bestOf = (srcset: string) => srcset.split(',').map((part) => part.trim().split(/\s+/)).map(([u, w]) => ({ u, w: Number.parseFloat(w ?? '') || 0 })).sort((a, b) => b.w - a.w)[0]?.u;
  const meta = (name: string) => new RegExp(`<meta[^>]+(?:name|property)=["']${name}["'][^>]*content=["']([^"']*)["']`, 'i').exec(html)?.[1];
  add(meta('og:image'), meta('og:title'));
  add(meta('twitter:image'), meta('twitter:title'));
  for (const m of html.matchAll(/<(img|source)\b[^>]*>/gi)) {
    const tag = m[0];
    const attr = (name: string) => new RegExp(`\\b${name}=["']([^"']*)["']`, 'i').exec(tag)?.[1];
    const srcset = attr('srcset') ?? attr('data-srcset');
    add(srcset ? bestOf(srcset) : attr('src') ?? attr('data-src'), attr('alt') ?? '');
    if (found.length >= MAX_CANDIDATES) break;
  }
  return found.slice(0, MAX_CANDIDATES);
}

export function pageText(html: string, url: string): { url: string; title: string; text: string } {
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

/**
 * Fetches a public web resource, following redirects manually to ensure every hop
 * is strictly validated against private/local addresses (preventing SSRF).
 */
async function fetchPublic(initialLink: string, init: RequestInit, maxRedirects = 5): Promise<{ res: Response; finalUrl: string }> {
  let currentUrl = publicUrl(initialLink);
  for (let i = 0; i <= maxRedirects; i++) {
    const res = await fetch(currentUrl, { ...init, redirect: 'manual' });
    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get('location');
      if (!location) return { res, finalUrl: currentUrl.toString() };
      currentUrl = publicUrl(location, currentUrl.toString());
      continue;
    }
    return { res, finalUrl: currentUrl.toString() };
  }
  throw new Error('too many redirects');
}

export async function readPage(link: string): Promise<LinkedPage> {
  const { res, finalUrl } = await fetchPublic(link, {
    headers: { 'user-agent': 'Mozilla/5.0 (NodeCine research)', 'accept-language': 'vi,en;q=0.8' },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`the page answered ${res.status}`);
  const type = res.headers.get('content-type') ?? '';
  if (!/html|text/.test(type)) throw new Error(`the page is ${type || 'not text'}`);
  const html = new TextDecoder().decode((await res.arrayBuffer()).slice(0, MAX_PAGE_BYTES));
  return { ...pageText(html, finalUrl), pictures: pagePictures(html, finalUrl) };
}

/** A picture's pixel size, read by ffprobe; undefined when it cannot be read. */
async function sizeOf(file: string): Promise<{ width: number; height: number } | undefined> {
  const bin = await ffprobeBin();
  if (!bin) return undefined;
  const r = await exec(bin, { args: ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', file], timeoutMs: 10_000 }).catch(() => null);
  const [width, height] = (r?.stdout.trim() ?? '').split(',').map(Number);
  return width && height ? { width, height } : undefined;
}

/**
 * A picture on the web brought onto this machine as an asset, named by its content like an upload, so
 * the same picture found twice is one file and a film never depends on someone else's server.
 */
export async function fetchPicture(link: string): Promise<FetchedPicture> {
  const { res } = await fetchPublic(link, {
    headers: { 'user-agent': 'Mozilla/5.0 (NodeCine research)' },
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`the picture answered ${res.status}`);
  const ext = PICTURE_TYPES[(res.headers.get('content-type') ?? '').split(';')[0]!.trim().toLowerCase()];
  if (!ext) throw new Error(`not a picture a film can use (${res.headers.get('content-type') || 'no type'})`);
  const bytes = Buffer.from(await res.arrayBuffer());
  if (!bytes.length || bytes.length > MAX_PICTURE_BYTES) throw new Error(`pictures up to ${MAX_PICTURE_BYTES / 1024 / 1024} MB`);
  const name = `${createHash('sha1').update(bytes).digest('hex')}.${ext}`;
  const target = path.join(await ensureAssetsDir(), name);
  if (!(await stat(target).then(() => true, () => false))) {
    const part = `${target}.${process.pid}.part`;
    await writeFile(part, bytes);
    await rename(part, target);
  }
  return { url: assetUrl(name), ...(await sizeOf(assetPath(name))) };
}

