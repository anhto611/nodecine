import { createHash, randomUUID } from 'node:crypto';
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import http from 'node:http';
import https from 'node:https';
import { rename, stat, unlink, writeFile } from 'node:fs/promises';
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
const PRIVATE_HOST = /(^|\.)localhost$|(^|\.)local$|(^|\.)internal$/i;
const PICTURE_TYPES: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' };

const decode = (s: string) =>
  s
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)));

function publicUrl(link: string, base?: string): URL {
  let url: URL;
  try {
    url = new URL(link, base);
  } catch {
    throw new Error('not a web address');
  }
  if (!/^https?:$/.test(url.protocol)) throw new Error('only http and https addresses can be read');
  const host = url.hostname.replace(/^\[|\]$/g, '');
  if (url.username || url.password || PRIVATE_HOST.test(host) || (isIP(host) ? privateAddress(host) : !host.includes('.'))) {
    throw new Error('that address is not on the public web');
  }
  return url;
}

function privateAddress(address: string): boolean {
  const ip = address.replace(/^\[|\]$/g, '').toLowerCase();
  const mapped = /^(?:::ffff:)(\d+\.\d+\.\d+\.\d+)$/.exec(ip);
  if (mapped) return privateAddress(mapped[1]!);
  if (isIP(ip) === 4) {
    const [a, b] = ip.split('.').map(Number);
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      a! >= 224 ||
      (a === 169 && b === 254) ||
      (a === 172 && b! >= 16 && b! <= 31) ||
      (a === 192 && b === 168) ||
      (a === 100 && b! >= 64 && b! <= 127) ||
      (a === 198 && (b === 18 || b === 19))
    );
  }
  if (isIP(ip) === 6) {
    return ip === '::' || ip === '::1' || ip.startsWith('fc') || ip.startsWith('fd') || /^fe[89ab]/.test(ip) || ip.startsWith('ff') || ip.startsWith('2001:db8:') || ip.startsWith('::ffff:');
  }
  return true;
}

async function publicAddress(url: URL): Promise<string> {
  const host = url.hostname.replace(/^\[|\]$/g, '');
  const addresses = isIP(host) ? [host] : (await lookup(host, { all: true })).map((entry) => entry.address);
  if (!addresses.length || addresses.some(privateAddress)) throw new Error('that address is not on the public web');
  return addresses[0]!;
}

/** Connect to the address we checked, while retaining the original host for HTTP and TLS. */
async function requestPublic(url: URL, address: string, init: RequestInit, maxBytes: number): Promise<Response> {
  return new Promise((resolve, reject) => {
    const request = (url.protocol === 'https:' ? https : http).request(
      url,
      {
        method: 'GET',
        headers: { 'accept-encoding': 'identity', ...Object.fromEntries(new Headers(init.headers)) },
        agent: false,
        signal: init.signal ?? undefined,
        lookup: (_host, _options, callback) => callback(null, address, isIP(address) as 4 | 6),
      },
      (incoming) => {
        const status = incoming.statusCode ?? 502;
        const headers = new Headers();
        for (const [key, value] of Object.entries(incoming.headers)) {
          if (value !== undefined) headers.set(key, Array.isArray(value) ? value.join(', ') : value);
        }
        if (status >= 300 && status < 400) {
          incoming.destroy();
          resolve(new Response(null, { status, headers }));
          return;
        }
        const chunks: Buffer[] = [];
        let size = 0;
        incoming.on('data', (chunk: Buffer) => {
          size += chunk.length;
          if (size > maxBytes) {
            incoming.destroy();
            reject(new Error(`web response exceeds ${maxBytes} bytes`));
          } else chunks.push(chunk);
        });
        incoming.on('end', () => resolve(new Response(status === 204 || status === 205 || status === 304 ? null : Buffer.concat(chunks), { status, headers })));
        incoming.on('error', reject);
      },
    );
    request.on('error', reject);
    request.end();
  });
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
    try {
      url = publicUrl(decode(raw.trim()), pageUrl);
    } catch {
      return;
    }
    if (/\.(svg|gif|ico)(\?|$)/i.test(url.pathname)) return;
    const href = largest(url.toString());
    const key = sameness(href);
    if (seen.has(key)) return;
    seen.add(key);
    found.push({ url: href, alt: decode(alt).trim().slice(0, 200), page: pageUrl });
  };
  const bestOf = (srcset: string) =>
    srcset
      .split(',')
      .map((part) => part.trim().split(/\s+/))
      .map(([u, w]) => ({ u, w: Number.parseFloat(w ?? '') || 0 }))
      .sort((a, b) => b.w - a.w)[0]?.u;
  const meta = (name: string) => new RegExp(`<meta[^>]+(?:name|property)=["']${name}["'][^>]*content=["']([^"']*)["']`, 'i').exec(html)?.[1];
  add(meta('og:image'), meta('og:title'));
  add(meta('twitter:image'), meta('twitter:title'));
  for (const m of html.matchAll(/<(img|source)\b[^>]*>/gi)) {
    const tag = m[0];
    const attr = (name: string) => new RegExp(`\\b${name}=["']([^"']*)["']`, 'i').exec(tag)?.[1];
    const srcset = attr('srcset') ?? attr('data-srcset');
    add(srcset ? bestOf(srcset) : (attr('src') ?? attr('data-src')), attr('alt') ?? '');
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
        else if (v && typeof v === 'object')
          for (const [k, x] of Object.entries(v)) {
            if (k === 'description' && typeof x === 'string') described.push(x);
            else walk(x);
          }
      };
      walk(JSON.parse(m[1]!));
    } catch {
      /* structured data that does not parse says nothing */
    }
  }
  const body = decode(
    html
      .replace(/<(script|style|noscript|svg|nav|footer|header)[\s\S]*?<\/\1>/gi, ' ')
      .replace(/<br\s*\/?>|<\/(p|div|li|h\d)>/gi, '\n')
      .replace(/<[^>]+>/g, ' '),
  )
    .replace(/[ \t]+/g, ' ')
    .replace(/\s*\n\s*/g, '\n')
    .trim();
  const text = [meta('description') || meta('og:description'), ...described, body].filter(Boolean).join('\n\n').slice(0, MAX_TEXT);
  return { url, title, text };
}

/**
 * Fetches a public web resource, following redirects manually to ensure every hop
 * is strictly validated against private/local addresses (preventing SSRF).
 */
async function fetchPublic(initialLink: string, init: RequestInit, maxBytes: number, maxRedirects = 5): Promise<{ res: Response; finalUrl: string }> {
  let currentUrl = publicUrl(initialLink);
  for (let i = 0; i <= maxRedirects; i++) {
    const address = await publicAddress(currentUrl);
    const res = await requestPublic(currentUrl, address, init, maxBytes);
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
  const { res, finalUrl } = await fetchPublic(
    link,
    {
      headers: { 'user-agent': 'Mozilla/5.0 (NodeCine research)', 'accept-language': 'vi,en;q=0.8' },
      signal: AbortSignal.timeout(15_000),
    },
    MAX_PAGE_BYTES,
  );
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
  const { res } = await fetchPublic(
    link,
    {
      headers: { 'user-agent': 'Mozilla/5.0 (NodeCine research)' },
      signal: AbortSignal.timeout(20_000),
    },
    MAX_PICTURE_BYTES,
  );
  if (!res.ok) throw new Error(`the picture answered ${res.status}`);
  const ext = PICTURE_TYPES[(res.headers.get('content-type') ?? '').split(';')[0]!.trim().toLowerCase()];
  if (!ext) throw new Error(`not a picture a film can use (${res.headers.get('content-type') || 'no type'})`);
  const bytes = Buffer.from(await res.arrayBuffer());
  if (!bytes.length || bytes.length > MAX_PICTURE_BYTES) throw new Error(`pictures up to ${MAX_PICTURE_BYTES / 1024 / 1024} MB`);
  const name = `${createHash('sha1').update(bytes).digest('hex')}.${ext}`;
  const target = path.join(await ensureAssetsDir(), name);
  if (
    !(await stat(target).then(
      () => true,
      () => false,
    ))
  ) {
    const part = `${target}.${randomUUID()}.part`;
    try {
      await writeFile(part, bytes);
      await rename(part, target);
    } finally {
      await unlink(part).catch(() => undefined);
    }
  }
  return { url: assetUrl(name), ...(await sizeOf(assetPath(name))) };
}
