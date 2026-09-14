import { STYLE_VARS } from './contract';

/**
 * What the style sheet is, spelled out for the model, and the lint that checks its answer.
 *
 * It lives in the core because two capsules need it: the Style node draws the sheet, and the
 * Illustrator draws scenes against it. One list for the prompt and one function for the check, so
 * the two can never disagree about what a style is.
 */

/** What the style sheet is and how it is written. */
export const STYLE_RULES = [
  'Answer with one CSS style sheet: no markup, no <style> tag, no @import, no url() to the network.',
  `Define these custom properties on .nc-scene: ${STYLE_VARS.map((v) => `--${v}`).join(', ')} — bg is the ground, fg the text on it, accent the one colour that pops, muted a quieter text, line a hairline. Give .nc-scene its ground (background: var(--bg)), its text colour and its body font there too: every scene sits on it.`,
  "Fonts: name a stack per variable. Bundled and safe: 'Comfortaa' (rounded, friendly, weights 300–700) and 'JetBrains Mono' (mono, 400/700/800). Otherwise use system stacks (system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif; Georgia, serif). Never a web font by name alone: a machine without it renders something else.",
  'Define a small set of reusable classes the scenes will be built from — a title, a paragraph, a card, a label, a big number, a list item, a panel — with sizes in px for this frame. Ten to twenty rules; the scenes add their own layout on top. Do not position them absolutely: where a thing sits is each scene\'s decision.',
  'Selectors are one class deep (.card, .card .label), never prefixed with .nc-scene: a scene overrides a shared class with the same selector, and the engine already makes scene rules win.',
  'Captions are drawn by the engine in a band with the class .nc-captions-default. Say where that band goes as numbers, in the "captions" field of your answer, not as CSS: the film\'s other drawings have to keep out of it, and a rule in this sheet is a number they cannot read. You may still style the class here — the face, the weight, the colour, a shadow, and --caption-on for the word being spoken — but never its position: no top, bottom, left, right, inset, position, transform or margin on it.',
  'Plain selectors, never !important, no :root (the sheet is scoped to the video frame; .nc-scene is the root of every scene).',
] as const;

export function lintStyleCss(css: string): { hard: string[]; soft: string[] } {
  const hard: string[] = [];
  const soft: string[] = [];
  if (/<\/?(style|html|body|head|div)\b/i.test(css)) hard.push('contains markup; only CSS belongs here');
  const missing = STYLE_VARS.filter((v) => !new RegExp(`--${v}\\s*:`).test(css));
  if (missing.length) hard.push(`does not define ${missing.map((v) => `--${v}`).join(', ')}`);
  if (/!important/.test(css)) soft.push('uses !important');
  if (/@import|url\(\s*["']?https?:/i.test(css)) soft.push('loads something from the network, which a render cannot');
  if (/:root\b/.test(css)) soft.push('uses :root, which the scope never reaches; put variables on .nc-scene');
  return { hard, soft };
}
