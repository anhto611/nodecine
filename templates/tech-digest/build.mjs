import { brandCorner, component, editComposition, filmShell, paste, progressRail, sceneBlock, sourceChip, tickerIndex } from '../_kit/build.mjs';

/**
 * Three things today: a short technology digest, laid out like a feed rather than a poster.
 *
 * One axis runs down the page — a vertical rule on the left for the opening and the items, mirrored on
 * the right for the close — and each item hangs off it, numbered in the gutter. Nothing is centred in a
 * card and there is no masthead band: the mark sits in a corner and the running bar at the foot.
 *
 * Those two, the numbered index and the source strip, are components this kit publishes under
 * `compositions/components/`, and the same definitions are pasted into the scenes below, so a scene's
 * own still shows them and a writer may still mount the published files elsewhere. Both come from one
 * definition in `templates/_kit/build.mjs`, so they cannot drift apart.
 */

const ACCENT = '#5ee6a8';
const INK = '#06231a';
const MUTED = '#8fa6c6';
const TRACK = '#1c2b3d';

/** The parts this kit publishes as components, and the same parts as snippets its scenes paste. */
const parts = {
  'brand-corner': brandCorner({ label: 'TECH DIGEST', accent: ACCENT, ink: INK, color: '#9fb4d4' }),
  'ticker-index': tickerIndex({ count: 3, accent: ACCENT, track: TRACK }),
  'source-chip': sourceChip({ accent: ACCENT, color: '#dbe6f5', track: '#2b4468', background: '#0c1526cc' }),
  'progress-rail': progressRail({ accent: ACCENT, track: TRACK, color: MUTED }),
};
const brand = paste(parts['brand-corner']);
const index = paste(parts['ticker-index']);
const chip = paste(parts['source-chip']);
const rail = paste(parts['progress-rail']);

/** Where a pasted part sits is the scene's business, not the part's: the part fills the box it is given. */
const slots =
  '.slot-brand{position:absolute;right:96px;top:98px;width:400px;height:52px}' +
  '.slot-rail{position:absolute;left:110px;right:150px;bottom:112px;height:40px}' +
  '.slot-index{position:absolute;left:560px;right:150px;top:1256px;height:230px}' +
  '.slot-chip{position:absolute;left:190px;right:150px;top:1330px;height:86px}';

const commonCss =
  'html,body{margin:0;background:#070a11}*{box-sizing:border-box}' +
  '#root{position:absolute;inset:0;width:1080px;height:1920px;overflow:hidden;color:#eef2f8;background:#070a11;font-family:var(--font-body,Inter,Arial,sans-serif)}' +
  '.nc-backdrop{position:absolute;inset:0;background:linear-gradient(180deg,#0d1728 0,#070a11 46%,#05070c 100%)}' +
  '.grid{position:absolute;inset:0;background-image:linear-gradient(#ffffff08 1px,transparent 1px);background-size:100% 96px}' +
  '.eyebrow{position:absolute;color:' +
  ACCENT +
  ';font-size:21px;font-weight:850;letter-spacing:.2em}' +
  '.hair{position:absolute;height:1px;background:#2b4468}' +
  slots;

const scenes = {
  open: {
    role: 'hook',
    description: 'Opening: what today’s items have in common, down the left axis of the page.',
    heading: 'Three things worth knowing today',
    css:
      commonCss +
      brand.css +
      index.css +
      rail.css +
      '.axis{position:absolute;left:110px;top:180px;bottom:300px;width:7px;border-radius:7px;background:' +
      ACCENT +
      '}' +
      '.eyebrow{left:190px;top:190px}' +
      '.open .title{position:absolute;left:190px;right:150px;top:296px;margin:0;font-size:92px;line-height:1.05;letter-spacing:-.03em;font-weight:850;max-height:620px;overflow:hidden}' +
      '.hair-one{left:190px;right:190px;top:950px}' +
      '.open .detail{position:absolute;left:190px;right:200px;top:1012px;margin:0;font-size:38px;line-height:1.36;color:#c3d3e8;max-height:220px;overflow:hidden}',
    markup: `<div class="grid"></div>
      <span class="slot slot-brand">${brand.markup}</span>
      <span class="eyebrow">TODAY'S FEED</span>
      <div class="axis"></div>
      <div class="open"><h1 class="title"></h1><div class="hair hair-one"></div><p class="detail"></p></div>
      <span class="slot slot-index">${index.markup}</span>
      <span class="slot slot-rail">${rail.markup}</span>`,
    motion: `tl.fromTo(q('.grid'),{opacity:0},{opacity:1,duration:1,ease:'sine.out'},0)
      .fromTo(q('.eyebrow'),{x:-18,opacity:0},{x:0,opacity:1,duration:.5,ease:'power2.out'},.1)
      .fromTo(q('.axis'),{scaleY:0,transformOrigin:'top center'},{scaleY:1,duration:.8,ease:'power2.out'},.16)
      .fromTo(q('.open .title'),{y:56,opacity:0},{y:0,opacity:1,duration:.8,ease:'power3.out'},.3)
      .fromTo(q('.hair-one'),{scaleX:0,transformOrigin:'left center'},{scaleX:1,duration:.6,ease:'power2.out'},.7)
      .fromTo(q('.open .detail'),{y:26,opacity:0},{y:0,opacity:1,duration:.6,ease:'power2.out'},.8)
      ${brand.motion}
      ${index.motion}
      ${rail.motion}`,
    extraScript: rail.before,
    variables: [
      {
        id: 'title',
        type: 'string',
        label: 'Opening line',
        labels: { vi: 'Câu mở đầu' },
        default: 'Three things worth knowing today',
        sample: 'Three things worth knowing today',
        maxLength: 56,
        required: true,
      },
      {
        id: 'detail',
        type: 'string',
        label: 'One sentence on why they matter',
        labels: { vi: 'Một câu vì sao đáng chú ý' },
        default: 'What changed today, and what it means next.',
        sample: 'Two releases and one quiet change that will matter next quarter.',
        maxLength: 150,
        required: true,
      },
      { id: 'step', type: 'number', label: 'Which scene this is', default: 1, required: true },
      { id: 'total', type: 'number', label: 'How many scenes the film has', default: 3, required: true },
      { id: 'seconds', type: 'number', label: 'Length in seconds (the Assemble node gives it)', default: 4 },
    ],
  },
  item: {
    role: 'feature',
    description: 'One item of the feed: a numbered row off the left axis, with where it came from.',
    heading: 'What happened',
    css:
      commonCss +
      brand.css +
      chip.css +
      rail.css +
      '.band{position:absolute;left:0;right:0;top:150px;height:760px;background:linear-gradient(90deg,#12203a00 0,#12203a66 44%,#12203a00 100%)}' +
      '.gutter{position:absolute;left:110px;top:180px;bottom:400px;width:7px;border-radius:7px;background:' +
      ACCENT +
      '}' +
      '.item-no{position:absolute;left:96px;top:250px;width:150px;text-align:center;font-size:104px;line-height:1;font-weight:900;letter-spacing:-.06em;color:' +
      ACCENT +
      '}' +
      '.eyebrow{left:190px;top:398px}' +
      '.item .title{position:absolute;left:190px;right:150px;top:470px;margin:0;font-size:86px;line-height:1.08;letter-spacing:-.03em;font-weight:850;max-height:420px;overflow:hidden}' +
      '.hair-one{left:190px;right:150px;top:930px}' +
      '.item .detail{position:absolute;left:190px;right:170px;top:992px;margin:0;font-size:38px;line-height:1.36;color:#b9cbe4;max-height:230px;overflow:hidden}',
    markup: `<div class="grid"></div>
      <div class="band"></div>
      <span class="slot slot-brand">${brand.markup}</span>
      <span class="eyebrow">ITEM</span>
      <div class="gutter"></div>
      <div class="item-no number-value">01</div>
      <div class="item"><h1 class="title"></h1><div class="hair hair-one"></div><p class="detail"></p></div>
      <span class="slot slot-chip">${chip.markup}</span>
      <span class="slot slot-rail">${rail.markup}</span>`,
    motion: `tl.fromTo(q('.grid'),{opacity:0},{opacity:1,duration:1,ease:'sine.out'},0)
      .fromTo(q('.band'),{opacity:0},{opacity:1,duration:.7,ease:'sine.out'},.06)
      .fromTo(q('.eyebrow'),{x:-18,opacity:0},{x:0,opacity:1,duration:.5,ease:'power2.out'},.12)
      .fromTo(q('.gutter'),{scaleY:0,transformOrigin:'top center'},{scaleY:1,duration:.8,ease:'power2.out'},.18)
      .fromTo(q('.item-no'),{y:34,opacity:0},{y:0,opacity:1,duration:.6,ease:'power3.out'},.3)
      .fromTo(q('.item .title'),{y:46,opacity:0},{y:0,opacity:1,duration:.7,ease:'power3.out'},.42)
      .fromTo(q('.hair-one'),{scaleX:0,transformOrigin:'left center'},{scaleX:1,duration:.6,ease:'power2.out'},.72)
      .fromTo(q('.item .detail'),{y:26,opacity:0},{y:0,opacity:1,duration:.6,ease:'power2.out'},.82)
      ${brand.motion}
      ${chip.motion}
      ${rail.motion}`,
    extraScript: `${chip.before}\n  ${rail.before}`,
    variables: [
      { id: 'number', type: 'string', label: 'Item number, two digits', labels: { vi: 'Số thứ tự tin, hai chữ số' }, default: '02', sample: '02', maxLength: 2, required: true },
      {
        id: 'title',
        type: 'string',
        label: 'Headline',
        labels: { vi: 'Tiêu đề tin' },
        default: 'What happened',
        sample: 'The release ships without the plugin it promised',
        maxLength: 56,
        required: true,
      },
      {
        id: 'detail',
        type: 'string',
        label: 'One sentence: what it means',
        labels: { vi: 'Một câu: nghĩa là gì' },
        default: 'Why this item matters, in one sentence.',
        sample: 'Anything built on that plugin has to wait for the next minor release.',
        maxLength: 170,
        required: true,
      },
      { id: 'source', type: 'string', label: 'Source of the item', labels: { vi: 'Nguồn của tin' }, default: 'github.blog', sample: 'github.blog', maxLength: 40, required: true },
      { id: 'step', type: 'number', label: 'Which scene this is', default: 2, required: true },
      { id: 'total', type: 'number', label: 'How many scenes the film has', default: 3, required: true },
      { id: 'seconds', type: 'number', label: 'Length in seconds (the Assemble node gives it)', default: 4 },
    ],
  },
  close: {
    role: 'outro',
    description: 'Closing: what to watch next, against the axis mirrored on the right.',
    heading: 'What to watch next',
    css:
      commonCss +
      brand.css +
      rail.css +
      '.axis{position:absolute;right:110px;top:180px;bottom:300px;width:7px;border-radius:7px;background:' +
      ACCENT +
      '}' +
      '.end{position:absolute;left:190px;top:186px;display:flex;align-items:center;gap:14px;color:' +
      MUTED +
      ';font-size:20px;letter-spacing:.2em;font-weight:800}' +
      '.end b{display:block;width:10px;height:10px;border-radius:50%;background:' +
      ACCENT +
      '}' +
      '.close .title{position:absolute;left:150px;right:190px;top:420px;margin:0;text-align:right;font-size:96px;line-height:1.06;letter-spacing:-.03em;font-weight:850;max-height:520px;overflow:hidden}' +
      '.hair-one{left:190px;right:190px;top:1010px}' +
      '.close .detail{position:absolute;left:200px;right:190px;top:1076px;margin:0;text-align:right;font-size:38px;line-height:1.36;color:#c3d3e8;max-height:220px;overflow:hidden}',
    markup: `<div class="grid"></div>
      <span class="slot slot-brand">${brand.markup}</span>
      <div class="end"><b></b><span>END OF FEED</span></div>
      <div class="axis"></div>
      <div class="close"><h1 class="title"></h1><div class="hair hair-one"></div><p class="detail"></p></div>
      <span class="slot slot-rail">${rail.markup}</span>`,
    motion: `tl.fromTo(q('.grid'),{opacity:0},{opacity:1,duration:1,ease:'sine.out'},0)
      .fromTo(q('.end'),{opacity:0,x:-16},{opacity:1,x:0,duration:.5,ease:'power2.out'},.1)
      .fromTo(q('.axis'),{scaleY:0,transformOrigin:'top center'},{scaleY:1,duration:.8,ease:'power2.out'},.16)
      .fromTo(q('.close .title'),{y:50,opacity:0},{y:0,opacity:1,duration:.8,ease:'power3.out'},.3)
      .fromTo(q('.hair-one'),{scaleX:0,transformOrigin:'right center'},{scaleX:1,duration:.6,ease:'power2.out'},.7)
      .fromTo(q('.close .detail'),{y:26,opacity:0},{y:0,opacity:1,duration:.6,ease:'power2.out'},.8)
      ${brand.motion}
      ${rail.motion}`,
    extraScript: rail.before,
    variables: [
      { id: 'title', type: 'string', label: 'Closing line', labels: { vi: 'Câu kết' }, default: 'What to watch next', sample: 'Watch the next minor release', maxLength: 56, required: true },
      {
        id: 'detail',
        type: 'string',
        label: 'One sentence to close on',
        labels: { vi: 'Một câu kết' },
        default: 'The thread to follow once today is old news.',
        sample: 'If the plugin returns, this whole week gets rewritten.',
        maxLength: 150,
        required: true,
      },
      { id: 'step', type: 'number', label: 'Which scene this is', default: 3, required: true },
      { id: 'total', type: 'number', label: 'How many scenes the film has', default: 3, required: true },
      { id: 'seconds', type: 'number', label: 'Length in seconds (the Assemble node gives it)', default: 4 },
    ],
  },
};

// Keep the workflow JSON in sync with the scenes, the components this kit publishes, and the guide.
await editComposition(new URL('./workflow.json', import.meta.url), (files) => {
  // The shell the Studio previews and the inspector lints, until a run has Assemble write the entry.
  files['index.html'] = filmShell({ id: 'digest-shell', background: '#070a11' });
  for (const [kind, scene] of Object.entries(scenes)) files[`compositions/digest-${kind}.html`] = sceneBlock({ ...scene, id: `digest-${kind}`, seconds: 4 });
  // Published, not pasted: a writer may mount these into a frame of its own.
  for (const [name, part] of Object.entries(parts)) files[`compositions/components/${name}.html`] = component(part);
  files['storyboard-guide.md'] =
    `---\nfirst: hook\nlast: outro\nrepeat: 3\n---\nMake a short technology digest in English, vertical 9:16, about 55–65 seconds, laid out as a feed: an opening on the left axis, one numbered row per item, a close against the right axis.\nUse only what is in Research and the URLs the person gave. Never invent a number, a date, a version or a quote.\nEvery scene carries its own place in the film: step (1 for the opening, then 2, 3 … for the items, and the last number for the close) and total (how many scenes the film has). The running bar at the foot of every scene reads those two.\nEvery item scene carries a two-digit number in order (01, 02, 03), a headline of at most 56 characters, one sentence that says what happened and why it matters, and the source of that item as a bare domain of at most 40 characters; the source strip at the foot of the item reads that.\nThe kit also publishes components a writer may mount into a frame of its own: brand-corner (the mark and the film's name), ticker-index (a numbered index), source-chip and progress-rail (the two the scenes already paste). Mount one only where the scene does not already carry it.\nDrop an item when Research has no evidence for it; three short items beat three padded ones. Do not call a rumour a release, and do not turn a blog post into a study.`;
});
