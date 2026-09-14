export type Project = { files: Record<string, string>; media: Record<string, string> };
export type Kind = 'block' | 'component';

/**
 * Where a project keeps its parts, the layout HyperFrames uses: a block is a whole scene under
 * `compositions/`, with its own size and length, played with the values its variables take; a
 * component is an elastic piece under `compositions/components/` that takes the box and the theme
 * tokens it is put in.
 */
const COMPONENTS_DIR = 'compositions/components/';
/** Frames are written per video by the Assemble node: not a part. */
const FRAMES = /^compositions\/frames\//;
export const kindOf = (file: string): Kind | null =>
  !/\.html?$/i.test(file) || FRAMES.test(file) ? null : file.startsWith(COMPONENTS_DIR) ? 'component' : file.startsWith('compositions/') ? 'block' : null;
export const pathFor = (kind: Kind, name: string): string => `${kind === 'component' ? COMPONENTS_DIR : 'compositions/'}${name}.html`;
export const nameOf = (path: string): string => path.split('/').pop()!.replace(/\.html?$/i, '');
export const PART_NAME = /^[a-z][a-z0-9-]{1,40}$/;

/**
 * What a part is for, so a storyboard's writer can find the one a frame needs. A block opens the film
 * (`hook`), shows what a product does (`feature`), backs it up (`proof`), closes (`outro`), or is some
 * other `scene`. A component is a `piece` of a scene, an `overlay` across the film, an `effect` drawn
 * over something to point at it, or a piece of an app's interface (`ui`).
 */
export const ROLES = {
  block: ['scene', 'hook', 'feature', 'proof', 'outro'],
  component: ['piece', 'overlay', 'effect', 'ui'],
} as const satisfies Record<Kind, readonly string[]>;
export type Role = (typeof ROLES)[Kind][number];

/** The Assemble node's settings, where the components that run across the film are listed. */
const ASSEMBLY_FILE = 'assemble.json';

/**
 * A part's role: the one its `<html data-role>` declares, else, for a component `assemble.json` lists
 * among its overlays, `overlay`, else the first of its kind.
 */
export function roleOf(files: Record<string, string>, path: string): Role {
  const kind = kindOf(path) ?? 'block';
  const roles: readonly string[] = ROLES[kind];
  const declared = attr(/<html\b[^>]*>/i.exec(files[path] ?? '')?.[0] ?? '', 'data-role');
  if (declared && roles.includes(declared)) return declared as Role;
  if (kind === 'component') {
    try {
      const config = JSON.parse(files[ASSEMBLY_FILE] ?? '{}') as { overlays?: { component?: string }[] };
      if (config.overlays?.some((o) => o.component === nameOf(path))) return 'overlay';
    } catch { /* an assemble.json that does not parse says nothing about roles */ }
  }
  return roles[0] as Role;
}

const attr = (tag: string, name: string) => new RegExp(`\\b${name}\\s*=\\s*(["'])([\\s\\S]*?)\\1`, 'i').exec(tag)?.[2];

/** What a part's own file says about it: its id, its variables, its size and length when it has them. */
export function readPart(html: string) {
  const root = /<template[^>]*>[\s\S]*?(<[a-z][^>]*\bdata-composition-id\s*=[^>]*>)/i.exec(html)?.[1] ?? /<[a-z][^>]*\bdata-composition-id\s*=[^>]*>/i.exec(html)?.[0] ?? '';
  let variables: { id: string; type: string; default?: unknown }[] = [];
  try { variables = JSON.parse(attr(html, 'data-composition-variables') ?? '[]'); } catch { variables = []; }
  return {
    id: attr(root, 'data-composition-id') ?? attr(html, 'data-composition-id') ?? '',
    variables: Array.isArray(variables) ? variables : [],
    width: attr(root, 'data-width'),
    height: attr(root, 'data-height'),
    duration: /\bdata-composition-duration\s*=\s*["']?([\d.]+)/i.exec(html)?.[1],
  };
}

/** The clip that mounts a part in `index.html`, to paste and then place and time. */
export function mountSnippet(path: string, html: string, frame: { width: number; height: number }): string {
  const part = readPart(html);
  return `<div class="clip" data-composition-id="${part.id}" data-composition-src="${path}" data-start="0" data-duration="${part.duration ?? 4}" data-track-index="1" data-width="${part.width ?? frame.width}" data-height="${part.height ?? frame.height}"></div>`;
}

/**
 * A new part to write from: the sub-composition contract HyperFrames mounts (a `<template>` whose
 * root carries the id, a script that registers one paused timeline under that id, variables read
 * through `getVariables`), styled from the theme tokens. A block paints its own frame at a fixed
 * size; a component paints nothing behind itself, sizes to its box in container units, and never clips
 * its root, so its glows and shadows can reach past the box.
 */
export function scaffoldPart(kind: Kind, name: string, frame: { width: number; height: number }, role?: Role): string {
  const block = kind === 'block';
  const root = block
    ? `<div id="root" data-composition-id="${name}" data-duration="4" data-width="${frame.width}" data-height="${frame.height}">`
    : `<div id="root" data-composition-id="${name}" data-duration="4">`;
  const rootStyle = block
    ? `#root { position: absolute; inset: 0; overflow: hidden; background: var(--bg, #ffffff); color: var(--fg, #111111); font-family: var(--font-body, system-ui, sans-serif); }
          .title { position: absolute; left: 8%; right: 8%; top: 42%; text-align: center; font-family: var(--font-display, system-ui, sans-serif); font-size: ${Math.round(frame.width / 11)}px; font-weight: 800; line-height: 1.05; }`
    : `#root { position: absolute; inset: 0; overflow: visible; container-type: size; color: var(--fg, #111111); font-family: var(--font-body, system-ui, sans-serif); pointer-events: none; }
          .title { position: absolute; inset: 0; display: grid; place-items: center; text-align: center; font-family: var(--font-display, system-ui, sans-serif); font-size: min(12cqw, 40cqh); font-weight: 800; line-height: 1.05; }`;
  return `<!doctype html>
<html
  lang="en"
  data-composition-id="${name}"
  data-composition-duration="4"${role && role !== ROLES[kind][0] ? `\n  data-role="${role}"` : ''}
  data-composition-variables='[
    { "id": "title", "type": "string", "label": "Title", "default": "${name}", "maxLength": 40 },
    { "id": "seconds", "type": "number", "label": "Length in seconds (the Assemble node gives it)", "default": 4 }
  ]'
>
  <!--
    ${name}, a ${kind} of this workflow.
    ${block ? 'A self-contained scene: it paints its whole frame and has its own size.' : 'An elastic piece: it paints only itself and fills the box it is mounted in.'}
    Styled from the theme tokens (--bg, --fg, --brand, --font-display, --font-body).
  -->
  <head>
    <meta charset="UTF-8" />
    <title>${name}</title>
  </head>
  <body>
    <template>
      ${root}
        <style>
          ${rootStyle}
        </style>
        <div class="title"></div>
        <script>
          (function () {
            var root = document.getElementById('root');
            var v = window.__hyperframes && window.__hyperframes.getVariables ? window.__hyperframes.getVariables() : {};
            var title = root.querySelector('.title');
            title.textContent = String(v.title == null ? '${name}' : v.title);
            var duration = Math.max(0.5, Number(v.seconds) || parseFloat(root.dataset.duration || '4'));
            var tl = gsap.timeline({ paused: true });
            tl.fromTo(title, { y: 40, opacity: 0 }, { y: 0, opacity: 1, duration: 0.6, ease: 'power3.out' }, 0)
              .set({}, {}, duration);
            tl.seek(0);
            window.__timelines = window.__timelines || {};
            window.__timelines['${name}'] = tl;
          })();
        </script>
      </div>
    </template>
  </body>
</html>
`;
}

/**
 * How a frame of STORYBOARD.md plays a block: its block line and its values, starting from the
 * block's defaults, to paste and rewrite. `seconds` is left out: the Assemble node gives it.
 */
export function storyboardSnippet(name: string, html: string): string {
  const values = Object.fromEntries(readPart(html).variables.filter((v) => v.id !== 'seconds').map((v) => [v.id, v.default]));
  return `- block: ${name}\n\n\`\`\`json\n${JSON.stringify(values, null, 2)}\n\`\`\``;
}
