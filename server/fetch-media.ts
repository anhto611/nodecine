import { createHash } from 'node:crypto';
import path from 'node:path';
import { rename, writeFile } from 'node:fs/promises';
import { NodeError } from '@/contracts/errors';
import { ASSET_TYPES, assetUrl, ensureAssetsDir } from '@/server/paths';
import { parsePageUrl } from '@/contracts/network/public-url';

/**
 * Bringing a file in from the open internet, safely (CORE_CONTRACTS §9.2). Shared by every node
 * that does it — the Web Fetcher for a page's own picture, Stock Images for a photograph — because
 * the rules must not drift apart between them: every address vetted and rebuilt before use, every
 * redirect followed one hop at a time so it cannot lead somewhere private, every read capped.
 */

export const MEDIA_UA = 'NodeCine/0.1 (+https://github.com/nodecine)';
export const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const MAX_REDIRECTS = 3;

export const FetchErrorCode = {
  URL_INVALID: 'FETCH_URL_INVALID',
  NETWORK: 'FETCH_NETWORK',
  TOO_BIG: 'FETCH_TOO_BIG',
} as const;

/** Fetch, following redirects one at a time so a redirect cannot lead somewhere private. */
export async function getVetted(url: string, signal: AbortSignal, accept: string): Promise<{ res: Response; url: string }> {
  let next = url;
  for (let hop = 0; ; hop++) {
    const res = await fetch(next, { redirect: 'manual', signal, headers: { 'user-agent': MEDIA_UA, accept } });
    if (res.status < 300 || res.status >= 400) return { res, url: next };
    const location = res.headers.get('location');
    if (!location || hop >= MAX_REDIRECTS) throw new NodeError(FetchErrorCode.NETWORK, `too many redirects from ${url}`, true);
    const target = parsePageUrl(new URL(location, next).toString());
    if (!target) throw new NodeError(FetchErrorCode.URL_INVALID, 'redirected somewhere this machine will not follow', false);
    next = target.url;
  }
}

/** Read a body with a hard cap, by the stream: an endless response must not fill memory. */
export async function readCapped(res: Response, max: number, what: string): Promise<Buffer> {
  const declared = Number(res.headers.get('content-length') ?? '0');
  if (declared > max) throw new NodeError(FetchErrorCode.TOO_BIG, `${what} is ${Math.round(declared / 1024)} KB, over the ${Math.round(max / 1024)} KB limit`, false);
  const reader = res.body?.getReader();
  if (!reader) return Buffer.alloc(0);
  const parts: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > max) {
      await reader.cancel();
      throw new NodeError(FetchErrorCode.TOO_BIG, `${what} is over the ${Math.round(max / 1024)} KB limit`, false);
    }
    parts.push(value);
  }
  return Buffer.concat(parts);
}

/** Store bytes as a scene asset, named by their content so the same picture is one file. */
export async function saveAsset(bytes: Buffer, mime: string, max = MAX_IMAGE_BYTES): Promise<string | undefined> {
  const ext = Object.entries(ASSET_TYPES).find(([, m]) => m === mime.split(';')[0]!.trim())?.[0];
  if (!ext || bytes.length === 0 || bytes.length > max) return undefined;
  const name = `${createHash('sha1').update(bytes).digest('hex')}.${ext === 'jpeg' ? 'jpg' : ext}`;
  const dir = await ensureAssetsDir();
  const target = path.join(dir, name);
  const tmp = `${target}.${process.pid}.part`;
  await writeFile(tmp, bytes);
  await rename(tmp, target);
  return assetUrl(name);
}

/** A picture at a public address, vetted, capped and kept locally; anything else comes back undefined. */
export async function downloadImageAsset(imageUrl: string, signal: AbortSignal, max = MAX_IMAGE_BYTES): Promise<string | undefined> {
  const vetted = parsePageUrl(imageUrl);
  if (!vetted) return undefined;
  const { res } = await getVetted(vetted.url, signal, 'image/*');
  if (!res.ok) return undefined;
  const mime = res.headers.get('content-type') ?? '';
  if (!mime.startsWith('image/')) return undefined;
  return saveAsset(await readCapped(res, max, 'the picture'), mime, max);
}
