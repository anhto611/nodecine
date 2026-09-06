/**
 * Drag-and-drop for a stage's layout, without a second data model (CORE_CONTRACTS §2.6): the
 * preview reports where each top-level element of the stage sits, the user drags a box, and the
 * numbers are written back into that element's own CSS rule. Whatever the code anchors to is kept:
 * a rule with `bottom` stays bottom-anchored, one with `left` and `right` keeps both, so the author's
 * intent survives the drag and the code stays readable.
 */

export interface Box { x: number; y: number; w: number; h: number }
export interface Frame { w: number; h: number }

/** One element the preview measured: the key names it in the code, the label is for the user. */
export interface MeasuredRect extends Box { key: string; label: string }

/** How an element is identified in code, from the key the measurement script built. */
export function selectorCandidates(key: string): string[] {
  if (key.startsWith('slot:')) { const n = key.slice(5); return [`[data-slot="${n}"]`, `[data-slot='${n}']`]; }
  if (key.startsWith('field:')) { const n = key.slice(6); return [`[data-field="${n}"]`, `[data-field='${n}']`]; }
  return [`.${key}`];
}

interface Rule { selector: string; body: string; start: number; end: number }

function rulesOf(css: string): Rule[] {
  const out: Rule[] = [];
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(css))) out.push({ selector: m[1]!.trim(), body: m[2]!, start: m.index, end: m.index + m[0].length });
  return out;
}

/** The rule that styles this element: its selector ends with one of the candidates. */
function findRule(rules: Rule[], key: string): Rule | undefined {
  const cands = selectorCandidates(key);
  return rules.find((r) => r.selector.split(',').some((sel) => { const s = sel.trim(); return cands.some((c) => s === c || s.endsWith(` ${c}`) || s.endsWith(`>${c}`) || s.endsWith(c)); }));
}

type Decl = { prop: string; value: string };
const parseDecls = (body: string): Decl[] => body.split(';').map((d) => d.trim()).filter(Boolean).map((d) => { const i = d.indexOf(':'); return { prop: d.slice(0, i).trim(), value: d.slice(i + 1).trim() }; });
const setDecl = (decls: Decl[], prop: string, value: string): void => { const d = decls.find((x) => x.prop === prop); if (d) d.value = value; else decls.push({ prop, value }); };
const dropDecl = (decls: Decl[], prop: string): void => { const i = decls.findIndex((x) => x.prop === prop); if (i >= 0) decls.splice(i, 1); };
const has = (decls: Decl[], prop: string): boolean => decls.some((x) => x.prop === prop && x.value !== 'auto');
const px = (n: number): string => `${Math.round(n)}px`;

/**
 * Writes a box into the element's rule. Horizontal: left+right stay a pair; right-only stays
 * right-anchored (width added when resized); otherwise left, with width when resized or already set.
 * Vertical likewise with top/bottom/height. `inset` shorthand is expanded first so it cannot fight.
 */
export function applyBoxToCode(code: string, key: string, box: Box, frame: Frame, opts: { resized?: boolean } = {}): string {
  const styleOpen = code.indexOf('<style');
  const styleStart = styleOpen >= 0 ? code.indexOf('>', styleOpen) + 1 : -1;
  const styleEnd = code.indexOf('</style>');
  const hasStyle = styleStart > 0 && styleEnd > styleStart;
  const css = hasStyle ? code.slice(styleStart, styleEnd) : '';
  const rules = rulesOf(css);
  const rule = findRule(rules, key);
  const decls = rule ? parseDecls(rule.body) : [];

  const inset = decls.find((d) => d.prop === 'inset');
  if (inset) {
    const parts = inset.value.split(/\s+/);
    const [t, r = t, b = t, l = r] = parts as [string, string?, string?, string?];
    dropDecl(decls, 'inset');
    setDecl(decls, 'top', t); setDecl(decls, 'right', r!); setDecl(decls, 'bottom', b!); setDecl(decls, 'left', l!);
  }
  if (!has(decls, 'position') || decls.find((d) => d.prop === 'position')!.value === 'static') setDecl(decls, 'position', 'absolute');

  const right = frame.w - (box.x + box.w);
  const bottom = frame.h - (box.y + box.h);
  if (has(decls, 'left') && has(decls, 'right')) { setDecl(decls, 'left', px(box.x)); setDecl(decls, 'right', px(right)); if (opts.resized) dropDecl(decls, 'width'); }
  else if (has(decls, 'right')) { setDecl(decls, 'right', px(right)); if (opts.resized || has(decls, 'width')) setDecl(decls, 'width', px(box.w)); }
  else { setDecl(decls, 'left', px(box.x)); if (opts.resized || has(decls, 'width')) setDecl(decls, 'width', px(box.w)); }
  if (has(decls, 'top') && has(decls, 'bottom')) { setDecl(decls, 'top', px(box.y)); setDecl(decls, 'bottom', px(bottom)); if (opts.resized) dropDecl(decls, 'height'); }
  else if (has(decls, 'bottom')) { setDecl(decls, 'bottom', px(bottom)); if (opts.resized || has(decls, 'height')) setDecl(decls, 'height', px(box.h)); }
  else { setDecl(decls, 'top', px(box.y)); if (opts.resized || has(decls, 'height')) setDecl(decls, 'height', px(box.h)); }

  const body = ' ' + decls.map((d) => `${d.prop}: ${d.value};`).join(' ') + ' ';
  if (rule) {
    const newCss = css.slice(0, rule.start) + `${rule.selector} {${body}}` + css.slice(rule.end);
    return code.slice(0, styleStart) + newCss + code.slice(styleEnd);
  }
  const selector = selectorCandidates(key)[0]!.startsWith('[') ? selectorCandidates(key)[0]! : `.stage ${selectorCandidates(key)[0]}`;
  const newRule = `  ${selector} {${body}}\n`;
  if (hasStyle) return code.slice(0, styleEnd) + newRule + code.slice(styleEnd);
  return `<style>\n${newRule}</style>\n${code}`;
}

/** Snap a frame-space box to the safe-zone lines and a 4px grid, so dragged layouts land cleanly. */
export function snapBox(box: Box, frame: Frame, zones: { left: number; right: number; top: number; bottom: number }, threshold = 12): Box {
  const linesX = [zones.left, frame.w - zones.right];
  const linesY = [zones.top, frame.h - zones.bottom];
  const grid = (n: number) => Math.round(n / 4) * 4;
  let { x, y } = box;
  const { w, h } = box;
  for (const lx of linesX) { if (Math.abs(x - lx) <= threshold) x = lx; else if (Math.abs(x + w - lx) <= threshold) x = lx - w; }
  for (const ly of linesY) { if (Math.abs(y - ly) <= threshold) y = ly; else if (Math.abs(y + h - ly) <= threshold) y = ly - h; }
  return { x: grid(x), y: grid(y), w: grid(w), h: grid(h) };
}
