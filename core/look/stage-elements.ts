/**
 * Adding, removing and relabelling elements of a stage without writing code (CORE_CONTRACTS §2.6):
 * a text, a shape or an image is one leaf element plus one CSS rule, inserted the way a person
 * would write them — inside the stage root, before the script — so what the layout editor adds
 * reads like the rest of the file.
 */

const ROOT_CLOSE = (code: string): { head: string; tail: string; at: number } => {
  const scriptAt = code.indexOf('<script');
  const head = scriptAt >= 0 ? code.slice(0, scriptAt) : code;
  const tail = scriptAt >= 0 ? code.slice(scriptAt) : '';
  return { head, tail, at: head.lastIndexOf('</div>') };
};

/** `text`, `text-2`, `text-3`… — the first class name not yet in the code. */
export function nextClass(code: string, base: string): string {
  let name = base;
  for (let i = 2; new RegExp(`class=["'][^"']*\\b${name}\\b`).test(code) || new RegExp(`\\.${name}\\b`).test(code); i++) name = `${base}-${i}`;
  return name;
}

function insertRule(code: string, rule: string): string {
  const end = code.indexOf('</style>');
  return end >= 0 ? code.slice(0, end) + rule + code.slice(end) : `<style>\n${rule}</style>\n${code}`;
}

function insertElement(code: string, el: string): string {
  const { head, tail, at } = ROOT_CLOSE(code);
  return (at >= 0 ? head.slice(0, at) + el + head.slice(at) : head + el) + tail;
}

const esc = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export function addTextToCode(code: string, text: string): { code: string; cls: string } {
  const cls = nextClass(code, 'text');
  const rule = `  .stage .${cls} { position: absolute; left: 72px; right: 168px; top: 1000px; font: 500 36px/1.35 var(--font-body); color: var(--fg); }\n`;
  return { code: insertElement(insertRule(code, rule), `  <div class="${cls}">${esc(text)}</div>\n`), cls };
}

export function addShapeToCode(code: string): { code: string; cls: string } {
  const cls = nextClass(code, 'shape');
  const rule = `  .stage .${cls} { position: absolute; left: 72px; top: 900px; width: 240px; height: 8px; border-radius: 4px; background: var(--accent); }\n`;
  return { code: insertElement(insertRule(code, rule), `  <div class="${cls}"></div>\n`), cls };
}

export function addImageToCode(code: string, src: string): { code: string; cls: string } {
  if (!/^\/api\/assets\/[a-f0-9]{16,64}\.[a-z0-9]+$/.test(src)) throw new Error('not an asset url');
  const cls = nextClass(code, 'image');
  const rule = `  .stage .${cls} { position: absolute; left: 72px; top: 120px; width: 160px; height: auto; object-fit: contain; }\n`;
  return { code: insertElement(insertRule(code, rule), `  <img class="${cls}" src="${src}" alt="">\n`), cls };
}

/** The element whose first class is `cls`: start, end (balanced), tag, inner text. */
function findElement(code: string, cls: string): { start: number; end: number; tag: string; open: string; inner: string } | null {
  const openRe = new RegExp(`<([a-zA-Z][\\w-]*)\\b[^>]*\\bclass=["']${cls}(?:\\s[^"']*)?["'][^>]*>`);
  const m = openRe.exec(code);
  if (!m) return null;
  const tag = m[1]!;
  const start = m.index;
  const openEnd = start + m[0].length;
  if (/\/>$/.test(m[0]) || /^(img|br|hr|input|source)$/i.test(tag)) return { start, end: openEnd, tag, open: m[0], inner: '' };
  // Walk to the matching close, counting nested tags of the same name.
  const re = new RegExp(`<(/?)${tag}\\b[^>]*>`, 'g');
  re.lastIndex = openEnd;
  let depth = 1;
  let x: RegExpExecArray | null;
  while ((x = re.exec(code))) {
    depth += x[1] === '/' ? -1 : 1;
    if (depth === 0) return { start, end: x.index + x[0].length, tag, open: m[0], inner: code.slice(openEnd, x.index) };
  }
  return null;
}

/** Removes the element and the rule written for it; a line left blank goes too. */
export function removeElementFromCode(code: string, cls: string): string {
  const el = findElement(code, cls);
  let out = el ? code.slice(0, el.start) + code.slice(el.end) : code;
  out = out.replace(new RegExp(`[ \\t]*\\.stage \\.${cls}\\s*\\{[^}]*\\}\\n?`), '');
  return out.replace(/\n[ \t]+\n/g, '\n');
}

/** The text a leaf element shows, or null when it is not a text element (has children, or is empty by design). */
export function elementTextOf(code: string, cls: string): string | null {
  const el = findElement(code, cls);
  if (!el || /<[a-zA-Z]/.test(el.inner)) return null;
  if (/data-(slot|field)=/.test(el.open)) return null;
  return el.inner.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').trim();
}

export function setElementText(code: string, cls: string, text: string): string {
  const el = findElement(code, cls);
  if (!el) return code;
  const openEnd = el.start + el.open.length;
  return code.slice(0, openEnd) + esc(text) + code.slice(el.end - `</${el.tag}>`.length);
}

export type ElementKind = 'slot' | 'captions' | 'field' | 'image' | 'text' | 'shape' | 'other';

/** What an element is, from its markup: slots and fields are the engine's, the rest is decoration. */
export function elementKindOf(code: string, cls: string): ElementKind {
  const el = findElement(code, cls);
  if (!el) return 'other';
  if (/data-slot=["']content["']/.test(el.open)) return 'slot';
  if (/data-slot=["']captions["']/.test(el.open)) return 'captions';
  if (/data-field=/.test(el.open)) return 'field';
  if (/^img$/i.test(el.tag)) return 'image';
  if (el.inner.trim() && !/<[a-zA-Z]/.test(el.inner)) return 'text';
  if (!el.inner.trim()) return 'shape';
  return 'other';
}

/** The scene field an element draws (`data-field="name"`), or null. */
export function fieldNameOf(code: string, cls: string): string | null {
  const el = findElement(code, cls);
  const m = el ? /data-field=["']([^"']+)["']/.exec(el.open) : null;
  return m ? m[1]! : null;
}

/** Removes the element that draws a scene field, with its rule, wherever it is in the markup. */
export function removeFieldFromCode(code: string, name: string): string {
  const m = new RegExp(`<([a-zA-Z][\\w-]*)\\b[^>]*\\bdata-field=["']${name}["'][^>]*>`).exec(code);
  if (!m) return code;
  const clsMatch = /\bclass=["']([^"'\s]+)/.exec(m[0]);
  if (clsMatch) return removeElementFromCode(code, clsMatch[1]!);
  // No class: drop the element by its own open/close pair.
  const tag = m[1]!;
  const closeAt = code.indexOf(`</${tag}>`, m.index + m[0].length);
  const end = closeAt >= 0 ? closeAt + `</${tag}>`.length : m.index + m[0].length;
  return (code.slice(0, m.index) + code.slice(end)).replace(/\n[ \t]+\n/g, '\n');
}

/**
 * The catalogue of things a stage may carry (CORE_CONTRACTS §2.6). A stage is not a free canvas:
 * every element has a role the rest of the system understands — the screenwriter writes into the
 * scene fields, the engine fills the slots, the captions node targets the captions slot — so the
 * user picks a role and styles it, rather than inventing elements the pipeline cannot use.
 * The class name is the role id, which is how the code and the catalogue recognise each other.
 */
export interface StageRole {
  id: string;
  kind: ElementKind;
  /** Required on every stage; cannot be removed. */
  required?: boolean;
  /** For `field` roles: what the screenwriter is told to write. */
  fieldRule?: string;
  /** For `text` roles: the words to start with (the user edits them). */
  defaultText?: string;
  /** Markup for the element (without the class, which is the role id) and its rule body. */
  markup: (attrs: string) => string;
  css: string;
}

export const STAGE_ROLES: StageRole[] = [
  { id: 'content', kind: 'slot', required: true, markup: (a) => `<div ${a} data-slot="content"></div>`, css: 'position: absolute; left: 72px; right: 168px; top: 260px; bottom: 680px; display: flex; flex-direction: column; justify-content: center;' },
  { id: 'captions', kind: 'captions', markup: (a) => `<div ${a} data-slot="captions" data-caption-style="karaoke"></div>`, css: 'position: absolute; left: 72px; right: 168px; bottom: 720px; text-align: center; font: 700 44px/1.3 var(--font-body); color: color-mix(in srgb, var(--fg) 85%, transparent); text-shadow: 0 2px 10px color-mix(in srgb, var(--bg) 70%, transparent); --caption-on: var(--accent);' },
  { id: 'kicker', kind: 'field', fieldRule: 'two or three words naming what the scene is about, uppercase, shown small above the content', markup: (a) => `<div ${a} data-field="kicker"></div>`, css: 'position: absolute; left: 72px; top: 200px; font: 600 28px/1 var(--font-body); letter-spacing: .16em; text-transform: uppercase; color: var(--accent);' },
  { id: 'source', kind: 'field', fieldRule: 'where the fact or quote on screen comes from, short, or empty when there is none', markup: (a) => `<div ${a} data-field="source"></div>`, css: 'position: absolute; left: 72px; right: 168px; bottom: 700px; font: 400 24px/1.3 var(--font-body); color: var(--muted);' },
  { id: 'signature', kind: 'text', defaultText: '@yourchannel', markup: (a) => `<div ${a}></div>`, css: 'position: absolute; right: 168px; top: 200px; font: 600 26px/1 var(--font-body); letter-spacing: .06em; color: var(--muted);' },
  { id: 'logo', kind: 'image', markup: (a) => `<img ${a} alt="">`, css: 'position: absolute; left: 72px; top: 120px; width: 140px; height: auto; object-fit: contain;' },
  { id: 'rule', kind: 'shape', markup: (a) => `<div ${a}></div>`, css: 'position: absolute; left: 72px; right: 168px; bottom: 640px; height: 2px; background: var(--line);' },
];

export const roleOf = (cls: string): StageRole | undefined => STAGE_ROLES.find((r) => r.id === cls);

/** Roles present in the code, by their class. */
export function rolesIn(code: string): string[] {
  return STAGE_ROLES.filter((r) => new RegExp(`class=["']${r.id}(?:\\s|["'])`).test(code)).map((r) => r.id);
}

/**
 * Adds a role's element and rule to the code. `text` seeds a text role, `src` an image role. The
 * caller declares the scene field for a `field` role (the definition is not the code's business).
 */
export function addRoleToCode(code: string, roleId: string, o: { text?: string; src?: string } = {}): string {
  const role = roleOf(roleId);
  if (!role) throw new Error(`unknown stage role ${roleId}`);
  if (rolesIn(code).includes(roleId)) return code;
  if (role.kind === 'image') {
    if (!o.src || !/^\/api\/assets\/[a-f0-9]{16,64}\.[a-z0-9]+$/.test(o.src)) throw new Error('an image role needs an asset url');
  }
  const attrs = `class="${role.id}"${role.kind === 'image' ? ` src="${o.src}"` : ''}`;
  let el = role.markup(attrs);
  if (role.kind === 'text') el = el.replace('></div>', `>${esc(o.text ?? role.defaultText ?? '')}</div>`);
  const rule = `  .stage .${role.id} { ${role.css} }\n`;
  return insertElement(insertRule(code, rule), `  ${el}\n`);
}
