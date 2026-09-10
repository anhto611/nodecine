/**
 * JetBrains Mono for the video (ARCHITECTURE §8).
 *
 * The font files ship in `public/` and are served by the app, exactly like the voice-over MP3, so
 * the browser player and the headless render load them from the same origin: '' in the browser,
 * an absolute http://127.0.0.1:<port> during a render. Without this the render falls back to
 * whatever monospace the machine happens to have and two machines produce different frames.
 */

export const VIDEO_FONT_FAMILY = 'JetBrains Mono';

const FACES: { weight: string; file: string }[] = [
  { weight: '400', file: 'JetBrainsMono-Regular.woff2' },
  { weight: '700', file: 'JetBrainsMono-Bold.woff2' },
  { weight: '800', file: 'JetBrainsMono-ExtraBold.woff2' },
];

const loaded = new Map<string, Promise<void>>();

/** Loads every weight once per origin; resolves even if a face fails so a render never hangs. */
export function loadVideoFonts(mediaBaseUrl: string): Promise<void> {
  const cached = loaded.get(mediaBaseUrl);
  if (cached) return cached;
  const run = (async () => {
    if (typeof document === 'undefined' || typeof FontFace === 'undefined') return;
    await Promise.all(
      FACES.map(async ({ weight, file }) => {
        try {
          const face = new FontFace(VIDEO_FONT_FAMILY, `url(${mediaBaseUrl}/fonts/${file}) format('woff2')`, { weight, style: 'normal' });
          await face.load();
          document.fonts.add(face);
        } catch {
          /* fall back to the system monospace for this weight */
        }
      }),
    );
    try {
      await document.fonts.ready;
    } catch {
      /* ignore */
    }
  })();
  loaded.set(mediaBaseUrl, run);
  return run;
}
