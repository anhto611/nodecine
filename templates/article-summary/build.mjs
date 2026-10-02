import { component, editComposition, filmShell, marginNote, paste, sceneBlock, sectionRule } from '../_kit/build.mjs';

/**
 * The article summary as an editorial column.
 *
 * One grammar for all three scenes: a standing head over a pair of rules, a narrow measure carrying the
 * writing, a margin to its right carrying where the piece came from, and a folio along the foot. There
 * is no centred card and no masthead band — a column is read top to bottom, and the type is set to a
 * measure rather than to the width of the page.
 *
 * The standing head and the margin note are components this kit publishes, pasted from the same
 * definitions so a scene's own still and a writer's mount cannot drift apart.
 */

const ACCENT = '#62dce7';

const head = paste(sectionRule({ label: 'SUMMARY FROM A LINK', accent: ACCENT, color: '#8fa8bd' }));
const margin = paste(marginNote({ accent: ACCENT, color: '#c3d3e8', line: '#2b4468' }));

/** Where the pasted parts sit: the column's business, not theirs. */
const slots =
  '.slot-head{position:absolute;left:150px;right:430px;top:176px;height:88px}' +
  '.slot-margin{position:absolute;left:820px;right:150px;height:440px}' +
  '.column{position:absolute;left:150px;right:430px;top:0;bottom:0}' +
  '.column .hair{position:absolute;left:0;right:0;height:1px;background:#2b4468}' +
  '.folio{position:absolute;left:150px;right:150px;bottom:120px;display:flex;align-items:center;gap:22px;color:#7d9bb0;font-size:18px;font-weight:800;letter-spacing:.18em}' +
  '.folio i{display:block;flex:1;height:1px;background:#2b4468}';

const scenes = {
  hook: {
    role: 'hook',
    description: 'Editorial opening: the most important source-supported angle, with context and attribution.',
    heading: 'What the article is saying',
    css:
      slots +
      head.css +
      margin.css +
      '.slot-margin{top:340px}' +
      '.hook .title{position:absolute;left:0;right:0;top:336px;margin:0;font-size:76px;line-height:1.12;letter-spacing:-.03em;font-weight:800;max-height:560px;overflow:hidden}' +
      '.hook .hair{top:978px}' +
      '.hook .detail{position:absolute;left:0;right:0;top:1038px;margin:0;font-size:36px;line-height:1.38;color:#c4d5e9;max-height:300px;overflow:hidden}',
    markup: `<span class="slot slot-head">${head.markup}</span>
      <div class="column hook"><h1 class="title"></h1><div class="hair"></div><p class="detail"></p></div>
      <span class="slot slot-margin">${margin.markup}</span>
      <div class="folio"><span>01 / THE POINT</span><i></i><span>NODECINE</span></div>`,
    motion: `tl.fromTo(q('.hook .title'),{y:54,opacity:0},{y:0,opacity:1,duration:.8,ease:'power3.out'},.22)
      .fromTo(q('.hook .hair'),{scaleX:0,transformOrigin:'left center'},{scaleX:1,duration:.6,ease:'power2.out'},.66)
      .fromTo(q('.hook .detail'),{y:26,opacity:0},{y:0,opacity:1,duration:.6,ease:'power2.out'},.78)
      .fromTo(q('.folio'),{opacity:0},{opacity:1,duration:.6,ease:'sine.out'},1)
      ${head.motion}
      ${margin.motion}`,
    extraScript: margin.before,
  },
  point: {
    role: 'feature',
    description: 'One source-supported finding explained clearly, with its short source label.',
    heading: 'One point, explained',
    css:
      slots +
      head.css +
      margin.css +
      '.slot-margin{top:470px}' +
      '.point .num{position:absolute;left:0;top:288px;font-size:118px;line-height:1;font-weight:900;letter-spacing:-.05em;color:#5ad7e6}' +
      '.point .title{position:absolute;left:0;right:0;top:470px;margin:0;font-size:72px;line-height:1.1;letter-spacing:-.03em;font-weight:800;max-height:470px;overflow:hidden}' +
      '.point .hair{top:986px}' +
      '.point .detail{position:absolute;left:0;right:0;top:1046px;margin:0;font-size:36px;line-height:1.38;color:#c4d5e9;max-height:300px;overflow:hidden}',
    markup: `<span class="slot slot-head">${head.markup}</span>
      <div class="column point"><div class="num number-value">01</div><h1 class="title"></h1><div class="hair"></div><p class="detail"></p></div>
      <span class="slot slot-margin">${margin.markup}</span>
      <div class="folio"><span>02 / THE BODY</span><i></i><span>ONE POINT</span></div>`,
    motion: `tl.fromTo(q('.point .num'),{y:38,opacity:0},{y:0,opacity:1,duration:.6,ease:'power3.out'},.16)
      .fromTo(q('.point .title'),{y:48,opacity:0},{y:0,opacity:1,duration:.75,ease:'power3.out'},.3)
      .fromTo(q('.point .hair'),{scaleX:0,transformOrigin:'left center'},{scaleX:1,duration:.6,ease:'power2.out'},.7)
      .fromTo(q('.point .detail'),{y:26,opacity:0},{y:0,opacity:1,duration:.6,ease:'power2.out'},.82)
      .fromTo(q('.folio'),{opacity:0},{opacity:1,duration:.6,ease:'sine.out'},1)
      ${head.motion}
      ${margin.motion}`,
    extraScript: margin.before,
  },
  close: {
    role: 'outro',
    description: 'Final source-supported takeaway; concise synthesis without an invented call to action.',
    heading: 'What to remember',
    css:
      slots +
      head.css +
      margin.css +
      '.slot-margin{top:340px}' +
      '.close .title{position:absolute;left:0;right:0;top:336px;margin:0;font-size:84px;line-height:1.1;letter-spacing:-.035em;font-weight:800;max-height:520px;overflow:hidden}' +
      '.close .hair{top:918px}' +
      '.close .detail{position:absolute;left:0;right:0;top:978px;margin:0;font-size:38px;line-height:1.38;color:#d5d9e2;max-height:300px;overflow:hidden}',
    markup: `<span class="slot slot-head">${head.markup}</span>
      <div class="column close"><h1 class="title"></h1><div class="hair"></div><p class="detail"></p></div>
      <span class="slot slot-margin">${margin.markup}</span>
      <div class="folio"><span>03 / CLOSE</span><i></i><span>READ THE ORIGINAL ↗</span></div>`,
    motion: `tl.fromTo(q('.close .title'),{y:56,opacity:0},{y:0,opacity:1,duration:.8,ease:'power3.out'},.24)
      .fromTo(q('.close .hair'),{scaleX:0,transformOrigin:'left center'},{scaleX:1,duration:.6,ease:'power2.out'},.68)
      .fromTo(q('.close .detail'),{y:28,opacity:0},{y:0,opacity:1,duration:.6,ease:'power2.out'},.8)
      .fromTo(q('.folio'),{opacity:0},{opacity:1,duration:.6,ease:'sine.out'},1)
      ${head.motion}
      ${margin.motion}`,
    extraScript: margin.before,
  },
};

const commonCss = `html,body{margin:0;background:#081220}*{box-sizing:border-box}#root{position:absolute;inset:0;width:1080px;height:1920px;overflow:hidden;color:#f4f8fb;background:#081220;font-family:var(--font-body,Inter,Arial,sans-serif)}.nc-backdrop{position:absolute;inset:0;background:linear-gradient(180deg,#0c1c30 0,#081220 58%,#060d19 100%)}`;

// The point scene carries the sequence number as a drop numeral at the head of the column.
scenes.point.css += '.point .num.number-value{font-size:118px;letter-spacing:-.05em;color:#5ad7e6}';

function block(kind, scene) {
  return sceneBlock({
    id: `summary-${kind}`,
    role: scene.role,
    description: scene.description,
    css: `${commonCss}${scene.css}`,
    markup: scene.markup,
    motion: scene.motion,
    extraScript: scene.extraScript,
    variables: [
      {
        id: 'title',
        type: 'string',
        label: 'Short, source-supported headline',
        labels: { vi: 'Tiêu đề ngắn có căn cứ từ nguồn' },
        default: scene.heading,
        sample: kind === 'hook' ? 'One article, three things to know' : kind === 'point' ? 'The context is the story' : 'Understand it before you share it',
        maxLength: 40,
        required: true,
      },
      {
        id: 'detail',
        type: 'string',
        label: 'One clear explanatory sentence grounded in the source',
        labels: { vi: 'Một câu giải thích dựa trên bài gốc' },
        default: 'The key point, explained briefly from the article.',
        sample:
          kind === 'hook'
            ? 'Pull the point out of the detail and grasp it in seconds.'
            : kind === 'point'
              ? 'Read the explanation beside it to understand the article’s claim.'
              : 'The summary gives you the point; the original gives you the context.',
        maxLength: kind === 'point' ? 108 : 94,
        required: true,
      },
      {
        id: 'source',
        type: 'string',
        label: 'Short name or domain of the source article',
        labels: { vi: 'Tên ngắn hoặc tên miền của nguồn' },
        default: 'THE ORIGINAL ARTICLE',
        sample: 'THE ORIGINAL ARTICLE',
        maxLength: 48,
        required: true,
      },
      ...(kind === 'point'
        ? [
            {
              id: 'number',
              type: 'string',
              label: 'Two-digit sequence number of this key point',
              labels: { vi: 'Số thứ tự luận điểm, gồm hai chữ số' },
              default: '01',
              sample: '01',
              maxLength: 2,
              required: true,
            },
          ]
        : []),
      { id: 'seconds', type: 'number', label: 'Length in seconds (the Assemble node gives it)', default: 4 },
    ],
  });
}

// Keep the self-contained workflow JSON in sync with those three designs and the parts this kit holds.
await editComposition(new URL('./workflow.json', import.meta.url), (files) => {
  // The shell the Studio previews and the inspector lints, until a run has Assemble write the entry.
  files['index.html'] = filmShell({ id: 'summary-shell', background: '#0b1020' });
  for (const [kind, scene] of Object.entries(scenes)) files[`compositions/summary-${kind}.html`] = block(kind, scene);
  // Published, not pasted: a writer may mount these into a frame of its own.
  files['compositions/components/section-rule.html'] = component(sectionRule({ label: 'SUMMARY FROM A LINK', accent: ACCENT, color: '#8fa8bd' }));
  files['compositions/components/margin-note.html'] = component(marginNote({ accent: ACCENT, color: '#c3d3e8', line: '#2b4468' }));
  files['storyboard-guide.md'] =
    `---\nfirst: hook\nlast: outro\nrepeat: 2\n---\nMake a summary of an article in English, vertical 9:16, about 30–45 seconds, set as an editorial column: a standing head, a narrow measure of writing, a margin carrying the source, and a folio along the foot.\nUse only what is in Research and the URLs the person gave. Never invent a number, a quote or a conclusion.\nOpen with the most important point; each following scene makes one point; close with what the viewer should remember.\nEvery scene carries a title of at most 40 characters, a detail that is one short sentence adding meaning (not repeating the title), and a source of at most 48 characters: the name or domain of the article. Leave the source label out when the article is unknown.\nThe narration explains briefly, in plain English, and keeps the tone of the original. Drop a point when the source has no evidence for it. Do not call an article a scientific study when it is not.`;
  files['storyboard-guide.md'] += '\nIn summary-point scenes, fill number with the point’s order: 01, 02, 03…';
});
