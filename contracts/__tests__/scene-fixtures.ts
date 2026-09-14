import type { Style } from '../types/payloads';

/** A small style every test can share: the variables every scene relies on, and one card class. */
export const STYLE: Style = {
  name: 'Dark',
  css: [
    ".nc-scene { --bg: #0b0c10; --fg: #f0f3f6; --accent: #7c5cff; --muted: #9aa3ad; --line: #2a2f3a; --font-display: 'JetBrains Mono', monospace; --font-body: 'Comfortaa', system-ui, sans-serif; background: var(--bg); color: var(--fg); font-family: var(--font-body); }",
    '.title { font: 800 88px/1.05 var(--font-display); }',
    '.card { position: absolute; left: 72px; right: 168px; top: 320px; padding: 48px; border: 1px solid var(--line); border-radius: 24px; }',
  ].join('\n'),
  // Low in the frame, the way a film agrees it: everything above is free.
  captions: { left: 96, right: 96, bottom: 150, size: 46 },
};

/** A drawn scene: a title, a paragraph, a caption slot of its own, and a script. */
export const SCENE_SOURCE = '<div class="card"><h1 class="title">Hello</h1><p>First</p></div>\n<div class="captions" data-slot="captions"></div>\n<style>\n  .captions { position: absolute; left: 72px; right: 168px; bottom: 720px; }\n</style>\n<script>\n  nodecine.timeline(gsap.timeline().fromTo(".card", { opacity: 0 }, { opacity: 1, duration: 0.6 }));\n</script>';
/** A drawn scene with no caption slot, a fact-bound number and a var. */
export const FACT_SOURCE = '<div class="card"><span data-var="channel"></span><h1 class="title" data-fact="stars">999</h1></div>';
