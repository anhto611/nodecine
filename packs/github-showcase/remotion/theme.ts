/** Shared look of the `github-showcase/developer-dark` theme (spec §4). */
export const MONO = "'JetBrains Mono', ui-monospace, Menlo, Consolas, monospace";
export const BG = '#0b0c10';
export const BG_2 = '#101218';
export const PANEL = '#14161c';
export const LINE = '#2a2e37';
export const TX = '#f2f3f5';
export const TX_2 = '#9aa0ab';
export const TX_3 = '#5f6570';

export const formatStars = (n: number): string => n.toLocaleString('en-US');

/** Slightly translucent version of a #rrggbb colour. */
export const alpha = (hex: string, a: number): string => {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!m) return hex;
  return `rgba(${parseInt(m[1]!, 16)}, ${parseInt(m[2]!, 16)}, ${parseInt(m[3]!, 16)}, ${a})`;
};
