/**
 * A name a browser can save a download under.
 *
 * The file on disk is named by its hash, so this name only ever travels in a `download` attribute —
 * it need not be ASCII, and stripping it to ASCII would be wrong in an app whose users write
 * Vietnamese: `phụ đề của tôi` came back as `ph-c-a-t-i`. So only what a filesystem or a header
 * genuinely refuses is removed: the set Windows reserves, and the control characters. Spelled out
 * character by character rather than as a regex class, where one stray hyphen makes a range that
 * silently eats digits.
 */
const RESERVED = new Set(['<', '>', ':', '"', '/', '\\', '|', '?', '*']);
const forbidden = (c: string): boolean => RESERVED.has(c) || (c.codePointAt(0) ?? 0) < 0x20;

export function safeFileName(name: string, fallback: string, extension?: string): string {
  const cleaned = [...name]
    .map((c) => (forbidden(c) ? ' ' : c))
    .join('')
    .replace(/\s+/g, ' ')
    // A leading dot hides the file; a trailing dot or space is refused on Windows.
    .replace(/^[.\s]+|[.\s]+$/g, '')
    .slice(0, 80)
    .trim();
  const base = cleaned || fallback;
  return extension ? `${base}.${extension}` : base;
}
