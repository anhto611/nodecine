import { NodeError } from '@/core/errors';
import { downloadImageAsset, getVetted, MEDIA_UA, readCapped, saveAsset } from '@/server/fetch-media';
import { parsePageUrl, isPrivateHost } from '@/core/network/public-url';
import { parsePageMeta } from './page-parse-meta';
import { WebErrorCode } from '@/core/network/page-errors';
import type { PageRead, ReadPageOptions } from '@/core/engine/services';

/**
 * Reading a public page, on the server (ARCHITECTURE §5). Every address is vetted and rebuilt by
 * `parsePageUrl` before it is used, redirects are followed by hand so each hop is vetted too, and
 * both the page and its picture are capped. A picture the page names is downloaded and kept as a
 * scene asset, because a scene may only show images this machine holds (CORE_CONTRACTS §2.7).
 */

const MAX_HTML = 2 * 1024 * 1024;
const MAX_IMAGE = 2 * 1024 * 1024;

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
    await page.setUserAgent(MEDIA_UA);
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

  const { res, url } = await getVetted(vetted.url, signal, 'text/html,application/xhtml+xml');
  if (res.status === 404 || res.status === 410) throw new NodeError(WebErrorCode.PAGE_NOT_FOUND, `the page is not there (HTTP ${res.status})`, false);
  if (!res.ok) throw new NodeError(WebErrorCode.PAGE_NETWORK, `HTTP ${res.status} from ${vetted.domain}`, res.status >= 500);
  const html = (await readCapped(res, MAX_HTML, 'the page')).toString('utf8');
  const meta = parsePageMeta(html, url);

  const picture = meta.imageUrl ? await downloadImageAsset(meta.imageUrl, signal, MAX_IMAGE).catch(() => undefined) : undefined;
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
