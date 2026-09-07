/**
 * When each item of a list appears (CORE_CONTRACTS §2.8), in seconds from the start of its scene.
 *
 * A fixed stagger shows every item in the first half second and the scene then stands still for
 * as long as the voice goes on — and the voice decides how long a scene is. The word timings the
 * Transcribe node produces say when the voice reaches each item, so the item can appear then:
 * motion that means something. Without timings the items are spread across the spoken part of
 * the scene, which already reads far better than a burst at the start. Ported from cutdown's
 * `shared/reveal.ts`, whose measurements on real jobs motivated it.
 */

export interface RevealWord { text: string; start: number }

export interface RevealOptions {
  /** The earliest an item may appear, from the scene start. */
  from?: number;
  /** Seconds kept clear at the end of the scene: an item shown there is never read. */
  tail?: number;
  /** Two items closer than this are pushed apart, so the eye catches both. */
  gap?: number;
}

/** Lower-case, punctuation gone, diacritics kept: Vietnamese words stay whole. */
const norm = (text: string): string => text.toLowerCase().replace(/[.,:;!?()[\]{}"'`…–—-]/g, ' ').replace(/\s+/g, ' ').trim();

/** The word of a label worth looking for: the longest, since function words recur everywhere and match the first sentence. */
export function keyword(label: string): string {
  const parts = norm(label).split(' ').filter(Boolean);
  return parts.reduce((a, b) => (b.length > a.length ? b : a), '');
}

/**
 * One time per label. Matching is a forward scan and deliberately not thorough: an item not
 * found keeps its evenly spread slot. Half a second early goes unnoticed; eight seconds of a
 * frozen frame does not.
 */
export function revealTimes(labels: string[], words: RevealWord[], sceneDuration: number, opts: RevealOptions = {}): number[] {
  const from = opts.from ?? 0.45;
  const tail = opts.tail ?? 0.6;
  const gap = opts.gap ?? 0.28;
  const last = Math.max(from, sceneDuration - tail);
  const round = (t: number) => Math.round(t * 1000) / 1000;
  const spread = labels.map((_, i) => round(labels.length === 1 ? from : from + ((last - from) * i) / (labels.length - 1)));
  if (words.length === 0) return spread;

  const spoken = words.map((w) => norm(w.text));
  const times: number[] = [];
  let at = 0;
  for (let i = 0; i < labels.length; i++) {
    const key = keyword(labels[i]!);
    let found = -1;
    if (key.length >= 2) {
      // Only forward from the previous item: the third cannot be said before the second, and a
      // search from the start would keep matching early words.
      for (let j = at; j < spoken.length; j++) {
        if (spoken[j] === key || spoken[j]!.includes(key)) { found = j; break; }
      }
    }
    if (found === -1) { times.push(spread[i]!); continue; }
    at = found + 1;
    times.push(words[found]!.start);
  }
  // Ascending, a minimum gap, inside the window: one match too far ahead must not put the next item before it.
  for (let i = 0; i < times.length; i++) {
    const floor = i === 0 ? from : times[i - 1]! + gap;
    if (times[i]! < floor) times[i] = floor;
    if (times[i]! > last) times[i] = last;
  }
  return times.map(round);
}

/** Reveal times for every list prop of a scene, by prop name. */
export function revealMap(props: Record<string, unknown>, words: RevealWord[], sceneDuration: number, opts?: RevealOptions): Record<string, number[]> {
  const out: Record<string, number[]> = {};
  for (const [name, value] of Object.entries(props)) {
    if (Array.isArray(value) && value.length) out[name] = revealTimes(value.map((v) => String(v)), words, sceneDuration, opts);
  }
  return out;
}

/**
 * The script-side helpers, as source: `nodecine.at(i, prop?)` is the i-th item's time, and
 * `nodecine.stagger(prop?)` is a gsap stagger function for a tween positioned at 0 in the scene.
 * Shared by the render document and the preview so a block's code runs the same in both.
 */
export const REVEAL_HELPERS = String.raw`
  var firstList = function (reveal) { var k = Object.keys(reveal || {}); return k.length ? k[0] : null; };
  var timesOf = function (reveal, name) { var key = name || firstList(reveal); return (key && reveal && reveal[key]) || []; };
  nodecine.at = function (i, name) { var t = timesOf(nodecine.reveal, name); return t[i] !== undefined ? t[i] : (t.length ? t[t.length - 1] : 0); };
  nodecine.stagger = function (name) { return function (i) { return nodecine.at(i, name); }; };
  // A number counts up to what the element already shows: same digits, same grouping, from zero.
  nodecine.count = function (target, vars) {
    var els = typeof target === 'string' ? Array.prototype.slice.call(nodecine.root.querySelectorAll(target)) : [].concat(target);
    var tl = gsap.timeline();
    els.forEach(function (el) {
      var text = el.textContent || '';
      var m = text.match(/-?[0-9][0-9.,]*/);
      if (!m) return;
      var raw = m[0];
      var decimals = (raw.split('.')[1] || '').length;
      var grouped = raw.indexOf(',') >= 0;
      var end = parseFloat(raw.replace(/,/g, ''));
      if (!isFinite(end)) return;
      var o = { v: 0 };
      tl.to(o, Object.assign({ v: end, duration: 1.2, ease: 'power2.out' }, vars || {}, { onUpdate: function () {
        var n = decimals ? o.v.toFixed(decimals) : String(Math.round(o.v));
        if (grouped) n = Number(n).toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
        el.textContent = text.replace(raw, n);
      } }), 0);
    });
    return tl;
  };
`;
