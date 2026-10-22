import { COMPONENT_ROLES, declaredVariables, type BlockVariable } from '@/contracts/storyboard/blocks';
import { COMPOSITION_ENTRY } from '@/contracts/types/composition';
import { libraryComponentPath } from '@/contracts/types/library';

/**
 * What a forged component has to be before anything renders it: the sub-composition contract every
 * kit component keeps (a `<template>` whose root carries the component's name, one paused timeline
 * registered under that name, its values declared on `<html>`), and the rules the runtime holds a
 * seek-driven page to. Read off the text, so a component that breaks them goes back to its author
 * without a browser being started.
 */

const attr = (tag: string, name: string) => new RegExp(`\\b${name}\\s*=\\s*(["'])([\\s\\S]*?)\\1`, 'i').exec(tag)?.[2];
const escapeAttr = (value: string) => value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

/** The variables a forged component is asked to take. */
export interface WantedVariable {
  id: string;
  type: 'string' | 'number';
}

/** The text of the component's scripts, where the motion rules apply. */
const scriptsOf = (html: string): string => [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map((m) => m[1]!).join('\n');

/** A name used as a bare identifier, not as a property (`tl.duration`), a key (`duration:`), a string or an attribute (`data-duration`). */
const bareUse = (code: string, name: string) => new RegExp(`(?<![\\w$.'"-])${name}(?![\\w$'"-])(?!\\s*:)`).test(code);

/** Every problem with a component's text, one sentence each, written to be handed back to its author. */
export function componentProblems(html: string, name: string, wanted: WantedVariable[] = []): string[] {
  const problems: string[] = [];
  const template = /<template\b[^>]*>([\s\S]*?)<\/template>/i.exec(html)?.[1];
  if (template === undefined) problems.push('the component has no <template>: its root and its script go inside one');
  const root = /<[a-z][^>]*\bdata-composition-id\s*=[^>]*>/i.exec(template ?? '')?.[0];
  const id = root ? attr(root, 'data-composition-id') : undefined;
  if (!root) problems.push(`no root element inside <template> carries data-composition-id="${name}"`);
  else if (id !== name) problems.push(`the root's data-composition-id is "${id ?? ''}"; it must be "${name}"`);

  const htmlTag = /<html\b[^>]*>/i.exec(html)?.[0] ?? '';
  const role = attr(htmlTag, 'data-role');
  if (!role) problems.push(`<html> declares no data-role; give one of ${COMPONENT_ROLES.join(', ')}`);
  else if (!(COMPONENT_ROLES as readonly string[]).includes(role)) problems.push(`data-role="${role}" is not one of ${COMPONENT_ROLES.join(', ')}`);

  const hasDeclaration = /\bdata-composition-variables\s*=/i.test(htmlTag);
  const declared: BlockVariable[] = hasDeclaration ? declaredVariables(html) : [];
  if (!hasDeclaration) problems.push('<html> declares no data-composition-variables');
  for (const v of wanted) {
    const found = declared.find((d) => d.id === v.id);
    if (!found) problems.push(`the variable "${v.id}" is not declared in data-composition-variables (or its declaration does not parse)`);
    else if (found.type !== v.type) problems.push(`the variable "${v.id}" is declared as ${found.type}; it must be ${v.type}`);
  }

  const code = scriptsOf(template ?? html);
  if (!code.trim()) problems.push('the component has no script');
  if (!new RegExp(`__timelines\\s*\\[\\s*(['"])${name}\\1\\s*\\]\\s*=`).test(code)) problems.push(`the script does not register its timeline at window.__timelines['${name}']`);
  if (!/gsap\.timeline\(\s*\{[^}]*paused\s*:\s*true/.test(code)) problems.push('the timeline is not created paused: gsap.timeline({ paused: true })');
  if (/\bonUpdate\b|\bonStart\b|\bonComplete\b|\bonRepeat\b/.test(code))
    problems.push('the script relies on onUpdate/onStart/onComplete callbacks, which never run: the renderer seeks with events suppressed. Tween properties, attributes or a setter property instead');
  if (/\bMath\.random\b/.test(code)) problems.push('Math.random makes every render different: use a small seeded generator seeded from the values');
  if (/\b(setTimeout|setInterval|requestAnimationFrame)\b/.test(code)) problems.push('timers and requestAnimationFrame do not follow the timeline: put every change on the timeline');
  if (/\bDate\.now\b|\bperformance\.now\b|new Date\(/.test(code)) problems.push('the clock is not the timeline: read time only from the timeline');
  if (/\brepeat\s*:\s*-\s*1\b/.test(code)) problems.push('repeat: -1 never ends: derive a bounded repeat count from the duration');
  if (/\bletterSpacing\b|\bletter-spacing\b/.test(code)) problems.push('letterSpacing is a layout property and must not be animated');
  if (bareUse(code, 'duration') && !/typeof\s+duration\b/.test(code) && !/\b(?:var|let|const)\s+duration\b/.test(code))
    problems.push("a component has no `duration` variable: write typeof duration!=='undefined'?duration:<seconds>");
  if (/\p{Extended_Pictographic}/u.test(html)) problems.push('the component uses emoji, which the renderer has no font for: draw it instead');
  if (/<script\b[^>]*\bsrc\s*=/i.test(template ?? '')) problems.push('the component loads a script: GSAP is already on the page, and nothing else may be fetched');
  return problems;
}

/** The component with `<meta name="description">` saying what it is, which is what a storyboard writer reads. */
export function withDescription(html: string, description: string): string {
  const meta = `<meta name="description" content="${escapeAttr(description)}" />`;
  if (/<meta\b[^>]*\bname\s*=\s*["']description["'][^>]*>/i.test(html)) return html.replace(/<meta\b[^>]*\bname\s*=\s*["']description["'][^>]*>/i, meta);
  if (/<head\b[^>]*>/i.test(html)) return html.replace(/<head\b([^>]*)>/i, `<head$1>${meta}`);
  return html.replace(/<html\b([^>]*)>/i, `<html$1><head>${meta}</head>`);
}

/** A model's answer as the page itself: no code fence around it. */
export const unfenced = (html: string): string => (/^\s*```/.test(html) ? html.replace(/^\s*```[a-z]*\s*/i, '').replace(/```\s*$/, '') : html).trim();

/** The custom properties the film's shell sets, in the order written: the theme tokens a component wears. */
export function themeTokens(files: Record<string, string>): [string, string][] {
  const entry = files[COMPOSITION_ENTRY] ?? '';
  const styles = [...entry.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)].map((m) => m[1]!).join('\n');
  const found = new Map<string, string>();
  for (const [, key, value] of styles.matchAll(/(--[a-zA-Z0-9-]+)\s*:\s*([^;}]+)/g)) if (!found.has(key!)) found.set(key!, value!.trim());
  return [...found];
}

/** The film's own background, from its shell's `--bg`, else a dark grey. */
export const backgroundOf = (files: Record<string, string>): string => themeTokens(files).find(([k]) => k === '--bg')?.[1] ?? '#222';

/** How long a component plays when nothing mounts it: what it declares, else six seconds. */
export function componentSeconds(html: string): number {
  const declared = Number(/\bdata-composition-duration\s*=\s*["']?([\d.]+)/i.exec(html)?.[1] ?? /\bdata-duration\s*=\s*["']?([\d.]+)/i.exec(html)?.[1]);
  return Number.isFinite(declared) && declared > 0 ? declared : 6;
}

/** The values a still is drawn with: each variable's sample, else the one asked for, else its default. */
export function sampleValuesOf(html: string, samples: Record<string, unknown> = {}): Record<string, unknown> {
  const values: Record<string, unknown> = {};
  for (const v of declaredVariables(html) as (BlockVariable & { sample?: unknown })[]) {
    const value = v.sample ?? samples[v.id] ?? v.default;
    if (value !== undefined) values[v.id] = value;
  }
  return values;
}

/** The box a still is drawn in: the film's shape, its long side 960. */
export function stillBox(width: number, height: number): { width: number; height: number } {
  const long = 960;
  const even = (n: number) => Math.max(2, Math.round(n / 2) * 2);
  return width >= height ? { width: long, height: even((long * height) / width) } : { width: even((long * width) / height), height: long };
}

/**
 * A page that is the component alone, in a box of the film's shape over the film's background, wearing
 * the shell's theme tokens: the component's `<template>` taken off, so its root is the page's root and
 * its timeline the page's. A block's thumbnail is drawn the same way.
 */
export function stillPage(files: Record<string, string>, html: string, box: { width: number; height: number }, seconds: number): string {
  const { width, height } = box;
  const tokens = themeTokens(files)
    .map(([k, v]) => `${k}: ${v};`)
    .join(' ');
  let body = /<template\b[^>]*>([\s\S]*?)<\/template>/i.exec(html)?.[1] ?? '';
  // The page's root needs a size and a length of its own, as a block's does.
  body = body.replace(/<([a-z][a-z0-9]*)\b([^>]*\bdata-composition-id\s*=[^>]*)>/i, (_tag, el: string, rest: string) => {
    let attrs = rest;
    if (!/\bdata-width\s*=/.test(attrs)) attrs += ` data-width="${width}"`;
    if (!/\bdata-height\s*=/.test(attrs)) attrs += ` data-height="${height}"`;
    if (!/\bdata-start\s*=/.test(attrs)) attrs += ' data-start="0"';
    if (!/\bdata-duration\s*=/.test(attrs)) attrs += ` data-duration="${seconds}"`;
    return `<${el}${attrs}>`;
  });
  const htmlTag = /<html\b[^>]*>/i.exec(html)?.[0] ?? '<html lang="en">';
  const head = /<head\b[^>]*>([\s\S]*?)<\/head>/i.exec(html)?.[1] ?? '';
  return `<!doctype html>
${htmlTag}
<head>
${head}
<script src="gsap.min.js"></script>
<style>
  :root { ${tokens} }
  html, body { margin: 0; width: ${width}px; height: ${height}px; overflow: hidden; background: ${backgroundOf(files)}; }
  .nodecine-forge-box { position: absolute; inset: 0; container-type: size; color: var(--fg, #eee); font-family: var(--font-body, system-ui, sans-serif); }
</style>
</head>
<body>
<div class="nodecine-forge-box">
${body}
</div>
</body>
</html>`;
}

/** Where a forged component lives in the composition. */
export const componentPath = libraryComponentPath;
