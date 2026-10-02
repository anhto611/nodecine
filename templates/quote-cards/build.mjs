import { component, edgeRule, editComposition, paste, sceneBlock, signature, sourceLine } from '../_kit/build.mjs';

/**
 * The quote card as a full-bleed poster.
 *
 * One scene, and the film is that scene: a bar of colour down the left edge with the opening mark
 * bleeding out of the frame beside it, the quote filling the middle at poster size, who said it set
 * vertically down the right edge like a signature, and where it came from along the foot. No masthead,
 * no footer band — a poster is the quote and nothing else.
 *
 * The spine, the signature and the source line are components this kit publishes, pasted from the same
 * definitions so the card's own still and a later writer's film cannot drift apart.
 */

const AMBER = '#e0a45c';

const spine = paste(edgeRule({ accent: AMBER, glow: '#e0a45c33' }));
const sign = paste(signature({ label: 'SAID BY', accent: AMBER, color: '#e8d6ba' }));
const source = paste(sourceLine({ accent: AMBER, color: '#a08a6c', track: '#7a6448', label: 'FROM' }));

const sceneCss =
  'html,body{margin:0;background:#100c09}*{box-sizing:border-box}' +
  '#root{position:absolute;inset:0;width:1080px;height:1920px;overflow:hidden;color:#f7f1e8;background:#100c09;font-family:var(--font-body,Inter,Arial,sans-serif)}' +
  '.nc-backdrop{position:absolute;inset:0;background:radial-gradient(circle at 24% 12%,#3a2a1a 0,#1a1209 56%,#0a0705 100%)}' +
  '.glow{position:absolute;width:1500px;height:1500px;left:-360px;top:1120px;border-radius:50%;background:radial-gradient(circle,#e0a45c26 0,#e0a45c00 62%)}' +
  '.slot-spine{position:absolute;inset:0}' +
  '.stage{position:absolute;left:110px;right:250px;top:260px;bottom:430px;display:flex;flex-direction:column;justify-content:center;gap:30px}' +
  '.opening{font-size:300px;line-height:.42;font-weight:900;color:' +
  AMBER +
  ';opacity:.28;margin-left:-96px}' +
  '.stage .title{margin:6px 0 0;font-size:92px;line-height:1.16;letter-spacing:-.03em;font-weight:850;max-height:900px;overflow:hidden}' +
  '.rule{width:150px;height:9px;border-radius:9px;background:' +
  AMBER +
  '}' +
  '.slot-sign{position:absolute;right:60px;top:300px;width:120px;height:600px}' +
  '.slot-source{position:absolute;left:110px;right:210px;bottom:156px;height:52px}' +
  '.credit{position:absolute;left:110px;bottom:96px;color:#8a7358;font-size:17px;font-weight:800;letter-spacing:.2em}';

const scene = {
  role: 'feature',
  description: 'A quote set at poster size, with who said it down the side and where it came from along the foot.',
  markup: `<div class="glow"></div>
      <span class="slot slot-spine">${spine.markup}</span>
      <div class="stage"><span class="opening">“</span><h1 class="title"></h1><div class="rule"></div></div>
      <span class="slot slot-sign">${sign.markup}</span>
      <span class="slot slot-source">${source.markup}</span>
      <div class="credit">MADE WITH NODECINE</div>`,
  css: sceneCss + spine.css + sign.css + source.css,
  motion: `tl.fromTo(q('.glow'),{opacity:0},{opacity:1,duration:1.6,ease:'sine.out'},.1)
      .fromTo(q('.opening'),{scale:.4,opacity:0,transformOrigin:'left top'},{scale:1,opacity:.28,duration:.8,ease:'power3.out'},.2)
      .fromTo(q('.stage .title'),{y:74,opacity:0},{y:0,opacity:1,duration:.9,ease:'power3.out'},.34)
      .fromTo(q('.rule'),{scaleX:0,transformOrigin:'left center'},{scaleX:1,duration:.6,ease:'power2.out'},.86)
      .fromTo(q('.credit'),{opacity:0},{opacity:1,duration:.6,ease:'sine.out'},1.1)
      ${spine.motion}
      ${sign.motion}
      ${source.motion}`,
  extraScript: `${sign.before}\n  ${source.before}`,
};

const variables = [
  {
    id: 'title',
    type: 'string',
    label: 'The quote',
    labels: { vi: 'Câu trích dẫn' },
    default: 'The best way out is always through.',
    sample: 'The best way out is always through.',
    maxLength: 220,
    required: true,
  },
  { id: 'detail', type: 'string', label: 'Who said it', labels: { vi: 'Người nói' }, default: 'Robert Frost', sample: 'Robert Frost', maxLength: 60, required: true },
  { id: 'source', type: 'string', label: 'Where it comes from (optional)', labels: { vi: 'Nguồn câu nói (không bắt buộc)' }, default: '', sample: 'A Servant to Servants, 1914', maxLength: 72 },
  { id: 'seconds', type: 'number', label: 'Length in seconds', labels: { vi: 'Độ dài, giây' }, default: 12 },
];

await editComposition(new URL('./workflow.json', import.meta.url), (files) => {
  // The film itself: nothing assembles frames for this template, so the entry is the scene — a page,
  // not a `<template>`, and it loads GSAP the way an assembled film's entry does.
  files['index.html'] = sceneBlock({ ...scene, id: 'quote-film', variables, seconds: 12, loadGsap: true, template: false });
  // The same scene as a block, for the composition's parts and for any later storyboard.
  files['compositions/quote-card.html'] = sceneBlock({ ...scene, id: 'quote-card', variables, seconds: 12 });
  // Published, not pasted: a writer may mount these into a frame of its own.
  files['compositions/components/edge-rule.html'] = component(edgeRule({ accent: AMBER, glow: '#e0a45c33' }));
  files['compositions/components/signature.html'] = component(signature({ label: 'SAID BY', accent: AMBER, color: '#e8d6ba' }));
  files['compositions/components/source-line.html'] = component(sourceLine({ accent: AMBER, color: '#a08a6c', track: '#7a6448', label: 'FROM' }));
  // This film is one scene, so nothing writes a storyboard for it — but a guide says what the shape is,
  // for whoever adds a writer to this template to make a series of cards.
  files['storyboard-guide.md'] =
    `---\nfirst: quote-card\nlast: quote-card\nrepeat: 0\n---\nA quote card is one scene, set as a full-bleed poster: a bar of colour down the left edge, the quote filling the middle at poster size, who said it down the right edge, and where it came from along the foot. There is no storyboard to write.\nShould a writer be added to make a series of cards, use one card per quote, in the order the person gave them, and keep each of the three lines to what they wrote.\nNever invent an author, a source or a wording the person did not give.`;
});
