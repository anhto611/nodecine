import { NodeError } from '@/core/errors';
import { downloadImageAsset, getVetted, readCapped, saveAsset } from '@/server/fetch-media';
import { parsePageUrl } from '@/core/network/public-url';
import type { StockRequest, StockResult } from './types';
import { clipSearchUrl, parseClips, parseStock, pick, pickClip, searchUrl, STOCK_KEY_ENV } from './providers';

export const StockErrorCode = {
  KEY_MISSING: 'STOCK_KEY_MISSING',
  UPSTREAM: 'STOCK_UPSTREAM',
} as const;

const MAX_JSON = 512 * 1024;
/** A clip's own ceiling, far above a picture's: a 1080 rendition measures about 2 MB for five seconds. */
const MAX_CLIP_BYTES = 40 * 1024 * 1024;

/**
 * One piece of footage for one scene, on the server (CORE_CONTRACTS §5.19).
 *
 * **A clip first, a photograph only if no clip fits** — the order cutdown settled on, because a
 * still held for four seconds reads as a frozen frame however carefully it drifts. Ken Burns is the
 * apology for not having footage, not the goal.
 *
 * The key is read from the environment and never from the graph, like every other credential
 * (§9.1). The address each library answers with is vetted and the download capped by the shared
 * media rules, because it is an address a third party chose, not one this machine did.
 */
export async function fetchStockMediaOnServer(req: StockRequest, signal: AbortSignal): Promise<StockResult | null> {
  const key = process.env[STOCK_KEY_ENV[req.provider]];
  if (!key) {
    throw new NodeError(StockErrorCode.KEY_MISSING, `${req.provider} needs ${STOCK_KEY_ENV[req.provider]} in .env.local`, false);
  }
  const used = new Set(req.used);
  if (req.want !== 'still') {
    const clip = await findClip(req, key, used, signal);
    if (clip) return clip;
    // `clip` means clip: a scene that gets a photograph instead is a scene that quietly stopped
    // being what the frame promised, and half a film of stills among moving shots reads as a fault.
    if (req.want === 'clip') return null;
  }
  return findPhoto(req, key, used, signal);
}

async function findClip(req: StockRequest, key: string, used: Set<string>, signal: AbortSignal): Promise<StockResult | null> {
  const body = await ask(clipSearchUrl(req.provider, req.query, req.orientation, key), req.provider, key, signal);
  const clips = parseClips(req.provider, body, req.orientation, req.longEdge);
  // The best candidate can still fail to download; one dead link should not cost the scene its clip.
  for (let tries = 0; tries < 3; tries++) {
    const chosen = pickClip(clips, req.orientation, used);
    if (!chosen) return null;
    used.add(chosen.page);
    const assetUrl = await downloadClip(chosen.url, signal).catch(() => undefined);
    if (assetUrl) return { kind: 'clip', assetUrl, author: chosen.author, page: chosen.page, width: chosen.width, height: chosen.height, durationSec: chosen.durationSec };
  }
  return null;
}

async function findPhoto(req: StockRequest, key: string, used: Set<string>, signal: AbortSignal): Promise<StockResult | null> {
  const body = await ask(searchUrl(req.provider, req.query, req.orientation, key), req.provider, key, signal);
  const photos = parseStock(req.provider, body, req.longEdge);
  for (let tries = 0; tries < 4; tries++) {
    const chosen = pick(photos, req.orientation, used);
    if (!chosen) return null;
    used.add(chosen.page);
    const assetUrl = await downloadImageAsset(chosen.url, signal).catch(() => undefined);
    if (assetUrl) return { kind: 'photo', assetUrl, author: chosen.author, page: chosen.page, width: chosen.width, height: chosen.height };
  }
  return null;
}

async function ask(url: string, provider: StockRequest['provider'], key: string, signal: AbortSignal): Promise<unknown> {
  const res = await fetch(url, {
    signal,
    headers: provider === 'pexels' ? { Authorization: key, accept: 'application/json' } : { accept: 'application/json' },
  });
  if (!res.ok) throw new NodeError(StockErrorCode.UPSTREAM, `${provider} answered ${res.status}`, res.status >= 500 || res.status === 429);
  return JSON.parse((await readCapped(res, MAX_JSON, 'the search result')).toString('utf8')) as unknown;
}

/** Same rules as a picture, a much bigger ceiling, and only the video types the asset store serves. */
async function downloadClip(url: string, signal: AbortSignal): Promise<string | undefined> {
  const vetted = parsePageUrl(url);
  if (!vetted) return undefined;
  const { res } = await getVetted(vetted.url, signal, 'video/*');
  if (!res.ok) return undefined;
  const mime = res.headers.get('content-type') ?? '';
  if (!mime.startsWith('video/')) return undefined;
  return saveAsset(await readCapped(res, MAX_CLIP_BYTES, 'the clip'), mime, MAX_CLIP_BYTES);
}

export const stockMediaServices = { 'stock-media/fetch': fetchStockMediaOnServer };
