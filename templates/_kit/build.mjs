import { readFile, writeFile } from 'node:fs/promises';

/**
 * A variable declaration as an attribute value. The JSON goes in with its double quotes escaped: a
 * label may hold an apostrophe ("The film's name"), and an attribute wrapped in single quotes ends at
 * the first one — which silently cuts the declaration a reader parses in half. `&quot;` is exactly what
 * `declaredVariables` in `contracts/storyboard/blocks.ts` unescapes on the way back in.
 */
const declare = (variables) => JSON.stringify(variables).replace(/"/g, '&quot;');

/**
 * What every template's build script would otherwise repeat: finding the composition inside the
 * workflow beside it, and turning one scene into a HyperFrames block.
 *
 * The folder is `_`-prefixed on purpose: `templates:discover` walks past anything starting with `_`
 * or `.`, so this is not a template — it is what a template is built with.
 *
 * The shell lives here rather than in each template because the shell is where a composition meets
 * the renderer, and that meeting has rules that are not obvious from either side:
 *
 *   - The scene is kept in `<template>`. A page that stands alone (a render, a still) has to open it.
 *   - GSAP is not provided by the runtime: a composition that uses it must load it, and it is the
 *     film's entry — written by Assemble — that normally does. A standalone page loads it too.
 *   - The values arrive as `window.__hfVariables`, which the engine sets and the runtime reads.
 *   - The scene's backdrop is painted by its own element, `.nc-backdrop`, and not by a `background`
 *     on the root: a background on the root element (or on `html`/`body`) does not reach the captured
 *     frame — a dark scene came back white, with near-white type invisible on it. An element inside
 *     the root travels with the scene wherever the runtime puts it. A template paints that class in
 *     its own CSS, because the colours are the design's.
 *   - `data-composition-id` lives on the root element alone. On `<html>` as well, the engine reads two
 *     compositions in one file — and the first of them carries no `data-duration` to take a length from.
 */

/**
 * Read the workflow beside a template's build script, hand the composition's `files` map to `edit`,
 * and write the document back. The composition node is found by the one thing this script may know
 * about it — it is the node whose params carry a file map; naming its type is the capsule's business.
 */
export async function editComposition(workflowUrl, edit) {
  const workflow = JSON.parse(await readFile(workflowUrl, 'utf8'));
  const composition = workflow.graph.nodes.find((node) => node.params && 'files' in node.params);
  if (!composition) throw new Error('No node in this template carries a files map; a node id may have changed.');
  edit(composition.params.files);
  // Every kit carries an entry file, even an empty one: the Studio's inspector opens `index.html`, and
  // a template that Assembles its frames simply has Assemble overwrite it at run time.
  if (composition.params.files['index.html'] === undefined) composition.params.files['index.html'] = '';
  await writeFile(workflowUrl, `${JSON.stringify(workflow, null, 2)}\n`);
}

/**
 * The entry a kit ships before anything is assembled: a shell page holding the marker Assemble
 * replaces with the film's frames (`FRAMES_MARKER` in `capsules/nodes/assemble/assemble.ts`). It is
 * what the Studio previews and what the inspector lints until a run writes the real entry, so every
 * kit whose frames are assembled carries one.
 */
export function filmShell({ id, width = 1080, height = 1920, background = '#0b1020' }) {
  return `<!doctype html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8" />\n  <meta name="viewport" content="width=${width}, height=${height}" />\n  <script src="gsap.min.js"></script>\n  <style>\n    html, body { margin: 0; width: ${width}px; height: ${height}px; overflow: hidden; background: ${background}; }\n    #${id} { position: relative; width: ${width}px; height: ${height}px; overflow: hidden; }\n  </style>\n</head>\n<body>\n  <div id="${id}" data-composition-id="${id}" data-start="0" data-width="${width}" data-height="${height}">\n    <!-- nodecine:frames -->\n    <script>\n      const tl = gsap.timeline({ paused: true });\n      tl.set({}, {}, 1);\n      window.__timelines['${id}'] = tl;\n    </script>\n  </div>\n</body>\n</html>`;
}

/**
 * One scene as a block: the document shell, the variables it declares, the backdrop element, and the
 * timeline the engine seeks. The text keys are filled from the values the engine handed the page, and
 * long type is shrunk until it fits the box it was given.
 *
 * `loadGsap` is for a kit whose own `index.html` is the film — a template with no Assemble node, where
 * nothing writes an entry for it. A block leaves it off: the host page carries GSAP. And `template`
 * says whether the scene is wrapped in `<template>`, which is what a *sub-composition* is: the film's
 * own entry is a page, and a page inside `<template>` never runs.
 */
export function sceneBlock({
  id,
  role,
  description,
  css,
  markup,
  motion,
  variables,
  textKeys = ['title', 'detail', 'source'],
  extraScript = '',
  width = 1080,
  height = 1920,
  seconds = 4,
  loadGsap = false,
  template = true,
}) {
  const defaults = Object.fromEntries(variables.map((variable) => [variable.id, variable.default]));
  const fill = textKeys.map((key) => `'${key}'`).join(',');
  const setup = `var number=root.querySelector('.number-value');if(number)number.textContent=String(v.number==null?'01':v.number).padStart(2,'0');\n  root.querySelectorAll('.title,.detail').forEach(function(el){var floor=el.classList.contains('title')?62:29;while(el.scrollHeight>el.clientHeight+2&&parseFloat(getComputedStyle(el).fontSize)>floor){el.style.fontSize=(parseFloat(getComputedStyle(el).fontSize)-2)+'px'}});${extraScript ? `\n  ${extraScript}` : ''}`;
  return `<!doctype html>\n<html lang="en" data-composition-duration="${seconds}" data-role="${role}" data-composition-variables="${declare(variables)}">\n<head><meta charset="UTF-8" /><meta name="description" content="${description}" /></head>\n<body>${template ? '<template>' : ''}${loadGsap ? '<script src="gsap.min.js"></script>' : ''}\n<style>${css}</style>\n<div id="root" data-composition-id="${id}" data-duration="${seconds}" data-width="${width}" data-height="${height}"><div class="nc-backdrop"></div>${markup}</div>\n<script>(function(){\n  var root=document.getElementById('root');\n  var q=function(s){return root.querySelector(s)};\n  var v=window.__hyperframes&&window.__hyperframes.getVariables?window.__hyperframes.getVariables():{};\n  [${fill}].forEach(function(key){root.querySelectorAll('.'+key).forEach(function(el){el.textContent=String(v[key]==null?${JSON.stringify(defaults)}[key]:v[key])})});\n  ${setup}\n  var duration=Math.max(2,Number(v.seconds)||Number(root.dataset.duration)||${seconds});\n  var tl=gsap.timeline({paused:true});\n  ${motion}\n  tl.set({},{},duration);\n  tl.seek(0);\n  window.__timelines=window.__timelines||{};window.__timelines['${id}']=tl;\n})();</script>\n${template ? '</template>' : ''}</body></html>`;
}

/**
 * One component: a piece of a scene rather than a scene. It is a sub-composition like a block — kept in
 * `<template>`, with its own registered timeline — but it fills the box its host gives it instead of
 * naming dimensions of its own, and `<html data-role>` says what it is for: `piece`, `effect`, `ui` or
 * `overlay` (`COMPONENT_ROLES` in `contracts/storyboard/blocks.ts`). The storyboard writer reads every
 * component a kit holds and may mount one into a frame.
 */
export function component({ name, role, description, css, markup, motion = '', variables = [], textKeys = [], extraScript = '', seconds = 8 }) {
  const defaults = Object.fromEntries(variables.map((variable) => [variable.id, variable.default]));
  const fill = textKeys.map((key) => `'${key}'`).join(',');
  return `<!doctype html>\n<html lang="en" data-composition-duration="${seconds}" data-role="${role}" data-composition-variables="${declare(variables)}">\n<head><meta charset="UTF-8" /><meta name="description" content="${description}" /></head>\n<body><template>\n<style>#root{position:absolute;inset:0;box-sizing:border-box}#root *{box-sizing:border-box}${css}</style>\n<div id="root" data-composition-id="${name}" data-duration="${seconds}">${markup}</div>\n<script>(function(){\n  var root=document.getElementById('root');\n  var q=function(s){return root.querySelector(s)};\n  var v=window.__hyperframes&&window.__hyperframes.getVariables?window.__hyperframes.getVariables():{};\n  [${fill}].forEach(function(key){root.querySelectorAll('.'+key).forEach(function(el){el.textContent=String(v[key]==null?${JSON.stringify(defaults)}[key]:v[key])})});\n  ${extraScript}\n  var tl=gsap.timeline({paused:true});\n  ${motion}\n  tl.set({},{},${seconds});\n  tl.seek(0);\n  window.__timelines=window.__timelines||{};window.__timelines['${name}']=tl;\n})();</script>\n</template></body></html>`;
}

/**
 * The same part as a snippet, to paste into a scene.
 *
 * A scene cannot *host* a component: a host is a mount for the runtime or for the hoist that flattens
 * nested compositions for a preview, and the hoist walks the entry once — a mount written inside a
 * block that is itself mounted as a frame is never reached, and a render writes the project as it
 * stands. Measured: a block hosting three components rendered none of them and took 166s against 65s,
 * the capture waiting on hosts that never resolved.
 *
 * What the app does support is what the registry describes: a component is published as a file the
 * writer may mount, and *pasted* into a scene that wants it now. Both come from the same definition
 * here, so a scene's still and a writer's mount cannot drift apart. The parts keep their markup in one
 * element of their own and every class prefixed, so pasting two of them into a scene is safe.
 */
export function paste(part) {
  return { css: part.css, markup: part.markup, before: part.extraScript ?? '', motion: part.motion ?? '' };
}

/**
 * The parts every template's scenes can share. Each returns what `component()` takes, so a kit writes
 * `component(brandCorner({ accent: '#5ee6a8' }))` and gets one file it owns — kits stay self-contained,
 * while the definition lives here once and the design moves together.
 */

/** The mark and the film's name, for the corner of a scene. Static: a brand does not change per scene. */
export function brandCorner({ label = 'NODECINE', accent = '#7fe0c0', ink = '#04211a', color = '#c9d6de' } = {}) {
  return {
    name: 'brand-corner',
    role: 'ui',
    description: "The mark and the film's name, in the corner of a scene.",
    css: `.bc{position:absolute;inset:0;display:flex;align-items:center;gap:16px}.bc-label{color:${color};font-size:22px;font-weight:850;letter-spacing:.14em}.bc-bug{display:flex;align-items:center;justify-content:center;width:52px;height:52px;border-radius:14px;background:${accent};color:${ink};font-size:31px;font-weight:1000;letter-spacing:-.1em}.bc-bug i{width:7px;height:7px;border-radius:50%;background:${ink};margin-top:18px}`,
    markup: `<span class="bc"><span class="bc-bug">N<i></i></span><span class="bc-label">${label}</span></span>`,
    motion: `tl.fromTo(q('.bc'),{opacity:0,y:-12},{opacity:1,y:0,duration:.5,ease:'power2.out'},0);`,
  };
}

/** What the film is about to show, as a numbered index: a scene's own table of contents. */
export function tickerIndex({ count = 3, accent = '#7fe0c0', track = '#22303a' } = {}) {
  const rows = Array.from({ length: count }, (_, index) => `<span class="ti-row"><span class="ti-no">${String(index + 1).padStart(2, '0')}</span><span class="ti-bar"></span></span>`).join('');
  return {
    name: 'ticker-index',
    role: 'ui',
    description: 'A numbered index of the items the film is about to show.',
    css: `.ti{position:absolute;inset:0;display:flex;flex-direction:column;justify-content:center;gap:18px}.ti-row{display:flex;align-items:center;gap:18px}.ti-no{color:${accent};font-size:24px;font-weight:850;letter-spacing:.1em}.ti-bar{flex:1;height:10px;border-radius:5px;background:${track}}.ti-row:first-child .ti-bar{background:${accent}66}.ti-row:last-child .ti-bar{width:60%}`,
    markup: `<span class="ti">${rows}</span>`,
    motion: `tl.fromTo(q('.ti-row'),{opacity:0,x:24,stagger:.09},{opacity:1,x:0,duration:.5,ease:'power2.out'},.3);`,
  };
}

/** Where the thing on screen came from. Fills itself from the scene's own `source`. */
export function sourceChip({ accent = '#7fe0c0', color = '#e8f0f6', track = '#26343f', background = '#0b131acc' } = {}) {
  return {
    name: 'source-chip',
    role: 'piece',
    description: "Where the item on screen came from, read from the scene's own source.",
    css: `.sc{position:absolute;inset:0;display:flex;align-items:center;gap:18px;padding:16px 24px;border:1px solid ${track};border-radius:14px;background:${background}}.sc-tag{color:${accent};font-size:17px;font-weight:800;letter-spacing:.14em}.sc-source{flex:1;text-align:right;font-size:25px;color:${color};white-space:nowrap;overflow:hidden;text-overflow:ellipsis}`,
    markup: `<span class="sc"><span class="sc-tag">SOURCE</span><span class="sc-source"></span></span>`,
    variables: [{ id: 'source', type: 'string', label: 'The source of this item', default: 'example.com', sample: 'example.com', maxLength: 40, required: true }],
    extraScript: `var chipEl=root.querySelector('.sc-source');if(chipEl)chipEl.textContent=String(v.source==null?'example.com':v.source);`,
    motion: `tl.fromTo(q('.sc'),{y:14,opacity:0},{y:0,opacity:1,duration:.5,ease:'power2.out'},.8);`,
  };
}

/** How far through the film a scene is. Fills itself from the scene's own `step` and `total`. */
export function progressRail({ accent = '#7fe0c0', track = '#22303a', color = '#8fa3b0' } = {}) {
  return {
    name: 'progress-rail',
    role: 'ui',
    description: "A running bar and count: which scene this is, of how many, from the scene's step and total.",
    css: `.pr{position:absolute;inset:0;display:flex;align-items:center;gap:20px}.pr-rail{flex:1;height:8px;border-radius:4px;background:${track};overflow:hidden}.pr-fill{display:block;height:100%;width:0;border-radius:4px;background:${accent}}.pr-count{color:${color};font-size:19px;font-weight:850;letter-spacing:.14em}`,
    markup: `<span class="pr"><span class="pr-rail"><span class="pr-fill"></span></span><span class="pr-count"></span></span>`,
    variables: [
      { id: 'step', type: 'number', label: 'Which scene this is', default: 1, required: true },
      { id: 'total', type: 'number', label: 'How many scenes the film has', default: 3, required: true },
    ],
    extraScript: `var railEl=root.querySelector('.pr-fill');var stepN=Number(v.step)||1;var totalN=Math.max(1,Number(v.total)||1);if(railEl)railEl.style.width=Math.min(100,Math.round((stepN/totalN)*100))+'%';var countEl=root.querySelector('.pr-count');if(countEl)countEl.textContent=String(stepN).padStart(2,'0')+' / '+String(totalN).padStart(2,'0');`,
    motion: `tl.fromTo(q('.pr-fill'),{scaleX:0,transformOrigin:'left center'},{scaleX:1,duration:.7,ease:'power2.out'},.2);`,
  };
}

/** The standing head of a column: what this scene is, over a pair of rules. Static. */
export function sectionRule({ label = 'SUMMARY', accent = '#64d2ff', color = '#8fa8bd' } = {}) {
  return {
    name: 'section-rule',
    role: 'ui',
    description: 'The standing head of a column: a label over a pair of rules.',
    css: `.sr{position:absolute;inset:0;display:flex;flex-direction:column;justify-content:flex-end;gap:10px}.sr-label{color:${accent};font-size:20px;font-weight:850;letter-spacing:.22em}.sr-line{height:2px;background:${color}55}.sr-line+.sr-line{height:1px;background:${color}2e}`,
    markup: `<span class="sr"><span class="sr-label">${label}</span><span class="sr-line"></span><span class="sr-line"></span></span>`,
    motion: `tl.fromTo(q('.sr'),{opacity:0,y:-10},{opacity:1,y:0,duration:.5,ease:'power2.out'},0);`,
  };
}

/** The margin of a column: a hairline, a label on its side, and where the piece came from. */
export function marginNote({ label = 'SOURCE', accent = '#64d2ff', color = '#c3d3e8', line = '#2b4468' } = {}) {
  return {
    name: 'margin-note',
    role: 'piece',
    description: "What the column came from, set in the margin: reads the scene's own source.",
    css: `.mn{position:absolute;inset:0;display:flex;gap:16px}.mn-line{width:1px;background:${line}}.mn-body{display:flex;gap:12px}.mn-label{color:${accent};font-size:15px;font-weight:850;letter-spacing:.18em;writing-mode:vertical-rl}.mn-source{color:${color};font-size:21px;line-height:1.32;overflow:hidden}`,
    markup: `<span class="mn"><span class="mn-line"></span><span class="mn-body"><span class="mn-label">${label}</span><span class="mn-source"></span></span></span>`,
    variables: [{ id: 'source', type: 'string', label: 'Where the article came from', default: 'the article', sample: 'theguardian.com', maxLength: 48, required: true }],
    extraScript: `var noteEl=root.querySelector('.mn-source');if(noteEl)noteEl.textContent=String(v.source==null?'the article':v.source);`,
    motion: `tl.fromTo(q('.mn'),{opacity:0,x:16},{opacity:1,x:0,duration:.6,ease:'power2.out'},.7);`,
  };
}

/** A book's page head: whose book this is, over a rule. Static, repeated on every page. */
export function runningHead({ title = 'THE BOOK', color = '#5d6b62', rule = '#cbbfa6' } = {}) {
  return {
    name: 'running-head',
    role: 'ui',
    description: "The book's own name, set as a running head over a rule.",
    css: `.rh{position:absolute;inset:0;display:flex;flex-direction:column;justify-content:flex-end;gap:12px}.rh-title{color:${color};font-size:19px;font-weight:850;letter-spacing:.2em}.rh-rule{height:2px;background:${rule}}`,
    markup: `<span class="rh"><span class="rh-title">${title}</span><span class="rh-rule"></span></span>`,
    motion: `tl.fromTo(q('.rh'),{opacity:0,y:-8},{opacity:1,y:0,duration:.5,ease:'power2.out'},0);`,
  };
}

/** A bookmark hanging over the page, with where the passage sits set down its length. */
export function ribbon({ label = 'IN THE BOOK', accent = '#b98c3f', ink = '#2a1d08' } = {}) {
  return {
    name: 'ribbon',
    role: 'piece',
    description: "A bookmark over the page, carrying where the passage sits: reads the scene's own source.",
    css: `.rb{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center}.rb-body{flex:1;width:100%;display:flex;flex-direction:column;align-items:center;gap:18px;padding:26px 0 0;background:${accent};box-shadow:0 18px 40px #00000055}.rb-tail{width:100%;height:34px;background:${accent};clip-path:polygon(0 0,100% 0,100% 100%,50% 62%,0 100%);margin-top:-1px}.rb-label{color:${ink};font-size:14px;font-weight:850;letter-spacing:.18em;writing-mode:vertical-rl}.rb-source{color:${ink};font-size:17px;font-weight:700;line-height:1.3;writing-mode:vertical-rl;max-height:420px;overflow:hidden}`,
    markup: `<span class="rb"><span class="rb-body"><span class="rb-label">${label}</span><span class="rb-source"></span></span><span class="rb-tail"></span></span>`,
    variables: [{ id: 'source', type: 'string', label: 'Where the passage sits in the book', default: 'Chapter one', sample: 'Part 2 � Chapter 4', maxLength: 48, required: true }],
    extraScript: `var ribEl=root.querySelector('.rb-source');if(ribEl)ribEl.textContent=String(v.source==null?'Chapter one':v.source);`,
    motion: `tl.fromTo(q('.rb'),{y:-60,opacity:0},{y:0,opacity:1,duration:.7,ease:'power3.out'},.3);`,
  };
}

/** The figure a story turns on, set at poster size so it runs off the edge of the frame. */
export function statPoster({ accent = '#ff8f7a' } = {}) {
  return {
    name: 'stat-poster',
    role: 'piece',
    description: "The figure the scene turns on, set at poster size: reads the scene's own figure.",
    css: `.sp{position:absolute;inset:0;display:flex;align-items:flex-start}.sp-figure{margin:0;font-size:420px;line-height:.86;font-weight:900;letter-spacing:-.06em;color:${accent};white-space:nowrap}`,
    markup: `<span class="sp"><span class="sp-figure"></span></span>`,
    variables: [{ id: 'figure', type: 'string', label: 'The figure, as the source prints it', default: '62%', sample: '62%', maxLength: 12, required: true }],
    extraScript: `var figEl=root.querySelector('.sp-figure');if(figEl)figEl.textContent=String(v.figure==null?'62%':v.figure);`,
    motion: `tl.fromTo(q('.sp-figure'),{x:-70,opacity:0},{x:0,opacity:1,duration:.85,ease:'power3.out'},0);`,
  };
}

/** A scale under a figure: ticks with their labels, and a marker at the scene's own share. */
export function axisScale({ accent = '#ff8f7a', color = '#8b93b8', track = '#2b2650' } = {}) {
  const ticks = [0, 25, 50, 75, 100].map((value) => `<span class="ax-tick" style="left:${value}%"><i></i><b>${value}</b></span>`).join('');
  return {
    name: 'axis-scale',
    role: 'ui',
    description: "A scale under the figure: ticks and labels, with a marker where the scene's share falls.",
    css: `.ax{position:absolute;inset:0}.ax-line{position:absolute;left:0;right:0;top:36px;height:2px;background:${track}}.ax-tick{position:absolute;top:36px}.ax-tick i{position:absolute;left:0;top:0;width:2px;height:18px;background:${track}}.ax-tick b{position:absolute;left:0;top:26px;transform:translateX(-50%);color:${color};font-size:17px;font-weight:750;letter-spacing:.08em}.ax-mark{position:absolute;left:0;top:8px;width:6px;height:58px;border-radius:3px;background:${accent};transform:translateX(-50%)}`,
    markup: `<span class="ax"><span class="ax-line"></span>${ticks}<span class="ax-mark"></span></span>`,
    variables: [{ id: 'share', type: 'number', label: 'How much of the whole it is, from 0 to 1', default: 0.62, sample: 0.62 }],
    extraScript: `var markEl=root.querySelector('.ax-mark');var shareN=Math.max(0,Math.min(1,Number(v.share)||0));if(markEl)markEl.style.left=(shareN*100)+'%';`,
    motion: `tl.fromTo(q('.ax'),{opacity:0},{opacity:1,duration:.5,ease:'sine.out'},.5)
      .fromTo(q('.ax-mark'),{scaleY:0,transformOrigin:'bottom center'},{scaleY:1,duration:.5,ease:'power2.out'},.72);`,
  };
}

/** Where a figure came from, set as a fine line along the foot of the poster. */
export function sourceLine({ accent = '#ff8f7a', color = '#8b93b8', track = '#2b2650', label = 'WHERE IT COMES FROM' } = {}) {
  return {
    name: 'source-line',
    role: 'piece',
    description: "Where the figure came from, set as a fine line: reads the scene's own source.",
    css: `.sl{position:absolute;inset:0;display:flex;align-items:center;gap:22px}.sl-line{flex:none;width:120px;height:1px;background:${track}}.sl-label{color:${accent};font-size:16px;font-weight:850;letter-spacing:.18em}.sl-source{flex:1;text-align:right;color:${color};font-size:22px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}`,
    markup: `<span class="sl"><span class="sl-line"></span><span class="sl-label">${label}</span><span class="sl-source"></span></span>`,
    variables: [{ id: 'source', type: 'string', label: 'Where the figure came from', default: 'the report', sample: 'Office for Budget Responsibility, 2024', maxLength: 48, required: true }],
    extraScript: `var srcEl=root.querySelector('.sl-source');if(srcEl)srcEl.textContent=String(v.source==null?'the report':v.source);`,
    motion: `tl.fromTo(q('.sl'),{opacity:0,y:10},{opacity:1,y:0,duration:.5,ease:'power2.out'},1.05);`,
  };
}

/** A bar of colour down the edge of the frame, with a soft glow beside it: a poster's spine. */
export function edgeRule({ accent = '#e0a45c', glow = '#e0a45c33' } = {}) {
  return {
    name: 'edge-rule',
    role: 'effect',
    description: 'A bar of colour down the edge of the frame, with a soft glow beside it.',
    css: `.er{position:absolute;inset:0}.er-bar{position:absolute;left:0;top:0;bottom:0;width:18px;background:${accent}}.er-glow{position:absolute;left:18px;top:0;bottom:0;width:96px;background:linear-gradient(90deg,${glow},transparent)}`,
    markup: `<span class="er"><span class="er-bar"></span><span class="er-glow"></span></span>`,
    motion: `tl.fromTo(q('.er-bar'),{scaleY:0,transformOrigin:'top center'},{scaleY:1,duration:.9,ease:'power2.out'},0)
      .fromTo(q('.er-glow'),{opacity:0},{opacity:1,duration:.8,ease:'sine.out'},.3);`,
  };
}

/** Who said it, set down the side of the frame like a signature. */
export function signature({ label = 'SAID BY', accent = '#e0a45c', color = '#e8d6ba' } = {}) {
  return {
    name: 'signature',
    role: 'piece',
    description: "Who said it, set vertically down the side: reads the scene's own detail.",
    css: `.sg{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;gap:16px}.sg-rule{width:2px;height:70px;background:${accent}}.sg-label{color:${accent};font-size:14px;font-weight:850;letter-spacing:.2em;writing-mode:vertical-rl}.sg-name{color:${color};font-size:30px;font-weight:750;letter-spacing:.02em;writing-mode:vertical-rl;transform:rotate(180deg);max-height:520px;overflow:hidden}`,
    markup: `<span class="sg"><span class="sg-rule"></span><span class="sg-label">${label}</span><span class="sg-name"></span></span>`,
    variables: [{ id: 'detail', type: 'string', label: 'Who said it', default: 'Robert Frost', sample: 'Robert Frost', maxLength: 60, required: true }],
    extraScript: `var nameEl=root.querySelector('.sg-name');if(nameEl)nameEl.textContent=String(v.detail==null?'Robert Frost':v.detail);`,
    motion: `tl.fromTo(q('.sg'),{opacity:0,y:-24},{opacity:1,y:0,duration:.7,ease:'power2.out'},.5);`,
  };
}

/** The title bar of a window, over the screen a recording plays on. */
export function windowChrome({ plate = 'RECORDING', dot = '#c3ccd4', bar = '#e4e9ee', ink = '#54606c', field = '#f7f9fb' } = {}) {
  return {
    name: 'window-chrome',
    role: 'ui',
    description: 'The title bar of a window, for a scene that shows a screen.',
    css: `.wc{position:absolute;inset:0;display:flex;align-items:center;gap:12px;padding:0 26px;background:${bar}}.wc i{display:block;width:14px;height:14px;border-radius:50%;background:${dot}}.wc-plate{margin-left:16px;flex:1;height:34px;border-radius:17px;background:${field};color:${ink};font-size:19px;letter-spacing:.1em;display:flex;align-items:center;padding:0 18px}`,
    markup: `<span class="wc"><i></i><i></i><i></i><span class="wc-plate">${plate}</span></span>`,
    motion: `tl.fromTo(q('.wc'),{opacity:0,y:-8},{opacity:1,y:0,duration:.5,ease:'power2.out'},.1);`,
  };
}

/** The words being said, around the playhead, read from the run's own voice-over timings. */
export function captionBand({ accent = '#7fe0c0', color = '#eaf2f5', background = '#05080acc', empty = 'CAPTIONS APPEAR WHEN A RUN HAS A VOICE' } = {}) {
  return {
    name: 'caption-band',
    role: 'piece',
    description: "The words being said around the playhead, read from the run's voice-over timings.",
    css: `.cb{position:absolute;inset:0;display:flex;align-items:flex-end;padding-bottom:16px}.cb-line{width:100%;text-align:center;background:${background};color:${color};font-size:34px;line-height:1.3;font-weight:750;padding:16px 28px;border-radius:10px}.cb-line b{color:${accent}}.cb-empty{opacity:.5}`,
    markup: `<span class="cb"><span class="cb-line">${empty}</span></span>`,
    extraScript: `var cbLine=root.querySelector('.cb-line');var cbBox=root.querySelector('.cb');var cbFrom=Number(v.from)||0;fetch('voiceover.json').then(function(r){return r.ok?r.json():null}).then(function(data){var cbWords=data&&data.words?data.words:[];if(!cbWords.length){if(cbBox)cbBox.classList.add('cb-empty');return;}var paint=function(){var t=cbFrom+(tl.time?tl.time():0);var last=-1;for(var i=0;i<cbWords.length;i++){if(cbWords[i].start<=t+0.001)last=i;else break;}if(last<0)return;var slice=cbWords.slice(Math.max(0,last-11),last+1);cbLine.innerHTML=slice.map(function(w,i){var text=String(w.text).replace(/</g,'&lt;');return i===slice.length-1?'<b>'+text+'</b>':text;}).join(' ');};paint();tl.eventCallback('onUpdate',paint);}).catch(function(){if(cbBox)cbBox.classList.add('cb-empty');});`,
    motion: `tl.fromTo(q('.cb'),{opacity:0,y:12},{opacity:1,y:0,duration:.5,ease:'power2.out'},.7);`,
  };
}
