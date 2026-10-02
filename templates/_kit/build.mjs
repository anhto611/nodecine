import { readFile, writeFile } from 'node:fs/promises';

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
  return `<!doctype html>\n<html lang="en" data-composition-duration="${seconds}" data-role="${role}" data-composition-variables='${JSON.stringify(variables)}'>\n<head><meta charset="UTF-8" /><meta name="description" content="${description}" /></head>\n<body>${template ? '<template>' : ''}${loadGsap ? '<script src="gsap.min.js"></script>' : ''}\n<style>${css}</style>\n<div id="root" data-composition-id="${id}" data-duration="${seconds}" data-width="${width}" data-height="${height}"><div class="nc-backdrop"></div>${markup}</div>\n<script>(function(){\n  var root=document.getElementById('root');\n  var q=function(s){return root.querySelector(s)};\n  var v=window.__hyperframes&&window.__hyperframes.getVariables?window.__hyperframes.getVariables():{};\n  [${fill}].forEach(function(key){root.querySelectorAll('.'+key).forEach(function(el){el.textContent=String(v[key]==null?${JSON.stringify(defaults)}[key]:v[key])})});\n  ${setup}\n  var duration=Math.max(2,Number(v.seconds)||Number(root.dataset.duration)||${seconds});\n  var tl=gsap.timeline({paused:true});\n  ${motion}\n  tl.set({},{},duration);\n  tl.seek(0);\n  window.__timelines=window.__timelines||{};window.__timelines['${id}']=tl;\n})();</script>\n${template ? '</template>' : ''}</body></html>`;
}
