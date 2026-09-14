import type { Style } from '../types/payloads';

/** A small style every test can share: the variables every scene relies on, and one card class. */
export const STYLE: Style = {
  name: 'Dark',
  css: [
    ".nc-scene { --bg: #0b0c10; --fg: #f0f3f6; --accent: #7c5cff; --muted: #9aa3ad; --line: #2a2f3a; --font-display: 'JetBrains Mono', monospace; --font-body: 'Comfortaa', system-ui, sans-serif; background: var(--bg); color: var(--fg); font-family: var(--font-body); }",
    '.title { font: 800 88px/1.05 var(--font-display); }',
    '.card { position: absolute; left: 72px; right: 168px; top: 320px; padding: 48px; border: 1px solid var(--line); border-radius: 24px; }',
  ].join('\n'),
  // Low in the frame, the way a film agrees it (CORE_CONTRACTS §2.6): everything above is free.
  captions: { left: 96, right: 96, bottom: 150, size: 46 },
};

/** A drawn scene: a title, a paragraph, a caption slot of its own, and a script. */
export const SCENE_SOURCE = '<div class="card"><h1 class="title">Hello</h1><p>First</p></div>\n<div class="captions" data-slot="captions"></div>\n<style>\n  .captions { position: absolute; left: 72px; right: 168px; bottom: 720px; }\n</style>\n<script>\n  nodecine.timeline(gsap.timeline().fromTo(".card", { opacity: 0 }, { opacity: 1, duration: 0.6 }));\n</script>';
/** A drawn scene with no caption slot, a fact-bound number and a var. */
export const FACT_SOURCE = '<div class="card"><span data-var="channel"></span><h1 class="title" data-fact="stars">999</h1></div>';

/** An Illustrator node for a test graph. */
export const illustratorNode = (id = 'illustrator', params: { brief?: string; frame?: string; character?: string } = {}) => ({
  id,
  type: 'core/illustrator',
  params: { llmProvider: 'claude-code', brief: '', frame: '9:16', character: '', ...params },
  bypassed: false,
  position: { x: 0, y: 0 },
});

/** The words of a scene's content, the way a good answer writes them into the markup, plus the elements the rules ask for. */
function fakeScene(prompt: string): string {
  const lines = prompt.split('\n');
  const parts: string[] = [];
  for (const l of lines) {
    const m = /^\s*(?:- |\d+\. )([a-z]+): (.*?)(?: — bound to verified data "([^"]+)": data-fact="([^"]+)")?$/.exec(l);
    if (!m) continue;
    const [, key, raw, , fact] = m;
    const attr = fact ? ` data-fact="${fact}"` : '';
    const token = /write src="(asset:[^"]+)"/.exec(raw!)?.[1];
    if (token) { parts.push(`<${key === 'clip' ? 'video' : 'img'} src="${token}"${attr}>`); continue; }
    let v: unknown;
    try { v = JSON.parse(raw!); } catch { v = raw; }
    if (Array.isArray(v)) parts.push(`<ul data-key="${key}">${v.map((x) => `<li>${String(x)}</li>`).join('')}</ul>`);
    else parts.push(`<div data-key="${key}"${attr}>${String(v)}</div>`);
  }
  const character = /data-var="character"/.test(prompt) ? '<img data-var="character" alt="">' : '';
  return `<div class="card">${parts.join('')}${character}</div>\n<script>\n  nodecine.timeline(gsap.timeline().fromTo(".card", { opacity: 0 }, { opacity: 1, duration: 0.5 }));\n</script>`;
}

/**
 * A plate for a shape: one hole per key the prompt names, with a placeholder, and a list's row
 * marked so whoever fills it can repeat it. What a good answer to the plate prompt looks like.
 */
export function fakePlate(prompt: string): { source: string; budget: Record<string, number> } {
  const keys = (/The shape is these content keys, and only these: (.+)\./.exec(prompt)?.[1] ?? '').split(', ').filter(Boolean);
  const hole = (k: string) =>
    k === 'points' || k === 'entries'
      ? `<div class="list" data-slot="${k}"><p data-item>một dòng</p></div>`
      : `<div class="${k}" data-slot="${k}">${k}</div>`;
  return {
    source: `<div class="card">${keys.map(hole).join('')}</div>\n<script>\n  nodecine.timeline(gsap.timeline().fromTo(".card", { opacity: 0 }, { opacity: 1, duration: 0.5 }));\n</script>`,
    budget: Object.fromEntries(keys.map((k) => [k, 80])),
  };
}

/**
 * A fake model for the nodes that draw: the style prompt gets `style` back, a plate prompt gets a
 * layout with a hole per key, a scene prompt a fragment carrying the content the prompt lists, and
 * a spanning prompt a thing that fits the lane. Any other prompt falls through to `other`.
 */
export function illustratorAnswers(style: Style = STYLE, other?: (prompt: string) => Promise<unknown>): (prompt: string) => Promise<unknown> {
  return async (prompt: string) => {
    if (prompt.startsWith('You are the illustrator of a short video. Design its style')) {
      return { name: style.name, css: style.css, guide: '.title for the headline, .card for a panel.', captions: style.captions ?? { left: 96, right: 96, bottom: 150, size: 46 } };
    }
    if (prompt.startsWith('You are the illustrator of a short video. Draw ONE layout')) {
      return fakePlate(prompt);
    }
    if (prompt.startsWith('You are the illustrator of a short video. Draw scene')) {
      return { source: fakeScene(prompt) };
    }
    if (prompt.startsWith('You are the illustrator of a short video. Draw ONE thing')) {
      return {
        source: '<div class="span"></div>\n<script>\n  var tl = gsap.timeline();\n  nodecine.beats.forEach(function (b) { tl.to(".span", { duration: 0.5 }, b.start); });\n  nodecine.timeline(tl);\n</script>',
        // Inside the lane a spanning thing is given: taller than this and it would sit on the captions.
        width: 380,
        height: 700,
      };
    }
    if (other) return other(prompt);
    throw new Error(`no fake answer for prompt: ${prompt.slice(0, 60)}`);
  };
}
