import { component, editComposition, filmShell, paste, ribbon, runningHead, sceneBlock } from '../_kit/build.mjs';

/**
 * The book summary as an open book.
 *
 * One grammar for all three scenes: two pages on the dark table, a gutter between them, the verso
 * carrying the running head (and, for a chapter, its number) and the recto carrying the writing. A
 * bookmark hangs over the recto's outer edge with where the passage sits set down its length. There is
 * no masthead band and no centred card — a spread is read left to right.
 *
 * The running head and the bookmark are components this kit publishes, pasted from the same definitions
 * so a scene's own still and a writer's mount cannot drift apart.
 */

const PAPER = '#f2ece0';
const INK = '#1b2320';
const BRASS = '#b98c3f';

const head = paste(runningHead({ title: 'BOOK SUMMARY', color: '#5d6b62', rule: '#cbbfa6' }));
const mark = paste(ribbon({ label: 'IN THE BOOK', accent: BRASS, ink: '#2a1d08' }));

/** Where a pasted part sits: the spread's business, not theirs. */
const spread =
  '.book{position:absolute;left:90px;right:90px;top:300px;height:1320px;background:' +
  PAPER +
  ';color:' +
  INK +
  ';border-radius:10px;box-shadow:0 60px 130px #02050499}' +
  '.gutter{position:absolute;left:446px;top:0;bottom:0;width:8px;background:linear-gradient(90deg,#00000000,#00000024 45%,#00000000)}' +
  '.verso{position:absolute;left:60px;width:330px;top:0;bottom:0}' +
  '.recto{position:absolute;left:510px;right:70px;top:0;bottom:0}' +
  '.slot-head{position:absolute;left:0;right:0;top:64px;height:74px}' +
  '.slot-mark{position:absolute;right:-30px;top:-46px;width:62px;height:640px}' +
  '.recto .title{position:absolute;left:0;right:0;margin:0;font-weight:850;letter-spacing:-.03em;overflow:hidden}' +
  '.recto .rule{position:absolute;left:0;width:130px;height:8px;border-radius:8px;background:' +
  BRASS +
  '}' +
  '.recto .detail{position:absolute;left:0;right:0;margin:0;color:#3c4a42;overflow:hidden}' +
  '.folio{position:absolute;left:150px;right:150px;bottom:120px;display:flex;align-items:center;justify-content:space-between;color:#7d9a8b;font-size:18px;font-weight:800;letter-spacing:.18em}' +
  '.label{position:absolute;left:0;color:' +
  BRASS +
  ';font-size:19px;font-weight:850;letter-spacing:.2em}' +
  '.chapter-no{position:absolute;left:0;font-size:140px;line-height:1;font-weight:900;letter-spacing:-.05em;color:' +
  INK +
  '}' +
  '.close-mark{position:absolute;left:0;font-size:150px;line-height:1;color:#cbbfa6}';

const scenes = {
  open: {
    role: 'hook',
    description: 'Opening: what this book gives a reader, on the recto of an open spread.',
    heading: 'What this book gives you',
    css:
      spread +
      head.css +
      mark.css +
      '.recto .title{top:246px;font-size:74px;line-height:1.12;max-height:620px}' +
      '.recto .rule{top:950px}' +
      '.recto .detail{top:1012px;font-size:36px;line-height:1.4;max-height:270px}' +
      '.label{top:190px}',
    markup: `<div class="book"><div class="gutter"></div>
        <div class="verso"><span class="slot slot-head">${head.markup}</span><span class="label">WHAT IT GIVES YOU</span></div>
        <div class="recto"><h1 class="title"></h1><div class="rule"></div><p class="detail"></p></div>
        <span class="slot slot-mark">${mark.markup}</span>
      </div>
      <div class="folio"><span>01 / THE PROMISE</span><span>NODECINE</span></div>`,
    motion: `tl.fromTo(q('.book'),{y:70,opacity:0},{y:0,opacity:1,duration:.8,ease:'power3.out'},0)
      .fromTo(q('.label'),{opacity:0},{opacity:1,duration:.5,ease:'sine.out'},.34)
      .fromTo(q('.recto .title'),{y:44,opacity:0},{y:0,opacity:1,duration:.75,ease:'power3.out'},.4)
      .fromTo(q('.recto .rule'),{scaleX:0,transformOrigin:'left center'},{scaleX:1,duration:.55,ease:'power2.out'},.84)
      .fromTo(q('.recto .detail'),{y:24,opacity:0},{y:0,opacity:1,duration:.6,ease:'power2.out'},.96)
      .fromTo(q('.folio'),{opacity:0},{opacity:1,duration:.6,ease:'sine.out'},1.1)
      ${head.motion}
      ${mark.motion}`,
    extraScript: mark.before,
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
    description: 'One idea from the book: its number on the verso, the idea on the recto, the bookmark where it sits.',
    heading: 'One idea',
    css:
      spread +
      head.css +
      mark.css +
      '.chapter-no{top:216px}' +
      '.label{top:392px}' +
      '.recto .title{top:246px;font-size:72px;line-height:1.12;max-height:600px}' +
      '.recto .rule{top:950px}' +
      '.recto .detail{top:1012px;font-size:36px;line-height:1.4;max-height:270px}',
    markup: `<div class="book"><div class="gutter"></div>
        <div class="verso"><span class="slot slot-head">${head.markup}</span><div class="chapter-no number-value">01</div><span class="label">CHAPTER</span></div>
        <div class="recto"><h1 class="title"></h1><div class="rule"></div><p class="detail"></p></div>
        <span class="slot slot-mark">${mark.markup}</span>
      </div>
      <div class="folio"><span>02 / THE CHAPTERS</span><span>NODECINE</span></div>`,
    motion: `tl.fromTo(q('.book'),{y:70,opacity:0},{y:0,opacity:1,duration:.8,ease:'power3.out'},0)
      .fromTo(q('.chapter-no'),{y:36,opacity:0},{y:0,opacity:1,duration:.6,ease:'power3.out'},.34)
      .fromTo(q('.label'),{opacity:0},{opacity:1,duration:.5,ease:'sine.out'},.5)
      .fromTo(q('.recto .title'),{y:44,opacity:0},{y:0,opacity:1,duration:.75,ease:'power3.out'},.46)
      .fromTo(q('.recto .rule'),{scaleX:0,transformOrigin:'left center'},{scaleX:1,duration:.55,ease:'power2.out'},.86)
      .fromTo(q('.recto .detail'),{y:24,opacity:0},{y:0,opacity:1,duration:.6,ease:'power2.out'},.98)
      .fromTo(q('.folio'),{opacity:0},{opacity:1,duration:.6,ease:'sine.out'},1.1)
      ${head.motion}
      ${mark.motion}`,
    extraScript: mark.before,
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
    description: 'Closing: what to keep, on the recto, with the book hanging over the edge.',
    heading: 'What to keep',
    css:
      spread +
      head.css +
      mark.css +
      '.close-mark{top:250px}' +
      '.label{top:452px}' +
      '.recto .title{top:246px;font-size:80px;line-height:1.1;max-height:620px}' +
      '.recto .rule{top:950px}' +
      '.recto .detail{top:1012px;font-size:38px;line-height:1.4;max-height:270px}',
    markup: `<div class="book"><div class="gutter"></div>
        <div class="verso"><span class="slot slot-head">${head.markup}</span><div class="close-mark">§</div><span class="label">WHAT TO KEEP</span></div>
        <div class="recto"><h1 class="title"></h1><div class="rule"></div><p class="detail"></p></div>
        <span class="slot slot-mark">${mark.markup}</span>
      </div>
      <div class="folio"><span>03 / CLOSE</span><span>NODECINE</span></div>`,
    motion: `tl.fromTo(q('.book'),{y:70,opacity:0},{y:0,opacity:1,duration:.8,ease:'power3.out'},0)
      .fromTo(q('.close-mark'),{scale:.7,opacity:0},{scale:1,opacity:1,duration:.7,ease:'back.out(1.4)'},.3)
      .fromTo(q('.label'),{opacity:0},{opacity:1,duration:.5,ease:'sine.out'},.5)
      .fromTo(q('.recto .title'),{y:44,opacity:0},{y:0,opacity:1,duration:.75,ease:'power3.out'},.44)
      .fromTo(q('.recto .rule'),{scaleX:0,transformOrigin:'left center'},{scaleX:1,duration:.55,ease:'power2.out'},.86)
      .fromTo(q('.recto .detail'),{y:24,opacity:0},{y:0,opacity:1,duration:.6,ease:'power2.out'},.98)
      .fromTo(q('.folio'),{opacity:0},{opacity:1,duration:.6,ease:'sine.out'},1.1)
      ${head.motion}
      ${mark.motion}`,
    extraScript: mark.before,
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
};

// Keep the workflow JSON in sync with the three scenes, the components this kit publishes, and the guide.
await editComposition(new URL('./workflow.json', import.meta.url), (files) => {
  // The shell the Studio previews and the inspector lints, until a run has Assemble write the entry.
  files['index.html'] = filmShell({ id: 'book-shell', background: '#050807' });
  for (const [kind, scene] of Object.entries(scenes)) files[`compositions/book-${kind}.html`] = sceneBlock({ ...scene, id: `book-${kind}`, seconds: 4 });
  // Published, not pasted: a writer may mount these into a frame of its own.
  files['compositions/components/running-head.html'] = component(runningHead({ title: 'BOOK SUMMARY', color: '#5d6b62', rule: '#cbbfa6' }));
  files['compositions/components/ribbon.html'] = component(ribbon({ label: 'IN THE BOOK', accent: BRASS, ink: '#2a1d08' }));
  files['storyboard-guide.md'] =
    `---\nfirst: hook\nlast: outro\nrepeat: 3\n---\nMake a summary of a book in English, vertical 9:16, about 80–100 seconds, set as an open spread: the verso carries the running head and the chapter's number, the recto carries the writing, and the bookmark down the outer edge carries where the passage sits.\nUse only what is in Research, the notes the person wrote and the URLs they gave. Never invent a quote, a page number or a figure.\nOpen with what the book gives a reader; one idea per chapter scene, in the book's own order; close with what to keep.\nEvery chapter scene carries a two-digit number in order (01, 02, 03), the idea in at most 56 characters, one sentence that explains it, and where it sits in the book (part, chapter or section, at most 48 characters).\nEvery scene carries a source: on the opening and closing scenes the book and its author, on a chapter where that chapter sits. The bookmark reads it.\nDrop an idea when Research has no support for it, and never present a summary of a summary as the book's own claim.`;
});
