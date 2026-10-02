import { editComposition, filmShell, sceneBlock } from '../_kit/build.mjs';

/**
 * Three things today: a short technology digest.
 *
 * The writer makes one item per link and the Assemble node lays them on the clock, so this kit is a
 * scene per role — an opening, one item (repeated by the guide), and a close — rather than the film's
 * entry: `index.html` stays empty and Assemble writes it.
 */

const commonCss =
  'html,body{margin:0;background:#070a11}*{box-sizing:border-box}' +
  '#root{position:absolute;inset:0;width:1080px;height:1920px;overflow:hidden;color:#eef2f8;background:#070a11;font-family:var(--font-body,Inter,Arial,sans-serif)}' +
  '.nc-backdrop{position:absolute;inset:0;background:radial-gradient(circle at 76% 10%,#1d3055 0,#0d1424 52%,#070a11 100%)}' +
  '.grid{position:absolute;inset:0;background-image:linear-gradient(#ffffff08 1px,transparent 1px),linear-gradient(90deg,#ffffff08 1px,transparent 1px);background-size:96px 96px}' +
  '.mast{position:absolute;top:91px;left:86px;right:86px;display:flex;align-items:center;gap:20px;color:#9fb4d4;font-size:19px;font-weight:850;letter-spacing:.14em;z-index:5}' +
  '.brand-mark{display:flex;align-items:center;justify-content:center;width:63px;height:63px;border-radius:17px;background:#5ee6a8;color:#06231a;font-size:37px;font-weight:1000;letter-spacing:-.1em}' +
  '.brand-mark span{width:7px;height:7px;border-radius:50%;background:#06231a;margin-top:22px}' +
  '.edition{margin-left:auto;color:#6d84a6;font-size:17px}' +
  '.foot{position:absolute;bottom:84px;left:86px;right:86px;display:flex;align-items:center;justify-content:space-between;padding-top:23px;border-top:1px solid #35507a;color:#8fa6c6;font-size:20px;font-weight:800;letter-spacing:.1em;z-index:5}' +
  '.foot-bars{display:flex;align-items:end;gap:6px;height:28px}' +
  '.foot-bars b{display:block;width:6px;background:#5ee6a8;border-radius:3px}' +
  '.foot-bars b:nth-child(1){height:12px}.foot-bars b:nth-child(2){height:24px}.foot-bars b:nth-child(3){height:17px}.foot-bars b:nth-child(4){height:28px}.foot-bars b:nth-child(5){height:15px}';

const scenes = {
  open: {
    role: 'hook',
    description: 'Opening: what today’s items have in common, and why they are worth a minute.',
    heading: 'Three things worth knowing today',
    css:
      commonCss +
      '.open-kicker{position:absolute;left:96px;top:430px;display:inline-flex;align-items:center;gap:16px;padding:14px 24px;border:1px solid #5ee6a8;border-radius:999px;color:#5ee6a8;font-size:22px;font-weight:850;letter-spacing:.12em}' +
      '.open .title{position:absolute;left:96px;right:96px;top:560px;margin:0;font-size:96px;line-height:1.06;letter-spacing:-.03em;font-weight:850;max-height:640px;overflow:hidden}' +
      '.open .rule{position:absolute;left:96px;top:1250px;width:170px;height:9px;border-radius:9px;background:#5ee6a8}' +
      '.open .detail{position:absolute;left:96px;right:150px;top:1320px;margin:0;font-size:38px;line-height:1.34;color:#c3d3e8;max-height:230px;overflow:hidden}' +
      '.count-row{position:absolute;left:96px;bottom:290px;display:flex;align-items:center;gap:16px;color:#8fa6c6;font-size:21px;letter-spacing:.16em}' +
      '.count-row b{display:block;width:46px;height:6px;border-radius:6px;background:#5ee6a8}',
    markup: `<div class="grid"></div>
      <div class="mast"><span class="brand-mark">N<span></span></span><span>TECH DIGEST</span><span class="edition">01 / TODAY</span></div>
      <span class="open-kicker">TODAY</span>
      <h1 class="title"></h1>
      <div class="rule"></div>
      <p class="detail"></p>
      <div class="count-row"><b></b><b></b><b></b><span>THREE ITEMS</span></div>
      <div class="foot"><span>NODECINE / TECH DIGEST</span><span class="foot-bars"><b></b><b></b><b></b><b></b><b></b></span></div>`,
    motion: `tl.fromTo(q('.grid'),{opacity:0},{opacity:1,duration:1.1,ease:'sine.out'},0)
      .fromTo(q('.open-kicker'),{y:26,opacity:0},{y:0,opacity:1,duration:.5,ease:'power2.out'},.1)
      .fromTo(q('.title'),{y:70,opacity:0},{y:0,opacity:1,duration:.85,ease:'power3.out'},.24)
      .fromTo(q('.rule'),{scaleX:0,transformOrigin:'left center'},{scaleX:1,duration:.55,ease:'power2.out'},.7)
      .fromTo(q('.detail'),{y:32,opacity:0},{y:0,opacity:1,duration:.6,ease:'power2.out'},.82)
      .fromTo(q('.count-row'),{opacity:0},{opacity:1,duration:.6,ease:'sine.out'},1.05);`,
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
      { id: 'seconds', type: 'number', label: 'Length in seconds (the Assemble node gives it)', default: 4 },
    ],
  },
  item: {
    role: 'feature',
    description: 'One item: what happened, why it matters, and where it came from.',
    heading: 'What happened',
    css:
      commonCss +
      '.item-no{position:absolute;right:64px;top:318px;font-size:300px;line-height:1;font-weight:900;letter-spacing:-.1em;color:#16263f}' +
      '.item-chip{position:absolute;left:96px;top:374px;display:inline-flex;align-items:center;gap:14px;color:#5ee6a8;font-size:22px;font-weight:850;letter-spacing:.16em}' +
      '.card{position:absolute;left:76px;right:76px;top:640px;min-height:840px;padding:60px 60px 70px;background:#0f1a2e;border:1px solid #24395c;border-radius:28px;box-shadow:0 50px 110px #03060ecc}' +
      '.card .title{margin:0;font-size:82px;line-height:1.1;letter-spacing:-.03em;font-weight:850;max-height:420px;overflow:hidden}' +
      '.card .rule{width:100%;height:3px;background:#2b4468;margin:44px 0 36px}' +
      '.card .detail{margin:0;font-size:38px;line-height:1.36;color:#b9cbe4;max-height:250px;overflow:hidden}' +
      '.chip{position:absolute;left:96px;right:96px;top:1560px;display:flex;align-items:center;gap:20px;padding:26px 30px;border:1px solid #2b4468;border-radius:16px;background:#0c1526}' +
      '.chip span:first-child{color:#5ee6a8;font-size:18px;letter-spacing:.14em;font-weight:800}' +
      '.chip .source{flex:1;text-align:right;font-size:28px;color:#dbe6f5;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    markup: `<div class="grid"></div>
      <div class="mast"><span class="brand-mark">N<span></span></span><span>TECH DIGEST</span><span class="edition">02 / ITEMS</span></div>
      <div class="item-no number-value">01</div>
      <span class="item-chip">ITEM</span>
      <div class="card"><h1 class="title"></h1><div class="rule"></div><p class="detail"></p></div>
      <div class="chip"><span>SOURCE</span><span class="source"></span></div>
      <div class="foot"><span>NODECINE / TECH DIGEST</span><span class="foot-bars"><b></b><b></b><b></b><b></b><b></b></span></div>`,
    motion: `tl.fromTo(q('.item-no'),{y:60,opacity:0},{y:0,opacity:1,duration:.7,ease:'power3.out'},0)
      .fromTo(q('.item-chip'),{x:-24,opacity:0},{x:0,opacity:1,duration:.5,ease:'power2.out'},.16)
      .fromTo(q('.card'),{y:110,opacity:0},{y:0,opacity:1,duration:.8,ease:'power3.out'},.26)
      .fromTo(q('.card .rule'),{scaleX:0,transformOrigin:'left center'},{scaleX:1,duration:.6,ease:'power2.out'},.72)
      .fromTo(q('.card .title'),{y:40,opacity:0},{y:0,opacity:1,duration:.65,ease:'power3.out'},.5)
      .fromTo(q('.card .detail'),{y:30,opacity:0},{y:0,opacity:1,duration:.55,ease:'power2.out'},.9)
      .fromTo(q('.chip'),{y:40,opacity:0},{y:0,opacity:1,duration:.55,ease:'power2.out'},1.05);`,
    variables: [
      { id: 'number', type: 'string', label: 'Item number, two digits', labels: { vi: 'Số thứ tự tin, hai chữ số' }, default: '01', sample: '01', maxLength: 2, required: true },
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
      { id: 'source', type: 'string', label: 'Source of the item', labels: { vi: 'Nguồn của tin' }, default: 'example.com', sample: 'github.blog', maxLength: 40, required: true },
      { id: 'seconds', type: 'number', label: 'Length in seconds (the Assemble node gives it)', default: 4 },
    ],
  },
  close: {
    role: 'outro',
    description: 'Closing: what to watch next, without inventing a call to action.',
    heading: 'What to watch next',
    css:
      commonCss +
      '.close .title{position:absolute;left:96px;right:96px;top:620px;margin:0;font-size:100px;line-height:1.08;letter-spacing:-.03em;font-weight:850;max-height:520px;overflow:hidden}' +
      '.close .rule{position:absolute;left:96px;top:1230px;width:150px;height:9px;border-radius:9px;background:#5ee6a8}' +
      '.close .detail{position:absolute;left:96px;right:130px;top:1310px;margin:0;font-size:40px;line-height:1.34;color:#c3d3e8;max-height:240px;overflow:hidden}' +
      '.close-mark{position:absolute;right:96px;top:560px;font-size:150px;line-height:1;color:#1d3355;font-weight:900}',
    markup: `<div class="grid"></div>
      <div class="mast"><span class="brand-mark">N<span></span></span><span>TECH DIGEST</span><span class="edition">03 / NEXT</span></div>
      <div class="close-mark">✳</div>
      <h1 class="title"></h1>
      <div class="rule"></div>
      <p class="detail"></p>
      <div class="foot"><span>NODECINE / TECH DIGEST</span><span class="foot-bars"><b></b><b></b><b></b><b></b><b></b></span></div>`,
    motion: `tl.fromTo(q('.grid'),{opacity:0},{opacity:1,duration:1,ease:'sine.out'},0)
      .fromTo(q('.close-mark'),{scale:.6,rotation:-40,opacity:0},{scale:1,rotation:0,opacity:1,duration:.8,ease:'back.out(1.4)'},.1)
      .fromTo(q('.title'),{y:60,opacity:0},{y:0,opacity:1,duration:.8,ease:'power3.out'},.34)
      .fromTo(q('.rule'),{scaleX:0,transformOrigin:'left center'},{scaleX:1,duration:.55,ease:'power2.out'},.84)
      .fromTo(q('.detail'),{y:34,opacity:0},{y:0,opacity:1,duration:.6,ease:'power2.out'},.96);`,
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
      { id: 'seconds', type: 'number', label: 'Length in seconds (the Assemble node gives it)', default: 4 },
    ],
  },
};

// Keep the workflow JSON in sync with the three scene designs and the guide the writer reads.
await editComposition(new URL('./workflow.json', import.meta.url), (files) => {
  // The shell the Studio previews and the inspector lints, until a run has Assemble write the entry.
  files['index.html'] = filmShell({ id: 'digest-shell', background: '#070a11' });
  for (const [kind, scene] of Object.entries(scenes)) files[`compositions/digest-${kind}.html`] = sceneBlock({ ...scene, id: `digest-${kind}`, seconds: 4 });
  files['storyboard-guide.md'] =
    `---\nfirst: hook\nlast: outro\nrepeat: 3\n---\nMake a short technology digest in English, vertical 9:16, about 55–65 seconds.\nUse only what is in Research and the URLs the person gave. Never invent a number, a date, a version or a quote.\nOpen with what today's items have in common, or why they are worth a minute; one item per scene, in the order the links were given; close with what to watch next.\nEvery item scene carries a two-digit number in order (01, 02, 03), a headline of at most 56 characters, one sentence that says what happened and why it matters, and the source of that item as a bare domain of at most 40 characters.\nDrop an item when Research has no evidence for it; three short items beat three padded ones. Do not call a rumour a release, and do not turn a blog post into a study.`;
});
