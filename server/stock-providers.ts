/**
 * Two stock libraries, read the same way (CORE_CONTRACTS §5.19). Pure: the shapes each API answers
 * with, turned into one shape, so the picking rules below can be tested against a saved response
 * without a key or a network.
 *
 * Both licences allow commercial use without attribution, which is why these two and not others.
 */
export const STOCK_PROVIDERS = ['pexels', 'pixabay'] as const;
export type StockProvider = (typeof STOCK_PROVIDERS)[number];
export type Orientation = 'landscape' | 'portrait' | 'square';

export interface StockPhoto {
  url: string;
  width: number;
  height: number;
  author: string;
  page: string;
}

/** A clip is a photo plus a length, and the length is what decides whether it can hold a scene. */
export interface StockClip extends StockPhoto {
  durationSec: number;
}

/**
 * A clip must outlast the scene it fills, or it starts again in the middle of it: the same curtain
 * lifting twice, the same car passing twice. Nothing throws — only the eye sees it.
 *
 * This node runs before the voice exists, so the scene's real length is not knowable here; four
 * seconds is the floor cutdown keeps for exactly that case. Longer candidates win on the tie.
 */
export const MIN_CLIP_SECONDS = 4;

/** Which environment variable holds each key. Keys come from the environment, never from a graph (§9.1). */
export const STOCK_KEY_ENV: Record<StockProvider, string> = { pexels: 'PEXELS_API_KEY', pixabay: 'PIXABAY_API_KEY' };

/**
 * The long edge must reach this, on a frame whose long edge is 1920. Below it the picture is being
 * enlarged, and enlargement shows on a phone. Measured on the long edge rather than the height so
 * one floor is right for both a portrait and a landscape frame.
 */
export const MIN_LONG_EDGE = 1200;
/**
 * Right way up, or near enough: short edge over long edge at most 0.9. On a portrait frame a 3:4
 * picture still fills after the crop while a landscape one does not — and the same number says so
 * for the other frame.
 */
export const MAX_RATIO = 0.9;

export function fitsFrame(size: { width: number; height: number }, orientation: Orientation): boolean {
  if (orientation === 'square') return Math.min(size.width, size.height) >= MIN_LONG_EDGE;
  const portrait = orientation === 'portrait';
  const long = portrait ? size.height : size.width;
  const ratio = portrait ? size.width / size.height : size.height / size.width;
  return long >= MIN_LONG_EDGE && ratio <= MAX_RATIO;
}

export function searchUrl(provider: StockProvider, query: string, orientation: Orientation, key: string): string {
  const q = encodeURIComponent(query);
  // Thirty, not fifteen: pictures already used in this video are dropped before any is tried, so
  // the page has to be wide enough to still hold candidates afterwards. This is JSON, not photographs.
  if (provider === 'pexels') return `https://api.pexels.com/v1/search?per_page=30&orientation=${orientation}&query=${q}`;
  const shape = orientation === 'portrait' ? 'vertical' : orientation === 'landscape' ? 'horizontal' : 'all';
  return `https://pixabay.com/api/?key=${encodeURIComponent(key)}&image_type=photo&orientation=${shape}&safesearch=true&per_page=30&q=${q}`;
}

interface PexelsPhoto { width: number; height: number; url: string; photographer: string; src: { original?: string } }
interface PixabayHit { largeImageURL: string; pageURL: string; user: string; imageWidth: number; imageHeight: number }

/**
 * Pexels: ask the original for the height wanted, rather than take a ready-made variant.
 * `large2x` sounds like the big one but it is `w=940&h=650&dpr=2`, so a portrait photograph comes
 * back 867×1300 — 620px short of a 1920 frame, enlarged to fit, visibly soft, and nothing reports
 * it. `original?h=1920` is the true aspect at the height the frame wants, and still light.
 */
export function parseStock(provider: StockProvider, body: unknown, longEdge: number): StockPhoto[] {
  if (provider === 'pexels') {
    const photos = (body as { photos?: PexelsPhoto[] }).photos ?? [];
    return photos
      .filter((p) => p.src.original)
      .map((p) => ({ url: `${p.src.original!}?auto=compress&h=${longEdge}`, width: p.width, height: p.height, author: p.photographer, page: p.url }));
  }
  const hits = (body as { hits?: PixabayHit[] }).hits ?? [];
  return hits.map((h) => ({ url: h.largeImageURL, width: h.imageWidth, height: h.imageHeight, author: h.user, page: h.pageURL }));
}

/** The first picture that fits and has not been used in this video yet. */
export function pick(photos: StockPhoto[], orientation: Orientation, used: ReadonlySet<string>): StockPhoto | undefined {
  return photos.find((p) => !used.has(p.page) && fitsFrame(p, orientation));
}

interface PexelsFile { link?: string; width?: number; height?: number; file_type?: string }
interface PexelsVideo { width: number; height: number; duration: number; url: string; user?: { name?: string }; video_files?: PexelsFile[] }
interface PixabayVideoHit { pageURL: string; duration: number; user: string; videos?: Record<string, { url?: string; width?: number; height?: number }> }

export function clipSearchUrl(provider: StockProvider, query: string, orientation: Orientation, key: string): string {
  const q = encodeURIComponent(query);
  if (provider === 'pexels') return `https://api.pexels.com/videos/search?per_page=30&orientation=${orientation}&query=${q}`;
  const shape = orientation === 'portrait' ? 'vertical' : orientation === 'landscape' ? 'horizontal' : 'all';
  return `https://pixabay.com/api/videos/?key=${encodeURIComponent(key)}&orientation=${shape}&safesearch=true&per_page=30&q=${q}`;
}

/**
 * The rendition that fits: the **smallest** one whose long edge still reaches the frame.
 *
 * Pexels answers with the same clip at five to seven sizes, 240×426 up to 2160×3840. Taking the
 * largest downloads 15.5 MB for a five-second scene and then scales it down; taking the first in the
 * list gets a clip whose top entry is 338×640, which enlarges into a 1080 frame and shows. Measured
 * across the first three results of one query: the 1080×1920 rendition is 2.2 MB, 1.2 seconds.
 */
export function pickFile(files: PexelsFile[], orientation: Orientation, longEdge: number): PexelsFile | undefined {
  const long = (f: PexelsFile) => (orientation === 'portrait' ? f.height : f.width) ?? 0;
  const usable = files.filter((f) => f.link && f.width && f.height);
  const enough = usable.filter((f) => long(f) >= longEdge).sort((a, b) => long(a) - long(b));
  return enough[0] ?? usable.sort((a, b) => long(b) - long(a))[0];
}

export function parseClips(provider: StockProvider, body: unknown, orientation: Orientation, longEdge: number): StockClip[] {
  if (provider === 'pexels') {
    const videos = (body as { videos?: PexelsVideo[] }).videos ?? [];
    return videos.flatMap((v) => {
      const file = pickFile(v.video_files ?? [], orientation, longEdge);
      if (!file?.link) return [];
      return [{ url: file.link, width: file.width ?? v.width, height: file.height ?? v.height, author: v.user?.name ?? '', page: v.url, durationSec: v.duration }];
    });
  }
  const hits = (body as { hits?: PixabayVideoHit[] }).hits ?? [];
  return hits.flatMap((h) => {
    const files = Object.values(h.videos ?? {}).map((f) => ({ link: f.url, width: f.width, height: f.height }));
    const file = pickFile(files, orientation, longEdge);
    if (!file?.link) return [];
    return [{ url: file.link, width: file.width ?? 0, height: file.height ?? 0, author: h.user, page: h.pageURL, durationSec: h.duration }];
  });
}

/**
 * The first clip that fills the frame, lasts long enough, and this video has not used already.
 *
 * First, not longest, and the difference is measured: sorting by length picked a 30-second clip and
 * downloaded 32 MB for a scene of five, where the first qualifying result is a couple of megabytes.
 * Length past the floor buys nothing — the clip only has to outlast the scene — and the library's
 * own order is relevance, which is the one ranking worth keeping.
 */
export function pickClip(clips: StockClip[], orientation: Orientation, used: ReadonlySet<string>): StockClip | undefined {
  return clips.find((c) => !used.has(c.page) && c.durationSec >= MIN_CLIP_SECONDS && fitsFrame(c, orientation));
}
