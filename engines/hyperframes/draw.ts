/** Small drawing helpers shared by the Hyperframes scene renderers. Pure, so they can be tested. */

export const MONO = "'JetBrains Mono', ui-monospace, Menlo, Consolas, monospace";

/** Ease-out cubic, the entrance curve every scene uses. */
export const easeOut = (t: number): number => 1 - Math.pow(1 - clamp01(t), 3);

export const clamp01 = (t: number): number => (t < 0 ? 0 : t > 1 ? 1 : t);

/** Linear ramp from 0 to 1 between two frames, clamped at both ends. */
export const ramp = (frame: number, from: number, to: number): number =>
  to <= from ? (frame >= to ? 1 : 0) : clamp01((frame - from) / (to - from));

/** Split text into lines that fit `maxWidth`, breaking on spaces. Long words are left intact. */
export function wrapText(measure: (s: string) => number, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  const lines: string[] = [];
  let line = words[0]!;
  for (const word of words.slice(1)) {
    const next = `${line} ${word}`;
    if (measure(next) <= maxWidth) line = next;
    else {
      lines.push(line);
      line = word;
    }
  }
  lines.push(line);
  return lines;
}

/** A rounded rectangle path, for the panels and badges the scenes draw. */
export function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

/** `#rrggbb` with an alpha, matching the Remotion scenes' helper so both engines share a palette. */
export function alpha(hex: string, a: number): string {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!m) return hex;
  return `rgba(${parseInt(m[1]!, 16)}, ${parseInt(m[2]!, 16)}, ${parseInt(m[3]!, 16)}, ${a})`;
}

/** Draw centred, wrapped text and return the height it occupied. */
export function centredText(
  ctx: CanvasRenderingContext2D,
  text: string,
  cx: number,
  top: number,
  maxWidth: number,
  lineHeight: number,
): number {
  const lines = wrapText((s) => ctx.measureText(s).width, text, maxWidth);
  lines.forEach((line, i) => ctx.fillText(line, cx, top + i * lineHeight));
  return lines.length * lineHeight;
}
