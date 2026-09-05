/**
 * The `quote-cards/ink` theme: paper rather than terminal, so the two videos do not look alike even
 * when they share an engine. Serif type, warm light ground, one accent the model chooses.
 */
export const SERIF = "Georgia, 'Iowan Old Style', 'Times New Roman', serif";
export const SANS = "'JetBrains Mono', ui-monospace, Menlo, Consolas, monospace";
export const BG = '#f4f1ea';
export const BG_2 = '#ece7dc';
export const INK = '#1c1a17';
export const INK_2 = '#5b554b';
export const RULE = '#d6cfc0';

/** Slightly translucent version of a #rrggbb colour. */
export const alpha = (hex: string, a: number): string => {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!m) return hex;
  return `rgba(${parseInt(m[1]!, 16)}, ${parseInt(m[2]!, 16)}, ${parseInt(m[3]!, 16)}, ${a})`;
};
