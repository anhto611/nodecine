import { CONTENT_KEYS, type ContentKey, type Plate, type PlateSheet, type SceneContent } from '../types/payloads';
import { EMPH_CLASS } from './contract';
import { esc } from './scene-markup';

/**
 * The one phrase a line leans on, as the script marks it: `*like this*`.
 *
 * The screenwriter is asked for it (`CONTENT_GUIDE.title`) and the Illustrator used to turn it into
 * markup while drawing the scene. Nothing did after the Illustrator went, so the asterisks went on
 * screen exactly as typed. It belongs here: this is the one place a person's words become markup.
 *
 * Run after escaping, on escaped text, so a phrase containing `<` is still safe.
 */
const emphasise = (escaped: string): string =>
  escaped.replace(/\*([^*\n]{1,120}?)\*/g, (_m, inner: string) => `<em class="${EMPH_CLASS}">${inner}</em>`);

/**
 * Plates: a drawing made once, filled many times.
 *
 * The Illustrator draws every scene of every film from scratch, which is the most expensive step in
 * the pipeline and the reason two films of one workflow never look alike. A plate moves that work
 * forward in time: the model draws one layout per shape of content, and from then on a scene is
 * filled into it by this file, with no model anywhere.
 *
 * Pure on purpose. Same scene and same plate give the same markup, byte for byte, on every run.
 */

/**
 * What shape of content a scene is: its keys, in the vocabulary's own order.
 *
 * The order is the vocabulary's, not the object's, because a scene written today and the same scene
 * read back from disk enumerate their keys in whatever order they were built — and a signature that
 * depends on that would ask for two plates for one shape.
 */
export function signatureOf(content: SceneContent): ContentKey[] {
  return CONTENT_KEYS.filter((k) => {
    const v = (content as Record<string, unknown>)[k];
    return Array.isArray(v) ? v.length > 0 : v !== undefined && v !== '';
  });
}

/** The signature as one string, for looking a plate up and for naming one in a message. */
export const signatureKey = (keys: readonly ContentKey[]): string => keys.join('+');

/** A rectangle as one string, so two poses that give the same one are the same question. */
export type Box = { x: number; y: number; width: number; height: number };
const boxKey = (b?: Box): string => (b ? `@${b.x},${b.y},${b.width},${b.height}` : '');

/**
 * What a plate answers for: a shape of content drawn to fit one rectangle.
 *
 * The rectangle and not the pose's name. A layout is drawn to fit a box (§6.1), so two poses that
 * give the same box want the same drawing — keyed by name, a form whose poses differ only in where
 * the device stands buys the same layout three times and gets three near-misses.
 */
export const shapeKey = (keys: readonly ContentKey[], box?: Box): string => `${keys.join('+')}${boxKey(box)}`;
const ofPlate = (p: Plate): string => shapeKey([...p.keys].sort((a, b) => CONTENT_KEYS.indexOf(a) - CONTENT_KEYS.indexOf(b)), p.box);

/** The plate that draws this shape in this box, or nothing. */
export function plateFor(sheet: PlateSheet, content: SceneContent, box?: Box): Plate | undefined {
  const wanted = shapeKey(signatureOf(content), box);
  return sheet.plates.find((p) => ofPlate(p) === wanted);
}

const SELF_CLOSING = (key: string) => new RegExp(`<(img|source)\\b[^>]*\\bdata-slot=["']${key}["'][^>]*>`, 'i');

/**
 * Where a value goes: the element carrying `data-slot="<key>"`, and what lies between its tags.
 *
 * The closing tag is found by counting, not by taking the first one: a list's hole is a container
 * with a row inside it, and a row is usually the same tag as the container. Reading to the first
 * `</div>` ends the hole at the row's own close, drops the rest of the layout, and leaves a stray
 * closing tag behind — which is what a plate with a grid of tiles does on its very first fill.
 */
function slotAt(source: string, key: string): { open: string; inner: string; from: number; to: number } | null {
  const head = new RegExp(`<([a-z0-9-]+)[^>]*\\bdata-slot=["']${key}["'][^>]*>`, 'i').exec(source);
  if (!head) return null;
  const scan = new RegExp(`<(/?)${head[1]!}\\b[^>]*>`, 'gi');
  scan.lastIndex = head.index + head[0].length;
  for (let depth = 1, m = scan.exec(source); m; m = scan.exec(source)) {
    depth += m[1] ? -1 : 1;
    if (depth === 0) return { open: head[0], inner: source.slice(head.index + head[0].length, m.index), from: head.index, to: m.index };
  }
  return null;
}

/** One item of a list, repeated: the first child marked `data-item` is the row, the rest is dropped. */
function repeat(inner: string, items: string[]): string {
  const row = /<([a-z0-9-]+)[^>]*\bdata-item\b[^>]*>[\s\S]*?<\/\1>/i.exec(inner);
  if (!row) return items.map((t) => `<li>${esc(t)}</li>`).join('');
  return items.map((t) => row[0].replace(/(>)([\s\S]*?)(<\/[a-z0-9-]+>$)/i, (_m, open: string, _old: string, close: string) => `${open}${emphasise(esc(t))}${close}`)).join('');
}

/**
 * One scene, drawn: the plate's markup with this scene's words in its holes.
 *
 * A hole the scene has nothing for keeps whatever the plate drew in it, so a plate may carry its own
 * placeholder and a half-written scene still renders. Text is escaped here and nowhere else: a plate
 * is HTML the model wrote, but the words in it are the user's.
 */
export function fillPlate(plate: Plate, content: SceneContent): string {
  let out = plate.source;
  for (const key of plate.keys) {
    const value = (content as Record<string, unknown>)[key];
    if (value === undefined || value === '') continue;
    if (key === 'image' || key === 'clip') {
      out = out.replace(SELF_CLOSING(key), (tag) => tag.replace(/\bsrc=["'][^"']*["']/i, `src="${esc(String(value))}"`));
      continue;
    }
    const slot = slotAt(out, key);
    if (!slot) continue;
    const filled = Array.isArray(value) ? repeat(slot.inner, value as string[]) : emphasise(esc(String(value)));
    out = out.slice(0, slot.from + slot.open.length) + filled + out.slice(slot.to);
  }
  return out;
}

/**
 * Every scene with the arrangement it is laid out in.
 *
 * A scene that names a pose keeps it; the rest take the form's poses in turn, so consecutive scenes
 * sit differently without anybody deciding scene by scene. Cutdown does the same with its tones: a
 * script that says nothing still gets a film that moves.
 */
export function posed<T extends { pose?: string }>(scenes: readonly T[], poses: readonly string[]): (T & { pose?: string })[] {
  if (!poses.length) return scenes.map((s) => ({ ...s, pose: undefined }));
  return scenes.map((s, i) => ({ ...s, pose: s.pose && poses.includes(s.pose) ? s.pose : poses[i % poses.length]! }));
}

/** Which shapes a script needs drawn, each once: the work a plate maker has to do. */
export function signaturesOf(scenes: { content: SceneContent; box?: Box }[]): { keys: ContentKey[]; box?: Box }[] {
  const seen = new Map<string, { keys: ContentKey[]; box?: Box }>();
  for (const s of scenes) {
    const keys = signatureOf(s.content);
    if (keys.length) seen.set(shapeKey(keys, s.box), { keys, ...(s.box ? { box: s.box } : {}) });
  }
  return [...seen.values()];
}
