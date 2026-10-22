import { component, diorama, dioramaBackdrop, dioramaCast, dioramaFx, dioramaProps, editComposition, filmShell, paste, pictureCard, pictureCredit, pictureFrame, portraitDisc, sceneBlock, sealStamp, sourceLine } from '../_kit/build.mjs';

/**
 * History, told as a story: a documentary in sepia and ink.
 *
 * The grammar of a history documentary on a wide screen: letterbox bars that close in as each chapter
 * opens, dark parchment drifting slowly behind the type (the Ken Burns move, over the pictures the Assets
 * node finds, or over the texture where a scene has none), film grain that flickers frame by frame, a warm light leak, and
 * a serif that carries the Vietnamese alphabet. Dates are set in amber; a vermilion seal is stamped only
 * on the first and the last chapter. Every chapter says in its top bar whether what it shows is recorded
 * history, legend, or a disputed account, and its bottom bar says where it comes from.
 *
 * Eight scenes, each a block the writer may play: a chapter title card with a huge year, a picture from
 * the Assets node filling the frame (the film's main scene), a shadow-puppet diorama drawn in code for a
 * moment no picture shows, a timeline the camera pans along, a historical figure on a medallion, two sides facing each other, a recorded quote
 * or turning point, and the closing lesson.
 */

const W = 1920;
const H = 1080;
const PARCH = '#ecdcb9';
const PARCH_DIM = '#b39c74';
const AMBER = '#d9a556';
const IRON = '#9fb0b4';
const VERMILION = '#c4381f';
const RULE = '#6d5536';
const BAR = '#050302';

/** The faces the film writes with, from Google Fonts: all three carry the Vietnamese alphabet. */
const FONTS =
  'https://fonts.googleapis.com/css2?family=Noto+Serif+Display:ital,wght@0,500;0,700;1,500&family=Noto+Serif:ital,wght@0,400;0,700;1,400&family=Be+Vietnam+Pro:wght@600;800&display=swap';

const SEAL = { label: 'KỂ SỬ', cinnabar: VERMILION, ink: '#f6e7c8' };
const FOOT = { accent: AMBER, color: PARCH_DIM, track: RULE, label: 'THEO' };
const seal = paste(sealStamp(SEAL));
const foot = paste(sourceLine(FOOT));

/** SVG noise as a CSS background: the grain of the film and the mottle of the parchment, drawn rather than shipped. */
const svgUrl = (svg) => `url("data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}")`;
const GRAIN = svgUrl(
  "<svg xmlns='http://www.w3.org/2000/svg' width='256' height='256'><filter id='g'><feTurbulence type='fractalNoise' baseFrequency='.82' numOctaves='3' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 .96 0 0 0 0 .9 0 0 0 0 .78 1.25 0 0 0 -.5'/></filter><rect width='100%' height='100%' filter='url(#g)'/></svg>",
);
const MOTTLE = svgUrl(
  "<svg xmlns='http://www.w3.org/2000/svg' width='640' height='640'><filter id='m'><feTurbulence type='fractalNoise' baseFrequency='.006 .018' numOctaves='4' seed='7' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 .05 0 0 0 0 .03 0 0 0 0 .01 0 0 0 -1.4 1.05'/></filter><rect width='100%' height='100%' filter='url(#m)'/></svg>",
);

/** The ground every chapter stands on: the parchment, the drift, the grain, the bars and the type. */
const ground =
  `html,body{margin:0;background:${BAR}}*{box-sizing:border-box}` +
  `#root{position:absolute;inset:0;width:${W}px;height:${H}px;overflow:hidden;color:${PARCH};font-family:"Noto Serif",Georgia,serif}` +
  '.nc-backdrop{position:absolute;inset:0;background:radial-gradient(ellipse 75% 85% at 46% 46%,#3e2b16 0,#22170c 52%,#0c0805 100%)}' +
  '.drift{position:absolute;inset:-90px;transform-origin:50% 50%}' +
  `.drift .mottle{position:absolute;inset:0;background-image:${MOTTLE};background-size:640px 640px;opacity:.85}` +
  '.drift .fibre{position:absolute;inset:0;background:repeating-linear-gradient(86deg,#f3e2bd06 0 2px,transparent 2px 11px),repeating-linear-gradient(-4deg,#00000016 0 1px,transparent 1px 17px)}' +
  `.drift .contour{position:absolute;inset:0;background:repeating-radial-gradient(ellipse at 74% 30%,transparent 0 46px,${AMBER}12 46px 48px),repeating-radial-gradient(ellipse at 18% 82%,transparent 0 58px,${AMBER}0d 58px 60px);opacity:.9}` +
  `.leak{position:absolute;left:38%;top:-30%;width:1200px;height:900px;border-radius:50%;background:radial-gradient(circle,#ffb15c30 0,#ff8a3a14 40%,transparent 70%);opacity:0}` +
  '.vignette{position:absolute;inset:0;background:radial-gradient(ellipse 72% 78% at 50% 50%,transparent 52%,#000000c4 100%)}' +
  `.grain{position:absolute;inset:0;z-index:4;pointer-events:none;background-image:${GRAIN};background-size:256px 256px;opacity:.13}` +
  `.lb{position:absolute;left:0;right:0;z-index:5;height:72px;background:${BAR};overflow:hidden}.lb-top{top:0}.lb-bot{bottom:0}` +
  `.lb-in{position:absolute;left:80px;right:80px;top:0;height:72px;display:flex;align-items:center;gap:22px;font-family:"Be Vietnam Pro",Arial,sans-serif;font-weight:800;font-size:16px;letter-spacing:.26em;color:${PARCH_DIM}}` +
  `.lb-in .dia{width:9px;height:9px;background:${VERMILION};transform:rotate(45deg)}` +
  '.lb-in .chapter{margin-left:auto;margin-right:auto;color:#8e7a58}' +
  `.kind{padding:7px 14px 6px;border:1.5px solid ${AMBER}aa;border-radius:3px;color:${AMBER};font-size:15px;letter-spacing:.2em;line-height:1.3}` +
  `.kind.legend{border-color:${VERMILION};color:#e8664a}.kind.disputed{border-style:dashed}` +
  '.slot-foot{position:absolute;left:80px;right:80px;top:14px;height:44px}' +
  `.kicker{display:flex;align-items:center;gap:22px;font-family:"Be Vietnam Pro",Arial,sans-serif;font-weight:800;font-size:22px;letter-spacing:.3em;color:${AMBER};line-height:1.4}` +
  `.kicker i{display:block;width:72px;height:2px;background:${AMBER}}` +
  '.display{font-family:"Noto Serif Display","Noto Serif",Georgia,serif}' +
  '.slot-seal{position:absolute;width:118px;height:118px;z-index:3}' +
  `.fade{position:absolute;inset:0;z-index:6;background:${BAR};opacity:0;pointer-events:none}`;

/** The layers behind and over the type, and the two bars. `chapter` names the chapter in the top bar. */
const frame = (chapter, inner, { footer = foot.markup } = {}) => `<div class="drift"><div class="mottle"></div><div class="fibre"></div><div class="contour"></div></div>
      <div class="leak"></div><div class="vignette"></div>
      ${inner}
      <div class="grain"></div>
      <div class="lb lb-top"><div class="lb-in"><span class="dia"></span><span>LỊCH SỬ KỂ CHUYỆN</span><span class="chapter">${chapter}</span><span class="kind"></span><span>NODECINE</span></div></div>
      <div class="lb lb-bot"><span class="slot slot-foot">${footer}</span></div>
      <div class="fade"></div>`;

/** The entrance every chapter shares: the bars close in, the parchment drifts, the grain flickers, the light leak crosses. */
const open =
  `tl.fromTo(root.querySelectorAll('.lb'),{height:200},{height:72,duration:1.1,ease:'power3.inOut'},0);` +
  `tl.fromTo(root.querySelectorAll('.lb-in,.slot-foot'),{opacity:0},{opacity:1,duration:.6,ease:'sine.out'},.7);` +
  `tl.fromTo(q('.drift'),{scale:1.03,x:30,y:10},{scale:1.11,x:-50,y:-14,duration:duration,ease:'none'},0);` +
  `tl.fromTo(q('.leak'),{x:-420,opacity:0},{x:380,opacity:1,duration:duration,ease:'sine.inOut'},0);` +
  `tl.fromTo(q('.grain'),{backgroundPosition:'0px 0px'},{backgroundPosition:'1931px 1187px',duration:duration,ease:'steps('+Math.max(12,Math.round(duration*12))+')'},0);`;

/** Shared by every scene's script: shrink type to its box, and label the chapter as history, legend or a disputed account. */
const helpers =
  "var fit=function(sel,floor){root.querySelectorAll(sel).forEach(function(el){var g=0;while(el.scrollHeight>el.clientHeight+2&&parseFloat(getComputedStyle(el).fontSize)>floor&&g++<90){el.style.fontSize=(parseFloat(getComputedStyle(el).fontSize)-2)+'px'}})};" +
  "var fitW=function(sel,floor){root.querySelectorAll(sel).forEach(function(el){var g=0;while(el.scrollWidth>el.clientWidth+2&&parseFloat(getComputedStyle(el).fontSize)>floor&&g++<120){el.style.fontSize=(parseFloat(getComputedStyle(el).fontSize)-4)+'px'}})};" +
  "var str=function(k){return String(v[k]==null?'':v[k]).trim()};";
/**
 * Pictures from the Assets node — a painting, a map, a place, an artifact — shown with the kit's own
 * parts, graded into the film's sepia: full frame where the picture is the scene, darker where words
 * sit over it, and round on a medallion for a person. A scene with no picture hides the part and stands
 * on its parchment, as before.
 */
const TONE = 'linear-gradient(180deg,#2a1a0a33,#1a0f0533 60%,#0c0805aa)';
const PICTURE = { grade: 'sepia', tone: TONE };
const DIM = { grade: 'dim', tone: TONE, from: 1.06, to: 1.14 };
const BEHIND_TITLE = { grade: 'sepia(.5) saturate(.7) contrast(1.05) brightness(.62)', tone: TONE, from: 1.02, to: 1.12 };
const CREDIT = { label: 'ẢNH', accent: AMBER, color: PARCH_DIM };
const PORTRAIT = { grade: 'sepia', ring: '#3a2610', glow: 'transparent' };
const look = { full: paste(pictureFrame(PICTURE)), dim: paste(pictureFrame(DIM)), title: paste(pictureFrame(BEHIND_TITLE)) };
const credit = paste(pictureCredit(CREDIT));
const portrait = paste(portraitDisc(PORTRAIT));
/** A pasted picture layer: its CSS, its markup in a slot filling the frame, its script and its move. */
const layer = (part) => ({ css: part.css + '.slot-pic{position:absolute;inset:0}', markup: `<span class="slot slot-pic">${part.markup}</span>`, before: part.before, motion: part.motion });
const pic = { full: layer(look.full), dim: layer(look.dim), title: layer(look.title) };
/**
 * A diorama from the kit, for a moment no picture shows: a battle, a journey, a scene from the chronicles
 * or a legend, drawn as a shadow-puppet play from the writer's keywords. It is an illustration and says
 * so in its corner; the film's own grain lies over it, so the part brings none of its own.
 */
const BACH_DANG = { setting: 'sông, núi', time: 'hoàng hôn', cast: 'tướng giơ cờ, 2 lính', props: 'thuyền chiến x2, thuyền nhẹ x2, bãi cọc', action: 'triều rút', region: 'á đông', foeRegion: '' };
const DIO = { grain: false, vignette: true, samples: BACH_DANG };
const dio = paste(diorama(DIO));
const pictureVar = (label, labelVi, required = false) => ({ id: 'picture', type: 'string', label, labels: { vi: labelVi }, default: '', sample: '', maxLength: 120, ...(required ? { required: true } : {}) });
const moveVar = {
  id: 'move',
  type: 'string',
  label: 'How the camera moves over the picture: "in", "out", "left" or "right"; empty for in',
  labels: { vi: 'Máy quay di chuyển trên ảnh: "in", "out", "left" hay "right"; để trống là "in"' },
  default: '',
  sample: '',
  maxLength: 6,
};

const kindScript = (fallback) =>
  `var kindEl=q('.kind');var kindS=v.kind==null?${JSON.stringify(fallback)}:String(v.kind).trim();if(!kindS)kindEl.style.display='none';else{kindEl.textContent=kindS.toUpperCase();if(/truyền|thuyết|giai thoại|dã sử|huyền/i.test(kindS))kindEl.classList.add('legend');else if(/theo |tranh|giả thuyết|chưa rõ|ước/i.test(kindS))kindEl.classList.add('disputed');}`;

const sourceVar = (label, labelVi, sample, dflt = 'Đại Việt sử ký toàn thư') => ({ id: 'source', type: 'string', label, labels: { vi: labelVi }, default: dflt, sample, maxLength: 48, required: true });
const kindVar = (sample = 'CHÍNH SỬ') => ({
  id: 'kind',
  type: 'string',
  label: 'What kind of account this is: "Chính sử", "Truyền thuyết", "Giai thoại", or "Theo …" for a disputed one',
  labels: { vi: 'Loại tư liệu: "Chính sử", "Truyền thuyết", "Giai thoại", hoặc "Theo …" khi còn tranh cãi' },
  default: 'CHÍNH SỬ',
  sample,
  maxLength: 24,
  required: true,
});
const secondsVar = { id: 'seconds', type: 'number', label: 'Length in seconds (the Assemble node gives it)', labels: { vi: 'Độ dài, giây (node Assemble cấp)' }, default: 4 };

const scenes = {
  hook: {
    role: 'hook',
    description:
      'Chapter title card: the era in amber, a huge outlined year bleeding off the right edge, the chapter title in large serif, and one subtitle line. Opens the film.',
    css:
      ground +
      seal.css +
      foot.css +
      pic.title.css +
      '.hook-shade{position:absolute;inset:0;display:none;background:linear-gradient(90deg,#0c0805e6 0,#0c0805b3 42%,#0c080533 75%,transparent)}#root.has-picture .hook-shade{display:block}' +
      `.year{position:absolute;right:-30px;top:190px;width:1240px;height:660px;margin:0;text-align:right;white-space:nowrap;font-size:520px;line-height:660px;font-weight:700;letter-spacing:-.02em;color:${AMBER}1c;-webkit-text-stroke:2px ${AMBER}88;overflow:hidden}` +
      '.copy{position:absolute;left:80px;top:250px;width:1180px;bottom:150px;display:flex;flex-direction:column;justify-content:center;gap:34px}' +
      `.hook-title{margin:0;font-size:124px;line-height:1.2;font-weight:700;letter-spacing:-.01em;color:${PARCH};text-shadow:0 6px 40px #000c;max-height:476px;overflow:hidden;padding:.06em 0 .18em}` +
      `.hook-rule{width:180px;height:2px;background:${AMBER}}` +
      `.hook-sub{margin:0;font-style:italic;font-size:40px;line-height:1.4;color:#d6c39c;max-height:116px;overflow:hidden;max-width:1060px}` +
      '.slot-seal{left:80px;top:130px}',
    markup: frame(
      'MỞ ĐẦU',
      `${pic.title.markup}<div class="hook-shade"></div><p class="year display"></p>
      <span class="slot slot-seal">${seal.markup}</span>
      <div class="copy"><span class="kicker"><i></i><span class="era"></span></span><h1 class="hook-title title display"></h1><span class="hook-rule"></span><p class="hook-sub detail"></p></div>`,
    ),
    motion:
      open +
      pic.title.motion +
      `tl.fromTo(q('.year'),{opacity:0,scale:1.08,x:60,transformOrigin:'100% 50%'},{opacity:1,scale:1,x:0,duration:1.8,ease:'power2.out'},.2);` +
      `tl.to(q('.year'),{x:-40,duration:Math.max(.5,duration-2),ease:'none'},2);` +
      `tl.fromTo(q('.kicker'),{opacity:0,x:-30},{opacity:1,x:0,duration:.7,ease:'power2.out'},.55);` +
      `tl.fromTo(q('.kicker i'),{scaleX:0,transformOrigin:'left center'},{scaleX:1,duration:.7,ease:'power2.out'},.55);` +
      `tl.fromTo(q('.hook-title'),{opacity:0,y:40,filter:'blur(8px)'},{opacity:1,y:0,filter:'blur(0px)',duration:1.1,ease:'power3.out'},.75);` +
      `tl.fromTo(q('.hook-rule'),{scaleX:0,transformOrigin:'left center'},{scaleX:1,duration:.8,ease:'power2.inOut'},1.2);` +
      `tl.fromTo(q('.hook-sub'),{opacity:0,y:16},{opacity:1,y:0,duration:.8,ease:'power2.out'},1.35);` +
      seal.motion.replace(',.55);', ',1.6);') +
      foot.motion,
    textKeys: ['title', 'detail', 'source', 'era', 'year'],
    extraScript: helpers + kindScript('CHÍNH SỬ') + pic.title.before + "fit('.hook-title',64);fit('.hook-sub',28);fitW('.year',200);" + foot.before,
    variables: [
      pictureVar('A picture behind the title card, or empty', 'Ảnh nền sau tiêu đề, hoặc để trống'),
      moveVar,
      { id: 'era', type: 'string', label: 'The era, in capitals: a dynasty and a century, or a place and an age', labels: { vi: 'Thời đại, viết hoa: triều đại và thế kỷ, hay vùng đất và thời kỳ' }, default: 'THẾ KỶ XIII', sample: 'NHÀ TRẦN · THẾ KỶ XIII', maxLength: 36, required: true },
      { id: 'year', type: 'string', label: 'The year the story turns on, as the sources date it ("1288", "476", "938")', labels: { vi: 'Năm câu chuyện xoay quanh, đúng như sử ghi ("1288", "476", "938")' }, default: '1288', sample: '1288', maxLength: 10, required: true },
      { id: 'title', type: 'string', label: 'The chapter title', labels: { vi: 'Tên chương' }, default: 'Một trang sử', sample: 'Ba lần đánh thắng Nguyên Mông', maxLength: 48, required: true },
      {
        id: 'detail',
        type: 'string',
        label: 'One subtitle line under it',
        labels: { vi: 'Một dòng phụ đề bên dưới' },
        default: 'Câu chuyện bắt đầu từ đây.',
        sample: 'Ba lần kháng chiến, một dòng sông.',
        maxLength: 70,
        required: true,
      },
      kindVar(),
      sourceVar('Where the story comes from', 'Câu chuyện theo nguồn nào', 'Đại Việt sử ký toàn thư'),
      secondsVar,
    ],
  },
  picture: {
    role: 'feature',
    description:
      'A picture, full frame: a painting, a map, a place, a statue or an artifact from the pictures, graded to sepia and slowly zoomed or panned, with only a few words on screen and the picture’s credit. The film’s main scene: the narration tells the story while the picture shows it.',
    css:
      ground +
      foot.css +
      pic.full.css +
      '.cap-shade{position:absolute;left:0;right:0;bottom:0;height:520px;background:linear-gradient(180deg,transparent,#0c0805d9 70%)}' +
      '.cap{position:absolute;left:80px;right:520px;bottom:122px;display:flex;flex-direction:column;gap:18px}' +
      `.cap-title{margin:0;font-size:76px;line-height:1.2;font-weight:700;color:${PARCH};text-shadow:0 4px 30px #000;max-height:208px;overflow:hidden;padding:.06em 0 .18em}` +
      credit.css +
      '.slot-credit{position:absolute;right:80px;bottom:120px;width:560px;height:40px}' +
      `.pcr{font-family:"Be Vietnam Pro",Arial,sans-serif}` +
      `.nopic{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:40px;font-style:italic;color:${PARCH_DIM}}#root.has-picture .nopic{display:none}`,
    markup: frame(
      'TƯ LIỆU',
      `${pic.full.markup}<div class="nopic">—</div><div class="cap-shade"></div>
      <div class="cap"><span class="kicker"><i></i><span class="when"></span></span><h2 class="cap-title title display"></h2></div>
      <span class="slot slot-credit">${credit.markup}</span>`,
    ),
    motion:
      open +
      pic.full.motion +
      `tl.fromTo(q('.cap-shade'),{opacity:0},{opacity:1,duration:1,ease:'sine.out'},.4);` +
      `tl.fromTo(q('.cap .kicker'),{opacity:0,x:-30},{opacity:1,x:0,duration:.7,ease:'power2.out'},.8);` +
      `tl.fromTo(q('.cap-title'),{opacity:0,y:30,filter:'blur(6px)'},{opacity:1,y:0,filter:'blur(0px)',duration:1,ease:'power3.out'},.95);` +
      credit.motion +
      foot.motion,
    textKeys: ['title', 'source', 'when'],
    extraScript:
      helpers +
      kindScript('CHÍNH SỬ') +
      pic.full.before +
      "if(!str('when'))q('.cap .kicker').style.display='none';fit('.cap-title',44);" +
      credit.before +
      foot.before,
    variables: [
      pictureVar('The picture: one of the listed picture paths', 'Ảnh: một trong các đường dẫn ảnh được liệt kê', true),
      {
        id: 'title',
        type: 'string',
        label: 'A few words on screen: a place, a name, or what is shown. The narration says the rest',
        labels: { vi: 'Vài chữ trên màn hình: một địa danh, một cái tên, hay điều ảnh cho thấy. Lời đọc kể phần còn lại' },
        default: 'Sông Bạch Đằng',
        sample: 'Bãi cọc trên sông Bạch Đằng',
        maxLength: 44,
        required: true,
      },
      { id: 'when', type: 'string', label: 'When or where, in capitals, or empty', labels: { vi: 'Khi nào hay ở đâu, viết hoa, hoặc để trống' }, default: '', sample: 'MÙA XUÂN 1288', maxLength: 28 },
      {
        id: 'credit',
        type: 'string',
        label: 'Where the picture comes from: the museum, the archive, or the site that holds it',
        labels: { vi: 'Ảnh lấy từ đâu: bảo tàng, kho lưu trữ, hay trang web lưu giữ nó' },
        default: '',
        sample: 'Wikimedia Commons',
        maxLength: 60,
        required: true,
      },
      moveVar,
      kindVar(),
      sourceVar('Where what the scene says comes from', 'Điều cảnh này nói theo nguồn nào', 'Đại Việt sử ký toàn thư'),
      secondsVar,
    ],
  },
  diorama: {
    role: 'feature',
    description:
      'An illustration drawn in code as a shadow-puppet play, filling the frame: a setting (river, sea, mountains, village, citadel, forest, fields, palace), a time of day, the people and things in it as paper-cut silhouettes, and what happens (the tide falls, an army advances, a battle, a fire), with only a few words on screen and an "illustration" credit. For a moment no picture shows: a battle, a journey, a scene from the chronicles or a legend.',
    css:
      ground +
      foot.css +
      dio.css +
      '.slot-dio{position:absolute;inset:0}' +
      '.dio-shade{position:absolute;left:0;bottom:0;width:1500px;height:600px;background:radial-gradient(ellipse 72% 78% at 0% 100%,#0a0403e0 0,#0a040399 42%,#0a040300 100%)}' +
      '.cap{position:absolute;left:80px;right:560px;bottom:122px;display:flex;flex-direction:column;gap:16px}' +
      `.cap-title{margin:0;font-size:74px;line-height:1.2;font-weight:700;color:${PARCH};text-shadow:0 4px 30px #000;max-height:208px;overflow:hidden;padding:.06em 0 .18em}` +
      `.dio-credit{position:absolute;right:80px;bottom:126px;font-family:"Be Vietnam Pro",Arial,sans-serif;font-weight:800;font-size:17px;letter-spacing:.2em;color:#e8c99a;text-shadow:0 2px 14px #000}`,
    markup: frame(
      'TÁI HIỆN',
      `<span class="slot slot-dio">${dio.markup}</span><div class="dio-shade"></div>
      <div class="cap"><span class="kicker"><i></i><span class="when"></span></span><h2 class="cap-title title display"></h2></div>
      <span class="dio-credit">MINH HOẠ · NODECINE</span>`,
    ),
    motion:
      open +
      dio.motion +
      `tl.fromTo(q('.dio-shade'),{opacity:0},{opacity:1,duration:1,ease:'sine.out'},.4);` +
      `tl.fromTo(q('.cap .kicker'),{opacity:0,x:-30},{opacity:1,x:0,duration:.8,ease:'power2.out'},.8);` +
      `tl.fromTo(q('.cap-title'),{opacity:0,y:30,filter:'blur(6px)'},{opacity:1,y:0,filter:'blur(0px)',duration:1.1,ease:'power3.out'},1);` +
      `tl.fromTo(q('.dio-credit'),{opacity:0},{opacity:1,duration:.8,ease:'sine.out'},1.6);` +
      foot.motion,
    textKeys: ['title', 'source', 'when'],
    extraScript: helpers + kindScript('CHÍNH SỬ') + dio.before + "if(!str('when'))q('.cap .kicker').style.display='none';fit('.cap-title',44);" + foot.before,
    variables: [
      ...diorama(DIO).variables,
      {
        id: 'title',
        type: 'string',
        label: 'A few words on screen: what the scene shows. The narration says the rest',
        labels: { vi: 'Vài chữ trên màn hình: cảnh này cho thấy gì. Lời đọc kể phần còn lại' },
        default: 'Nước rút, thuyền giặc mắc cọc',
        sample: 'Nước rút, thuyền giặc mắc cọc',
        maxLength: 44,
        required: true,
      },
      { id: 'when', type: 'string', label: 'When or where, in capitals, or empty', labels: { vi: 'Khi nào hay ở đâu, viết hoa, hoặc để trống' }, default: '', sample: 'BẠCH ĐẰNG · 1288', maxLength: 28 },
      kindVar(),
      sourceVar('Where what the scene shows comes from', 'Điều cảnh này dựng lại theo nguồn nào', 'Đại Việt sử ký toàn thư'),
      secondsVar,
    ],
  },
  timeline: {
    role: 'feature',
    description:
      'A timeline: up to five dated events on a horizontal line that draws in while the camera pans along it; each event is a date in amber and one line of what happened. Use for the order of events.',
    css:
      ground +
      foot.css +
      '.head{position:absolute;left:80px;right:80px;top:118px;display:flex;flex-direction:column;gap:14px}' +
      `.tl-title{margin:0;font-size:72px;line-height:1.2;font-weight:700;color:${PARCH};max-height:110px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;padding:.06em 0 .18em}` +
      '.view{position:absolute;left:0;right:0;top:360px;height:620px;overflow:hidden;-webkit-mask:linear-gradient(90deg,transparent 0,#000 80px,#000 1840px,transparent 1920px);mask:linear-gradient(90deg,transparent 0,#000 80px,#000 1840px,transparent 1920px)}' +
      '.cam{position:absolute;left:80px;top:0;height:620px}' +
      '.track{position:relative;height:620px;display:flex}' +
      `.line{position:absolute;left:0;right:0;top:186px;height:3px;background:linear-gradient(90deg,${AMBER}00,${AMBER} 6%,${AMBER} 94%,${AMBER}00)}` +
      `.line-shadow{position:absolute;left:0;right:0;top:184px;height:7px;background:${RULE}55;filter:blur(3px)}` +
      '.ev{position:relative;flex:none;width:460px;height:620px;padding:0 34px 0 0}' +
      `.when{position:absolute;left:0;right:20px;top:20px;height:140px;display:flex;align-items:flex-end;font-size:104px;line-height:1.1;font-weight:700;color:${AMBER};white-space:nowrap;overflow:hidden;letter-spacing:-.01em}` +
      `.dot{position:absolute;left:2px;top:174px;width:28px;height:28px;border-radius:50%;background:${BAR};border:3px solid ${AMBER};box-shadow:0 0 0 8px ${AMBER}22}` +
      `.dot:after{content:"";position:absolute;inset:6px;border-radius:50%;background:${AMBER}}` +
      `.stem{position:absolute;left:15px;top:210px;width:1px;height:46px;background:${AMBER}88}` +
      `.what{position:absolute;left:0;right:30px;top:270px;height:300px;margin:0;font-size:34px;line-height:1.42;color:${PARCH};overflow:hidden}`,
    markup: frame(
      'DÒNG THỜI GIAN',
      `<div class="head"><span class="kicker"><i></i><span>DÒNG THỜI GIAN</span></span><h2 class="tl-title title display"></h2></div>
      <div class="view"><div class="cam"><div class="track"><div class="line-shadow"></div><div class="line"></div>
        ${[1, 2, 3, 4, 5].map((i) => `<div class="ev ev-${i}"><span class="when when${i} display"></span><span class="dot"></span><span class="stem"></span><p class="what what${i}"></p></div>`).join('\n        ')}
      </div></div></div>`,
    ),
    motion:
      open +
      `tl.fromTo(q('.head .kicker'),{opacity:0,x:-30},{opacity:1,x:0,duration:.7,ease:'power2.out'},.4);` +
      `tl.fromTo(q('.tl-title'),{opacity:0,y:30},{opacity:1,y:0,duration:.8,ease:'power3.out'},.55);` +
      `var D0=.8,DL=Math.max(1.8,duration*.6);` +
      `tl.fromTo(root.querySelectorAll('.line,.line-shadow'),{scaleX:0,transformOrigin:'left center'},{scaleX:1,duration:DL,ease:'power1.inOut'},D0);` +
      `var inv=function(f){return f<.5?Math.sqrt(f/2):1-Math.sqrt((1-f)/2)};` +
      // The camera holds until the drawing tip nears the right of the frame, then follows it to the last event.
      `if(pan>0){var c0=D0+inv(Math.min(.95,1230/trackW))*DL;tl.fromTo(q('.cam'),{x:0},{x:-pan,duration:Math.max(.4,D0+DL-c0),ease:'sine.inOut'},c0);}` +
      `evs.forEach(function(el,i){var f=(i*COL+16)/trackW;var t=D0+inv(f)*DL;` +
      `tl.fromTo(el.querySelector('.dot'),{scale:0},{scale:1,duration:.4,ease:'back.out(2.4)'},t);` +
      `tl.fromTo(el.querySelector('.when'),{opacity:0,y:30},{opacity:1,y:0,duration:.6,ease:'power3.out'},t+.05);` +
      `tl.fromTo(el.querySelector('.stem'),{scaleY:0,transformOrigin:'top center'},{scaleY:1,duration:.3,ease:'power2.out'},t+.15);` +
      `tl.fromTo(el.querySelector('.what'),{opacity:0,y:18},{opacity:1,y:0,duration:.6,ease:'power2.out'},t+.2);});` +
      foot.motion,
    textKeys: ['title', 'source', 'when1', 'when2', 'when3', 'when4', 'when5', 'what1', 'what2', 'what3', 'what4', 'what5'],
    extraScript:
      helpers +
      kindScript('CHÍNH SỬ') +
      // Empty events leave the line; the track is as wide as what is left, centred when it fits and panned along when it does not.
      "var evs=[];[1,2,3,4,5].forEach(function(i){var el=q('.ev-'+i);if(!str('when'+i))el.style.display='none';else evs.push(el)});" +
      "var COL=evs.length<=4?Math.min(520,Math.floor(1760/Math.max(1,evs.length))):460;evs.forEach(function(el){el.style.width=COL+'px'});var trackW=Math.max(COL,evs.length*COL);var pan=Math.max(0,trackW-1760);q('.track').style.width=trackW+'px';q('.cam').style.width=trackW+'px';if(trackW<1760)q('.cam').style.left=Math.round(80+(1760-trackW)/2)+'px';" +
      "fit('.what',24);fitW('.when',56);" +
      foot.before,
    variables: [
      { id: 'title', type: 'string', label: 'What this stretch of time is', labels: { vi: 'Quãng thời gian này là gì' }, default: 'Những mốc chính', sample: 'Ba lần quân Nguyên Mông sang', maxLength: 40, required: true },
      ...[1, 2, 3, 4, 5].flatMap((i) => [
        {
          id: `when${i}`,
          type: 'string',
          label: `Date of event ${i}, as the sources give it ("1258", "12/1287", "476")${i > 2 ? ', or empty' : ''}`,
          labels: { vi: `Mốc thời gian của sự kiện ${i}, đúng như sử ghi ("1258", "12/1287", "476")${i > 2 ? ', hoặc để trống' : ''}` },
          default: i <= 2 ? ['1258', '1285'][i - 1] : '',
          sample: ['1258', '1285', '1287', '1288', ''][i - 1],
          maxLength: 12,
          required: i <= 2,
        },
        {
          id: `what${i}`,
          type: 'string',
          label: `What happened then, in one line${i > 2 ? ', or empty' : ''}`,
          labels: { vi: `Điều đã xảy ra, trong một dòng${i > 2 ? ', hoặc để trống' : ''}` },
          default: i <= 2 ? 'Điều đã xảy ra.' : '',
          sample: [
            'Mông Cổ vào Thăng Long, bị đánh bật.',
            'Thắng ở Hàm Tử, Chương Dương.',
            'Nguyên sang cả bộ lẫn thuỷ.',
            'Bạch Đằng: thuyền giặc mắc cọc.',
            '',
          ][i - 1],
          maxLength: 48,
          required: i <= 2,
        },
      ]),
      kindVar(),
      sourceVar('Where these dates come from', 'Các mốc này theo nguồn nào', 'Đại Việt sử ký toàn thư'),
      secondsVar,
    ],
  },
  figure: {
    role: 'feature',
    description:
      'A historical figure: a bronze medallion with their portrait (or their initials when there is none) and their name and years engraved round the rim, then the name, the years, their role, and one line on who they were.',
    css:
      ground +
      foot.css +
      '.medal{position:absolute;left:150px;top:250px;width:580px;height:580px}' +
      `.medal .halo{position:absolute;inset:-60px;border-radius:50%;background:radial-gradient(circle,${AMBER}26 0,transparent 66%)}` +
      `.medal .rim{position:absolute;inset:0;border-radius:50%;background:radial-gradient(circle at 38% 30%,#7a5428,#3a2610 62%,#22160a);box-shadow:0 40px 90px #000c,inset 0 0 0 3px ${AMBER}aa,inset 0 0 0 16px #2a1b0c,inset 0 0 0 18px ${AMBER}66}` +
      `.medal .ticks{position:absolute;inset:92px;border-radius:50%;background:repeating-conic-gradient(${AMBER}aa 0 .7deg,transparent .7deg 6deg);-webkit-mask:radial-gradient(circle,transparent 63%,#000 64%,#000 70%,transparent 71%);mask:radial-gradient(circle,transparent 63%,#000 64%,#000 70%,transparent 71%)}` +
      `.medal .face{position:absolute;inset:132px;border-radius:50%;background:radial-gradient(circle at 40% 32%,#5c3f1f,#2b1c0d 70%);box-shadow:inset 0 10px 30px #00000099,inset 0 0 0 2px ${AMBER}66,0 0 0 2px #00000066;display:flex;align-items:center;justify-content:center}` +
      `.medal .ini{font-size:150px;line-height:1.2;font-weight:700;color:#f0d9a6;letter-spacing:.02em;text-shadow:0 -2px 0 #00000088,0 2px 0 #ffe9b844,0 0 40px ${AMBER}44;padding-top:.08em;white-space:nowrap}` +
      '.medal svg{position:absolute;inset:0;width:100%;height:100%;overflow:visible}' +
      `.medal text{font-family:"Be Vietnam Pro",Arial,sans-serif;font-weight:800;font-size:25px;fill:${AMBER}}` +
      portrait.css +
      '.slot-portrait{position:absolute;inset:0}#root.has-picture .ini{display:none}' +
      '.bio{position:absolute;left:880px;right:80px;top:150px;bottom:130px;display:flex;flex-direction:column;justify-content:center;gap:20px}' +
      `.fig-name{margin:0;font-size:104px;line-height:1.18;font-weight:700;color:${PARCH};max-height:272px;overflow:hidden;padding:.06em 0 .18em}` +
      `.years{font-size:52px;line-height:1.2;font-weight:500;color:${AMBER};font-style:italic}` +
      `.role{font-family:"Be Vietnam Pro",Arial,sans-serif;font-weight:600;font-size:28px;line-height:1.45;letter-spacing:.04em;color:${PARCH_DIM};max-height:84px;overflow:hidden;padding:18px 0 0;border-top:1px solid ${RULE};margin-top:10px}` +
      `.who{margin:0;font-size:38px;line-height:1.45;font-style:italic;color:#e2cfa8;max-height:170px;overflow:hidden}`,
    markup: frame(
      'NHÂN VẬT',
      `<div class="medal"><div class="halo"></div><div class="rim"></div><div class="ticks"></div>
        <svg viewBox="0 0 580 580"><defs><path id="hs-ring" d="M290,290 m-245,0 a245,245 0 1,1 490,0 a245,245 0 1,1 -490,0"/></defs><g class="ring-g"><text><textPath href="#hs-ring" class="ring-text" textLength="1520" lengthAdjust="spacing"></textPath></text></g></svg>
        <div class="face"><span class="ini display"></span><span class="slot slot-portrait">${portrait.markup}</span></div></div>
      <div class="bio"><span class="kicker"><i></i><span>NHÂN VẬT LỊCH SỬ</span></span><h2 class="fig-name title display"></h2><span class="years display"></span><span class="role"></span><p class="who detail"></p></div>`,
    ),
    motion:
      open +
      `tl.fromTo(q('.medal'),{opacity:0,scale:.86,rotation:-8},{opacity:1,scale:1,rotation:0,duration:1.3,ease:'power3.out'},.3);` +
      `tl.fromTo(q('.ring-g'),{rotation:-40,svgOrigin:'290 290'},{rotation:20,svgOrigin:'290 290',duration:duration,ease:'none'},0);` +
      `tl.fromTo(q('.ticks'),{rotation:0},{rotation:-18,duration:duration,ease:'none'},0);` +
      `tl.fromTo(q('.ini'),{opacity:0,scale:1.15},{opacity:1,scale:1,duration:1,ease:'power2.out'},.7);` +
      portrait.motion +
      `tl.fromTo(q('.bio .kicker'),{opacity:0,x:-30},{opacity:1,x:0,duration:.7,ease:'power2.out'},.6);` +
      `tl.fromTo(q('.fig-name'),{opacity:0,y:36,filter:'blur(6px)'},{opacity:1,y:0,filter:'blur(0px)',duration:1,ease:'power3.out'},.75);` +
      `tl.fromTo(q('.years'),{opacity:0,y:16},{opacity:1,y:0,duration:.7,ease:'power2.out'},1.05);` +
      `tl.fromTo(q('.role'),{opacity:0},{opacity:1,duration:.7,ease:'sine.out'},1.25);` +
      `tl.fromTo(q('.who'),{opacity:0,y:16},{opacity:1,y:0,duration:.8,ease:'power2.out'},1.4);` +
      foot.motion,
    textKeys: ['title', 'detail', 'source', 'years', 'role'],
    extraScript:
      helpers +
      kindScript('CHÍNH SỬ') +
      // The initials stand in for a portrait: given, or the first letter of the first and the last word of the name.
      portrait.before +
      "var nameW=str('title').split(/\\s+/).filter(Boolean);var ini=str('initials')||((nameW[0]||'').charAt(0)+(nameW.length>1?nameW[nameW.length-1].charAt(0):'')).toUpperCase();q('.ini').textContent=ini.slice(0,3);" +
      "var ringS=(str('title')+(str('years')?'  ·  '+str('years'):'')+'  ·  ').toUpperCase();var ring=ringS;while(ring.length<60)ring+=ringS;q('.ring-text').textContent=ring;" +
      "if(!str('role'))q('.role').style.display='none';fit('.fig-name',62);fit('.who',28);fit('.role',22);fitW('.ini',90);" +
      foot.before,
    variables: [
      { id: 'title', type: 'string', label: 'The name, as history knows them', labels: { vi: 'Tên nhân vật, như sử gọi' }, default: 'Nhân vật', sample: 'Trần Hưng Đạo', maxLength: 36, required: true },
      pictureVar('A portrait, statue or painting of them, or empty for their initials', 'Chân dung, tượng hay tranh vẽ nhân vật, hoặc để trống để dùng chữ viết tắt'),
      { id: 'initials', type: 'string', label: 'The initials on the medallion, or empty to take them from the name', labels: { vi: 'Chữ viết tắt trên huy chương, hoặc để trống để lấy từ tên' }, default: '', sample: '', maxLength: 3 },
      {
        id: 'years',
        type: 'string',
        label: 'Their years, as the sources give them; mark an uncertain one with "?" ("1228? – 1300")',
        labels: { vi: 'Năm sinh – năm mất, đúng như sử ghi; năm chưa chắc thì thêm "?" ("1228? – 1300")' },
        default: '',
        sample: '1228? – 1300',
        maxLength: 24,
        required: true,
      },
      { id: 'role', type: 'string', label: 'Their title or role', labels: { vi: 'Tước vị hay vai trò' }, default: '', sample: 'Quốc công tiết chế, thống lĩnh quân đội nhà Trần', maxLength: 64 },
      {
        id: 'detail',
        type: 'string',
        label: 'One line on who they were',
        labels: { vi: 'Một dòng về con người này' },
        default: 'Một dòng về con người này.',
        sample: 'Tác giả Hịch tướng sĩ, thống lĩnh hai cuộc kháng chiến.',
        maxLength: 80,
        required: true,
      },
      kindVar(),
      sourceVar('Where this account of them comes from', 'Tiểu sử theo nguồn nào', 'Đại Việt sử ký toàn thư'),
      secondsVar,
    ],
  },
  forces: {
    role: 'feature',
    description:
      'Two sides facing each other across a divider: each side’s name, its strength (a number or a word, as the sources give it) with a note, its leader, and map-style arrows advancing to the centre; one line on the outcome below. For a battle; for anything else, two powers or two choices.',
    css:
      ground +
      foot.css +
      pic.dim.css +
      '.fc-head{position:absolute;left:80px;right:80px;top:112px;display:flex;flex-direction:column;align-items:center;gap:12px;text-align:center}' +
      '.fc-head .kicker{justify-content:center}' +
      `.fc-title{margin:0;font-size:64px;line-height:1.2;font-weight:700;color:${PARCH};max-height:98px;max-width:1500px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;padding:.06em 0 .18em}` +
      '.side{position:absolute;top:290px;width:720px;height:440px;display:flex;flex-direction:column;gap:10px}' +
      '.side-a{left:80px;align-items:flex-start;text-align:left}.side-b{right:80px;align-items:flex-end;text-align:right}' +
      '.side-name{text-transform:uppercase;font-family:"Be Vietnam Pro",Arial,sans-serif;font-weight:800;font-size:28px;letter-spacing:.24em;line-height:1.4}' +
      `.side-a .side-name{color:${AMBER}}.side-b .side-name{color:${IRON}}` +
      '.strength{width:100%;font-size:150px;line-height:1.2;font-weight:700;letter-spacing:-.02em;white-space:nowrap;overflow:hidden;padding:.04em 0 .2em}' +
      `.side-a .strength{color:#f1d59c}.side-b .strength{color:#d4dfe0}` +
      `.note{margin:0;width:620px;font-size:30px;line-height:1.42;font-style:italic;color:#d8c59f;max-height:86px;overflow:hidden}.side-b .note{color:#c4cfd0}` +
      `.leader{margin-top:14px;padding-top:16px;border-top:1px solid ${RULE};width:560px;font-size:30px;line-height:1.4;color:${PARCH}}` +
      `.leader b{display:block;font-family:"Be Vietnam Pro",Arial,sans-serif;font-size:16px;letter-spacing:.24em;color:${PARCH_DIM};font-weight:800;margin-bottom:4px}` +
      `.divider{position:absolute;left:959px;top:300px;width:2px;height:470px;background:linear-gradient(${AMBER}00,${AMBER}aa 30%,${AMBER}aa 70%,${AMBER}00)}` +
      `.vs{position:absolute;left:910px;top:485px;width:100px;height:100px;display:flex;align-items:center;justify-content:center;background:${BAR};border:2px solid ${AMBER};transform:rotate(45deg);box-shadow:0 0 0 10px #0c0805,0 0 60px ${AMBER}33}` +
      `.vs span{transform:rotate(-45deg);font-size:38px;font-style:italic;font-weight:700;color:${AMBER};line-height:1}` +
      '.arrows{position:absolute;top:770px;width:780px;height:110px}.arrows-a{left:100px}.arrows-b{right:100px;transform:scaleX(-1)}' +
      '.arr{position:absolute;left:0;height:30px;display:flex;align-items:center}' +
      '.arr i{display:block;flex:1;height:5px}.arr b{display:block;width:34px;height:30px;clip-path:polygon(0 0,100% 50%,0 100%)}' +
      `.arrows-a .arr i{background:repeating-linear-gradient(90deg,${AMBER} 0 22px,transparent 22px 34px)}.arrows-a .arr b{background:${AMBER}}` +
      `.arrows-b .arr i{background:repeating-linear-gradient(90deg,${IRON} 0 22px,transparent 22px 34px)}.arrows-b .arr b{background:${IRON}}` +
      '.arr-1{top:0;width:700px}.arr-2{top:40px;width:780px}.arr-3{top:80px;width:620px}' +
      `.clash{position:absolute;left:880px;top:745px;width:160px;height:160px;border-radius:50%;background:radial-gradient(circle,#ffd08a88 0,#ff8a3a33 40%,transparent 70%);opacity:0}` +
      `.outcome{position:absolute;left:240px;right:240px;top:910px;margin:0;text-align:center;font-size:32px;line-height:1.4;font-style:italic;color:#e6d3ab;max-height:90px;overflow:hidden}`,
    markup: frame(
      'ĐỐI ĐẦU',
      `${pic.dim.markup}<div class="fc-head"><span class="kicker"><i></i><span class="kick-label">HAI BÊN ĐỐI ĐẦU</span><i></i></span><h2 class="fc-title title display"></h2></div>
      <div class="side side-a"><span class="side-name nameA"></span><span class="strength strengthA display"></span><p class="note noteA"></p><span class="leader"><b>CHỈ HUY</b><span class="leaderA"></span></span></div>
      <div class="side side-b"><span class="side-name nameB"></span><span class="strength strengthB display"></span><p class="note noteB"></p><span class="leader"><b>CHỈ HUY</b><span class="leaderB"></span></span></div>
      <div class="divider"></div><div class="vs"><span class="display">vs</span></div>
      <div class="arrows arrows-a"><span class="arr arr-1"><i></i><b></b></span><span class="arr arr-2"><i></i><b></b></span><span class="arr arr-3"><i></i><b></b></span></div>
      <div class="arrows arrows-b"><span class="arr arr-1"><i></i><b></b></span><span class="arr arr-2"><i></i><b></b></span><span class="arr arr-3"><i></i><b></b></span></div>
      <div class="clash"></div>
      <p class="outcome detail"></p>`,
    ),
    motion:
      open +
      pic.dim.motion +
      `tl.fromTo(q('.fc-head'),{opacity:0,y:-20},{opacity:1,y:0,duration:.8,ease:'power2.out'},.4);` +
      `tl.fromTo(q('.divider'),{scaleY:0},{scaleY:1,duration:.9,ease:'power2.inOut'},.6);` +
      `tl.fromTo(q('.vs'),{scale:0,rotation:0},{scale:1,rotation:45,duration:.7,ease:'back.out(1.8)'},.9);` +
      `tl.fromTo(q('.side-a'),{opacity:0,x:-80},{opacity:1,x:0,duration:1,ease:'power3.out'},.7);` +
      `tl.fromTo(q('.side-b'),{opacity:0,x:80},{opacity:1,x:0,duration:1,ease:'power3.out'},.85);` +
      `tl.fromTo(root.querySelectorAll('.arrows .arr'),{clipPath:'inset(0 100% 0 0)'},{clipPath:'inset(0 0% 0 0)',duration:.9,ease:'power2.inOut',stagger:.12},1.3);` +
      `tl.fromTo(root.querySelectorAll('.arrows'),{x:-30},{x:0,duration:1.4,ease:'power1.out'},1.3);` +
      `tl.to(q('.arrows-a'),{x:24,duration:Math.max(.6,duration-2.7),ease:'sine.inOut'},2.7);` +
      `tl.to(q('.arrows-b'),{x:-24,duration:Math.max(.6,duration-2.7),ease:'sine.inOut'},2.7);` +
      `tl.fromTo(q('.clash'),{opacity:0,scale:.4},{opacity:1,scale:1.3,duration:.5,ease:'power2.out'},2.2);` +
      `tl.to(q('.clash'),{opacity:.45,scale:1,duration:.8,ease:'sine.inOut'},2.7);` +
      `tl.fromTo(q('.outcome'),{opacity:0,y:14},{opacity:1,y:0,duration:.7,ease:'power2.out'},1.9);` +
      foot.motion,
    textKeys: ['title', 'detail', 'source', 'nameA', 'strengthA', 'noteA', 'leaderA', 'nameB', 'strengthB', 'noteB', 'leaderB'],
    extraScript:
      helpers +
      kindScript('CHÍNH SỬ') +
      pic.dim.before +
      "['A','B'].forEach(function(s){var side=q('.side-'+s.toLowerCase());if(!str('leader'+s))side.querySelector('.leader').style.display='none';if(!str('note'+s))side.querySelector('.note').style.display='none';});" +
      "if(!str('detail'))q('.outcome').style.display='none';fitW('.strength',64);fit('.note',24);fit('.outcome',24);" +
      foot.before,
    variables: [
      pictureVar('A map or a painting of the battle, shown dim behind the two sides, or empty', 'Bản đồ hay tranh vẽ trận đánh, mờ phía sau hai bên, hoặc để trống'),
      { id: 'title', type: 'string', label: 'The battle or the contest, with its year', labels: { vi: 'Trận đánh hay cuộc đối đầu, kèm năm' }, default: 'Hai bên đối đầu', sample: 'Trận Bạch Đằng, 1288', maxLength: 44, required: true },
      { id: 'nameA', type: 'string', label: 'The first side (the side the story follows)', labels: { vi: 'Bên thứ nhất (bên câu chuyện đi theo)' }, default: 'Bên A', sample: 'Đại Việt', maxLength: 28, required: true },
      {
        id: 'strengthA',
        type: 'string',
        label: 'Its strength, a number as the sources give it or a word ("20 vạn", "~400", "Mai phục")',
        labels: { vi: 'Lực lượng: con số đúng như sử ghi, hoặc một chữ ("20 vạn", "~400", "Mai phục")' },
        default: '?',
        sample: 'Mai phục',
        maxLength: 14,
        required: true,
      },
      { id: 'noteA', type: 'string', label: 'A note under it: what the number counts, or "theo …"', labels: { vi: 'Ghi chú dưới con số: đếm cái gì, hoặc "theo …"' }, default: '', sample: 'Cọc gỗ dưới lòng sông, chờ nước triều rút.', maxLength: 70 },
      { id: 'leaderA', type: 'string', label: 'Who led it', labels: { vi: 'Ai chỉ huy' }, default: '', sample: 'Trần Hưng Đạo', maxLength: 40 },
      { id: 'nameB', type: 'string', label: 'The second side', labels: { vi: 'Bên thứ hai' }, default: 'Bên B', sample: 'Quân Nguyên', maxLength: 28, required: true },
      { id: 'strengthB', type: 'string', label: 'Its strength', labels: { vi: 'Lực lượng bên thứ hai' }, default: '?', sample: '400+', maxLength: 14, required: true },
      { id: 'noteB', type: 'string', label: 'A note under it', labels: { vi: 'Ghi chú dưới con số' }, default: '', sample: 'Chiến thuyền bị bắt, theo Toàn thư.', maxLength: 70 },
      { id: 'leaderB', type: 'string', label: 'Who led it', labels: { vi: 'Ai chỉ huy' }, default: '', sample: 'Ô Mã Nhi, Phàn Tiếp', maxLength: 40 },
      {
        id: 'detail',
        type: 'string',
        label: 'One line on the outcome, or empty',
        labels: { vi: 'Một dòng về kết cục, hoặc để trống' },
        default: '',
        sample: 'Nước triều rút, thuyền giặc mắc cọc; Ô Mã Nhi bị bắt sống.',
        maxLength: 110,
      },
      kindVar(),
      sourceVar('Where these figures come from', 'Các con số theo nguồn nào', 'Đại Việt sử ký toàn thư'),
      secondsVar,
    ],
  },
  quote: {
    role: 'proof',
    description:
      'The turning point: a quote recorded in the sources, or the one sentence the story turns on, in large serif; who said it and when, and the book it is recorded in.',
    css:
      ground +
      pic.dim.css +
      '.q-head{position:absolute;left:80px;right:80px;top:128px;display:flex;justify-content:center}' +
      `.mark{position:absolute;left:210px;top:170px;font-size:360px;line-height:1;color:${AMBER}38;font-weight:700}` +
      '.q-stack{position:absolute;left:250px;right:250px;top:200px;bottom:120px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:44px}' +
      `.quote{flex:none;max-height:500px;width:100%;margin:0;text-align:center;font-size:82px;line-height:1.3;font-style:italic;font-weight:500;color:${PARCH};text-shadow:0 6px 40px #000b;overflow:hidden;padding:.06em 0 .2em}` +
      '.attrib{display:flex;flex-direction:column;align-items:center;gap:16px;text-align:center}' +
      `.attrib .rule{width:120px;height:2px;background:${AMBER}}` +
      `.who{margin:0;font-size:34px;line-height:1.4;color:#e2cfa8;max-height:96px;overflow:hidden}` +
      `.rec{display:flex;align-items:center;gap:16px;font-family:"Be Vietnam Pro",Arial,sans-serif;font-weight:800;font-size:18px;letter-spacing:.24em;color:${AMBER}}` +
      `.rec .source{font-family:"Noto Serif",Georgia,serif;font-weight:700;font-style:italic;font-size:30px;letter-spacing:0;color:${PARCH}}` +
      `.q-folio{position:absolute;left:0;right:0;top:0;height:72px;display:flex;align-items:center;justify-content:space-between;font-family:"Be Vietnam Pro",Arial,sans-serif;font-weight:800;font-size:15px;letter-spacing:.26em;color:#7d6a4c}`,
    markup: frame(
      'BƯỚC NGOẶT',
      `${pic.dim.markup}<div class="q-head"><span class="kicker"><i></i><span class="heading"></span><i></i></span></div>
      <span class="mark display">“</span>
      <div class="q-stack"><p class="quote title display"></p>
      <div class="attrib"><span class="rule"></span><p class="who detail"></p><span class="rec"><span>CHÉP TRONG</span><span class="source"></span></span></div></div>`,
      { footer: '<span class="q-folio"><span>SỬ CÒN CHÉP LẠI</span><span>NODECINE</span></span>' },
    ),
    motion:
      open +
      pic.dim.motion +
      `tl.fromTo(q('.q-head'),{opacity:0,y:-14},{opacity:1,y:0,duration:.7,ease:'power2.out'},.4);` +
      `tl.fromTo(q('.mark'),{opacity:0,x:-30},{opacity:1,x:0,duration:1,ease:'power3.out'},.5);` +
      `tl.fromTo(q('.quote'),{opacity:0,y:24,filter:'blur(10px)'},{opacity:1,y:0,filter:'blur(0px)',duration:1.5,ease:'power3.out'},.65);` +
      `tl.fromTo(q('.quote'),{scale:1},{scale:1.03,duration:duration,ease:'none'},0);` +
      `tl.fromTo(q('.attrib .rule'),{scaleX:0},{scaleX:1,duration:.7,ease:'power2.inOut'},1.5);` +
      `tl.fromTo(q('.who'),{opacity:0,y:12},{opacity:1,y:0,duration:.7,ease:'power2.out'},1.65);` +
      `tl.fromTo(q('.rec'),{opacity:0},{opacity:1,duration:.7,ease:'sine.out'},1.9);`,
    textKeys: ['title', 'detail', 'source', 'heading'],
    extraScript: helpers + kindScript('CHÍNH SỬ') + pic.dim.before + "fit('.who',26);",
    variables: [
      pictureVar('A picture shown dim behind the words: the place, the person or the document, or empty', 'Ảnh mờ phía sau lời: nơi chốn, nhân vật hay văn bản, hoặc để trống'),
      { id: 'heading', type: 'string', label: 'The head over it, in capitals: "LỜI CÒN CHÉP LẠI" for a quote, "BƯỚC NGOẶT" for a turning point', labels: { vi: 'Đề mục, viết hoa: "LỜI CÒN CHÉP LẠI" cho câu nói, "BƯỚC NGOẶT" cho bước ngoặt' }, default: 'LỜI CÒN CHÉP LẠI', sample: 'LỜI CÒN CHÉP LẠI', maxLength: 28, required: true },
      {
        id: 'title',
        type: 'string',
        label: 'The quote word for word as the source records it, or the turning point in one sentence',
        labels: { vi: 'Câu nói đúng nguyên văn như sử chép, hoặc bước ngoặt trong một câu' },
        default: 'Một câu sử còn chép lại.',
        sample: 'Đầu thần chưa rơi xuống đất, xin bệ hạ đừng lo.',
        maxLength: 130,
        required: true,
      },
      {
        id: 'detail',
        type: 'string',
        label: 'Who said it, when and to whom; or where the turning point happened',
        labels: { vi: 'Ai nói, khi nào, với ai; hoặc bước ngoặt diễn ra ở đâu' },
        default: '',
        sample: 'Thái sư Trần Thủ Độ, năm 1258, khi vua Trần Thái Tông hỏi kế đánh giặc',
        maxLength: 100,
        required: true,
      },
      kindVar(),
      sourceVar('The book it is recorded in', 'Sách chép lại câu này', 'Đại Việt sử ký toàn thư'),
      secondsVar,
    ],
  },
  stage: {
    role: 'scene',
    description:
      'An empty stage: only the film’s frame and its parchment, for a scene built from components. Mount them into its slots — something filling "full" (a diorama, a picture), a "portrait" or "inset" beside it, and a "history-caption" in "caption" last, so its words sit on top. Use it when no other block shows what the scene needs.',
    css: ground + foot.css + `.stage-glow{position:absolute;left:50%;top:46%;width:1500px;height:900px;transform:translate(-50%,-50%);border-radius:50%;background:radial-gradient(circle,${AMBER}14 0,transparent 62%)}`,
    markup: frame('TƯ LIỆU', '<div class="stage-glow"></div>'),
    motion: open + `tl.fromTo(q('.stage-glow'),{opacity:0,scale:.9},{opacity:1,scale:1.05,duration:duration,ease:'sine.out'},0);` + foot.motion,
    textKeys: ['source'],
    extraScript: helpers + kindScript('CHÍNH SỬ') + foot.before,
    variables: [kindVar(), sourceVar('Where what the scene shows comes from', 'Điều cảnh này cho thấy theo nguồn nào', 'Đại Việt sử ký toàn thư'), secondsVar],
  },
  close: {
    role: 'outro',
    description: 'Closing: what history leaves us, in large serif under a vermilion seal, one closing sentence, the source, and a note on how the film used its sources.',
    css:
      ground +
      seal.css +
      foot.css +
      '.c-body .slot-seal{position:relative;left:auto;top:auto;flex:none;margin-bottom:10px}' +
      '.c-body{position:absolute;left:200px;right:200px;top:110px;bottom:180px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:30px;text-align:center}' +
      '.c-body .kicker{justify-content:center}' +
      `.lesson{margin:0;font-size:104px;line-height:1.2;font-weight:700;color:${PARCH};max-height:282px;overflow:hidden;text-shadow:0 6px 40px #000c;padding:.06em 0 .18em}` +
      `.closing{margin:0;font-size:38px;line-height:1.45;font-style:italic;color:#e2cfa8;max-height:170px;overflow:hidden;max-width:1300px}` +
      `.c-note{position:absolute;left:200px;right:200px;bottom:110px;text-align:center;font-family:"Be Vietnam Pro",Arial,sans-serif;font-weight:600;font-size:21px;line-height:1.5;letter-spacing:.02em;color:${PARCH_DIM}}`,
    markup: frame(
      'KHÉP LẠI',
      `<div class="c-body"><span class="slot slot-seal">${seal.markup}</span><span class="kicker"><i></i><span>ĐIỀU LỊCH SỬ ĐỂ LẠI</span><i></i></span><h2 class="lesson title display"></h2><p class="closing detail"></p></div>
      <span class="c-note">Phim kể theo sử liệu; chi tiết truyền thuyết và điều các nguồn còn ghi khác nhau đã được ghi rõ.</span>`,
    ),
    motion:
      open +
      seal.motion.replace(',.55);', ',.5);') +
      `tl.fromTo(q('.c-body .kicker'),{opacity:0,y:-12},{opacity:1,y:0,duration:.7,ease:'power2.out'},.6);` +
      `tl.fromTo(q('.lesson'),{opacity:0,y:36,filter:'blur(8px)'},{opacity:1,y:0,filter:'blur(0px)',duration:1.2,ease:'power3.out'},.75);` +
      `tl.fromTo(q('.closing'),{opacity:0,y:16},{opacity:1,y:0,duration:.8,ease:'power2.out'},1.25);` +
      `tl.fromTo(q('.c-note'),{opacity:0},{opacity:1,duration:.8,ease:'sine.out'},1.6);` +
      `tl.to(q('.fade'),{opacity:1,duration:.6,ease:'sine.in'},Math.max(2.4,duration-.6));` +
      foot.motion,
    extraScript: helpers + kindScript('') + "fit('.lesson',62);fit('.closing',28);" + foot.before,
    variables: [
      { id: 'title', type: 'string', label: 'What history leaves us, in a few words', labels: { vi: 'Điều lịch sử để lại, trong vài chữ' }, default: 'Điều lịch sử để lại', sample: 'Khoan thư sức dân', maxLength: 48, required: true },
      {
        id: 'detail',
        type: 'string',
        label: 'One closing sentence',
        labels: { vi: 'Một câu kết' },
        default: 'Một câu để khép lại.',
        sample: 'Nới sức dân, làm kế sâu rễ bền gốc.',
        maxLength: 90,
        required: true,
      },
      sourceVar('Where the film’s account comes from', 'Phim kể theo nguồn nào', 'Đại Việt sử ký toàn thư · năm 1300'),
      secondsVar,
    ],
  },
};

/**
 * The words over a stage: a kicker and a short title, set in the film's serif over a soft shade. A
 * component, so it sits on top of whatever else the stage mounts; it fills its box in container units.
 */
const caption = {
  name: 'history-caption',
  role: 'ui',
  description: 'The words over a stage scene: when or where in small capitals, and a short title in the film’s serif over a soft shade. Mount it last, in the "caption" slot.',
  css:
    '#root{container-type:size}' +
    '.hc{position:absolute;inset:0;display:flex;flex-direction:column;justify-content:flex-end;gap:2.6cqh;padding:0 0 4cqh}' +
    '.hc-shade{position:absolute;left:-12cqw;right:-30cqw;top:-60cqh;bottom:-20cqh;background:radial-gradient(ellipse at 20% 80%,#0c0805e0 0,#0c080599 40%,transparent 72%)}' +
    `.hc-kick{position:relative;display:flex;align-items:center;gap:1.6cqw;font-family:var(--font-body,"Be Vietnam Pro",Arial,sans-serif);font-weight:800;font-size:min(2cqw,14cqh);letter-spacing:.3em;color:var(--brand,${AMBER})}` +
    `.hc-kick i{display:block;width:6cqw;height:2px;background:var(--brand,${AMBER})}` +
    `.hc-title{position:relative;margin:0;font-family:var(--font-display,"Noto Serif Display",Georgia,serif);font-weight:700;font-size:min(6.4cqw,46cqh);line-height:1.2;color:var(--fg,${PARCH});text-shadow:0 4px 30px #000;padding:.06em 0 .18em}`,
  markup: '<span class="hc"><span class="hc-shade"></span><span class="hc-kick"><i></i><span class="hc-when"></span></span><h2 class="hc-title"></h2></span>',
  variables: [
    { id: 'title', type: 'string', label: 'A few words on screen', labels: { vi: 'Vài chữ trên màn hình' }, default: '', sample: 'Nước rút, thuyền giặc mắc cọc', maxLength: 44, required: true },
    { id: 'when', type: 'string', label: 'When or where, in capitals, or empty', labels: { vi: 'Khi nào hay ở đâu, viết hoa, hoặc để trống' }, default: '', sample: 'BẠCH ĐẰNG · 1288', maxLength: 28 },
  ],
  extraScript:
    "var hcT=root.querySelector('.hc-title');hcT.textContent=String(v.title==null?'':v.title);var hcW=String(v.when==null?'':v.when).trim();if(hcW)root.querySelector('.hc-when').textContent=hcW;else root.querySelector('.hc-kick').style.display='none';",
  motion:
    "tl.fromTo(root.querySelector('.hc-shade'),{opacity:0},{opacity:1,duration:.8,ease:'sine.out'},0);" +
    "tl.fromTo(root.querySelector('.hc-kick'),{opacity:0,x:-30},{opacity:1,x:0,duration:.7,ease:'power2.out'},.3);" +
    "tl.fromTo(root.querySelector('.hc-title'),{opacity:0,y:30,filter:'blur(6px)'},{opacity:1,y:0,filter:'blur(0px)',duration:1,ease:'power3.out'},.45);",
};

/**
 * The named boxes a stage's components go in, inside the letterbox (72px bars top and bottom): the
 * whole picture, its two halves, a centre, a card at the top right, a portrait, the caption band and a
 * credit line above the source bar.
 */
const SLOTS = {
  full: [0, 72, W, H - 144],
  left: [80, 130, 840, 680],
  right: [1000, 130, 840, 680],
  center: [400, 120, 1120, 700],
  inset: [1250, 120, 590, 430],
  portrait: [140, 150, 560, 560],
  caption: [80, 780, 1180, 210],
  credit: [1240, 950, 600, 40],
};

const GUIDE = `---
first: hook
last: outro
repeat: 2
---
Làm một phim tiếng Việt, ngang 16:9, khoảng 100–120 giây, kể một câu chuyện lịch sử theo chủ đề trong Brief: một trận đánh, một triều đại, sự sụp đổ của một đế chế, một nhân vật lịch sử Việt Nam hay thế giới. Giọng kể trầm, chậm rãi, trang nghiêm như phim tài liệu, có nhịp kể chuyện: dẫn người xem vào một khoảnh khắc rồi mới kể bối cảnh.
LỜI ĐỌC LÀ KỂ CHUYỆN, KHÔNG PHẢI ĐỌC CHÚ THÍCH. Kể như người kể chuyện bên đống lửa: có người, có cảnh, có căng thẳng, có quyết định. Dùng câu ngắn, động từ mạnh, chi tiết cụ thể Research có (tiếng trống, con nước, đêm tối, ngọn cờ), đặt người xem vào khoảnh khắc ("Đêm ấy, …", "Ba ngày sau, …"), để lại câu hỏi treo giữa các cảnh cho người xem muốn nghe tiếp. Không liệt kê, không đọc như sách giáo khoa.
KHÔNG NHẮC NGUỒN TRONG LỜI ĐỌC. Tên sách, "theo Toàn thư", "sử chép", "có sách ghi" đã có ở thanh nguồn và nhãn trên màn hình — lời đọc không lặp lại. Chỉ được nói tới nguồn tối đa một lần trong cả phim, khi điều đó chính là câu chuyện (một câu sử chép nguyên văn). Với truyền thuyết hay điều còn tranh cãi, chỉ một từ dẫn tự nhiên, một lần cho cả đoạn ("tương truyền", "người ta kể rằng"), rồi kể tiếp; không rào đón ở từng câu.
HÌNH NHIỀU, CHỮ ÍT. Đây là phim, không phải trang sách: lời đọc kể chi tiết, màn hình chỉ hiện điều mắt cần thấy — một địa danh, một cái tên, một năm. Mỗi giá trị chữ viết ngắn hơn giới hạn của nó nhiều; không chép lại lời đọc lên màn hình.
Ảnh và minh hoạ là xương sống của phim: ít nhất 6 trên 10 cảnh là history-picture (ảnh tràn khung, máy quay lia chậm) hoặc history-diorama (minh hoạ rối bóng), xen giữa các cảnh đồ hoạ; khi có ảnh hợp thì ưu tiên ảnh. Cảnh hook nên có ảnh nền khi có một bức hợp; history-figure dùng chân dung, tượng hay tranh vẽ nhân vật khi có; history-forces dùng bản đồ hay tranh trận đánh; history-quote dùng ảnh nơi chốn hay văn bản. Chỉ dùng ảnh khi ghi chú của nó cho thấy đúng điều cảnh nói; mỗi ảnh dùng một lần. Không có ảnh hợp thì để trống giá trị ảnh, đừng gượng ép.
Mỗi history-picture: vài chữ trên màn hình (tối đa 44 ký tự: địa danh, tên, hay điều ảnh cho thấy), thời điểm hay nơi chốn viết hoa nếu có, nơi lưu giữ ảnh (credit: bảo tàng, kho lưu trữ, hay trang web theo ghi chú của ảnh, như "Wikimedia Commons"), và hướng máy quay ("in", "out", "left", "right" — đổi hướng giữa các cảnh liền nhau). Lời đọc của cảnh này kể 1–3 câu về điều ảnh cho thấy.
Khoảnh khắc không có ảnh hợp (trận đánh, cuộc hành quân, một cảnh sử chép hay truyền thuyết kể) thì dùng history-diorama, xen kẽ với history-picture. Giá trị là từ khoá, viết thường, cách nhau dấu phẩy:
- region: LUÔN đặt đúng văn hoá và thời đại của chủ đề: á đông (Việt Nam, Trung Hoa, Nhật, Triều Tiên; mặc định), châu âu (Byzantine, châu Âu Trung cổ), trung đông (Ottoman, Ả Rập, Ba Tư), la mã cổ đại. foeRegion cho phe bên kia khi khác phe ta (Constantinople 1453: region "châu âu", foeRegion "trung đông"); để trống nếu giống.
- KHÔNG BAO GIỜ vẽ người hay công trình Á Đông cho chủ đề châu Âu, Trung Đông hay ngoài châu Á. Khi từ khoá không vẽ được điều quan trọng (một công trình cụ thể, một trang phục riêng), dùng history-picture, hoặc history-stage gắn component (backdrop, cast, props, fx, picture-card…), hoặc bỏ chi tiết đó; đừng vẽ sai văn hoá.
- setting: sông, biển, núi, làng, thành, rừng, đồng, cung điện (ghép được: "sông, núi").
- time: bình minh, ngày, hoàng hôn, đêm; thêm "mưa" hay "sương".
- cast: mỗi mục "[số] loại [tư thế]"; loại: tướng, lính, vua, quan, dân, phụ nữ, tu sĩ (nhà sư; ở châu âu là linh mục mang thánh giá), trẻ em, kỵ binh; tư thế: đứng, giơ cờ, chỉ tay, giơ kiếm, cúi, đi. Phe ta trước, rồi "giặc: …" — mọi mục sau "giặc:" thuộc phe bên kia. Mỗi bên tối đa khoảng 8 người; để trống khi cảnh không có người.
- props: thuyền chiến (chiến thuyền của vùng: junk, galley, trireme), thuyền buồm, thuyền nhẹ, bãi cọc, thành, tháp, mái vòm, nhà thờ, thánh đường (đền Hồi giáo có minaret), chùa, cung điện, nhà, lều, đại pháo (nhả khói khi giao chiến), voi chiến (người dẫn đầu hay người cầm cờ cưỡi voi), ngựa, cờ, lửa, cây; "x2" để nhân lên; "giặc: …" cho đồ của phe bên kia ("giặc: đại pháo x2").
- action: triều rút, tiến quân, giao chiến, cháy, hoặc yên.
Ví dụ Bạch Đằng: "sông, núi" · "hoàng hôn" · "tướng giơ cờ, 2 lính" · "thuyền chiến x2, thuyền nhẹ x2, bãi cọc" · "triều rút" · region "á đông". Constantinople 1453: "thành, biển" · "bình minh" · "hoàng đế giơ kiếm, 4 lính, giặc: 6 lính đi" · "giặc: đại pháo x2, tháp, cờ" · "giao chiến" · region "châu âu" · foeRegion "trung đông". Chọn từ khoá đúng với điều Research ghi; title vài chữ (tối đa 44 ký tự), when viết hoa nếu có. Minh hoạ không phải ảnh tư liệu: lời đọc không gọi nó là ảnh hay tranh xưa, và dòng "MINH HOẠ" ở góc nói rõ điều đó.
Cảnh ghép (history-stage): khi không khối nào cho thấy điều cảnh cần, chọn history-stage — một sân khấu trống chỉ có khung phim — và gắn component vào các ô của nó trong "mounts", theo thứ tự từ sau ra trước: thứ phủ ô "full" trước (diorama, picture-frame; hoặc dựng cảnh từng lớp: backdrop, rồi props, cast, fx cùng ô "full", cùng time, setting, region để các lớp khớp nhau), rồi thứ đặt bên cạnh ("portrait" cho portrait-disc, "inset" cho picture-card, "left"/"right"/"center" cho thứ khác), "credit" cho picture-credit khi có ảnh, và cuối cùng history-caption ở ô "caption" với vài chữ. Mỗi component chỉ nhận giá trị nó khai báo; dùng "at"/"until" (một từ trong lời đọc) để một component hiện ra đúng lúc lời đọc nhắc tới nó. Component lấy từ kệ của template (các phim trước đã tích luỹ) dùng được như component của kit. Không gắn component lên các khối khác; một cảnh history-stage có từ 2 đến 5 component.
Chỉ dùng những gì Research tìm được, ghi chú người viết và các đường link họ đưa. Năm tháng, con số (số quân, số thuyền, số năm) và câu nói chỉ lấy đúng như Research ghi, kèm nguồn. Không bịa lời thoại rồi kể như thật; lời nhân vật chỉ dùng khi sử chép nguyên văn. Đừng nói một bức tranh là ảnh chụp thật hay vẽ đúng sự kiện khi ghi chú không nói vậy: tranh vẽ đời sau thì lời đọc gọi là tranh vẽ.
Mỗi cảnh mang một nhãn loại tư liệu (kind, tối đa 24 ký tự): "CHÍNH SỬ" khi sử sách chép, "TRUYỀN THUYẾT" hay "GIAI THOẠI" khi chỉ là lời truyền lại, "THEO …" (ví dụ "THEO NGUYÊN SỬ") khi các nguồn còn ghi khác nhau. Nhãn và nguồn nằm trên màn hình, không nằm trong lời đọc.
Mỗi cảnh mang một nguồn (tối đa 48 ký tự): tên sách sử (Đại Việt sử ký toàn thư, Khâm định Việt sử thông giám cương mục, Nguyên sử…), nhà sử học, hay bảo tàng. Thanh dưới khung hình đọc nguồn đó.
Thứ tự gợi ý: mở bằng history-hook (thời đại viết hoa, một năm lớn, tên chương vài chữ, một dòng phụ đề ngắn, ảnh nền nếu có). Rồi xen kẽ history-picture và history-diorama với các cảnh đồ hoạ: history-timeline cho 3–5 mốc (mỗi mốc một năm và vài chữ, tối đa 48 ký tự; mốc thừa để trống); history-figure cho nhân vật chính (tên, năm sinh – năm mất có "?" khi chưa chắc, tước vị, một dòng ngắn); history-forces cho trận đánh hay hai thế lực (tên, lực lượng đúng như sử ghi hoặc một chữ như "Mai phục", ghi chú ngắn, người chỉ huy, một dòng kết cục). Trước khi khép lại, history-quote: câu nói đúng nguyên văn, ai nói, chép trong sách nào; không có câu nói chắc chắn thì đề mục "BƯỚC NGOẶT" và một câu. Khép lại bằng history-close: điều lịch sử để lại, vài chữ, và một câu kết ngắn.
Phim dài khoảng 2 phút, 9–14 cảnh; không quá 2 cảnh liền nhau cùng một khối.
Kể chiến tranh với sự tôn trọng người đã khuất, không miệt thị dân tộc nào, không cổ vũ bạo lực. Bỏ một chi tiết khi Research không có gì chống đỡ cho nó; nói rõ khi sử không chép.`;

// Keep the workflow JSON in sync with the six scenes, the components this kit publishes, and the guide.
await editComposition(new URL('./workflow.json', import.meta.url), (files) => {
  for (const key of Object.keys(files)) delete files[key];
  // The shell the Studio previews and the inspector lints, until a run has Assemble write the entry.
  files['index.html'] = filmShell({
    id: 'history-shell',
    width: W,
    height: H,
    background: BAR,
    // What a component from the library paints with, so a borrowed one wears this film.
    theme: { bg: BAR, fg: PARCH, brand: AMBER, fontDisplay: '"Noto Serif Display","Noto Serif",Georgia,serif', fontBody: '"Be Vietnam Pro",Arial,sans-serif' },
  });
  files['assemble.json'] = JSON.stringify({ slots: SLOTS }, null, 2);
  files['compositions/components/history-caption.html'] = component({ ...caption, fonts: FONTS });
  for (const [kind, scene] of Object.entries(scenes)) files[`compositions/history-${kind}.html`] = sceneBlock({ ...scene, id: `history-${kind}`, width: W, height: H, seconds: 4, fonts: FONTS });
  // Published, not pasted: a writer may mount these into a frame of its own.
  files['compositions/components/seal-stamp.html'] = component({ ...sealStamp(SEAL), fonts: FONTS });
  files['compositions/components/source-line.html'] = component({ ...sourceLine(FOOT), fonts: FONTS });
  // The kit's picture parts, in this film's grade: the scenes paste them, and a writer may mount them too.
  files['compositions/components/picture-frame.html'] = component({ ...pictureFrame(PICTURE), fonts: FONTS });
  files['compositions/components/portrait-disc.html'] = component({ ...portraitDisc(PORTRAIT), fonts: FONTS });
  files['compositions/components/picture-card.html'] = component({ ...pictureCard({ grade: 'sepia', paper: PARCH, ink: '#2b1d0e', accent: '#8a5a1c' }), fonts: FONTS });
  files['compositions/components/picture-credit.html'] = component({ ...pictureCredit(CREDIT), fonts: FONTS });
  // The diorama on its own, with the film's grain over it: a writer may mount it into a frame of its own.
  files['compositions/components/diorama.html'] = component({ ...diorama({ ...DIO, grain: true }), fonts: FONTS });
  // Its four layers, each a component of its own, for a history-stage that builds the scene from them.
  files['compositions/components/backdrop.html'] = component({ ...dioramaBackdrop({ samples: BACH_DANG, vignette: true }), fonts: FONTS });
  files['compositions/components/props.html'] = component({ ...dioramaProps({ samples: BACH_DANG }), fonts: FONTS });
  files['compositions/components/cast.html'] = component({ ...dioramaCast({ samples: BACH_DANG }), fonts: FONTS });
  files['compositions/components/fx.html'] = component({ ...dioramaFx({ samples: BACH_DANG }), fonts: FONTS });
  files['storyboard-guide.md'] = GUIDE;
});
