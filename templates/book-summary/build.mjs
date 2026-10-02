import { editComposition, filmShell, sceneBlock } from '../_kit/build.mjs';

/**
 * Book summary: ideas lifted out of a book, in the book's own order.
 *
 * The writer makes one chapter scene per idea and the Assemble node lays them on the clock, so this is
 * a scene per role — an opening, one chapter (repeated by the guide), a close — and the film's entry
 * is the shell this kit ships for Assemble to replace.
 */

const commonCss =
  'html,body{margin:0;background:#050807}*{box-sizing:border-box}' +
  '#root{position:absolute;inset:0;width:1080px;height:1920px;overflow:hidden;color:#f0ece2;background:#050807;font-family:var(--font-body,Inter,Arial,sans-serif)}' +
  '.nc-backdrop{position:absolute;inset:0;background:radial-gradient(circle at 20% 6%,#14342a 0,#0a1512 52%,#040706 100%)}' +
  '.mast{position:absolute;top:91px;left:86px;right:86px;display:flex;align-items:center;gap:20px;color:#a9c4b6;font-size:19px;font-weight:850;letter-spacing:.14em;z-index:5}' +
  '.brand-mark{display:flex;align-items:center;justify-content:center;width:63px;height:63px;border-radius:17px;background:#d8b26a;color:#241a08;font-size:37px;font-weight:1000;letter-spacing:-.1em}' +
  '.brand-mark span{width:7px;height:7px;border-radius:50%;background:#241a08;margin-top:22px}' +
  '.edition{margin-left:auto;color:#7d9a8b;font-size:17px}' +
  '.foot{position:absolute;bottom:84px;left:86px;right:86px;display:flex;align-items:center;justify-content:space-between;padding-top:23px;border-top:1px solid #2b4a3d;color:#9db8aa;font-size:20px;font-weight:800;letter-spacing:.1em;z-index:5}' +
  '.foot-bars{display:flex;align-items:end;gap:6px;height:28px}' +
  '.foot-bars b{display:block;width:6px;background:#d8b26a;border-radius:3px}' +
  '.foot-bars b:nth-child(1){height:12px}.foot-bars b:nth-child(2){height:24px}.foot-bars b:nth-child(3){height:17px}.foot-bars b:nth-child(4){height:28px}.foot-bars b:nth-child(5){height:15px}';

const scenes = {
  open: {
    role: 'hook',
    description: 'Opening: what this book gives a reader, and which book it is.',
    heading: 'What this book gives you',
    css:
      commonCss +
      '.paper{position:absolute;left:86px;right:86px;top:320px;min-height:980px;padding:70px 66px;background:#f2ece0;color:#1b2320;border-radius:26px;box-shadow:0 50px 120px #02050499}' +
      '.paper-top{display:flex;justify-content:space-between;color:#5d6b62;font-size:20px;font-weight:850;letter-spacing:.14em}' +
      '.paper .title{margin:64px 0 0;font-size:88px;line-height:1.08;letter-spacing:-.03em;font-weight:850;max-height:520px;overflow:hidden}' +
      '.paper .rule{width:150px;height:8px;border-radius:8px;background:#b98c3f;margin:44px 0}' +
      '.paper .detail{margin:0;font-size:38px;line-height:1.4;color:#3c4a42;max-height:280px;overflow:hidden}' +
      '.book-line{position:absolute;left:96px;right:96px;bottom:300px;display:flex;align-items:center;gap:18px;color:#d8b26a;font-size:23px;font-weight:800;letter-spacing:.08em}' +
      '.book-line .source{flex:1;text-align:right;color:#e6ddc9;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    markup: `<div class="mast"><span class="brand-mark">N<span></span></span><span>BOOK SUMMARY</span><span class="edition">01 / OPENING</span></div>
      <div class="paper"><div class="paper-top"><span>THE PROMISE</span><span>01 / OPENING</span></div><h1 class="title"></h1><div class="rule"></div><p class="detail"></p></div>
      <div class="book-line"><span>THE BOOK</span><span class="source"></span></div>
      <div class="foot"><span>NODECINE / BOOK SUMMARY</span><span class="foot-bars"><b></b><b></b><b></b><b></b><b></b></span></div>`,
    motion: `tl.fromTo(q('.paper'),{y:110,opacity:0},{y:0,opacity:1,duration:.9,ease:'power3.out'},0)
      .fromTo(q('.paper-top'),{opacity:0},{opacity:1,duration:.5,ease:'sine.out'},.3)
      .fromTo(q('.paper .title'),{y:70,opacity:0},{y:0,opacity:1,duration:.85,ease:'power3.out'},.42)
      .fromTo(q('.paper .rule'),{scaleX:0,transformOrigin:'left center'},{scaleX:1,duration:.55,ease:'power2.out'},.86)
      .fromTo(q('.paper .detail'),{y:34,opacity:0},{y:0,opacity:1,duration:.6,ease:'power2.out'},.98)
      .fromTo(q('.book-line'),{y:30,opacity:0},{y:0,opacity:1,duration:.6,ease:'power2.out'},1.15);`,
    variables: [
      {
        id: 'title',
        type: 'string',
        label: 'What the book gives a reader',
        labels: { vi: 'Cuốn sách cho người đọc điều gì' },
        default: 'What this book gives you',
        sample: 'A way to think about attention',
        maxLength: 56,
        required: true,
      },
      {
        id: 'detail',
        type: 'string',
        label: 'One sentence on what it is for',
        labels: { vi: 'Một câu về mục đích cuốn sách' },
        default: 'What the book is for, in one sentence.',
        sample: 'It argues that attention is the scarce resource, and that most of our habits spend it badly.',
        maxLength: 160,
        required: true,
      },
      {
        id: 'source',
        type: 'string',
        label: 'The book and its author',
        labels: { vi: 'Tên sách và tác giả' },
        default: 'The book · its author',
        sample: 'Stolen Focus · Johann Hari',
        maxLength: 60,
        required: true,
      },
      { id: 'seconds', type: 'number', label: 'Length in seconds (the Assemble node gives it)', default: 4 },
    ],
  },
  chapter: {
    role: 'feature',
    description: 'One idea from the book, and where in the book it sits.',
    heading: 'One idea',
    css:
      commonCss +
      '.chapter-no{position:absolute;right:64px;top:286px;font-size:290px;line-height:1;font-weight:900;letter-spacing:-.08em;color:#12291f}' +
      '.chapter-chip{position:absolute;left:96px;top:344px;color:#d8b26a;font-size:22px;font-weight:850;letter-spacing:.16em}' +
      '.card{position:absolute;left:76px;right:76px;top:620px;min-height:800px;padding:62px 60px 70px;background:#f2ece0;color:#1b2320;border-radius:26px;box-shadow:0 50px 110px #02050499}' +
      '.card .title{margin:0;font-size:80px;line-height:1.1;letter-spacing:-.03em;font-weight:850;max-height:400px;overflow:hidden}' +
      '.card .rule{width:100%;height:3px;background:#cbbfa6;margin:44px 0 36px}' +
      '.card .detail{margin:0;font-size:38px;line-height:1.38;color:#3c4a42;max-height:250px;overflow:hidden}' +
      '.note{position:absolute;left:96px;right:96px;top:1560px;display:flex;align-items:center;gap:20px;color:#bcd3c6;font-size:23px;letter-spacing:.04em}' +
      '.note span:first-child{color:#d8b26a;font-size:19px;letter-spacing:.16em;font-weight:800}' +
      '.note .source{flex:1;text-align:right;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    markup: `<div class="mast"><span class="brand-mark">N<span></span></span><span>BOOK SUMMARY</span><span class="edition">02 / CHAPTERS</span></div>
      <div class="chapter-no number-value">01</div>
      <span class="chapter-chip">CHAPTER</span>
      <div class="card"><h1 class="title"></h1><div class="rule"></div><p class="detail"></p></div>
      <div class="note"><span>WHERE IT SITS</span><span class="source"></span></div>
      <div class="foot"><span>NODECINE / BOOK SUMMARY</span><span class="foot-bars"><b></b><b></b><b></b><b></b><b></b></span></div>`,
    motion: `tl.fromTo(q('.chapter-no'),{y:60,opacity:0},{y:0,opacity:1,duration:.7,ease:'power3.out'},0)
      .fromTo(q('.chapter-chip'),{x:-24,opacity:0},{x:0,opacity:1,duration:.5,ease:'power2.out'},.16)
      .fromTo(q('.card'),{y:110,opacity:0},{y:0,opacity:1,duration:.8,ease:'power3.out'},.26)
      .fromTo(q('.card .title'),{y:40,opacity:0},{y:0,opacity:1,duration:.65,ease:'power3.out'},.5)
      .fromTo(q('.card .rule'),{scaleX:0,transformOrigin:'left center'},{scaleX:1,duration:.6,ease:'power2.out'},.72)
      .fromTo(q('.card .detail'),{y:30,opacity:0},{y:0,opacity:1,duration:.55,ease:'power2.out'},.9)
      .fromTo(q('.note'),{y:36,opacity:0},{y:0,opacity:1,duration:.55,ease:'power2.out'},1.05);`,
    variables: [
      { id: 'number', type: 'string', label: 'Chapter number, two digits', labels: { vi: 'Số thứ tự chương, hai chữ số' }, default: '01', sample: '01', maxLength: 2, required: true },
      { id: 'title', type: 'string', label: 'The idea', labels: { vi: 'Ý của chương' }, default: 'One idea', sample: 'Attention is spent, not lost', maxLength: 56, required: true },
      {
        id: 'detail',
        type: 'string',
        label: 'One sentence that explains it',
        labels: { vi: 'Một câu giải thích' },
        default: 'What the idea means, in one sentence.',
        sample: 'Every interruption costs more than the minute it takes, because the thread has to be rebuilt.',
        maxLength: 170,
        required: true,
      },
      { id: 'source', type: 'string', label: 'Where it sits in the book', labels: { vi: 'Vị trí trong sách' }, default: 'Chapter one', sample: 'Part 2 — Chapter 4', maxLength: 48, required: true },
      { id: 'seconds', type: 'number', label: 'Length in seconds (the Assemble node gives it)', default: 4 },
    ],
  },
  close: {
    role: 'outro',
    description: 'Closing: what to keep from the book, without an invented call to action.',
    heading: 'What to keep',
    css:
      commonCss +
      '.close{position:absolute;inset:0}' +
      '.close .title{position:absolute;left:96px;right:96px;top:620px;margin:0;font-size:100px;line-height:1.08;letter-spacing:-.03em;font-weight:850;max-height:520px;overflow:hidden}' +
      '.close .rule{position:absolute;left:96px;top:1240px;width:150px;height:9px;border-radius:9px;background:#d8b26a}' +
      '.close .detail{position:absolute;left:96px;right:130px;top:1320px;margin:0;font-size:40px;line-height:1.36;color:#c9d8ce;max-height:250px;overflow:hidden}' +
      '.close-mark{position:absolute;right:96px;top:548px;font-size:150px;line-height:1;color:#12291f;font-weight:900}',
    markup: `<div class="mast"><span class="brand-mark">N<span></span></span><span>BOOK SUMMARY</span><span class="edition">03 / KEEP</span></div>
      <div class="close"><div class="close-mark">§</div><h1 class="title"></h1><div class="rule"></div><p class="detail"></p></div>
      <div class="foot"><span>NODECINE / BOOK SUMMARY</span><span class="foot-bars"><b></b><b></b><b></b><b></b><b></b></span></div>`,
    motion: `tl.fromTo(q('.close-mark'),{scale:.6,rotation:-30,opacity:0},{scale:1,rotation:0,opacity:1,duration:.8,ease:'back.out(1.4)'},0)
      .fromTo(q('.close .title'),{y:60,opacity:0},{y:0,opacity:1,duration:.8,ease:'power3.out'},.26)
      .fromTo(q('.close .rule'),{scaleX:0,transformOrigin:'left center'},{scaleX:1,duration:.55,ease:'power2.out'},.76)
      .fromTo(q('.close .detail'),{y:34,opacity:0},{y:0,opacity:1,duration:.6,ease:'power2.out'},.88);`,
    variables: [
      { id: 'title', type: 'string', label: 'What to keep', labels: { vi: 'Điều nên giữ lại' }, default: 'What to keep', sample: 'Keep the argument, not the anecdote', maxLength: 56, required: true },
      {
        id: 'detail',
        type: 'string',
        label: 'One sentence to close on',
        labels: { vi: 'Một câu kết' },
        default: 'The one thing worth carrying out of this book.',
        sample: 'The book is at its best where it counts interruptions; its own stories prove less.',
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
  files['index.html'] = filmShell({ id: 'book-shell', background: '#050807' });
  for (const [kind, scene] of Object.entries(scenes)) files[`compositions/book-${kind}.html`] = sceneBlock({ ...scene, id: `book-${kind}`, seconds: 4 });
  files['storyboard-guide.md'] =
    `---\nfirst: hook\nlast: outro\nrepeat: 3\n---\nMake a summary of a book in English, vertical 9:16, about 80–100 seconds.\nUse only what is in Research, the notes the person wrote and the URLs they gave. Never invent a quote, a page number or a figure.\nOpen with what the book gives a reader; one idea per chapter scene, in the book's own order; close with what to keep.\nEvery chapter scene carries a two-digit number in order (01, 02, 03), the idea in at most 56 characters, one sentence that explains it, and where it sits in the book (part, chapter or section, at most 48 characters).\nName the book and its author once, on the opening scene, in the source line. Drop an idea when Research has no support for it, and never present a summary of a summary as the book's own claim.`;
});
