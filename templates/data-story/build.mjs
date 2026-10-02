import { editComposition, filmShell, sceneBlock } from '../_kit/build.mjs';

/**
 * Data story: one claim per scene, each with its number and where it came from.
 *
 * The writer makes the scenes and Assemble lays them on the clock, so this is a scene per role — an
 * opening, one claim (repeated by the guide), a close — and the film's entry is the shell this kit
 * ships for Assemble to replace.
 */

const commonCss =
  'html,body{margin:0;background:#0a0a10}*{box-sizing:border-box}' +
  '#root{position:absolute;inset:0;width:1080px;height:1920px;overflow:hidden;color:#f2f2f7;background:#0a0a10;font-family:var(--font-body,Inter,Arial,sans-serif)}' +
  '.nc-backdrop{position:absolute;inset:0;background:radial-gradient(circle at 78% 8%,#241f4a 0,#12101f 52%,#08080e 100%)}' +
  '.dots{position:absolute;inset:0;background-image:radial-gradient(#ffffff14 1.5px,transparent 1.5px);background-size:44px 44px}' +
  '.mast{position:absolute;top:91px;left:86px;right:86px;display:flex;align-items:center;gap:20px;color:#b7b2d8;font-size:19px;font-weight:850;letter-spacing:.14em;z-index:5}' +
  '.brand-mark{display:flex;align-items:center;justify-content:center;width:63px;height:63px;border-radius:17px;background:#8b7cf6;color:#12102a;font-size:37px;font-weight:1000;letter-spacing:-.1em}' +
  '.brand-mark span{width:7px;height:7px;border-radius:50%;background:#12102a;margin-top:22px}' +
  '.edition{margin-left:auto;color:#7c76a0;font-size:17px}' +
  '.foot{position:absolute;bottom:84px;left:86px;right:86px;display:flex;align-items:center;justify-content:space-between;padding-top:23px;border-top:1px solid #2f2a52;color:#a49ec6;font-size:20px;font-weight:800;letter-spacing:.1em;z-index:5}' +
  '.foot-bars{display:flex;align-items:end;gap:6px;height:28px}' +
  '.foot-bars b{display:block;width:6px;background:#ff8f7a;border-radius:3px}' +
  '.foot-bars b:nth-child(1){height:12px}.foot-bars b:nth-child(2){height:24px}.foot-bars b:nth-child(3){height:17px}.foot-bars b:nth-child(4){height:28px}.foot-bars b:nth-child(5){height:15px}';

const scenes = {
  open: {
    role: 'hook',
    description: 'Opening: the question the numbers answer, and why it is worth a minute.',
    heading: 'The question',
    css:
      commonCss +
      '.open{position:absolute;inset:0}' +
      '.chip{position:absolute;left:96px;top:376px;display:inline-flex;align-items:center;gap:14px;padding:14px 24px;border:1px solid #8b7cf6;border-radius:999px;color:#c3bcff;font-size:22px;font-weight:850;letter-spacing:.14em}' +
      '.open .title{position:absolute;left:96px;right:96px;top:520px;margin:0;font-size:96px;line-height:1.07;letter-spacing:-.03em;font-weight:850;max-height:660px;overflow:hidden}' +
      '.open .rule{position:absolute;left:96px;top:1240px;width:170px;height:9px;border-radius:9px;background:#8b7cf6}' +
      '.open .detail{position:absolute;left:96px;right:140px;top:1310px;margin:0;font-size:38px;line-height:1.34;color:#c9c4e4;max-height:230px;overflow:hidden}' +
      '.axis{position:absolute;left:96px;right:96px;bottom:300px;display:flex;align-items:center;gap:12px}' +
      '.axis b{display:block;flex:1;height:6px;border-radius:6px;background:#2b2650}' +
      '.axis b:first-child{background:#8b7cf6}',
    markup: `<div class="dots"></div>
      <div class="mast"><span class="brand-mark">N<span></span></span><span>DATA STORY</span><span class="edition">01 / THE QUESTION</span></div>
      <div class="open"><span class="chip">THE NUMBERS</span><h1 class="title"></h1><div class="rule"></div><p class="detail"></p></div>
      <div class="axis"><b></b><b></b><b></b><b></b><b></b></div>
      <div class="foot"><span>NODECINE / DATA STORY</span><span class="foot-bars"><b></b><b></b><b></b><b></b><b></b></span></div>`,
    motion: `tl.fromTo(q('.dots'),{opacity:0},{opacity:1,duration:1,ease:'sine.out'},0)
      .fromTo(q('.chip'),{y:26,opacity:0},{y:0,opacity:1,duration:.5,ease:'power2.out'},.12)
      .fromTo(q('.open .title'),{y:70,opacity:0},{y:0,opacity:1,duration:.85,ease:'power3.out'},.26)
      .fromTo(q('.open .rule'),{scaleX:0,transformOrigin:'left center'},{scaleX:1,duration:.55,ease:'power2.out'},.72)
      .fromTo(q('.open .detail'),{y:32,opacity:0},{y:0,opacity:1,duration:.6,ease:'power2.out'},.84)
      .fromTo(q('.axis b'),{scaleX:0,transformOrigin:'left center',stagger:.08},{scaleX:1,duration:.45,ease:'power2.out'},1.02);`,
    variables: [
      {
        id: 'title',
        type: 'string',
        label: 'The question the story answers',
        labels: { vi: 'Câu hỏi mà mạch chuyện trả lời' },
        default: 'What the numbers say',
        sample: 'Where the money actually goes',
        maxLength: 56,
        required: true,
      },
      {
        id: 'detail',
        type: 'string',
        label: 'One sentence on why it matters',
        labels: { vi: 'Một câu vì sao đáng quan tâm' },
        default: 'Why this question is worth a minute.',
        sample: 'Three figures, one table, and a conclusion most coverage skips.',
        maxLength: 150,
        required: true,
      },
      { id: 'seconds', type: 'number', label: 'Length in seconds (the Assemble node gives it)', default: 4 },
    ],
  },
  chart: {
    role: 'feature',
    description: 'One claim, its figure, how much of the whole that figure is, and where it came from.',
    heading: 'One claim',
    css:
      commonCss +
      '.chart{position:absolute;left:96px;right:96px;top:296px}' +
      '.figure{margin:0;font-size:270px;line-height:.94;font-weight:900;letter-spacing:-.055em;color:#ff8f7a;max-height:300px;overflow:hidden}' +
      '.track{position:absolute;left:96px;right:96px;top:690px;height:26px;border-radius:13px;background:#1b1834;overflow:hidden}' +
      '.fill{height:100%;width:0;border-radius:13px;background:linear-gradient(90deg,#8b7cf6,#ff8f7a)}' +
      '.claim{position:absolute;left:96px;right:96px;top:812px;margin:0;font-size:76px;line-height:1.12;letter-spacing:-.03em;font-weight:850;max-height:420px;overflow:hidden}' +
      '.detail{position:absolute;left:96px;right:150px;top:1290px;margin:0;font-size:36px;line-height:1.36;color:#c9c4e4;max-height:250px;overflow:hidden}' +
      '.src{position:absolute;left:96px;right:96px;top:1600px;display:flex;align-items:center;gap:20px;padding:26px 30px;border:1px solid #2f2a52;border-radius:16px;background:#12101f}' +
      '.src span:first-child{color:#8b7cf6;font-size:18px;letter-spacing:.14em;font-weight:800}' +
      '.src .source{flex:1;text-align:right;font-size:26px;color:#e8e5f6;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    markup: `<div class="dots"></div>
      <div class="mast"><span class="brand-mark">N<span></span></span><span>DATA STORY</span><span class="edition">02 / THE FIGURES</span></div>
      <div class="chart"><p class="figure"></p></div>
      <div class="track"><div class="fill"></div></div>
      <h1 class="claim title"></h1>
      <p class="detail"></p>
      <div class="src"><span>WHERE IT COMES FROM</span><span class="source"></span></div>
      <div class="foot"><span>NODECINE / DATA STORY</span><span class="foot-bars"><b></b><b></b><b></b><b></b><b></b></span></div>`,
    motion: `tl.fromTo(q('.figure'),{y:60,opacity:0},{y:0,opacity:1,duration:.8,ease:'power3.out'},0)
      .fromTo(q('.track'),{opacity:0},{opacity:1,duration:.4,ease:'sine.out'},.42)
      .fromTo(q('.fill'),{width:'0%'},{width:(Math.max(0,Math.min(1,Number(v.share)||0))*100)+'%',duration:.9,ease:'power2.out'},.5)
      .fromTo(q('.claim'),{y:44,opacity:0},{y:0,opacity:1,duration:.65,ease:'power3.out'},.6)
      .fromTo(q('.detail'),{y:30,opacity:0},{y:0,opacity:1,duration:.55,ease:'power2.out'},.9)
      .fromTo(q('.src'),{y:36,opacity:0},{y:0,opacity:1,duration:.55,ease:'power2.out'},1.05);`,
    // The bar is drawn from the share the writer kept: the figure says how big, the bar says how much.
    extraScript: `var fillBar=root.querySelector('.fill');if(fillBar)fillBar.style.width=(Math.max(0,Math.min(1,Number(v.share)||0))*100)+'%';`,
    variables: [
      { id: 'figure', type: 'string', label: 'The figure, as the source prints it', labels: { vi: 'Con số, đúng như nguồn in' }, default: '62%', sample: '62%', maxLength: 12, required: true },
      { id: 'share', type: 'number', label: 'How much of the whole it is, from 0 to 1', labels: { vi: 'Nó chiếm bao nhiêu phần trăm của tổng, từ 0 đến 1' }, default: 0.62, sample: 0.62 },
      {
        id: 'title',
        type: 'string',
        label: 'The claim',
        labels: { vi: 'Nhận định' },
        default: 'What the figure means',
        sample: 'Most of it is spent before the year starts',
        maxLength: 56,
        required: true,
      },
      {
        id: 'detail',
        type: 'string',
        label: 'One sentence that explains it',
        labels: { vi: 'Một câu giải thích' },
        default: 'What it measures, in one sentence.',
        sample: 'The figure counts households, not people, so a city of renters weighs less than it looks.',
        maxLength: 170,
        required: true,
      },
      {
        id: 'source',
        type: 'string',
        label: 'Where the figure came from',
        labels: { vi: 'Nguồn của con số' },
        default: 'the report',
        sample: 'Office for Budget Responsibility, 2024',
        maxLength: 48,
        required: true,
      },
      { id: 'seconds', type: 'number', label: 'Length in seconds (the Assemble node gives it)', default: 4 },
    ],
  },
  close: {
    role: 'outro',
    description: 'Closing: what the figures mean together, without inventing a conclusion.',
    heading: 'What it means',
    css:
      commonCss +
      '.close{position:absolute;inset:0}' +
      '.close .title{position:absolute;left:96px;right:96px;top:620px;margin:0;font-size:100px;line-height:1.08;letter-spacing:-.03em;font-weight:850;max-height:520px;overflow:hidden}' +
      '.close .rule{position:absolute;left:96px;top:1240px;width:150px;height:9px;border-radius:9px;background:#ff8f7a}' +
      '.close .detail{position:absolute;left:96px;right:130px;top:1320px;margin:0;font-size:40px;line-height:1.36;color:#c9c4e4;max-height:250px;overflow:hidden}' +
      '.close-mark{position:absolute;right:96px;top:556px;font-size:150px;line-height:1;color:#2b2650;font-weight:900}',
    markup: `<div class="dots"></div>
      <div class="mast"><span class="brand-mark">N<span></span></span><span>DATA STORY</span><span class="edition">03 / WHAT IT MEANS</span></div>
      <div class="close"><div class="close-mark">∑</div><h1 class="title"></h1><div class="rule"></div><p class="detail"></p></div>
      <div class="foot"><span>NODECINE / DATA STORY</span><span class="foot-bars"><b></b><b></b><b></b><b></b><b></b></span></div>`,
    motion: `tl.fromTo(q('.dots'),{opacity:0},{opacity:1,duration:1,ease:'sine.out'},0)
      .fromTo(q('.close-mark'),{scale:.6,opacity:0},{scale:1,opacity:1,duration:.8,ease:'back.out(1.4)'},.1)
      .fromTo(q('.close .title'),{y:60,opacity:0},{y:0,opacity:1,duration:.8,ease:'power3.out'},.3)
      .fromTo(q('.close .rule'),{scaleX:0,transformOrigin:'left center'},{scaleX:1,duration:.55,ease:'power2.out'},.8)
      .fromTo(q('.close .detail'),{y:34,opacity:0},{y:0,opacity:1,duration:.6,ease:'power2.out'},.92);`,
    variables: [
      {
        id: 'title',
        type: 'string',
        label: 'What the figures mean together',
        labels: { vi: 'Các con số cùng nói lên điều gì' },
        default: 'What it means',
        sample: 'The headline number was the least interesting one',
        maxLength: 56,
        required: true,
      },
      {
        id: 'detail',
        type: 'string',
        label: 'One sentence to close on',
        labels: { vi: 'Một câu kết' },
        default: 'The one thing the numbers say together.',
        sample: 'Two of the three figures move together; the third is the one to watch next year.',
        maxLength: 160,
        required: true,
      },
      { id: 'seconds', type: 'number', label: 'Length in seconds (the Assemble node gives it)', default: 4 },
    ],
  },
};

// Keep the workflow JSON in sync with the three scene designs and the guide the writer reads.
await editComposition(new URL('./workflow.json', import.meta.url), (files) => {
  // The shell the Studio previews and the inspector lints, until a run has Assemble write the entry.
  files['index.html'] = filmShell({ id: 'data-shell', background: '#0a0a10' });
  files['compositions/data-open.html'] = sceneBlock({ ...scenes.open, id: 'data-open', seconds: 4 });
  // The claim scene fills its figure as well as its words, so its text keys carry `figure` too.
  files['compositions/data-chart.html'] = sceneBlock({ ...scenes.chart, id: 'data-chart', seconds: 4, textKeys: ['figure', 'title', 'detail', 'source'] });
  files['compositions/data-close.html'] = sceneBlock({ ...scenes.close, id: 'data-close', seconds: 4 });
  files['storyboard-guide.md'] =
    `---\nfirst: hook\nlast: outro\nrepeat: 3\n---\nMake a story told with numbers in English, vertical 9:16, about 65–85 seconds.\nUse only the figures Research kept, each with the source's own wording, unit and year. Never invent, extrapolate or round a figure in a way that changes what it says.\nOpen with the question the story answers; one claim per scene; close with what the figures mean together.\nEvery claim scene carries the figure as the source prints it (at most 12 characters including its unit), the share of the whole it represents as a number between 0 and 1 when the source gives one (use 0 when it does not), the claim in at most 56 characters, one sentence that explains it, and where the figure came from (at most 48 characters).\nSay what a figure measures, not only how big it is: "62% of adults" is a claim, "62%" is not.`;
});
