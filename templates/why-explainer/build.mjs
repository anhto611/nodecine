import { component, editComposition, filmShell, paste, sceneBlock } from '../_kit/build.mjs';

/**
 * "Vì sao…?" as a flat-illustration explainer.
 *
 * The grammar of the friendly science channels: a deep indigo ground with soft geometric shapes drifting
 * at different depths, rounded type, and every idea carried by a big emoji "icon" sitting in a coloured
 * circle — the kit ships no illustrations, so an emoji on the storyboard is enough to draw one. One idea
 * per scene, and a small pill along the foot of every scene saying where the idea comes from.
 *
 * Six scenes, each a block the writer may play: the question, a chain of steps joined by arrows that
 * draw themselves, a two-column comparison, a myth stamped SAI beside the truth stamped ĐÚNG, one
 * striking number with a scale made of icons, and the one-sentence answer.
 *
 * The film is landscape (1920×1080). Text keeps an 80px margin and stays out of the lower 140px.
 */

const W = 1920;
const H = 1080;

const CREAM = '#fff8ec';
const MUTED = '#c3bfef';
const YELLOW = '#ffd23f';
const CORAL = '#ff6b6b';
const TEAL = '#2ec4b6';
const SKY = '#4dabff';
const PINK = '#ff8fcf';
const GREEN = '#5ee38a';
const CARD = '#2a2772';
const CARD_EDGE = '#3d3a96';
const PALETTE = [YELLOW, TEAL, PINK, SKY];

/** Rounded faces with the Vietnamese alphabet: Lexend for display, Nunito for reading. */
const FONTS = 'https://fonts.googleapis.com/css2?family=Lexend:wght@500;700;800&family=Nunito:wght@600;700;800&family=Noto+Color+Emoji&display=swap';
const DISPLAY = '"Lexend","Nunito",Arial,sans-serif';
const EMOJI = '"Noto Color Emoji",sans-serif';

/** Where an idea came from, as a pill along the foot of the scene. Published, and pasted into every scene. */
const sourceTag = () => ({
  name: 'source-tag',
  role: 'piece',
  description: "Where the idea on screen comes from, as a pill with a book icon: reads the scene's own source.",
  css: `.st{position:absolute;inset:0;display:flex;align-items:center;gap:18px;font-family:"Nunito",Arial,sans-serif}.st-pill{flex:none;display:flex;align-items:center;gap:10px;height:100%;padding:0 22px;border-radius:999px;background:${TEAL};color:#05302b;font-family:${DISPLAY};font-size:18px;font-weight:800;letter-spacing:.14em}.st-pill i{font-style:normal;font-family:${EMOJI};font-size:22px;letter-spacing:0}.st-text{flex:1;min-width:0;color:${MUTED};font-size:25px;font-weight:700;line-height:1.5;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}`,
  markup: `<span class="st"><span class="st-pill"><i>📚</i>NGUỒN</span><span class="st-text"></span></span>`,
  variables: [{ id: 'source', type: 'string', label: 'Where this idea comes from', labels: { vi: 'Ý này lấy từ nguồn nào' }, default: 'Nguồn tham khảo', sample: 'NASA Space Place', maxLength: 60, required: true }],
  extraScript: `var stEl=root.querySelector('.st-text');if(stEl)stEl.textContent=String(v.source==null?'Nguồn tham khảo':v.source);`,
  motion: `tl.fromTo(q('.st'),{opacity:0,y:16},{opacity:1,y:0,duration:.5,ease:'back.out(1.6)'},1.1);`,
});
const source = paste(sourceTag());

/** The floating shapes behind every scene: each has a depth, and the deeper ones drift less. */
const SHAPES = [
  // [class, left, top, size, colour, depth]
  ['sh-circle', -140, -180, 560, `${SKY}1f`, 0.4],
  ['sh-ring', 1640, 640, 300, `${TEAL}55`, 1],
  ['sh-square', 1720, 190, 96, `${PINK}44`, 1.4],
  ['sh-tri', 640, 910, 140, `${YELLOW}38`, 1.2],
  ['sh-blob', 1180, 860, 420, `${PINK}14`, 0.5],
  ['sh-dot', 900, 90, 34, `${YELLOW}88`, 2],
  ['sh-dot', 1360, 980, 26, `${TEAL}aa`, 2.2],
  ['sh-dot', 70, 520, 22, `${PINK}aa`, 1.8],
  ['sh-plus', 1120, 210, 56, `${SKY}66`, 1.6],
];
const shapesMarkup = `<div class="shapes">${SHAPES.map(([cls, left, top, size, colour, depth], i) => `<i class="sh ${cls} sh-${i}" data-depth="${depth}" style="left:${left}px;top:${top}px;width:${size}px;height:${size}px;--c:${colour}"></i>`).join('')}</div>`;

const ground =
  // Room under the last line and over it, for descenders (g, y, p) and stacked Vietnamese accents, in boxes that clip.
  '#root .title-label{padding-bottom:.2em}#root .claim{padding-top:.08em;padding-bottom:.2em}' +
  'html,body{margin:0;background:#131142}*{box-sizing:border-box}' +
  `#root{position:absolute;inset:0;width:${W}px;height:${H}px;overflow:hidden;color:${CREAM};font-family:"Nunito",Arial,sans-serif}` +
  '.nc-backdrop{position:absolute;inset:0;background:radial-gradient(ellipse at 78% 12%,#3a2f9a 0,#221f6e 38%,#141249 72%,#0e0c36 100%)}' +
  '.grain{position:absolute;inset:0;background-image:radial-gradient(#ffffff10 1.6px,transparent 1.8px);background-size:46px 46px;opacity:.8}' +
  '.shapes{position:absolute;inset:0}.sh{position:absolute;display:block}' +
  '.sh-circle,.sh-blob,.sh-dot{border-radius:50%;background:var(--c)}' +
  '.sh-blob{border-radius:46% 54% 60% 40%/50% 42% 58% 50%}' +
  '.sh-ring{border-radius:50%;border:26px solid var(--c)}' +
  '.sh-square{border-radius:26px;background:var(--c);transform:rotate(18deg)}' +
  '.sh-tri{background:var(--c);clip-path:polygon(50% 4%,96% 92%,4% 92%);border-radius:12px}' +
  '.sh-plus{background:linear-gradient(var(--c),var(--c)) center/100% 30% no-repeat,linear-gradient(var(--c),var(--c)) center/30% 100% no-repeat;border-radius:8px}' +
  `.kicker{position:absolute;left:120px;top:72px;display:flex;align-items:center;gap:12px;height:50px;padding:0 24px 0 14px;border-radius:999px;background:${YELLOW};color:#2a1c00;font-family:${DISPLAY};font-size:20px;font-weight:800;letter-spacing:.14em;white-space:nowrap}` +
  `.kicker i{font-style:normal;display:flex;align-items:center;justify-content:center;width:30px;height:30px;border-radius:50%;background:#2a1c00;color:${YELLOW};font-size:18px;letter-spacing:0}` +
  `.folio{position:absolute;right:120px;top:80px;display:flex;align-items:center;gap:14px;color:${MUTED};font-family:${DISPLAY};font-size:19px;font-weight:700;letter-spacing:.16em}` +
  `.folio b{display:flex;align-items:center;justify-content:center;width:36px;height:36px;border-radius:11px;background:${CREAM};color:#1b1860;font-size:21px;font-weight:800;letter-spacing:-.06em}` +
  '.folio span{opacity:.9}' +
  `.title{margin:0;font-family:${DISPLAY};font-weight:800;line-height:1.3;letter-spacing:-.015em;padding:.07em 0;overflow:hidden;text-wrap:balance;color:${CREAM}}` +
  `.title em{font-style:normal;color:${YELLOW}}` +
  `.detail{margin:0;text-wrap:balance;font-weight:700;line-height:1.42;color:${MUTED};overflow:hidden}` +
  `.disc{display:flex;align-items:center;justify-content:center;border-radius:50%;font-family:${EMOJI};line-height:1}` +
  `.disc .ico{display:block;line-height:1.1}` +
  '.slot-source{position:absolute;left:120px;width:1240px;bottom:150px;height:52px}';

/** The chrome every scene shares: the drifting shapes, the kicker, the folio. */
const chrome = (label, icon) => `<div class="grain"></div>${shapesMarkup}
      <span class="kicker"><i>${icon}</i>${label}</span>
      <span class="folio"><b>N</b><span>NODECINE</span></span>`;

/** Every shape drifts across the whole scene, deeper ones less: a slow parallax that seeks like the rest. */
const chromeIn =
  `tl.fromTo(q('.grain'),{opacity:0},{opacity:.8,duration:1,ease:'sine.out'},0);` +
  `root.querySelectorAll('.sh').forEach(function(el,i){var d=Number(el.getAttribute('data-depth'))||1;tl.fromTo(el,{opacity:0,scale:.6},{opacity:1,scale:1,duration:.9,ease:'back.out(1.4)'},.05*i);tl.fromTo(el,{x:-22*d,y:30*d,rotation:-8*d},{x:22*d,y:-30*d,rotation:8*d,duration:duration,ease:'none',immediateRender:false},0)});` +
  `tl.fromTo(q('.kicker'),{opacity:0,x:-30},{opacity:1,x:0,duration:.5,ease:'back.out(1.8)'},.1);` +
  `tl.fromTo(q('.folio'),{opacity:0},{opacity:1,duration:.6,ease:'sine.out'},.3);`;

/** A gentle up-and-down for an icon, for as long as the scene runs. */
const bob = (sel, at, amp = 14, period = 1.1) => `tl.fromTo(root.querySelectorAll('${sel}'),{y:0},{y:-${amp},duration:${period},ease:'sine.inOut',yoyo:true,repeat:Math.max(1,Math.floor((duration-${at})/${period})),stagger:.18},${at});`;

/**
 * Shared helpers for the scenes' scripts: shrink a box's type until it fits, put an icon in with a
 * fallback, colour a *starred* word, hide a part a storyboard left empty.
 */
const HELPERS =
  "var fit=function(sel,floor){root.querySelectorAll(sel).forEach(function(el){var g=0;while((el.scrollHeight>el.clientHeight+2||el.scrollWidth>el.clientWidth+2)&&parseFloat(getComputedStyle(el).fontSize)>floor&&g++<90){el.style.fontSize=(parseFloat(getComputedStyle(el).fontSize)-2)+'px'}})};" +
  "var str=function(k){return String(v[k]==null?'':v[k]).trim()};" +
  "var icon=function(sel,k,fb){var el=q(sel);if(el)el.textContent=str(k)||fb};" +
  "var settle=function(list,after){var run=function(){list.forEach(function(p){root.querySelectorAll(p[0]).forEach(function(el){el.style.fontSize=''})});list.forEach(function(p){fit(p[0],p[1])});if(after)after()};run();if(document.fonts&&document.fonts.ready)document.fonts.ready.then(run)};" +
  "var star=function(sel){root.querySelectorAll(sel).forEach(function(el){var t=el.textContent.replace(/&/g,'&amp;').replace(/</g,'&lt;');el.innerHTML=t.replace(/\\*([^*]+)\\*/g,'<em>$1</em>').replace(/\\*/g,'')})};";

const secondsVar = { id: 'seconds', type: 'number', label: 'Length in seconds (the Assemble node gives it)', labels: { vi: 'Độ dài, giây (node Assemble cấp)' }, default: 4 };
const sourceVar = (sample, label = 'Where this scene’s idea comes from', vi = 'Ý của cảnh này lấy từ nguồn nào') => ({
  id: 'source',
  type: 'string',
  label,
  labels: { vi },
  default: 'Nguồn tham khảo',
  sample,
  maxLength: 60,
  required: true,
});
const iconVar = (id, label, vi, sample, dflt = '💡') => ({ id, type: 'string', label: `${label} — one emoji`, labels: { vi: `${vi} — một emoji` }, default: dflt, sample, maxLength: 12 });

const STEP_SAMPLES = [
  ['🌞', 'Ánh nắng trắng', 'Ánh sáng Mặt Trời chứa đủ mọi màu của cầu vồng.'],
  ['🌬️', 'Gặp không khí', 'Ánh sáng va vào các phân tử khí nhỏ li ti.'],
  ['💙', 'Xanh bị tán xạ', 'Ánh xanh bước sóng ngắn, bị hắt đi khắp mọi hướng.'],
  ['👀', 'Mắt ta thấy xanh', 'Ánh xanh tới mắt từ mọi phía trên bầu trời.'],
];

const scenes = {
  hook: {
    role: 'hook',
    description:
      'Opening: the big question in huge rounded type (one key word may be wrapped in *asterisks* to colour it yellow), a one-line teaser under it, and a big emoji hero icon bobbing in a circle with shapes orbiting around it.',
    css:
      ground +
      source.css +
      '.copy{position:absolute;left:120px;top:160px;bottom:250px;width:1000px;display:flex;flex-direction:column;justify-content:center;gap:36px}' +
      '.title{flex:none;font-size:124px;max-height:450px}' +
      '.detail{flex:none;font-size:42px;max-height:124px}' +
      '.hero{position:absolute;left:1210px;top:220px;width:500px;height:500px}' +
      `.hero .disc{position:absolute;left:60px;top:60px;width:380px;height:380px;background:radial-gradient(circle at 36% 30%,#ffe57a,${YELLOW} 58%,#f2b705);box-shadow:0 0 0 22px ${YELLOW}26,0 30px 70px #0007;font-size:200px}` +
      `.orbit{position:absolute;inset:-30px;border-radius:50%;border:3px dashed ${MUTED}55}` +
      '.orbit i{position:absolute;display:block;border-radius:50%}' +
      `.orbit .p1{left:50%;top:-20px;width:40px;height:40px;margin-left:-20px;background:${PINK}}` +
      `.orbit .p2{right:8px;bottom:110px;width:28px;height:28px;background:${TEAL}}` +
      `.orbit .p3{left:30px;bottom:60px;width:52px;height:52px;border-radius:14px;background:${SKY}}` +
      `.qm{position:absolute;font-family:${DISPLAY};font-weight:800;line-height:1}` +
      `.qm-1{left:1130px;top:170px;font-size:90px;color:${PINK}}.qm-2{left:1760px;top:300px;font-size:64px;color:${TEAL}}.qm-3{left:1700px;top:700px;font-size:76px;color:${YELLOW}}`,
    markup: `${chrome('GIẢI THÍCH', '?')}
      <div class="copy"><h1 class="title"></h1><p class="detail"></p></div>
      <div class="hero"><div class="orbit"><i class="p1"></i><i class="p2"></i><i class="p3"></i></div><div class="disc"><span class="ico"></span></div></div>
      <span class="qm qm-1">?</span><span class="qm qm-2">?</span><span class="qm qm-3">?</span>
      <span class="slot slot-source">${source.markup}</span>`,
    motion:
      chromeIn +
      `tl.fromTo(q('.title'),{y:60,opacity:0},{y:0,opacity:1,duration:.8,ease:'back.out(1.3)'},.25);` +
      `tl.fromTo(q('.detail'),{y:30,opacity:0},{y:0,opacity:1,duration:.6,ease:'power2.out'},.75);` +
      `tl.fromTo(q('.hero .disc'),{scale:0,rotation:-25},{scale:1,rotation:0,duration:.9,ease:'back.out(1.7)'},.35);` +
      `tl.fromTo(q('.orbit'),{opacity:0,scale:.7},{opacity:1,scale:1,duration:.8,ease:'power2.out'},.55);` +
      `tl.fromTo(q('.orbit'),{rotation:0},{rotation:120,duration:duration,ease:'none',immediateRender:false},0);` +
      `tl.fromTo(root.querySelectorAll('.qm'),{scale:0,opacity:0},{scale:1,opacity:1,duration:.5,ease:'back.out(2.4)',stagger:.15},.9);` +
      bob('.hero .ico', 1.2, 16, 1.1) +
      bob('.qm', 1.5, 12, 0.9) +
      source.motion,
    extraScript: HELPERS + "icon('.hero .ico','icon','🤔');star('.title');settle([['.title',62],['.detail',29]]);" + source.before,
    variables: [
      {
        id: 'title',
        type: 'string',
        label: 'The big question, as a curious person asks it; wrap one key word in *asterisks* to colour it',
        labels: { vi: 'Câu hỏi lớn, đúng như người tò mò hỏi; bọc một từ khoá trong *dấu sao* để tô màu' },
        default: 'Vì sao lại như vậy?',
        sample: 'Vì sao bầu trời có *màu xanh*?',
        maxLength: 64,
        required: true,
      },
      {
        id: 'detail',
        type: 'string',
        label: 'One teaser line under the question',
        labels: { vi: 'Một dòng gợi tò mò dưới câu hỏi' },
        default: 'Câu trả lời đơn giản hơn bạn nghĩ.',
        sample: 'Ánh nắng màu trắng, vậy màu xanh từ đâu ra?',
        maxLength: 90,
        required: true,
      },
      iconVar('icon', 'The hero icon for the question', 'Biểu tượng chính của câu hỏi', '🌤️', '🤔'),
      sourceVar('NASA Space Place · Why is the sky blue?', 'Where the answer comes from', 'Câu trả lời lấy từ nguồn nào'),
      secondsVar,
    ],
  },
  steps: {
    role: 'feature',
    description:
      'A cause-and-effect chain of three or four steps, left to right: each step is an emoji icon in a coloured circle with its number, a short label and one line, joined by arrows that draw themselves in. The fourth step may be left empty.',
    css:
      ground +
      source.css +
      '.title{position:absolute;left:120px;right:120px;top:150px;font-size:66px;max-height:170px}' +
      '.chain{position:absolute;left:120px;right:120px;top:330px;height:474px;display:flex;align-items:stretch}' +
      `.step{flex:1;min-width:0;display:flex;flex-direction:column;align-items:center;text-align:center;padding:34px 22px 26px;background:${CARD};border:3px solid ${CARD_EDGE};border-radius:36px;box-shadow:0 22px 50px #0006}` +
      '.step .disc{position:relative;flex:none;width:150px;height:150px;font-size:80px;box-shadow:0 12px 26px #0005}' +
      `.step-no{position:absolute;right:-8px;top:-8px;width:50px;height:50px;border-radius:50%;background:${CREAM};color:#1b1860;font-family:${DISPLAY};font-size:24px;font-weight:800;display:flex;align-items:center;justify-content:center;border:4px solid ${CARD}}` +
      `.step-label{flex:none;margin:24px 0 0;width:100%;font-family:${DISPLAY};font-size:34px;font-weight:800;line-height:1.28;padding:.07em 0;color:${CREAM};max-height:98px;overflow:hidden}` +
      `.step-line{flex:none;margin:10px 0 0;width:100%;text-wrap:balance;font-size:28px;font-weight:700;line-height:1.4;color:${MUTED};max-height:120px;overflow:hidden}` +
      '.arrow{flex:none;width:86px;display:flex;align-items:center;justify-content:center}' +
      `.arrow svg{width:74px;height:44px;overflow:visible}.arrow path{fill:none;stroke:${YELLOW};stroke-width:7;stroke-linecap:round;stroke-linejoin:round}` +
      PALETTE.map((c, i) => `.c${i + 1}{background:radial-gradient(circle at 36% 30%,#ffffffaa,${c} 46%)}`).join(''),
    markup: `${chrome('TỪNG BƯỚC', '»')}
      <h2 class="title"></h2>
      <div class="chain">${[1, 2, 3, 4]
        .map(
          (i) =>
            `<div class="step step-${i}"><div class="disc c${i}"><span class="ico ico${i}"></span><b class="step-no">${i}</b></div><h3 class="step-label label${i}"></h3><p class="step-line line${i}"></p></div>` +
            (i < 4 ? `<div class="arrow arrow-${i}"><svg viewBox="0 0 74 44"><path class="ar-line" d="M4 22 H64" stroke-dasharray="64"/><path class="ar-head" d="M48 6 L66 22 L48 38" stroke-dasharray="50"/></svg></div>` : ''),
        )
        .join('')}</div>
      <span class="slot slot-source">${source.markup}</span>`,
    motion:
      chromeIn +
      `tl.fromTo(q('.title'),{y:30,opacity:0},{y:0,opacity:1,duration:.6,ease:'power2.out'},.2);` +
      `[1,2,3,4].forEach(function(i){var at=.45+(i-1)*.42;tl.fromTo(q('.step-'+i),{y:50,opacity:0,scale:.9},{y:0,opacity:1,scale:1,duration:.6,ease:'back.out(1.5)'},at);tl.fromTo(q('.step-'+i+' .disc'),{scale:0,rotation:-30},{scale:1,rotation:0,duration:.6,ease:'back.out(2)'},at+.12);if(i<4){tl.fromTo(q('.arrow-'+i+' .ar-line'),{strokeDashoffset:64},{strokeDashoffset:0,duration:.3,ease:'power2.inOut'},at+.32);tl.fromTo(q('.arrow-'+i+' .ar-head'),{strokeDashoffset:50},{strokeDashoffset:0,duration:.22,ease:'power2.out'},at+.56);}});` +
      bob('.step .ico', 2.3, 8, 1) +
      source.motion,
    textKeys: ['title', 'source', 'label1', 'label2', 'label3', 'label4', 'line1', 'line2', 'line3', 'line4'],
    extraScript:
      HELPERS +
      "[1,2,3,4].forEach(function(i){icon('.ico'+i,'icon'+i,['🔹','🔸','✨','🎯'][i-1])});" +
      "if(!str('label4')){q('.step-4').style.display='none';q('.arrow-3').style.display='none'}" +
      "settle([['.title',62],['.step-label',26],['.step-line',20]],function(){q('.chain').style.top=q('.title').clientHeight>110?'368px':''});" +
      source.before,
    variables: [
      {
        id: 'title',
        type: 'string',
        label: 'What this chain explains, as a short heading',
        labels: { vi: 'Chuỗi này giải thích điều gì, một tiêu đề ngắn' },
        default: 'Chuyện diễn ra thế nào?',
        sample: 'Từ ánh nắng đến bầu trời xanh',
        maxLength: 60,
        required: true,
      },
      ...[1, 2, 3, 4].flatMap((i) => [
        iconVar(`icon${i}`, `Step ${i}'s icon`, `Biểu tượng bước ${i}`, STEP_SAMPLES[i - 1][0], ''),
        {
          id: `label${i}`,
          type: 'string',
          label: `Step ${i}: a short label, two to four words${i === 4 ? ', or empty for a three-step chain' : ''}`,
          labels: { vi: `Bước ${i}: nhãn ngắn, hai đến bốn chữ${i === 4 ? ', hoặc để trống nếu chỉ có ba bước' : ''}` },
          default: i === 4 ? '' : `Bước ${i}`,
          sample: STEP_SAMPLES[i - 1][1],
          maxLength: 28,
          required: i <= 3,
        },
        {
          id: `line${i}`,
          type: 'string',
          label: `Step ${i}: one line saying what happens`,
          labels: { vi: `Bước ${i}: một dòng nói điều gì xảy ra` },
          default: '',
          sample: STEP_SAMPLES[i - 1][2],
          maxLength: 70,
          required: i <= 3,
        },
      ]),
      sourceVar('NASA Space Place · Why is the sky blue?'),
      secondsVar,
    ],
  },
  compare: {
    role: 'feature',
    description:
      'A two-column comparison: two states side by side (before and after, normal and extreme, here and there), each with an emoji icon, a name and up to four short rows, a VS badge between them.',
    css:
      ground +
      source.css +
      '.title{position:absolute;left:120px;right:120px;top:150px;font-size:66px;max-height:170px}' +
      '.cols{position:absolute;left:120px;right:120px;top:340px;height:486px;display:flex;gap:120px}' +
      `.col{flex:1;min-width:0;position:relative;background:${CARD};border:3px solid ${CARD_EDGE};border-radius:36px;box-shadow:0 22px 50px #0006;overflow:hidden}` +
      '.col-head{display:flex;align-items:center;gap:24px;height:128px;padding:0 34px}' +
      '.col-l .col-head{background:linear-gradient(90deg,' +
      TEAL +
      ',' +
      TEAL +
      'cc)}.col-r .col-head{background:linear-gradient(90deg,' +
      CORAL +
      ',' +
      CORAL +
      'cc)}' +
      '.col-head .disc{flex:none;width:92px;height:92px;font-size:52px;background:#ffffffe6}' +
      `.col-name{flex:1;min-width:0;font-family:${DISPLAY};font-size:44px;font-weight:800;line-height:1.3;padding:.07em 0;color:#14123f;white-space:nowrap;overflow:hidden}` +
      '.rows{position:absolute;left:34px;right:34px;top:150px;bottom:24px;display:flex;flex-direction:column;justify-content:space-evenly}' +
      '.row{display:flex;align-items:center;gap:20px}' +
      '.row i{flex:none;width:18px;height:18px;border-radius:50%}' +
      `.col-l .row i{background:${TEAL}}.col-r .row i{background:${CORAL}}` +
      `.row span{flex:1;min-width:0;text-wrap:balance;font-size:32px;font-weight:700;line-height:1.36;color:${CREAM};max-height:88px;overflow:hidden}` +
      `.vs{position:absolute;left:50%;top:572px;width:120px;height:120px;margin:-60px 0 0 -60px;border-radius:50%;background:${YELLOW};color:#2a1c00;font-family:${DISPLAY};font-size:42px;font-weight:800;display:flex;align-items:center;justify-content:center;box-shadow:0 0 0 12px #141249,0 18px 40px #0008}`,
    markup: `${chrome('SO SÁNH', '=')}
      <h2 class="title"></h2>
      <div class="cols">
        <div class="col col-l"><div class="col-head"><div class="disc"><span class="ico ico-l"></span></div><span class="col-name leftName"></span></div><div class="rows rows-l"></div></div>
        <div class="col col-r"><div class="col-head"><div class="disc"><span class="ico ico-r"></span></div><span class="col-name rightName"></span></div><div class="rows rows-r"></div></div>
      </div>
      <span class="vs">VS</span>
      <span class="slot slot-source">${source.markup}</span>`,
    motion:
      chromeIn +
      `tl.fromTo(q('.title'),{y:30,opacity:0},{y:0,opacity:1,duration:.6,ease:'power2.out'},.2);` +
      `tl.fromTo(q('.col-l'),{x:-120,opacity:0},{x:0,opacity:1,duration:.7,ease:'power3.out'},.4);` +
      `tl.fromTo(q('.col-r'),{x:120,opacity:0},{x:0,opacity:1,duration:.7,ease:'power3.out'},.55);` +
      `tl.fromTo(root.querySelectorAll('.col-head .disc'),{scale:0,rotation:-40},{scale:1,rotation:0,duration:.55,ease:'back.out(2)',stagger:.15},.75);` +
      `tl.fromTo(q('.vs'),{scale:0,rotation:-90},{scale:1,rotation:0,duration:.55,ease:'back.out(2.2)'},.95);` +
      `tl.fromTo(root.querySelectorAll('.rows-l .row'),{x:-30,opacity:0},{x:0,opacity:1,duration:.4,ease:'power2.out',stagger:.14},1.05);` +
      `tl.fromTo(root.querySelectorAll('.rows-r .row'),{x:30,opacity:0},{x:0,opacity:1,duration:.4,ease:'power2.out',stagger:.14},1.15);` +
      `tl.fromTo(q('.vs'),{scale:1},{scale:1.08,duration:.6,ease:'sine.inOut',yoyo:true,repeat:Math.max(1,Math.floor((duration-1.6)/.6))},1.6);` +
      source.motion,
    textKeys: ['title', 'source', 'leftName', 'rightName'],
    extraScript:
      HELPERS +
      "icon('.ico-l','leftIcon','🙂');icon('.ico-r','rightIcon','😵');" +
      "var rows=function(sel,k){var box=q(sel);str(k).split(/\\s*;\\s*/).filter(Boolean).slice(0,4).forEach(function(t){var r=document.createElement('div');r.className='row';r.innerHTML='<i></i><span></span>';r.querySelector('span').textContent=t;box.appendChild(r)})};" +
      "rows('.rows-l','leftRows');rows('.rows-r','rightRows');" +
      "settle([['.title',62],['.col-name',28],['.row span',22]],function(){var two=q('.title').clientHeight>110;q('.cols').style.top=two?'368px':'';q('.vs').style.top=two?'600px':''});" +
      source.before,
    variables: [
      {
        id: 'title',
        type: 'string',
        label: 'What the comparison shows, as a short heading',
        labels: { vi: 'Phép so sánh cho thấy điều gì, một tiêu đề ngắn' },
        default: 'Khác nhau thế nào?',
        sample: 'Vì sao hoàng hôn lại đỏ?',
        maxLength: 60,
        required: true,
      },
      iconVar('leftIcon', 'The left column’s icon', 'Biểu tượng cột trái', '☀️', '🙂'),
      { id: 'leftName', type: 'string', label: 'The left column’s name, a few words', labels: { vi: 'Tên cột trái, vài chữ' }, default: 'Bình thường', sample: 'Giữa trưa', maxLength: 26, required: true },
      {
        id: 'leftRows',
        type: 'string',
        label: 'The left column’s rows, two to four short facts separated by ";"',
        labels: { vi: 'Các dòng cột trái, hai đến bốn ý ngắn, ngăn bằng dấu ";"' },
        default: 'Ý thứ nhất;Ý thứ hai',
        sample: 'Nắng chiếu gần như thẳng đứng;Đường đi qua khí quyển ngắn;Ánh xanh tán xạ khắp trời',
        maxLength: 200,
        required: true,
      },
      iconVar('rightIcon', 'The right column’s icon', 'Biểu tượng cột phải', '🌇', '😵'),
      { id: 'rightName', type: 'string', label: 'The right column’s name, a few words', labels: { vi: 'Tên cột phải, vài chữ' }, default: 'Khác thường', sample: 'Hoàng hôn', maxLength: 26, required: true },
      {
        id: 'rightRows',
        type: 'string',
        label: 'The right column’s rows, as many as the left, separated by ";"',
        labels: { vi: 'Các dòng cột phải, bằng số dòng cột trái, ngăn bằng dấu ";"' },
        default: 'Ý thứ nhất;Ý thứ hai',
        sample: 'Nắng chiếu xiên rất thấp;Đường đi dài gấp nhiều lần;Ánh xanh tán xạ hết dọc đường, còn lại cam đỏ',
        maxLength: 200,
        required: true,
      },
      sourceVar('NOAA SciJinks · Why is the sunset red?'),
      secondsVar,
    ],
  },
  myth: {
    role: 'proof',
    description:
      'Myth versus truth: a common misconception on the left, stamped SAI in red, and what is actually true on the right, stamped ĐÚNG in green, with one line under them explaining why.',
    css:
      ground +
      source.css +
      '.pair{position:absolute;left:120px;right:120px;top:170px;height:500px;display:flex;gap:110px}' +
      `.card{flex:1;min-width:0;position:relative;display:flex;flex-direction:column;align-items:center;padding:40px 46px 36px;border-radius:40px;box-shadow:0 24px 56px #0007}` +
      `.card-myth{background:#2b2766;border:3px dashed #6a64b8}` +
      `.card-fact{background:linear-gradient(160deg,#1f8f86,${TEAL});border:3px solid #7ff0e4}` +
      `.tag{display:flex;align-items:center;gap:12px;height:52px;padding:0 26px;border-radius:999px;font-family:${DISPLAY};font-size:22px;font-weight:800;letter-spacing:.16em;white-space:nowrap}` +
      `.card-myth .tag{background:#45408f;color:${MUTED}}.card-fact .tag{background:#0b4743;color:${CREAM}}` +
      '.card .disc{flex:none;margin-top:28px;width:120px;height:120px;font-size:64px}' +
      '.card-myth .disc{background:#3b3684}.card-fact .disc{background:#ffffffe6}' +
      `.claim{margin:26px 0 0;width:100%;flex:1;min-height:0;display:flex;align-items:center;justify-content:center;text-align:center;text-wrap:balance;font-family:${DISPLAY};font-size:46px;font-weight:700;line-height:1.3;padding-top:.05em;overflow:hidden}` +
      `.card-myth .claim{color:${MUTED}}.card-fact .claim{color:#ffffff}` +
      `.stamp{position:absolute;top:26px;right:30px;padding:8px 22px;border:7px solid currentColor;border-radius:14px;font-family:${DISPLAY};font-size:46px;font-weight:800;letter-spacing:.1em;line-height:1.2;background:#00000014}` +
      `.stamp-myth{color:${CORAL};transform:rotate(-12deg)}.stamp-fact{color:${GREEN};background:#0b4743cc;transform:rotate(8deg)}` +
      `.swap{position:absolute;left:50%;top:420px;width:96px;height:96px;margin:-48px 0 0 -48px;border-radius:50%;background:${YELLOW};color:#2a1c00;font-family:${DISPLAY};font-size:52px;font-weight:800;display:flex;align-items:center;justify-content:center;box-shadow:0 0 0 12px #141249}` +
      '.detail{position:absolute;left:220px;right:220px;top:716px;text-align:center;font-size:36px;max-height:112px;color:' +
      CREAM +
      '}',
    markup: `${chrome('LẦM TƯỞNG & SỰ THẬT', '!')}
      <div class="pair">
        <div class="card card-myth"><span class="tag">❌ LẦM TƯỞNG</span><div class="disc"><span class="ico">🤔</span></div><p class="claim myth"></p><span class="stamp stamp-myth">SAI</span></div>
        <div class="card card-fact"><span class="tag">✅ SỰ THẬT</span><div class="disc"><span class="ico">💡</span></div><p class="claim fact"></p><span class="stamp stamp-fact">ĐÚNG</span></div>
      </div>
      <span class="swap">→</span>
      <p class="detail"></p>
      <span class="slot slot-source">${source.markup}</span>`,
    motion:
      chromeIn +
      `tl.fromTo(q('.card-myth'),{y:60,opacity:0,rotation:-3},{y:0,opacity:1,rotation:0,duration:.7,ease:'back.out(1.4)'},.25);` +
      `tl.fromTo(q('.stamp-myth'),{scale:2.6,opacity:0,rotation:-34},{scale:1,opacity:1,rotation:-12,duration:.35,ease:'power4.in'},.9);` +
      `tl.fromTo(q('.card-myth'),{x:0},{x:-10,duration:.05,ease:'none',yoyo:true,repeat:3,immediateRender:false},1.25);` +
      `tl.to(q('.card-myth'),{opacity:.72,duration:.5,ease:'sine.out'},1.45);` +
      `tl.fromTo(q('.swap'),{scale:0,rotation:-90},{scale:1,rotation:0,duration:.5,ease:'back.out(2)'},1.35);` +
      `tl.fromTo(q('.card-fact'),{y:60,opacity:0,rotation:3},{y:0,opacity:1,rotation:0,duration:.7,ease:'back.out(1.4)'},1.45);` +
      `tl.fromTo(q('.stamp-fact'),{scale:2.6,opacity:0,rotation:30},{scale:1,opacity:1,rotation:8,duration:.35,ease:'power4.in'},2.05);` +
      `tl.fromTo(q('.card-fact'),{scale:1},{scale:1.025,duration:.12,ease:'power2.out',yoyo:true,repeat:1,immediateRender:false},2.4);` +
      `tl.fromTo(q('.detail'),{y:24,opacity:0},{y:0,opacity:1,duration:.6,ease:'power2.out'},2.3);` +
      source.motion.replace(',1.1);', ',2.5);'),
    textKeys: ['detail', 'source', 'myth', 'fact'],
    extraScript: HELPERS + "if(!str('detail')){q('.detail').style.display='none';q('.pair').style.top='230px';q('.swap').style.top='480px'}settle([['.claim',28],['.detail',29]]);" + source.before,
    variables: [
      {
        id: 'myth',
        type: 'string',
        label: 'The common misconception, as people say it',
        labels: { vi: 'Điều nhiều người lầm tưởng, đúng như người ta hay nói' },
        default: 'Điều nhiều người vẫn tin.',
        sample: 'Trời xanh vì phản chiếu màu nước biển.',
        maxLength: 90,
        required: true,
      },
      {
        id: 'fact',
        type: 'string',
        label: 'What is actually true, in one sentence',
        labels: { vi: 'Điều thực sự đúng, trong một câu' },
        default: 'Điều thực sự đúng.',
        sample: 'Trời xanh vì không khí tán xạ ánh xanh của Mặt Trời.',
        maxLength: 90,
        required: true,
      },
      {
        id: 'detail',
        type: 'string',
        label: 'One line explaining why, or empty',
        labels: { vi: 'Một dòng giải thích vì sao, hoặc để trống' },
        default: '',
        sample: 'Ngược lại mới đúng: biển trông xanh một phần là nhờ phản chiếu bầu trời.',
        maxLength: 110,
      },
      sourceVar('NOAA Ocean Service · Why is the ocean blue?'),
      secondsVar,
    ],
  },
  fact: {
    role: 'proof',
    description:
      'One striking number at huge size, counting up, with its unit and what it measures above it, and a scale analogy under it ("bằng 3 sân bóng đá") drawn as a row of emoji icons — count may be fractional, a half icon is drawn as half.',
    css:
      ground +
      source.css +
      `.burst{position:absolute;left:960px;top:400px;width:1200px;height:1200px;margin:-600px 0 0 -600px;border-radius:50%;background:repeating-conic-gradient(${YELLOW}16 0 7deg,transparent 7deg 15deg);-webkit-mask:radial-gradient(circle,#000 0,#000 18%,transparent 62%);mask:radial-gradient(circle,#000 0,#000 18%,transparent 62%)}` +
      `.label{position:absolute;left:220px;right:220px;top:150px;margin:0;text-align:center;font-family:${DISPLAY};font-size:46px;font-weight:700;line-height:1.26;padding-top:.05em;color:${CREAM};max-height:66px;overflow:hidden;white-space:nowrap}` +
      '.figure{position:absolute;left:120px;right:120px;top:226px;height:300px;display:flex;align-items:baseline;justify-content:center;gap:28px;white-space:nowrap;overflow:hidden}' +
      `.fig-box{display:inline-grid;font-family:${DISPLAY};font-size:270px;font-weight:800;line-height:1.08;letter-spacing:-.04em;color:${YELLOW};text-shadow:0 10px 0 #b8860b55,0 30px 60px #0006}.fig-box>span{grid-area:1/1;text-align:center}.fig-ghost{visibility:hidden}` +
      `.fig-unit{font-family:${DISPLAY};font-size:80px;font-weight:700;line-height:1.2;color:${CREAM}}` +
      '.scale{position:absolute;left:120px;right:120px;top:548px;height:92px;display:flex;align-items:center;justify-content:center;gap:16px;font-family:' +
      EMOJI +
      ';font-size:72px;line-height:1}' +
      '.scale span{display:block;overflow:hidden;white-space:nowrap;line-height:1.2}' +
      `.analogy{position:absolute;left:50%;top:664px;width:1500px;margin-left:-750px;min-height:170px;display:flex;align-items:center;gap:30px;padding:24px 44px 24px 26px;background:${CARD};border:3px solid ${CARD_EDGE};border-radius:999px;box-shadow:0 22px 50px #0006}` +
      `.analogy .disc{flex:none;width:118px;height:118px;font-size:64px;background:radial-gradient(circle at 36% 30%,#ffffffaa,${PINK} 46%)}` +
      `.analogy p{margin:0;text-wrap:balance;flex:1;min-width:0;font-size:40px;font-weight:800;line-height:1.36;color:${CREAM};max-height:110px;overflow:hidden}`,
    markup: `${chrome('CON SỐ', '#')}
      <div class="burst"></div>
      <h2 class="label title-label"></h2>
      <div class="figure"><span class="fig-box"><span class="fig-ghost"></span><span class="fig-num"></span></span><span class="fig-unit unit"></span></div>
      <div class="scale"></div>
      <div class="analogy"><div class="disc"><span class="ico"></span></div><p class="analogy-text"></p></div>
      <span class="slot slot-source">${source.markup}</span>`,
    motion:
      chromeIn +
      `tl.fromTo(q('.burst'),{opacity:0,scale:.6},{opacity:1,scale:1,duration:1,ease:'power2.out'},.2);` +
      `tl.fromTo(q('.burst'),{rotation:0},{rotation:40,duration:duration,ease:'none',immediateRender:false},0);` +
      `tl.fromTo(q('.label'),{y:-20,opacity:0},{y:0,opacity:1,duration:.5,ease:'power2.out'},.2);` +
      `tl.fromTo(q('.fig-box'),{scale:.5,opacity:0},{scale:1,opacity:1,duration:.7,ease:'back.out(1.8)',transformOrigin:'50% 70%'},.35);` +
      `tl.fromTo(q('.fig-unit'),{x:-30,opacity:0},{x:0,opacity:1,duration:.5,ease:'power2.out'},.8);` +
      `if(countUp)tl.fromTo(countUp,{p:0},{p:1,duration:1.3,ease:'power2.out'},.35);` +
      `tl.fromTo(root.querySelectorAll('.scale span'),{scale:0,opacity:0},{scale:1,opacity:1,duration:.4,ease:'back.out(2.6)',stagger:.08},1);` +
      `tl.fromTo(q('.analogy'),{y:40,opacity:0},{y:0,opacity:1,duration:.6,ease:'back.out(1.5)'},1.25);` +
      `tl.fromTo(q('.analogy .disc'),{scale:0,rotation:-30},{scale:1,rotation:0,duration:.5,ease:'back.out(2)'},1.4);` +
      bob('.scale span', 2.2, 8, 0.8) +
      source.motion.replace(',1.1);', ',1.6);'),
    textKeys: ['source', 'unit'],
    extraScript:
      HELPERS +
      "q('.title-label').textContent=str('title')||'Một con số đáng nhớ';q('.analogy-text').textContent=str('detail')||'Bằng một thứ quen thuộc.';" +
      "icon('.analogy .ico','icon','📏');" +
      // The figure counts up when it is a plain Vietnamese number (300.000, 7,5); anything else is shown as given.
      "var raw=str('figure')||'100';var numEl=q('.fig-num');numEl.textContent=raw;q('.fig-ghost').textContent=raw;var boxEl=q('.fig-box');var countUp=null;" +
      "if(/^\\d{1,3}(\\.\\d{3})+(,\\d+)?$|^\\d+(,\\d+)?$/.test(raw)){var dec=(raw.split(',')[1]||'').length;var grp=raw.indexOf('.')>=0;var to=parseFloat(raw.replace(/\\./g,'').replace(',','.'));" +
      "var fmt=function(n){var s=n.toFixed(dec).split('.');var int=s[0];if(grp)int=int.replace(/\\B(?=(\\d{3})+(?!\\d))/g,'.');return int+(dec?','+s[1]:'')};" +
      "countUp={_p:1,get p(){return this._p},set p(x){this._p=x;numEl.textContent=x>=1?raw:fmt(to*x)}};}" +
      // The scale: as many icons as the count, a fraction drawn as part of one.
      "var cnt=Math.max(0,Math.min(12,Number(v.count)||0));var scaleEl=q('.scale');var mark=str('icon')||'📏';" +
      "if(!cnt)scaleEl.style.display='none';for(var k=0;k<Math.ceil(cnt);k++){var s=document.createElement('span');s.textContent=mark;var part=Math.min(1,cnt-k);if(part<1)s.style.width=Math.round(part*76)+'px';scaleEl.appendChild(s)}" +
      "if(!cnt){q('.analogy').style.top='600px'}" +
      "var figFit=function(){var un=q('.fig-unit');boxEl.style.fontSize='';un.style.fontSize='';var fg=q('.figure');var gi=0;while(fg.scrollWidth>fg.clientWidth+2&&gi++<60){boxEl.style.fontSize=(parseFloat(getComputedStyle(boxEl).fontSize)*.94)+'px';un.style.fontSize=(parseFloat(getComputedStyle(un).fontSize)*.96)+'px'}};" +
      // The figure fits by shrinking the number and its unit together; text and figure are refit once the web fonts are in.
      "settle([['.label',28],['.analogy p',26]],figFit);" +
      source.before,
    variables: [
      {
        id: 'title',
        type: 'string',
        label: 'What the number measures, one short line',
        labels: { vi: 'Con số này đo điều gì, một dòng ngắn' },
        default: 'Một con số đáng nhớ',
        sample: 'Tốc độ ánh sáng Mặt Trời lao tới Trái Đất',
        maxLength: 56,
        required: true,
      },
      {
        id: 'figure',
        type: 'string',
        label: 'The number alone, written the Vietnamese way (300.000 or 7,5), as the source gives it',
        labels: { vi: 'Riêng con số, viết kiểu Việt (300.000 hay 7,5), đúng như nguồn ghi' },
        default: '100',
        sample: '300.000',
        maxLength: 10,
        required: true,
      },
      { id: 'unit', type: 'string', label: 'Its unit, or empty', labels: { vi: 'Đơn vị, hoặc để trống' }, default: '', sample: 'km/giây', maxLength: 16 },
      {
        id: 'detail',
        type: 'string',
        label: 'The scale analogy, one line that makes the number feel real',
        labels: { vi: 'Phép so sánh dễ hình dung, một dòng giúp con số trở nên cụ thể' },
        default: 'Bằng một thứ quen thuộc.',
        sample: 'Chỉ trong 1 giây, đủ đi vòng quanh Trái Đất khoảng 7,5 lần',
        maxLength: 90,
        required: true,
      },
      iconVar('icon', 'The analogy’s icon, repeated for the scale', 'Biểu tượng của phép so sánh, lặp lại thành thước đo', '🌍', '📏'),
      {
        id: 'count',
        type: 'number',
        label: 'How many icons the analogy is worth (0 to 12, halves allowed), only when the analogy is literally a count; 0 hides the row',
        labels: { vi: 'Phép so sánh bằng bao nhiêu biểu tượng (0 đến 12, được dùng số lẻ như 7,5), chỉ khi phép so sánh đúng là một số đếm; 0 để ẩn' },
        default: 0,
        sample: 7.5,
      },
      sourceVar('NASA · Speed of light'),
      secondsVar,
    ],
  },
  close: {
    role: 'outro',
    description: 'Closing: the answer in one sentence at large size beside a glowing icon, one line to remember, an optional note (a disclaimer for health topics), and the source.',
    css:
      ground +
      source.css +
      '.copy{position:absolute;left:120px;top:160px;bottom:250px;width:1100px;display:flex;flex-direction:column;justify-content:center;gap:30px}' +
      '.title{flex:none;font-size:84px;max-height:420px}' +
      '.detail{flex:none;font-size:38px;max-height:108px}' +
      `.note{flex:none;margin:0;font-size:27px;font-weight:700;line-height:1.4;color:${MUTED}dd;max-height:76px;overflow:hidden}` +
      '.answer-ico{position:absolute;left:1300px;top:230px;width:440px;height:440px}' +
      `.answer-ico .disc{position:absolute;inset:40px;background:radial-gradient(circle at 36% 30%,#a8fff4,${TEAL} 58%,#159a8e);box-shadow:0 0 0 22px ${TEAL}2b,0 0 0 48px ${TEAL}14,0 30px 70px #0007;font-size:180px}` +
      `.spark{position:absolute;font-family:${DISPLAY};font-weight:800;line-height:1;color:${YELLOW}}` +
      '.spark-1{left:1270px;top:200px;font-size:70px}.spark-2{left:1720px;top:250px;font-size:46px}.spark-3{left:1690px;top:640px;font-size:60px}.spark-4{left:1300px;top:640px;font-size:38px;color:' +
      PINK +
      '}',
    markup: `${chrome('TÓM LẠI', '✓')}
      <div class="copy"><h1 class="title"></h1><p class="detail"></p><p class="note"></p></div>
      <div class="answer-ico"><div class="disc"><span class="ico"></span></div></div>
      <span class="spark spark-1">✦</span><span class="spark spark-2">✦</span><span class="spark spark-3">✦</span><span class="spark spark-4">✦</span>
      <span class="slot slot-source">${source.markup}</span>`,
    motion:
      chromeIn +
      `tl.fromTo(q('.title'),{y:50,opacity:0},{y:0,opacity:1,duration:.8,ease:'back.out(1.3)'},.25);` +
      `tl.fromTo(q('.detail'),{y:24,opacity:0},{y:0,opacity:1,duration:.6,ease:'power2.out'},.8);` +
      `tl.fromTo(q('.note'),{opacity:0},{opacity:1,duration:.6,ease:'sine.out'},1.05);` +
      `tl.fromTo(q('.answer-ico .disc'),{scale:0,rotation:30},{scale:1,rotation:0,duration:.9,ease:'back.out(1.7)'},.35);` +
      `tl.fromTo(root.querySelectorAll('.spark'),{scale:0,rotation:-90},{scale:1,rotation:0,duration:.5,ease:'back.out(2.4)',stagger:.12},.85);` +
      `tl.fromTo(root.querySelectorAll('.spark'),{scale:1},{scale:.6,duration:.7,ease:'sine.inOut',yoyo:true,repeat:Math.max(1,Math.floor((duration-1.6)/.7)),stagger:.2},1.6);` +
      bob('.answer-ico .ico', 1.3, 14, 1.1) +
      source.motion,
    extraScript: HELPERS + "icon('.answer-ico .ico','icon','💡');star('.title');var nt=q('.note');nt.textContent=str('note');if(!str('note'))nt.style.display='none';settle([['.title',62],['.detail',29],['.note',20]]);" + source.before,
    variables: [
      {
        id: 'title',
        type: 'string',
        label: 'The answer in one sentence; wrap one key word in *asterisks* to colour it',
        labels: { vi: 'Câu trả lời trong một câu; bọc một từ khoá trong *dấu sao* để tô màu' },
        default: 'Câu trả lời, gói trong một câu.',
        sample: 'Trời xanh vì không khí *tán xạ* ánh xanh mạnh nhất.',
        maxLength: 90,
        required: true,
      },
      {
        id: 'detail',
        type: 'string',
        label: 'One line to remember',
        labels: { vi: 'Một dòng để nhớ' },
        default: 'Một điều để nhớ.',
        sample: 'Ánh xanh bị hắt ra khắp trời, nên nhìn hướng nào ta cũng thấy xanh.',
        maxLength: 110,
        required: true,
      },
      iconVar('icon', 'The answer’s icon', 'Biểu tượng của câu trả lời', '💙', '💡'),
      {
        id: 'note',
        type: 'string',
        label: 'A small note, e.g. the health disclaimer, or empty',
        labels: { vi: 'Ghi chú nhỏ, ví dụ lưu ý sức khoẻ, hoặc để trống' },
        default: '',
        sample: '',
        maxLength: 120,
      },
      sourceVar('NASA Space Place · NOAA SciJinks', 'Where the answer comes from', 'Câu trả lời lấy từ nguồn nào'),
      secondsVar,
    ],
  },
};

// Keep the workflow JSON in sync with the six scenes, the component this kit publishes, and the guide.
await editComposition(new URL('./workflow.json', import.meta.url), (files) => {
  for (const key of Object.keys(files)) delete files[key];
  // The shell the Studio previews and the inspector lints, until a run has Assemble write the entry.
  files['index.html'] = filmShell({ id: 'why-shell', width: W, height: H, background: '#141249' });
  for (const [kind, scene] of Object.entries(scenes)) files[`compositions/why-${kind}.html`] = sceneBlock({ ...scene, id: `why-${kind}`, width: W, height: H, seconds: 4, fonts: FONTS });
  // Published, not pasted: a writer may mount it into a frame of its own.
  files['compositions/components/source-tag.html'] = component({ ...sourceTag(), fonts: FONTS });
  files['storyboard-guide.md'] =
    `---\nfirst: hook\nlast: outro\nrepeat: 2\n---\nLàm một video giải thích tiếng Việt, khổ ngang 16:9, khoảng 90–120 giây, trả lời câu hỏi trong Brief ("Vì sao bầu trời màu xanh?", "Điều gì xảy ra khi nhịn ngủ 3 ngày?"). Giọng kể tò mò, thân thiện, như một người bạn hiểu biết giải thích cho người hỏi: câu ngắn, từ ngữ đời thường, mỗi cảnh một ý. Phong cách hình minh hoạ phẳng: mỗi ý có một emoji làm biểu tượng; chọn emoji đúng nghĩa và dễ hiểu.\nChỉ dùng những gì Research tìm được, ghi chú người viết và các đường link họ đưa. Không bịa con số, phép so sánh, cơ chế hay câu trích; con số ước tính thì nói "khoảng". Bỏ một ý khi Research không có gì chống đỡ cho nó.\nMở đầu bằng cảnh hook (why-hook): câu hỏi lớn làm tiêu đề (tối đa 64 ký tự, có thể bọc một từ khoá trong *dấu sao* để tô vàng), một dòng gợi tò mò, một emoji chính.\nPhần thân, khoảng 10–16 cảnh, xen kẽ các khối cho nhịp video thay đổi:\n- why-steps: chuỗi nguyên nhân → kết quả 3 hoặc 4 bước (nhãn 2–4 chữ, mỗi bước một dòng tối đa 70 ký tự); để trống bước 4 khi chỉ có ba bước. Đây là khối chính để giải thích cơ chế; một cơ chế dài thì chia thành hai cảnh steps nối tiếp.\n- why-compare: hai trạng thái cạnh nhau (bình thường và sau 72 giờ thức, giữa trưa và hoàng hôn), mỗi cột 2–4 dòng ngắn ngăn bằng dấu ";", hai cột cùng số dòng và dòng cùng thứ tự nói về cùng một khía cạnh.\n- why-myth: một lầm tưởng phổ biến và sự thật thay cho nó, mỗi bên một câu; chỉ dùng khi Research chỉ ra đúng lầm tưởng đó.\n- why-fact: một con số ấn tượng (viết kiểu Việt: 300.000, 7,5; đơn vị để riêng) và một phép so sánh giúp hình dung ("bằng 3 sân bóng đá"); count là số biểu tượng cho thước đo, chỉ khi phép so sánh đúng là một số đếm (3 sân bóng → 3 và emoji ⚽), còn lại để 0.\nKhép lại bằng cảnh outro (why-close): câu trả lời trong một câu, một dòng để nhớ.\nMỗi cảnh mang một nguồn (tối đa 60 ký tự), ghi tên tổ chức, sách hay trang: "NASA Space Place", "WHO · Sleep", "Bách khoa toàn thư Britannica". Pill NGUỒN cuối cảnh đọc nguồn đó.\nChủ đề sức khoẻ: chỉ giải thích điều nghiên cứu cho thấy, không chẩn đoán, không khuyên dùng thuốc hay chữa bệnh, không khuyến khích thử nghiệm nguy hiểm (như nhịn ngủ); ở cảnh why-close, ghi note "Nội dung chỉ để tham khảo, không thay cho lời khuyên của bác sĩ." Chủ đề khác để note trống.`;
});
