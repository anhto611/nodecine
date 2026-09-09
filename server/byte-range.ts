/**
 * A `Range: bytes=…` header as an inclusive slice of a file (RFC 9110 §14.1.2).
 *
 * Ranges are the whole point for video. Without them a `<video>` asking for `bytes=0-` is answered
 * `200` with the entire file, so the browser must download every byte before it can play or seek —
 * and a preview holding seven 1080p clips opens seven such downloads at once, hits the browser's
 * six-connection-per-host limit and stalls: the first scene loops with no voice and no captions
 * until the last clip lands, then everything is suddenly fine. Answering `206` with the slice asked
 * for makes the same preview start at once.
 *
 * Pure, so the header parsing can be tested without a server: it is the part that fails silently.
 */
export function byteRange(header: string | null, size: number): { start: number; end: number } | 'unsatisfiable' | null {
  if (!header) return null;
  // One range only. A player asks for one; several would need multipart/byteranges, which no video
  // element sends and which is not worth writing for a preview.
  const m = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!m || (!m[1] && !m[2])) return null;
  const [, from, to] = m;
  // "bytes=-500" is the LAST 500 bytes — how a player reads an MP4's index — not a range from zero.
  const start = from ? Number(from) : Math.max(0, size - Number(to));
  const end = from ? (to ? Math.min(Number(to), size - 1) : size - 1) : size - 1;
  if (!Number.isFinite(start) || !Number.isFinite(end) || start > end || start >= size) return 'unsatisfiable';
  return { start, end };
}
