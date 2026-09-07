import { createHash } from 'node:crypto';
import path from 'node:path';
import { rename, writeFile } from 'node:fs/promises';
import { NodeError } from '@/core/errors';
import { ASSET_TYPES, assetUrl, ensureAssetsDir } from '@/server/paths';
import { parsePageUrl, isPrivateHost } from './parse-url';
import { parsePageMeta } from './parse-meta';
import { WebErrorCode } from './errors';
import type { PageRead, ReadPageOptions } from '@/core/engine/services';

/**
 * Reading a public page, on the server (ARCHITECTURE §5). Every address is vetted and rebuilt by
 * `parsePageUrl` before it is used, redirects are followed by hand so each hop is vetted too, and
 * both the page and its picture are capped. A picture the page names is downloaded and kept as a
 * look asset, because a scene may only show images this machine holds (CORE_CONTRACTS §2.7).
 */

const UA = 'NodeCine/0.1 (+https://github.com/nodecine)';
const MAX_HTML = 2 * 1024 * 1024;
const MAX_IMAGE = 2 * 1024 * 1024;
const MAX_REDIRECTS = 3;

/** Fetch, following redirects one at a time so a redirect cannot lead somewhere private. */
async function get(url: string, signal: AbortSignal, accept: string): Promise<{ res: Response; url: string }> {
  let next = url;
  for (let hop = 0; ; hop++) {
    const res = await fetch(next, { redirect: 'manual', signal, headers: { 'user-agent': UA, accept } });
    if (res.status < 300 || res.status >= 400) return { res, url: next };
    const location = res.headers.get('location');
    if (!location || hop >= MAX_REDIRECTS) throw new NodeError(WebErrorCode.PAGE_NETWORK, `too many redirects from ${url}`, true);
    const target = parsePageUrl(new URL(location, next).toString());
    if (!target) throw new NodeError(WebErrorCode.PAGE_URL_INVALID, `redirected somewhere this machine will not follow`, false);
    next = target.url;
  }
}

/** Read at most `max` bytes of a body, so a huge or endless response cannot fill memory. */
async function readCapped(res: Response, max: number, what: string): Promise<Buffer> {
  const declared = Number(res.headers.get('content-length') ?? '0');
  if (declared > max) throw new NodeError(WebErrorCode.PAGE_TOO_BIG, `${what} is ${Math.round(declared / 1024)} KB, over the ${Math.round(max / 1024)} KB limit`, false);
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
      throw new NodeError(WebErrorCode.PAGE_TOO_BIG, `${what} is over the ${Math.round(max / 1024)} KB limit`, false);
    }
    parts.push(value);
  }
  return Buffer.concat(parts);
}

/** Store bytes as a look asset, named by their content so the same picture is one file. */
async function saveAsset(bytes: Buffer, mime: string): Promise<string | undefined> {
  const ext = Object.entries(ASSET_TYPES).find(([, m]) => m === mime.split(';')[0]!.trim())?.[0];
  if (!ext || bytes.length === 0 || bytes.length > MAX_IMAGE) return undefined;
  const name = `${createHash('sha1').update(bytes).digest('hex')}.${ext === 'jpeg' ? 'jpg' : ext}`;
  const dir = await ensureAssetsDir();
  const target = path.join(dir, name);
  const tmp = `${target}.${process.pid}.part`;
  await writeFile(tmp, bytes);
  await rename(tmp, target);
  return assetUrl(name);
}

/** The page's own picture, kept locally; anything that is not an image of a sane size is skipped. */
async function savePicture(imageUrl: string, signal: AbortSignal): Promise<string | undefined> {
  const vetted = parsePageUrl(imageUrl);
  if (!vetted) return undefined;
  const { res } = await get(vetted.url, signal, 'image/*');
  if (!res.ok) return undefined;
  const mime = res.headers.get('content-type') ?? '';
  if (!mime.startsWith('image/')) return undefined;
  return saveAsset(await readCapped(res, MAX_IMAGE, 'the picture'), mime);
}

/**
 * One browser for a run, not one per page: photographing five links should not start Chrome five
 * times. It closes itself once nobody has asked for a while, so an idle Studio holds no browser.
 */
const IDLE_MS = 30_000;
let shared: { browser: Awaited<ReturnType<typeof launch>>; timer: NodeJS.Timeout | null } | null = null;
async function launch() {
  const { default: puppeteer } = await import('puppeteer');
  return puppeteer.launch({ args: ['--no-sandbox', '--disable-dev-shm-usage'] });
}
async function browserFor(): Promise<Awaited<ReturnType<typeof launch>>> {
  if (shared?.timer) clearTimeout(shared.timer);
  if (!shared || !shared.browser.connected) shared = { browser: await launch(), timer: null };
  return shared.browser;
}
function releaseBrowser(): void {
  if (!shared) return;
  if (shared.timer) clearTimeout(shared.timer);
  shared.timer = setTimeout(() => {
    const b = shared?.browser;
    shared = null;
    void b?.close().catch(() => undefined);
  }, IDLE_MS);
  shared.timer.unref?.();
}

/** A picture of the page itself, taken in the browser the renderer already uses. */
async function screenshot(url: string, width: number, height: number, signal: AbortSignal): Promise<string | undefined> {
  const browser = await browserFor();
  try {
    const page = await browser.newPage();
    await page.setViewport({ width, height, deviceScaleFactor: 1 });
    await page.setUserAgent(UA);
    // The page is somebody else's code: it gets a short leash and no chance to open anything.
    page.on('dialog', (d) => void d.dismiss());
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 20_000 });
    if (signal.aborted) return undefined;
    const shot = Buffer.from(await page.screenshot({ type: 'png' }));
    await page.close().catch(() => undefined);
    return await saveAsset(shot, 'image/png');
  } finally {
    releaseBrowser();
  }
}

export async function readPageOnServer(rawUrl: string, opts: ReadPageOptions, signal: AbortSignal): Promise<PageRead> {
  const vetted = parsePageUrl(rawUrl);
  if (!vetted) throw new NodeError(WebErrorCode.PAGE_URL_INVALID, `not a public web address: ${rawUrl.slice(0, 120)}`, false);
  if (isPrivateHost(vetted.host)) throw new NodeError(WebErrorCode.PAGE_URL_INVALID, 'that address is on this machine or its network', false);

  const { res, url } = await get(vetted.url, signal, 'text/html,application/xhtml+xml');
  if (res.status === 404 || res.status === 410) throw new NodeError(WebErrorCode.PAGE_NOT_FOUND, `the page is not there (HTTP ${res.status})`, false);
  if (!res.ok) throw new NodeError(WebErrorCode.PAGE_NETWORK, `HTTP ${res.status} from ${vetted.domain}`, res.status >= 500);
  const html = (await readCapped(res, MAX_HTML, 'the page')).toString('utf8');
  const meta = parsePageMeta(html, url);

  const picture = meta.imageUrl ? await savePicture(meta.imageUrl, signal).catch(() => undefined) : undefined;
  // A photograph that does not come out must not cost the page its title: the reason is carried
  // back so the node can say it, and the read stands without a picture.
  let shot: string | undefined;
  let shotProblem: string | undefined;
  if (opts.screenshot) {
    try {
      shot = await screenshot(vetted.url, opts.width, opts.height, signal);
    } catch (e) {
      shotProblem = e instanceof Error ? e.message.slice(0, 160) : String(e);
    }
  }

  return {
    url,
    domain: vetted.domain,
    ...meta,
    ...(picture ? { pictureAsset: picture } : {}),
    ...(shot ? { screenshotAsset: shot } : {}),
    ...(shotProblem ? { shotProblem } : {}),
  };
}
