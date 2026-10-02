import { editComposition, sceneBlock } from '../_kit/build.mjs';

/** The three scenes of the article summary: an opening, one point, and what to remember. */
const scenes = {
  hook: {
    role: 'hook',
    description: 'Editorial opening: the most important source-supported angle, with context and attribution.',
    heading: 'What the article is saying',
    markup: `<div class="orbit orbit-one"></div><div class="orbit orbit-two"></div>
      <div class="mast"><span class="brand-mark">N<span></span></span><span>ARTICLE / SUMMARY</span><span class="edition">01 / OPENING</span></div>
      <div class="hook-copy"><div class="eyebrow"><i></i> TODAY’S ISSUE</div><h1 class="title"></h1><div class="accent-rule"></div><p class="detail"></p></div>
      <div class="paper-stage"><div class="paper-back"></div><div class="paper"><div class="paper-top"><span>THE ARTICLE</span><span>● ● ●</span></div><div class="paper-line long"></div><div class="paper-line mid"></div><div class="paper-highlight"></div><div class="paper-line short"></div><div class="paper-line mid"></div><div class="paper-line long"></div><div class="paper-index">01<span> / THE STORY</span></div></div><div class="scan-chip">KEY POINT CHOSEN <b>↗</b></div></div>
      <div class="foot"><span class="source"></span><span class="foot-bars"><b></b><b></b><b></b><b></b><b></b></span></div>`,
    css: `.hook-copy{position:absolute;top:290px;left:86px;right:86px;z-index:3}.hook-copy .title{margin:38px 0 0;font-size:100px;line-height:1.04;letter-spacing:-.055em;max-height:440px;overflow:hidden}.hook-copy .detail{margin:30px 0 0;max-width:830px;font-size:39px;line-height:1.35;color:#c4d5e9;max-height:160px;overflow:hidden}.accent-rule{width:165px;height:9px;margin-top:45px;border-radius:9px;background:#66e4f5}.paper-stage{position:absolute;left:128px;top:1050px;width:850px;height:650px;z-index:2}.paper-back{position:absolute;left:95px;top:30px;width:620px;height:530px;background:#1a3656;border:1px solid #426c89;border-radius:30px;transform:rotate(11deg)}.paper{position:absolute;left:80px;top:24px;width:620px;height:530px;padding:42px 46px;background:#eaf3f5;color:#14243b;border-radius:24px;box-shadow:0 45px 100px #030a18aa;transform:rotate(-6deg)}.paper-top{display:flex;justify-content:space-between;font-size:20px;font-weight:850;letter-spacing:.12em;margin-bottom:72px}.paper-top span:last-child{color:#39adbd}.paper-line{height:14px;background:#c5d5d9;border-radius:10px;margin:21px 0}.paper-line.long{width:100%}.paper-line.mid{width:76%}.paper-line.short{width:55%}.paper-highlight{width:88%;height:44px;background:#a5ebed;border-radius:8px;margin:20px 0}.paper-index{position:absolute;bottom:38px;font-size:40px;font-weight:900;color:#2a8291}.paper-index span{font-size:17px;letter-spacing:.12em}.scan-chip{position:absolute;right:0;bottom:100px;padding:22px 27px;background:#59e0e8;color:#102640;border-radius:12px;font-size:20px;font-weight:900;letter-spacing:.08em;box-shadow:0 20px 50px #04142799}.scan-chip b{margin-left:20px;font-size:30px}.orbit{position:absolute;border:1px solid #2d6680;border-radius:50%;opacity:.45}.orbit-one{width:830px;height:830px;left:500px;top:750px}.orbit-two{width:1140px;height:1140px;left:340px;top:580px}`,
    motion: `tl.fromTo(q('.eyebrow'),{y:26,opacity:0},{y:0,opacity:1,duration:.45,ease:'power2.out'},0)
      .fromTo(q('.title'),{y:80,opacity:0},{y:0,opacity:1,duration:.75,ease:'power3.out'},.14)
      .fromTo(q('.accent-rule'),{scaleX:0,transformOrigin:'left center'},{scaleX:1,duration:.55,ease:'power2.out'},.55)
      .fromTo(q('.detail'),{y:35,opacity:0},{y:0,opacity:1,duration:.55,ease:'power2.out'},.68)
      .fromTo(q('.paper-stage'),{y:120,rotation:4,opacity:0},{y:0,rotation:0,opacity:1,duration:.9,ease:'power3.out'},.35)
      .fromTo(q('.scan-chip'),{x:80,opacity:0},{x:0,opacity:1,duration:.5,ease:'power2.out'},1.1);`,
  },
  point: {
    role: 'feature',
    description: 'One source-supported finding explained clearly, with its short source label.',
    heading: 'One point, explained',
    markup: `<div class="grid-lines"></div><div class="mast"><span class="brand-mark">N<span></span></span><span>READ FAST / GO DEEP</span><span class="edition">02 / BODY</span></div>
      <div class="point-top"><span class="section-chip">NOTABLE POINT</span><span class="plus">✳</span></div>
      <div class="point-number"><span class="number-value">01</span><span> / INSIGHT</span></div>
      <div class="point-card"><div class="card-ribbon"><span>KEY POINT</span><span>↗</span></div><h1 class="title"></h1><div class="divider"></div><p class="detail"></p><div class="card-corner">◢</div></div>
      <div class="point-aside"><span class="aside-line"></span><span>VIEW FROM THE ARTICLE</span></div>
      <div class="foot"><span class="source"></span><span class="foot-bars"><b></b><b></b><b></b><b></b><b></b></span></div>`,
    css: `.grid-lines{position:absolute;inset:0;background-image:linear-gradient(#ffffff08 1px,transparent 1px),linear-gradient(90deg,#ffffff08 1px,transparent 1px);background-size:90px 90px;mask-image:linear-gradient(transparent 10%,#000 80%)}.point-top{position:absolute;left:86px;right:86px;top:292px;display:flex;align-items:center;justify-content:space-between}.section-chip{border:1px solid #65dce9;color:#72e4ed;border-radius:999px;padding:15px 25px;font-size:23px;font-weight:850;letter-spacing:.1em}.plus{font-size:54px;color:#67e4ef}.point-number{position:absolute;top:385px;left:78px;font-size:340px;line-height:1;font-weight:900;letter-spacing:-.12em;color:#294c66}.point-number span{font-size:22px;letter-spacing:.12em;color:#75a7b9;vertical-align:middle;margin-left:30px}.point-card{position:absolute;left:76px;right:76px;top:690px;min-height:750px;padding:65px 65px 80px;background:#f0f5f2;color:#11283c;border-radius:32px;box-shadow:0 50px 110px #0311219c;overflow:hidden}.card-ribbon{display:flex;justify-content:space-between;align-items:center;color:#206c7a;font-size:21px;font-weight:900;letter-spacing:.15em}.card-ribbon span:last-child{font-size:40px}.point-card .title{margin:50px 0 0;font-size:84px;line-height:1.08;letter-spacing:-.05em;max-height:370px;overflow:hidden}.divider{width:100%;height:3px;background:#a8c5c8;margin:50px 0 38px}.point-card .detail{margin:0;font-size:40px;line-height:1.36;color:#355368;max-height:220px;overflow:hidden}.card-corner{position:absolute;right:0;bottom:-20px;font-size:130px;color:#4fc7cb}.point-aside{position:absolute;left:90px;top:1535px;display:flex;align-items:center;gap:22px;color:#a8c7d8;font-size:22px;font-weight:750;letter-spacing:.16em}.aside-line{width:120px;height:3px;background:#5edce6}`,
    motion: `tl.fromTo(q('.point-number'),{y:70,opacity:0},{y:0,opacity:1,duration:.7,ease:'power3.out'},0)
      .fromTo(q('.point-card'),{y:130,opacity:0},{y:0,opacity:1,duration:.8,ease:'power3.out'},.2)
      .fromTo(q('.card-ribbon'),{y:20,opacity:0},{y:0,opacity:1,duration:.45},.6)
      .fromTo(q('.title'),{y:45,opacity:0},{y:0,opacity:1,duration:.65,ease:'power3.out'},.72)
      .fromTo(q('.divider'),{scaleX:0,transformOrigin:'left center'},{scaleX:1,duration:.6},1.1)
      .fromTo(q('.detail'),{y:30,opacity:0},{y:0,opacity:1,duration:.55},1.24);`,
  },
  close: {
    role: 'outro',
    description: 'Final source-supported takeaway; concise synthesis without an invented call to action.',
    heading: 'What to remember',
    markup: `<div class="halo"></div><div class="halo inner"></div><div class="mast"><span class="brand-mark">N<span></span></span><span>KEY POINTS / WRAP-UP</span><span class="edition">03 / CLOSE</span></div>
      <div class="close-symbol">✳</div><div class="close-content"><div class="close-label"><span class="label-dot"></span> WHAT TO REMEMBER <span class="label-line"></span></div><h1 class="title"></h1><p class="detail"></p><div class="close-rule"></div><div class="close-note">READ THE ORIGINAL FOR THE FULL CONTEXT <span>↗</span></div></div>
      <div class="source-panel"><span>ARTICLE SOURCE</span><strong class="source"></strong><span class="source-arrow">↗</span></div>
      <div class="foot"><span>NODECINE / ARTICLE SUMMARY</span><span class="foot-bars"><b></b><b></b><b></b><b></b><b></b></span></div>`,
    css: `.halo{position:absolute;width:900px;height:900px;left:90px;top:330px;border:2px solid #b393563e;border-radius:50%;box-shadow:0 0 180px #e1ab4422,inset 0 0 150px #e1ab4416}.halo.inner{width:650px;height:650px;left:215px;top:455px;border-color:#e0bc7142}.close-symbol{position:absolute;right:118px;top:250px;font-size:150px;color:#f5cb70;line-height:1}.close-content{position:absolute;left:86px;right:86px;top:540px;text-align:center}.close-label{display:flex;align-items:center;justify-content:center;gap:20px;color:#f4ce79;font-size:24px;font-weight:850;letter-spacing:.14em}.label-dot{width:13px;height:13px;border-radius:50%;background:#f4ce79}.label-line{width:75px;height:2px;background:#f4ce79}.close-content .title{margin:80px 0 0;font-size:100px;line-height:1.08;letter-spacing:-.055em;max-height:450px;overflow:hidden}.close-content .detail{margin:60px auto 0;max-width:770px;color:#d5d9e2;font-size:42px;line-height:1.38;max-height:230px;overflow:hidden}.close-rule{height:4px;width:125px;margin:70px auto 40px;background:#f2c667}.close-note{font-size:20px;letter-spacing:.1em;color:#aeb9c9;font-weight:760}.close-note span{color:#f0c870;font-size:30px;margin-left:10px}.source-panel{position:absolute;bottom:238px;left:86px;right:86px;display:flex;align-items:center;gap:28px;padding:33px 36px;border:1px solid #737b8d;background:#ffffff0c;border-radius:17px}.source-panel span:first-child{font-size:17px;color:#f1c571;letter-spacing:.13em;font-weight:800}.source-panel .source{font-size:26px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex:1;text-align:right}.source-arrow{font-size:36px;color:#f1c571}`,
    motion: `tl.fromTo(q('.halo'),{scale:.82,opacity:0},{scale:1,opacity:1,duration:1.2,ease:'power2.out'},0)
      .fromTo(q('.close-symbol'),{scale:.5,rotation:-70,opacity:0},{scale:1,rotation:0,opacity:1,duration:.8,ease:'back.out(1.5)'},.1)
      .fromTo(q('.close-label'),{y:30,opacity:0},{y:0,opacity:1,duration:.5},.3)
      .fromTo(q('.title'),{y:80,opacity:0},{y:0,opacity:1,duration:.8,ease:'power3.out'},.52)
      .fromTo(q('.detail'),{y:40,opacity:0},{y:0,opacity:1,duration:.6},1.02)
      .fromTo(q('.source-panel'),{y:65,opacity:0},{y:0,opacity:1,duration:.6},1.3);`,
  },
};

const commonCss = `html,body{margin:0;background:#081220}*{box-sizing:border-box}#root{position:absolute;inset:0;width:1080px;height:1920px;overflow:hidden;color:#f4f8fb;background:#081220;font-family:var(--font-body,Inter,Arial,sans-serif)}.nc-backdrop{position:absolute;inset:0;background:radial-gradient(circle at 85% 25%,#1d3d59 0,#0c1b2c 52%,#081220 100%)}.mast{position:absolute;top:91px;left:86px;right:86px;display:flex;align-items:center;gap:21px;color:#b8d6e3;font-size:19px;font-weight:850;letter-spacing:.13em;z-index:5}.brand-mark{display:flex;align-items:center;justify-content:center;width:63px;height:63px;border-radius:17px;background:#62dce7;color:#0b2638;font-size:37px;font-weight:1000;letter-spacing:-.1em}.brand-mark span{width:7px;height:7px;border-radius:50%;background:#0b2638;margin-top:22px}.edition{margin-left:auto;color:#84a5b8;font-size:17px}.foot{position:absolute;bottom:84px;left:86px;right:86px;display:flex;align-items:center;justify-content:space-between;padding-top:23px;border-top:1px solid #718ca078;color:#abc0d0;font-size:21px;font-weight:800;letter-spacing:.08em;z-index:5}.foot .source{max-width:720px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.foot-bars{display:flex;align-items:end;gap:6px;height:28px}.foot-bars b{display:block;width:6px;background:#6fdce7;border-radius:3px}.foot-bars b:nth-child(1){height:12px}.foot-bars b:nth-child(2){height:24px}.foot-bars b:nth-child(3){height:17px}.foot-bars b:nth-child(4){height:28px}.foot-bars b:nth-child(5){height:15px}.eyebrow{display:flex;align-items:center;gap:16px;color:#6ce6ef;font-size:25px;font-weight:850;letter-spacing:.14em}.eyebrow i{display:block;width:16px;height:16px;border-radius:50%;background:#6ce6ef}`;

scenes.point.css += '.point-number .number-value{font-size:340px;letter-spacing:-.12em;color:#294c66;vertical-align:baseline;margin-left:0}';

function block(kind, scene) {
  return sceneBlock({
    id: `summary-${kind}`,
    role: scene.role,
    description: scene.description,
    css: `${commonCss}${scene.css}`,
    markup: scene.markup,
    motion: scene.motion,
    variables: [
    { id: 'title', type: 'string', label: 'Short, source-supported headline', labels: { vi: 'Tiêu đề ngắn có căn cứ từ nguồn' }, default: scene.heading, sample: kind === 'hook' ? 'One article, three things to know' : kind === 'point' ? 'The context is the story' : 'Understand it before you share it', maxLength: 40, required: true },
    { id: 'detail', type: 'string', label: 'One clear explanatory sentence grounded in the source', labels: { vi: 'Một câu giải thích dựa trên bài gốc' }, default: 'The key point, explained briefly from the article.', sample: kind === 'hook' ? 'Pull the point out of the detail and grasp it in seconds.' : kind === 'point' ? 'Read the explanation beside it to understand the article’s claim.' : 'The summary gives you the point; the original gives you the context.', maxLength: kind === 'point' ? 108 : 94, required: true },
    { id: 'source', type: 'string', label: 'Short name or domain of the source article', labels: { vi: 'Tên ngắn hoặc tên miền của nguồn' }, default: 'THE ORIGINAL ARTICLE', sample: 'THE ORIGINAL ARTICLE', maxLength: 48, required: true },
    ...(kind === 'point' ? [{ id: 'number', type: 'string', label: 'Two-digit sequence number of this key point', labels: { vi: 'Số thứ tự luận điểm, gồm hai chữ số' }, default: '01', sample: '01', maxLength: 2, required: true }] : []),
    { id: 'seconds', type: 'number', label: 'Length in seconds (the Assemble node gives it)', default: 4 },
    ],
  });
}

// Keep the self-contained workflow JSON in sync with those three designs.
await editComposition(new URL('./workflow.json', import.meta.url), (files) => {
  for (const [kind, scene] of Object.entries(scenes)) files[`compositions/summary-${kind}.html`] = block(kind, scene);
  files['storyboard-guide.md'] = `---\nfirst: hook\nlast: outro\nrepeat: 2\n---\nMake a summary of an article in English, vertical 9:16, about 30–45 seconds.\nUse only what is in Research and the URLs the person gave. Never invent a number, a quote or a conclusion.\nOpen with the most important point; each following scene makes one point; close with what the viewer should remember.\nEvery scene carries a title of at most 40 characters, a detail that is one short sentence adding meaning (not repeating the title), and a source of at most 48 characters: the name or domain of the article. Leave the source label out when the article is unknown.\nThe narration explains briefly, in plain English, and keeps the tone of the original. Drop a point when the source has no evidence for it. Do not call an article a scientific study when it is not.`;
  files['storyboard-guide.md'] += '\nIn summary-point scenes, fill number with the point’s order: 01, 02, 03…';
});
