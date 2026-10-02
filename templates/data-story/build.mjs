import { axisScale, component, editComposition, filmShell, paste, sceneBlock, sourceLine, statPoster } from '../_kit/build.mjs';

/**
 * The data story as a poster.
 *
 * One grammar for all three scenes: a figure or a mark set so large it runs off the left edge of the
 * frame, a scale under it with a marker where the figure falls, the claim across the lower third, and a
 * fine line along the foot saying where the number came from. There is no masthead band and no centred
 * card — a poster is read from the number down.
 *
 * The figure, the scale and the source line are components this kit publishes, pasted from the same
 * definitions so a scene's own still and a writer's mount cannot drift apart.
 */

const CORAL = '#ff8f7a';
const MUTED = '#8b93b8';
const TRACK = '#2b2650';

const poster = paste(statPoster({ accent: CORAL }));
const scale = paste(axisScale({ accent: CORAL, color: MUTED, track: TRACK }));
const source = paste(sourceLine({ accent: CORAL, color: MUTED, track: TRACK }));

/** Where a pasted part sits, and the thin stamp that stands in for a masthead here. */
const posterSlots =
  '.slot-poster{position:absolute;left:-40px;right:80px;top:196px;height:404px}' +
  '.slot-axis{position:absolute;left:150px;right:150px;top:704px;height:92px}' +
  '.slot-source{position:absolute;left:110px;right:110px;bottom:118px;height:56px}' +
  '.stamp{position:absolute;z-index:3;left:110px;top:108px;color:' +
  MUTED +
  ';font-size:17px;font-weight:800;letter-spacing:.2em}' +
  '.body{position:absolute;left:110px;right:130px}' +
  '.body .hair{position:absolute;left:0;right:0;height:1px;background:' +
  TRACK +
  '}' +
  '.mark{position:absolute;left:-60px;font-size:560px;line-height:1;font-weight:900;color:#241f4a}';

const commonCss =
  'html,body{margin:0;background:#0a0a10}*{box-sizing:border-box}' +
  '#root{position:absolute;inset:0;width:1080px;height:1920px;overflow:hidden;color:#f2f2f7;background:#0a0a10;font-family:var(--font-body,Inter,Arial,sans-serif)}' +
  '.nc-backdrop{position:absolute;inset:0;background:radial-gradient(circle at 80% 6%,#241f4a 0,#12101f 54%,#08080e 100%)}' +
  '.dots{position:absolute;inset:0;background-image:radial-gradient(#ffffff12 1.5px,transparent 1.5px);background-size:44px 44px}' +
  posterSlots;

const scenes = {
  open: {
    role: 'hook',
    description: 'Opening: the question the numbers answer, under a mark that runs off the edge.',
    heading: 'What the numbers say',
    css:
      commonCss +
      source.css +
      '.open .mark{top:120px}' +
      '.open .title{position:absolute;left:0;right:0;top:716px;margin:0;font-size:96px;line-height:1.06;letter-spacing:-.035em;font-weight:850;max-height:560px;overflow:hidden}' +
      '.open .hair{top:1330px}' +
      '.open .detail{position:absolute;left:0;right:0;top:1392px;margin:0;font-size:38px;line-height:1.36;color:#c9c4e4;max-height:260px;overflow:hidden}',
    markup: `<div class="dots"></div>
      <span class="stamp">DATA STORY / 01</span>
      <div class="mark">?</div>
      <div class="body open"><h1 class="title"></h1><div class="hair"></div><p class="detail"></p></div>
      <span class="slot slot-source">${source.markup}</span>`,
    motion: `tl.fromTo(q('.dots'),{opacity:0},{opacity:1,duration:1,ease:'sine.out'},0)
      .fromTo(q('.mark'),{x:-80,opacity:0},{x:0,opacity:1,duration:.9,ease:'power3.out'},.06)
      .fromTo(q('.open .title'),{y:54,opacity:0},{y:0,opacity:1,duration:.8,ease:'power3.out'},.34)
      .fromTo(q('.open .hair'),{scaleX:0,transformOrigin:'left center'},{scaleX:1,duration:.6,ease:'power2.out'},.78)
      .fromTo(q('.open .detail'),{y:26,opacity:0},{y:0,opacity:1,duration:.6,ease:'power2.out'},.9)
      ${source.motion}`,
    extraScript: source.before,
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
      {
        id: 'source',
        type: 'string',
        label: 'Where the figures come from',
        labels: { vi: 'Nguồn của các con số' },
        default: 'the report',
        sample: 'Office for Budget Responsibility, 2024',
        maxLength: 48,
        required: true,
      },
      { id: 'seconds', type: 'number', label: 'Length in seconds (the Assemble node gives it)', default: 4 },
    ],
  },
  chart: {
    role: 'feature',
    description: 'One claim: the figure running off the edge, a scale under it, and where it came from.',
    heading: 'One claim',
    css:
      commonCss +
      poster.css +
      scale.css +
      source.css +
      '.chart .title{position:absolute;left:0;right:0;top:996px;margin:0;font-size:84px;line-height:1.08;letter-spacing:-.03em;font-weight:850;max-height:420px;overflow:hidden}' +
      '.chart .hair{top:1476px}' +
      '.chart .detail{position:absolute;left:0;right:0;top:1538px;margin:0;font-size:36px;line-height:1.36;color:#c9c4e4;max-height:240px;overflow:hidden}',
    markup: `<div class="dots"></div>
      <span class="stamp">DATA STORY / 02</span>
      <span class="slot slot-poster">${poster.markup}</span>
      <span class="slot slot-axis">${scale.markup}</span>
      <div class="body chart"><h1 class="title"></h1><div class="hair"></div><p class="detail"></p></div>
      <span class="slot slot-source">${source.markup}</span>`,
    motion: `tl.fromTo(q('.dots'),{opacity:0},{opacity:1,duration:1,ease:'sine.out'},0)
      .fromTo(q('.chart .title'),{y:48,opacity:0},{y:0,opacity:1,duration:.75,ease:'power3.out'},.55)
      .fromTo(q('.chart .hair'),{scaleX:0,transformOrigin:'left center'},{scaleX:1,duration:.6,ease:'power2.out'},.9)
      .fromTo(q('.chart .detail'),{y:26,opacity:0},{y:0,opacity:1,duration:.6,ease:'power2.out'},1)
      ${poster.motion}
      ${scale.motion}
      ${source.motion}`,
    extraScript: `${poster.before}\n  ${scale.before}\n  ${source.before}`,
    variables: [
      { id: 'figure', type: 'string', label: 'The figure, as the source prints it', labels: { vi: 'Con số, đúng như nguồn in' }, default: '62%', sample: '62%', maxLength: 12, required: true },
      { id: 'share', type: 'number', label: 'How much of the whole it is, from 0 to 1', labels: { vi: 'Nó chiếm bao nhiêu phần của tổng, từ 0 đến 1' }, default: 0.62, sample: 0.62 },
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
    description: 'Closing: what the figures mean together, under a sum that runs off the edge.',
    heading: 'What it means',
    css:
      commonCss +
      source.css +
      '.close .mark{top:120px}' +
      '.close .title{position:absolute;left:0;right:0;top:716px;margin:0;font-size:100px;line-height:1.06;letter-spacing:-.035em;font-weight:850;max-height:560px;overflow:hidden}' +
      '.close .hair{top:1330px}' +
      '.close .detail{position:absolute;left:0;right:0;top:1392px;margin:0;font-size:40px;line-height:1.36;color:#c9c4e4;max-height:260px;overflow:hidden}',
    markup: `<div class="dots"></div>
      <span class="stamp">DATA STORY / 03</span>
      <div class="mark">∑</div>
      <div class="body close"><h1 class="title"></h1><div class="hair"></div><p class="detail"></p></div>
      <span class="slot slot-source">${source.markup}</span>`,
    motion: `tl.fromTo(q('.dots'),{opacity:0},{opacity:1,duration:1,ease:'sine.out'},0)
      .fromTo(q('.mark'),{x:-80,opacity:0},{x:0,opacity:1,duration:.9,ease:'power3.out'},.06)
      .fromTo(q('.close .title'),{y:54,opacity:0},{y:0,opacity:1,duration:.8,ease:'power3.out'},.32)
      .fromTo(q('.close .hair'),{scaleX:0,transformOrigin:'left center'},{scaleX:1,duration:.6,ease:'power2.out'},.76)
      .fromTo(q('.close .detail'),{y:26,opacity:0},{y:0,opacity:1,duration:.6,ease:'power2.out'},.88)
      ${source.motion}`,
    extraScript: source.before,
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
      {
        id: 'source',
        type: 'string',
        label: 'Where the figures come from',
        labels: { vi: 'Nguồn của các con số' },
        default: 'the report',
        sample: 'Office for Budget Responsibility, 2024',
        maxLength: 48,
        required: true,
      },
      { id: 'seconds', type: 'number', label: 'Length in seconds (the Assemble node gives it)', default: 4 },
    ],
  },
};

// Keep the workflow JSON in sync with the three scenes, the components this kit publishes, and the guide.
await editComposition(new URL('./workflow.json', import.meta.url), (files) => {
  // The shell the Studio previews and the inspector lints, until a run has Assemble write the entry.
  files['index.html'] = filmShell({ id: 'data-shell', background: '#0a0a10' });
  for (const [kind, scene] of Object.entries(scenes)) files[`compositions/data-${kind}.html`] = sceneBlock({ ...scene, id: `data-${kind}`, seconds: 4 });
  // Published, not pasted: a writer may mount these into a frame of its own.
  files['compositions/components/stat-poster.html'] = component(statPoster({ accent: CORAL }));
  files['compositions/components/axis-scale.html'] = component(axisScale({ accent: CORAL, color: MUTED, track: TRACK }));
  files['compositions/components/source-line.html'] = component(sourceLine({ accent: CORAL, color: MUTED, track: TRACK }));
  files['storyboard-guide.md'] =
    `---\nfirst: hook\nlast: outro\nrepeat: 3\n---\nMake a story told with numbers in English, vertical 9:16, about 65–85 seconds, set as a poster: the figure runs off the left edge, a scale sits under it with a marker where the figure falls, the claim runs across the lower third, and a fine line at the foot says where the number came from.\nUse only the figures Research kept, each with the source's own wording, unit and year. Never invent, extrapolate or round a figure in a way that changes what it says.\nOpen with the question the story answers; one claim per scene; close with what the figures mean together.\nEvery claim scene carries the figure as the source prints it (at most 12 characters including its unit), the share of the whole it represents as a number between 0 and 1 when the source gives one (use 0 when it does not), the claim in at most 56 characters, one sentence that explains it, and where the figure came from (at most 48 characters).\nEvery scene carries a source: the report, table or page the figures come from, at most 48 characters.\nSay what a figure measures, not only how big it is: "62% of adults" is a claim, "62%" is not.`;
});
