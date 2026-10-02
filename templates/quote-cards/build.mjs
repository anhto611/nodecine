import { editComposition, sceneBlock } from '../_kit/build.mjs';

/**
 * The quote card: one scene, and the film is that scene.
 *
 * Nothing assembles frames here — a quote needs no storyboard, no model and no voice — so the
 * template's own `index.html` is the film, which is why it loads GSAP itself. The card under
 * `compositions/` is the same scene as a block, so it shows up in the composition's parts and can be
 * assembled with other scenes if someone adds a writer later.
 */

const commonCss =
  'html,body{margin:0;background:#100c09}*{box-sizing:border-box}' +
  '#root{position:absolute;inset:0;width:1080px;height:1920px;overflow:hidden;color:#f7f1e8;background:#100c09;font-family:var(--font-body,Inter,Arial,sans-serif)}' +
  '.nc-backdrop{position:absolute;inset:0;background:radial-gradient(circle at 18% 8%,#3a2a1a 0,#1a1209 54%,#0a0705 100%)}' +
  '.mast{position:absolute;top:91px;left:86px;right:86px;display:flex;align-items:center;gap:20px;color:#cbb59a;font-size:19px;font-weight:850;letter-spacing:.14em;z-index:4}' +
  '.brand-mark{display:flex;align-items:center;justify-content:center;width:63px;height:63px;border-radius:17px;background:#e0a45c;color:#241708;font-size:37px;font-weight:1000;letter-spacing:-.1em}' +
  '.brand-mark span{width:7px;height:7px;border-radius:50%;background:#241708;margin-top:22px}' +
  '.edition{margin-left:auto;color:#8a7358;font-size:17px}' +
  '.foot{position:absolute;bottom:84px;left:86px;right:86px;display:flex;align-items:center;justify-content:space-between;padding-top:23px;border-top:1px solid #7a6448;color:#a08a6c;font-size:20px;font-weight:800;letter-spacing:.1em;z-index:4}' +
  '.foot-bars{display:flex;align-items:end;gap:6px;height:28px}' +
  '.foot-bars b{display:block;width:6px;background:#e0a45c;border-radius:3px}' +
  '.foot-bars b:nth-child(1){height:12px}.foot-bars b:nth-child(2){height:24px}.foot-bars b:nth-child(3){height:17px}.foot-bars b:nth-child(4){height:28px}.foot-bars b:nth-child(5){height:15px}';

const sceneCss =
  '.glow{position:absolute;width:1400px;height:1400px;left:-320px;top:1150px;border-radius:50%;background:radial-gradient(circle,#e0a45c26 0,#e0a45c00 62%)}' +
  '.stage{position:absolute;left:96px;right:96px;top:300px;bottom:280px;display:flex;flex-direction:column;justify-content:center;gap:30px;z-index:3}' +
  '.opening{font-size:230px;line-height:.5;font-weight:900;color:#e0a45c;opacity:.3;margin:0 0 0 -14px}' +
  '.stage .title{margin:10px 0 0;font-size:78px;line-height:1.2;letter-spacing:-.025em;font-weight:800;max-height:840px;overflow:hidden}' +
  '.rule{width:150px;height:8px;border-radius:8px;background:#e0a45c}' +
  '.stage .detail{margin:0;font-size:36px;line-height:1.3;color:#e8d6ba;letter-spacing:.02em;max-height:130px;overflow:hidden}' +
  '.stage .detail::before{content:"— "}' +
  '.stage .source{font-size:21px;letter-spacing:.16em;color:#a08a6c;text-transform:uppercase;max-height:60px;overflow:hidden}';

const scene = {
  role: 'feature',
  description: 'A quote set large, with who said it and where it came from.',
  markup: `<div class="glow"></div>
      <div class="mast"><span class="brand-mark">N<span></span></span><span>QUOTE CARD</span><span class="edition">NODECINE</span></div>
      <div class="stage"><span class="opening">“</span><h1 class="title"></h1><div class="rule"></div><p class="detail"></p><span class="source"></span></div>
      <div class="foot"><span>MADE WITH NODECINE</span><span class="foot-bars"><b></b><b></b><b></b><b></b><b></b></span></div>`,
  css: `${commonCss}${sceneCss}`,
  motion: `tl.fromTo(q('.opening'),{scale:.35,opacity:0,transformOrigin:'left top'},{scale:1,opacity:.3,duration:.75,ease:'power3.out'},0)
      .fromTo(q('.glow'),{opacity:0},{opacity:1,duration:1.6,ease:'sine.out'},.15)
      .fromTo(q('.title'),{y:70,opacity:0},{y:0,opacity:1,duration:.9,ease:'power3.out'},.2)
      .fromTo(q('.rule'),{scaleX:0,transformOrigin:'left center'},{scaleX:1,duration:.6,ease:'power2.out'},.74)
      .fromTo(q('.detail'),{y:34,opacity:0},{y:0,opacity:1,duration:.6,ease:'power2.out'},.88)
      .fromTo(q('.source'),{opacity:0},{opacity:1,duration:.7,ease:'sine.out'},1.1);`,
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
});
