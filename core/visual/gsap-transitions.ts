/**
 * How a transition between two beat clips is drawn on a gsap master timeline: a function body,
 * inlined into a page or run by a player, that puts tweens on `master`. `el` is the incoming beat
 * clip, `prev` the outgoing one (kept mounted for `d` seconds past the cut, or null), `t` the cut in
 * seconds, `d` the transition's length. Opacity, transform and clip-path only: the runtime owns
 * visibility. The four required names come first; the rest is a catalogue any engine that drives
 * gsap may register. The core keeps it because two engines draw `html-gsap` the same way; the
 * registry still decides which engine has which name.
 */
export const GSAP_TRANSITION_CATALOG: Record<string, string> = {
  cut: '',
  fade: "master.fromTo(el, { opacity: 0 }, { opacity: 1, duration: d, ease: 'power1.inOut' }, t);",
  slide: "master.fromTo(el, { yPercent: 100 }, { yPercent: 0, duration: d, ease: 'power3.out' }, t); if (prev) master.fromTo(prev, { yPercent: 0, opacity: 1 }, { yPercent: -18, opacity: 0.4, duration: d, ease: 'power3.out' }, t);",
  zoom: "master.fromTo(el, { opacity: 0, scale: 1.08 }, { opacity: 1, scale: 1, duration: d, ease: 'power2.out' }, t); if (prev) master.fromTo(prev, { scale: 1 }, { scale: 0.96, duration: d, ease: 'power2.out' }, t);",
  'slide-left': "master.fromTo(el, { xPercent: 100 }, { xPercent: 0, duration: d, ease: 'power3.out' }, t); if (prev) master.fromTo(prev, { xPercent: 0 }, { xPercent: -18, duration: d, ease: 'power3.out' }, t);",
  'slide-right': "master.fromTo(el, { xPercent: -100 }, { xPercent: 0, duration: d, ease: 'power3.out' }, t); if (prev) master.fromTo(prev, { xPercent: 0 }, { xPercent: 18, duration: d, ease: 'power3.out' }, t);",
  'push-up': "master.fromTo(el, { yPercent: 100 }, { yPercent: 0, duration: d, ease: 'power2.inOut' }, t); if (prev) master.fromTo(prev, { yPercent: 0 }, { yPercent: -100, duration: d, ease: 'power2.inOut' }, t);",
  'push-left': "master.fromTo(el, { xPercent: 100 }, { xPercent: 0, duration: d, ease: 'power2.inOut' }, t); if (prev) master.fromTo(prev, { xPercent: 0 }, { xPercent: -100, duration: d, ease: 'power2.inOut' }, t);",
  'wipe-left': "master.fromTo(el, { clipPath: 'inset(0 0 0 100%)' }, { clipPath: 'inset(0 0 0 0%)', duration: d, ease: 'power2.inOut' }, t);",
  'wipe-up': "master.fromTo(el, { clipPath: 'inset(100% 0 0 0)' }, { clipPath: 'inset(0% 0 0 0)', duration: d, ease: 'power2.inOut' }, t);",
  iris: "master.fromTo(el, { clipPath: 'circle(0% at 50% 50%)' }, { clipPath: 'circle(75% at 50% 50%)', duration: d, ease: 'power2.out' }, t);",
  blur: "master.fromTo(el, { opacity: 0, filter: 'blur(24px)' }, { opacity: 1, filter: 'blur(0px)', duration: d, ease: 'power2.out' }, t); if (prev) master.fromTo(prev, { filter: 'blur(0px)' }, { filter: 'blur(24px)', duration: d, ease: 'power2.in' }, t);",
  flip: "master.fromTo(el, { rotationY: -90, opacity: 0, transformPerspective: 1200 }, { rotationY: 0, opacity: 1, duration: d, ease: 'power2.out' }, t); if (prev) master.fromTo(prev, { rotationY: 0, transformPerspective: 1200 }, { rotationY: 90, opacity: 0, duration: d, ease: 'power2.in' }, t);",
};


/** The catalogue as a page's own JavaScript: one function per name, keyed by name. */
export function gsapTransitionCatalogScript(names: readonly string[] = Object.keys(GSAP_TRANSITION_CATALOG)): string {
  return `{ ${names.filter((n) => n in GSAP_TRANSITION_CATALOG).map((name) => `${JSON.stringify(name)}: function (master, el, prev, t, d) { ${GSAP_TRANSITION_CATALOG[name]} }`).join(', ')} }`;
}
