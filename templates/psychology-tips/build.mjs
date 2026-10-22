import { editComposition, filmShell, sceneBlock } from '../_kit/build.mjs';

/**
 * Everyday psychology as kinetic type.
 *
 * The grammar of the self-growth posts people stop scrolling for: a warm off-white ground with two
 * soft pastel glows drifting behind a fine dot grid, words set huge and arriving one after another,
 * and the one word that matters swiped with a coral marker. One accent and one ink, nothing else: the
 * type is the picture.
 *
 * Five scenes, each a block the writer may play: a provocative hook built word by word, a numbered
 * sign (a giant index, the sign, one line why, a tiny example), a myth turned over ("Bạn nghĩ…" then
 * "Thực ra…"), a checklist whose boxes tick one by one, and a gentle close that always says it is not
 * a substitute for a professional and names the study behind the idea.
 */

const PAPER = '#f6f1e9';
const INK = '#1f1b2d';
const SOFT = '#5d5870';
const CORAL = '#ff5a3c';
const PEACH = '#ffe2d5';
const CARD = '#fffaf4';

/** Be Vietnam Pro carries the whole Vietnamese alphabet, from a light body to a black display weight. */
const FONTS = 'https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@500;700;800;900&display=swap';

/**
 * What every scene's script shares: reading a value, splitting a line into words for the kinetic
 * entrance (the words of `highlight` get a marker bar), and shrinking type until it fits its box —
 * once now and once more when the face has loaded, since the fallback sets narrower than it.
 */
const KIT = String.raw`var esc=function(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')};
  var val=function(k){var x=v[k];return String(x==null?'':x).trim()};
  var norm=function(s){return String(s||'').toLowerCase().replace(/[.,!?…:;"“”‘’'()«»]/g,'').trim()};
  var kinetic=function(el,text,hl){if(!el)return 0;var words=String(text||'').trim().split(/\s+/).filter(Boolean);var hw=String(hl||'').trim().split(/\s+/).map(norm).filter(Boolean);var mark=words.map(function(){return false});if(hw.length){for(var i=0;i+hw.length<=words.length;i++){var ok=true;for(var j=0;j<hw.length;j++){if(norm(words[i+j])!==hw[j]){ok=false;break}}if(ok){for(j=0;j<hw.length;j++)mark[i+j]=true;break}}}el.innerHTML=words.map(function(w,i){return '<span class="kw'+(mark[i]?' kw-hl':'')+(mark[i]&&mark[i+1]?' kw-join':'')+'">'+(mark[i]?'<i class="kw-bar"><i class="kw-ink"></i></i>':'')+'<span class="kw-t">'+esc(w)+'</span></span>'}).join(' ');return words.length};
  var FITS=[];
  var wide=function(el){var kws=el.querySelectorAll('.kw');if(!kws.length)return el.scrollWidth>el.clientWidth+2;var edge=el.getBoundingClientRect().right+2;for(var i=0;i<kws.length;i++){if(kws[i].getBoundingClientRect().right>edge)return true}return false};
  var fit=function(el,floor,box){if(!el)return;box=box||el;root.classList.add('measuring');el.style.fontSize='';var size=parseFloat(getComputedStyle(el).fontSize);var guard=0;while((box.scrollHeight>box.clientHeight+6||wide(el))&&size>floor&&guard++<120){size-=2;el.style.fontSize=size+'px'}root.classList.remove('measuring')};
  var fitLater=function(el,floor,box){FITS.push([el,floor,box]);fit(el,floor,box)};
  if(document.fonts&&document.fonts.ready)document.fonts.ready.then(function(){FITS.forEach(function(f){fit(f[0],f[1],f[2])})});
  var hideIfEmpty=function(sel,key){var el=q(sel);if(el&&!val(key))el.style.display='none'};`;

/** The ground every scene stands on: paper, two drifting glows, a dot grid, the masthead line. */
const ground =
  // Room under the last line, for descenders (g, y, p), in boxes that clip.
  '#root .cite-src{padding-bottom:.2em}' +
  `html,body{margin:0;background:${PAPER}}*{box-sizing:border-box}` +
  `#root{position:absolute;inset:0;width:1080px;height:1920px;overflow:hidden;color:${INK};font-family:"Be Vietnam Pro",Arial,sans-serif}` +
  `.nc-backdrop{position:absolute;inset:0;background:${PAPER}}` +
  '.glow{position:absolute;border-radius:50%}' +
  '.glow-a{left:-300px;top:-260px;width:980px;height:980px;background:radial-gradient(circle,#ffcdb9 0,#ffcdb900 66%)}' +
  '.glow-b{right:-360px;top:880px;width:1100px;height:1100px;background:radial-gradient(circle,#dcd3fb 0,#dcd3fb00 64%)}' +
  `.dots{position:absolute;inset:0;background-image:radial-gradient(${INK}17 1.7px,transparent 2px);background-size:42px 42px}` +
  '.top{position:absolute;left:90px;right:90px;top:96px;height:48px;display:flex;align-items:center;justify-content:space-between}' +
  `.tag{display:inline-flex;align-items:center;gap:14px;font-size:23px;font-weight:800;letter-spacing:.16em;color:${INK}}` +
  `.tag i{display:block;width:16px;height:16px;border-radius:50%;background:${CORAL}}` +
  `.brand{font-size:19px;font-weight:800;letter-spacing:.26em;color:${SOFT}}` +
  // The kinetic words and their marker.
  '.kw{display:inline-block;position:relative;white-space:nowrap}' +
  '.kw-t{position:relative;z-index:1}' +
  '.kw-bar{position:absolute;z-index:0;left:-.08em;right:-.08em;top:.2em;bottom:.04em;transform:skewX(-8deg) rotate(-1.5deg)}' +
  '.kw-join .kw-bar{right:-.34em}' +
  `.kw-ink{position:absolute;inset:0;display:block;background:${CORAL};border-radius:.1em;transform-origin:left center}` +
  '#root.measuring *{transform:none!important}' +
  '.words{display:flex;flex-wrap:wrap;align-content:flex-start;column-gap:.24em;margin:0}';

const groundMarkup = (tag) =>
  `<div class="glow glow-a"></div><div class="glow glow-b"></div><div class="dots"></div>
      <div class="top"><span class="tag"><i></i>${tag}</span><span class="brand">NODECINE</span></div>`;

/** The entrance every scene shares: the glows drift for the whole scene, the masthead settles. */
const groundIn =
  `tl.fromTo(q('.glow-a'),{x:-70,y:-30},{x:70,y:50,duration:duration,ease:'sine.inOut'},0);` +
  `tl.fromTo(q('.glow-b'),{x:60,y:40},{x:-60,y:-50,duration:duration,ease:'sine.inOut'},0);` +
  `tl.fromTo(q('.dots'),{opacity:0},{opacity:1,duration:.8,ease:'sine.out'},0);` +
  `tl.fromTo(q('.top'),{opacity:0,y:-14},{opacity:1,y:0,duration:.5,ease:'power2.out'},.05);`;

/** Words arrive one after another from below, then the marker swipes across the highlighted ones. */
const wordsIn = (sel, at, name) =>
  `var ${name}=root.querySelectorAll('${sel} .kw');var ${name}S=Math.min(.12,1.3/Math.max(1,${name}.length));` +
  `tl.fromTo(${name},{y:80,opacity:0,rotation:4,transformOrigin:'left bottom'},{y:0,opacity:1,rotation:0,duration:.6,ease:'power4.out',stagger:${name}S},${at});` +
  `var ${name}I=root.querySelectorAll('${sel} .kw-ink');if(${name}I.length)tl.fromTo(${name}I,{scaleX:0},{scaleX:1,duration:.5,ease:'power3.inOut',stagger:.08},${at}+${name}S*${name}.length+.3);`;

const secondsVar = { id: 'seconds', type: 'number', label: 'Length in seconds (the Assemble node gives it)', default: 4 };
const highlightVar = (sample, of = 'the line') => ({
  id: 'highlight',
  type: 'string',
  label: `The word or words of ${of} to swipe with the marker, exactly as written there, or empty`,
  labels: { vi: 'Từ (hoặc cụm từ) cần tô nổi bật, viết đúng như trong câu, hoặc để trống' },
  default: '',
  sample,
  maxLength: 28,
});

const scenes = {
  hook: {
    role: 'hook',
    description:
      'Opening hook: one provocative statement set huge, arriving word by word, with one word swiped by a coral marker; a small eyebrow above, one line under it, and an optional giant outlined number behind (how many signs or tips the film will show).',
    css:
      ground +
      `.count{position:absolute;right:30px;top:700px;font-size:900px;line-height:1;font-weight:900;letter-spacing:-.07em;color:transparent;-webkit-text-stroke:5px ${CORAL};opacity:.3}` +
      '.stack{position:absolute;left:90px;right:90px;top:250px;bottom:330px;display:flex;flex-direction:column;justify-content:center;gap:40px}' +
      `.eyebrow{display:flex;align-items:center;gap:18px;font-size:34px;font-weight:800;color:${CORAL};line-height:1.3}` +
      `.eyebrow:before{content:"";display:block;width:64px;height:6px;border-radius:3px;background:${CORAL}}` +
      '.hook-words{font-size:150px;line-height:1.18;font-weight:900;letter-spacing:-.03em;padding-top:.06em}' +
      `.sub{margin:0;max-width:820px;font-size:46px;line-height:1.42;font-weight:500;color:${SOFT}}`,
    markup: `${groundMarkup('TÂM LÝ HỌC ĐỜI THƯỜNG')}
      <span class="count"></span>
      <div class="stack">
        <span class="eyebrow kicker"></span>
        <h1 class="words hook-words"></h1>
        <p class="sub"></p>
      </div>`,
    textKeys: ['kicker', 'sub', 'count'],
    extraScript:
      KIT +
      "hideIfEmpty('.eyebrow','kicker');hideIfEmpty('.sub','sub');hideIfEmpty('.count','count');" +
      "kinetic(q('.hook-words'),val('title'),val('highlight'));" +
      "fitLater(q('.hook-words'),72,q('.stack'));fitLater(q('.sub'),30,q('.stack'));",
    motion:
      groundIn +
      `tl.fromTo(q('.count'),{opacity:0,scale:.82,transformOrigin:'right center'},{opacity:.3,scale:1,duration:1.2,ease:'expo.out'},.1);` +
      `tl.fromTo(q('.eyebrow'),{opacity:0,x:-30},{opacity:1,x:0,duration:.5,ease:'power3.out'},.2);` +
      wordsIn('.hook-words', 0.35, 'hk') +
      `tl.fromTo(q('.sub'),{opacity:0,y:24},{opacity:1,y:0,duration:.6,ease:'power2.out'},.35+hkS*hk.length+.5);`,
    variables: [
      {
        id: 'title',
        type: 'string',
        label: 'The hook: one provocative statement or question, short',
        labels: { vi: 'Câu mở: một câu khẳng định hay câu hỏi gây chú ý, ngắn' },
        default: 'Vì sao bạn hay trì hoãn?',
        sample: '5 dấu hiệu bạn đang bị thao túng tâm lý',
        maxLength: 64,
        required: true,
      },
      highlightVar('thao túng', 'the hook'),
      { id: 'kicker', type: 'string', label: 'A few words above the hook, or empty', labels: { vi: 'Vài chữ phía trên câu mở, hoặc để trống' }, default: '', sample: 'Gaslighting là gì?', maxLength: 32 },
      {
        id: 'sub',
        type: 'string',
        label: 'One line under the hook: what the film will help with',
        labels: { vi: 'Một dòng dưới câu mở: phim sẽ giúp người xem điều gì' },
        default: '',
        sample: 'Không phải lúc nào bạn cũng “quá nhạy cảm”. Có những dấu hiệu đáng để ý.',
        maxLength: 110,
      },
      {
        id: 'count',
        type: 'string',
        label: 'How many signs or tips follow, as a numeral ("5"), or empty',
        labels: { vi: 'Số dấu hiệu hay mẹo phía sau, viết bằng số ("5"), hoặc để trống' },
        default: '',
        sample: '5',
        maxLength: 2,
      },
      secondsVar,
    ],
  },
  sign: {
    role: 'feature',
    description:
      'One numbered sign, tip or reason: a giant coral index number, the sign in bold with one word marked, one line explaining it, and a small “ví dụ” card with an everyday example and the source. Play it once per sign, in order.',
    css:
      ground +
      '.head{position:absolute;left:90px;right:90px;top:232px;display:flex;align-items:center;gap:20px}' +
      `.label{display:inline-block;padding:10px 22px;border:3px solid ${INK};border-radius:999px;font-size:24px;font-weight:800;letter-spacing:.16em;line-height:1.3}` +
      `.of{font-size:30px;font-weight:800;letter-spacing:.06em;color:${SOFT}}` +
      `.num{position:absolute;left:52px;top:280px;font-size:600px;line-height:1;font-weight:900;letter-spacing:-.07em;color:${CORAL}}` +
      `.rule{position:absolute;left:90px;right:90px;top:868px;height:6px;border-radius:3px;background:${INK}}` +
      '.body{position:absolute;left:90px;right:90px;top:920px;bottom:300px;display:flex;flex-direction:column;gap:34px}' +
      '.sign-words{font-size:84px;line-height:1.2;font-weight:900;letter-spacing:-.02em;padding-top:.05em}' +
      `.why{margin:0;font-size:40px;line-height:1.42;font-weight:500;color:${SOFT}}` +
      `.ex{margin-top:10px;background:${PEACH};border-radius:30px;padding:26px 34px 30px}` +
      '.ex-head{display:flex;align-items:center;justify-content:space-between;gap:20px;margin-bottom:12px}' +
      `.ex-tag{font-size:22px;font-weight:800;letter-spacing:.18em;color:${CORAL}}` +
      `.ex-src{font-size:22px;font-weight:700;color:${SOFT};white-space:nowrap;overflow:hidden;text-overflow:ellipsis}` +
      `.ex-text{margin:0;font-size:34px;line-height:1.42;font-weight:700;color:${INK}}`,
    markup: `${groundMarkup('TÂM LÝ HỌC ĐỜI THƯỜNG')}
      <div class="head"><span class="label"></span><span class="of"></span></div>
      <span class="num"><span class="number-value"></span></span>
      <span class="rule"></span>
      <div class="body">
        <h2 class="words sign-words"></h2>
        <p class="why"></p>
        <div class="ex"><div class="ex-head"><span class="ex-tag">VÍ DỤ</span><span class="ex-src source"></span></div><p class="ex-text example"></p></div>
      </div>`,
    textKeys: ['label', 'why', 'example', 'source'],
    extraScript:
      KIT +
      "var totalN=Number(v.total)||0;q('.of').textContent=totalN>0?'/ '+String(totalN).padStart(2,'0'):'';" +
      "hideIfEmpty('.why','why');hideIfEmpty('.ex','example');hideIfEmpty('.ex-src','source');" +
      "kinetic(q('.sign-words'),val('title'),val('highlight'));" +
      "fitLater(q('.sign-words'),52,q('.body'));fitLater(q('.why'),28,q('.body'));fitLater(q('.ex-text'),26,q('.body'));",
    motion:
      groundIn +
      `tl.fromTo(q('.head'),{opacity:0,y:-16},{opacity:1,y:0,duration:.5,ease:'power2.out'},.1);` +
      `tl.fromTo(q('.num'),{opacity:0,yPercent:18,scale:.9,transformOrigin:'left bottom'},{opacity:1,yPercent:0,scale:1,duration:.9,ease:'expo.out'},.15);` +
      `tl.fromTo(q('.rule'),{scaleX:0,transformOrigin:'left center'},{scaleX:1,duration:.7,ease:'power3.inOut'},.4);` +
      wordsIn('.sign-words', 0.55, 'sg') +
      `var sgEnd=.55+sgS*sg.length;` +
      `tl.fromTo(q('.why'),{opacity:0,y:22},{opacity:1,y:0,duration:.6,ease:'power2.out'},sgEnd+.2);` +
      `tl.fromTo(q('.ex'),{opacity:0,x:80},{opacity:1,x:0,duration:.7,ease:'power3.out'},sgEnd+.5);`,
    variables: [
      { id: 'number', type: 'number', label: 'Which sign this is, from 1', labels: { vi: 'Đây là dấu hiệu thứ mấy, từ 1' }, default: 1, sample: 1, required: true },
      { id: 'total', type: 'number', label: 'How many signs the film shows, or 0', labels: { vi: 'Phim có tất cả bao nhiêu dấu hiệu, hoặc 0' }, default: 0, sample: 5 },
      {
        id: 'label',
        type: 'string',
        label: 'What these are, in capitals: DẤU HIỆU, MẸO, LÝ DO, CÁCH…',
        labels: { vi: 'Đây là gì, viết hoa: DẤU HIỆU, MẸO, LÝ DO, CÁCH…' },
        default: 'DẤU HIỆU',
        sample: 'DẤU HIỆU',
        maxLength: 16,
        required: true,
      },
      {
        id: 'title',
        type: 'string',
        label: 'The sign, tip or reason itself, in one bold line',
        labels: { vi: 'Chính dấu hiệu, mẹo hay lý do, trong một dòng đậm' },
        default: 'Dấu hiệu, trong một dòng',
        sample: 'Bạn hay nghi ngờ trí nhớ của chính mình',
        maxLength: 60,
        required: true,
      },
      highlightVar('nghi ngờ', 'the sign'),
      {
        id: 'why',
        type: 'string',
        label: 'One line explaining it',
        labels: { vi: 'Một dòng giải thích' },
        default: '',
        sample: 'Người kia khẳng định điều bạn nhớ rõ là “chưa từng xảy ra”, lặp lại đến khi bạn tin là mình sai.',
        maxLength: 120,
        required: true,
      },
      {
        id: 'example',
        type: 'string',
        label: 'A tiny everyday example, or empty',
        labels: { vi: 'Một ví dụ đời thường rất ngắn, hoặc để trống' },
        default: '',
        sample: '“Em lại tưởng tượng rồi, anh nói thế bao giờ?”',
        maxLength: 90,
      },
      {
        id: 'source',
        type: 'string',
        label: 'The study or author behind it, as "Stern, 2007", or empty',
        labels: { vi: 'Nghiên cứu hay tác giả đứng sau, dạng "Stern, 2007", hoặc để trống' },
        default: '',
        sample: 'Stern, 2007',
        maxLength: 32,
      },
      secondsVar,
    ],
  },
  myth: {
    role: 'proof',
    description:
      'A myth turned over: a pale card “Bạn nghĩ…” with the common belief, crossed out, then a coral card “Thực ra…” flips down with what the research found, and the study under it.',
    css:
      ground +
      `.card{position:absolute;left:90px;right:90px;border-radius:40px;padding:44px 50px;display:flex;flex-direction:column;gap:24px;overflow:hidden}` +
      `.card-a{top:270px;height:540px;background:${CARD};box-shadow:0 24px 60px ${INK}14}` +
      `.card-b{top:930px;height:600px;background:${CORAL};box-shadow:0 30px 70px ${CORAL}55}` +
      '.card-label{display:flex;align-items:center;justify-content:space-between;font-size:30px;font-weight:800;letter-spacing:.12em;line-height:1.3}' +
      `.card-a .card-label{color:${SOFT}}` +
      `.cross{display:flex;align-items:center;justify-content:center;width:84px;height:84px;border-radius:50%;background:${INK};color:${PAPER};font-size:44px;font-weight:900;line-height:1}` +
      `.belief{flex:1;margin:0;display:flex;align-items:center;font-size:64px;line-height:1.28;font-weight:700;color:${SOFT};min-height:0}` +
      `.belief-t{background:linear-gradient(${CORAL},${CORAL}) no-repeat 0 58%/0% .11em;-webkit-box-decoration-break:clone;box-decoration-break:clone}` +
      `.fact{flex:1;margin:0;display:flex;align-items:center;font-size:62px;line-height:1.3;font-weight:800;color:${INK};min-height:0}` +
      `.turn{position:absolute;left:50%;top:812px;width:116px;height:116px;margin-left:-58px;border-radius:50%;background:${INK};color:${PAPER};display:flex;align-items:center;justify-content:center;font-size:58px;font-weight:900;line-height:1}` +
      '.cite{position:absolute;left:90px;right:90px;top:1562px;display:flex;align-items:center;gap:20px}' +
      `.cite-tag{flex:none;font-size:21px;font-weight:800;letter-spacing:.18em;color:${CORAL}}` +
      `.cite-src{font-size:27px;font-weight:700;color:${SOFT};white-space:nowrap;overflow:hidden;text-overflow:ellipsis}`,
    markup: `${groundMarkup('TÂM LÝ HỌC ĐỜI THƯỜNG')}
      <div class="card card-a"><span class="card-label">BẠN NGHĨ…<span class="cross">✕</span></span><p class="belief"><span><span class="belief-t myth"></span></span></p></div>
      <div class="card card-b"><span class="card-label">THỰC RA…</span><p class="fact truth"></p></div>
      <span class="turn">↓</span>
      <div class="cite"><span class="cite-tag">NGHIÊN CỨU</span><span class="cite-src source"></span></div>`,
    textKeys: ['myth', 'truth', 'source'],
    extraScript: KIT + "fitLater(q('.belief'),34,q('.card-a'));fitLater(q('.fact'),34,q('.card-b'));",
    motion:
      groundIn +
      `tl.fromTo(q('.card-a'),{opacity:0,y:60},{opacity:1,y:0,duration:.7,ease:'power3.out'},.15);` +
      `tl.fromTo(q('.belief'),{opacity:0},{opacity:1,duration:.5,ease:'sine.out'},.4);` +
      `tl.fromTo(q('.belief-t'),{backgroundSize:'0% .11em'},{backgroundSize:'100% .11em',duration:.5,ease:'power3.inOut'},1.05);` +
      `tl.fromTo(q('.cross'),{scale:0,rotation:-90},{scale:1,rotation:0,duration:.45,ease:'back.out(2.2)'},1.1);` +
      `tl.to(q('.belief'),{opacity:.5,duration:.4,ease:'sine.out'},1.2);` +
      `tl.fromTo(q('.turn'),{scale:0},{scale:1,duration:.4,ease:'back.out(2)'},1.35);` +
      `tl.fromTo(q('.card-b'),{opacity:0,rotationX:-88,transformPerspective:1800,transformOrigin:'center top'},{opacity:1,rotationX:0,duration:.9,ease:'power3.out'},1.5);` +
      `tl.fromTo(q('.fact'),{opacity:0,y:24},{opacity:1,y:0,duration:.6,ease:'power2.out'},1.85);` +
      `tl.fromTo(q('.cite'),{opacity:0,y:12},{opacity:1,y:0,duration:.5,ease:'power2.out'},2.2);`,
    variables: [
      {
        id: 'myth',
        type: 'string',
        label: 'What people commonly believe',
        labels: { vi: 'Điều nhiều người vẫn nghĩ' },
        default: 'Điều nhiều người vẫn nghĩ',
        sample: 'Chỉ người yếu đuối mới bị thao túng',
        maxLength: 90,
        required: true,
      },
      {
        id: 'truth',
        type: 'string',
        label: 'What the research actually found',
        labels: { vi: 'Điều nghiên cứu thật sự cho thấy' },
        default: 'Điều nghiên cứu cho thấy',
        sample: 'Thao túng thường diễn ra dần dần trong những mối quan hệ thân thiết, và ai cũng có thể bị cuốn vào.',
        maxLength: 120,
        required: true,
      },
      {
        id: 'source',
        type: 'string',
        label: 'The study, as "Kruger & Dunning, 1999"',
        labels: { vi: 'Nghiên cứu, dạng "Kruger & Dunning, 1999"' },
        default: 'Nghiên cứu',
        sample: 'Sweet, 2019 · American Sociological Review',
        maxLength: 48,
        required: true,
      },
      secondsVar,
    ],
  },
  checklist: {
    role: 'feature',
    description:
      'A gentle self-check: a question like “Gần đây bạn có thường…?” set large, then up to five rows whose boxes tick one by one, and a note under them that this is for noticing, not a diagnosis.',
    css:
      ground +
      '.q-box{position:absolute;left:90px;right:90px;top:220px;height:390px;display:flex;flex-direction:column;justify-content:flex-end}' +
      '.q-words{font-size:104px;line-height:1.18;font-weight:900;letter-spacing:-.025em;padding-top:.06em}' +
      '.rows{position:absolute;left:90px;right:90px;top:660px;height:770px;display:flex;flex-direction:column;justify-content:center}' +
      `.row{display:flex;align-items:center;gap:36px;height:150px;border-bottom:3px dashed ${INK}22}.row:last-child{border-bottom:0}` +
      `.box{flex:none;position:relative;width:86px;height:86px;border:6px solid ${INK};border-radius:24px;background:${CARD}}` +
      '.box svg{position:absolute;left:8px;top:8px;width:58px;height:58px;overflow:visible}' +
      `.box path{fill:none;stroke:${CARD};stroke-width:3.4;stroke-linecap:round;stroke-linejoin:round;stroke-dasharray:1;stroke-dashoffset:1}` +
      '.row p{margin:0;flex:1;display:flex;align-items:center;height:132px;font-size:44px;line-height:1.3;font-weight:700;overflow:visible}' +
      '.note{position:absolute;left:90px;right:90px;top:1460px;height:160px;display:flex;gap:22px;align-items:flex-start}' +
      `.note i{flex:none;display:flex;align-items:center;justify-content:center;width:44px;height:44px;margin-top:2px;border-radius:50%;background:${INK};color:${PAPER};font-style:normal;font-size:26px;font-weight:900}` +
      `.note p{margin:0;font-size:31px;line-height:1.45;font-weight:500;color:${SOFT}}`,
    markup: `${groundMarkup('TỰ HỎI MÌNH')}
      <div class="q-box"><h2 class="words q-words"></h2></div>
      <div class="rows">
        ${[1, 2, 3, 4, 5].map((n) => `<div class="row row-${n}"><span class="box"><svg viewBox="0 0 24 24"><path pathLength="1" d="M4.5 12.5l5 5L19.5 6.5"/></svg></span><p class="item${n}"></p></div>`).join('\n        ')}
      </div>
      <div class="note"><i>i</i><p class="notetext"></p></div>`,
    textKeys: ['item1', 'item2', 'item3', 'item4', 'item5', 'notetext'],
    extraScript:
      KIT +
      "[1,2,3,4,5].forEach(function(n){if(!val('item'+n))q('.row-'+n).remove()});" +
      "hideIfEmpty('.note','notetext');" +
      "kinetic(q('.q-words'),val('title'),val('highlight'));" +
      "fitLater(q('.q-words'),60,q('.q-box'));" +
      "root.querySelectorAll('.row p').forEach(function(p){fitLater(p,28)});",
    motion:
      groundIn +
      wordsIn('.q-words', 0.2, 'qw') +
      `var ckRows=root.querySelectorAll('.row');` +
      `tl.fromTo(ckRows,{opacity:0,x:60},{opacity:1,x:0,duration:.5,ease:'power3.out',stagger:.1},.55);` +
      `var ckStep=Math.min(.34,1.6/Math.max(1,ckRows.length));` +
      `ckRows.forEach(function(r,i){var t=1.15+i*ckStep;var b=r.querySelector('.box');` +
      `tl.to(b,{backgroundColor:'${CORAL}',borderColor:'${CORAL}',duration:.18,ease:'none'},t);` +
      `tl.fromTo(b,{scale:1},{scale:1.14,duration:.12,ease:'power2.out',yoyo:true,repeat:1},t);` +
      `tl.fromTo(r.querySelector('path'),{strokeDashoffset:1},{strokeDashoffset:0,duration:.28,ease:'power2.out'},t+.06);});` +
      `tl.fromTo(q('.note'),{opacity:0,y:16},{opacity:1,y:0,duration:.6,ease:'power2.out'},1.15+ckStep*ckRows.length+.1);`,
    variables: [
      {
        id: 'title',
        type: 'string',
        label: 'The question the rows answer, as "Gần đây bạn có thường…?"',
        labels: { vi: 'Câu hỏi các dòng trả lời, dạng "Gần đây bạn có thường…?"' },
        default: 'Bạn có thường…?',
        sample: 'Gần đây bạn có thường…',
        maxLength: 48,
        required: true,
      },
      highlightVar('thường', 'the question'),
      ...[1, 2, 3, 4, 5].map((n) => ({
        id: `item${n}`,
        type: 'string',
        label: `Row ${n}: a short thing to notice${n > 2 ? ', or empty' : ''}`,
        labels: { vi: `Dòng ${n}: một điều ngắn để tự quan sát${n > 2 ? ', hoặc để trống' : ''}` },
        default: '',
        sample: ['Xin lỗi dù không chắc mình sai', 'Tự thấy mình “quá nhạy cảm”', 'Kể lại chuyện mà không ai tin', 'Im lặng để khỏi bị bắt bẻ', ''][n - 1],
        maxLength: 48,
        required: n <= 2,
      })),
      {
        id: 'notetext',
        type: 'string',
        label: 'A gentle note under the rows: this is for noticing, not a test or a diagnosis',
        labels: { vi: 'Một lời nhắn nhẹ dưới các dòng: đây để tự quan sát, không phải bài kiểm tra hay chẩn đoán' },
        default: 'Đây không phải bài kiểm tra chẩn đoán, chỉ là vài câu để bạn dừng lại và quan sát.',
        sample: 'Đây không phải bài kiểm tra chẩn đoán, chỉ là vài câu để bạn dừng lại và quan sát chính mình.',
        maxLength: 120,
      },
      secondsVar,
    ],
  },
  close: {
    role: 'outro',
    description:
      'Closing: one gentle takeaway set large with one word marked, one warm line under it, the study the idea comes from, and the fixed note that this is for reference and does not replace a psychologist.',
    css:
      ground +
      '.stack{position:absolute;left:90px;right:90px;top:250px;height:1060px;display:flex;flex-direction:column;justify-content:center;gap:40px}' +
      `.keep{display:flex;align-items:center;gap:18px;font-size:30px;font-weight:800;letter-spacing:.16em;color:${CORAL};line-height:1.3}` +
      `.keep:before{content:"";display:block;width:64px;height:6px;border-radius:3px;background:${CORAL}}` +
      '.take-words{font-size:112px;line-height:1.2;font-weight:900;letter-spacing:-.025em;padding-top:.06em}' +
      `.warm{margin:0;font-size:44px;line-height:1.45;font-weight:500;color:${SOFT}}` +
      `.chip{position:absolute;left:90px;top:1362px;max-width:900px;display:flex;align-items:center;gap:22px;padding:18px 30px;border:3px solid ${INK};border-radius:999px;background:${CARD}}` +
      `.chip-tag{flex:none;font-size:21px;font-weight:800;letter-spacing:.18em;color:${CORAL}}` +
      '.chip-src{font-size:28px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
      `.disclaimer{position:absolute;left:90px;right:90px;top:1490px;margin:0;font-size:27px;line-height:1.45;font-weight:500;color:${SOFT}}`,
    markup: `${groundMarkup('TÂM LÝ HỌC ĐỜI THƯỜNG')}
      <div class="stack">
        <span class="keep">ĐIỀU ĐỌNG LẠI</span>
        <h2 class="words take-words"></h2>
        <p class="warm"></p>
      </div>
      <div class="chip"><span class="chip-tag">NGUỒN</span><span class="chip-src source"></span></div>
      <p class="disclaimer">Nội dung tham khảo, không thay thế tư vấn của chuyên gia tâm lý.</p>`,
    textKeys: ['warm', 'source'],
    extraScript: KIT + "hideIfEmpty('.warm','warm');kinetic(q('.take-words'),val('title'),val('highlight'));fitLater(q('.take-words'),60,q('.stack'));fitLater(q('.warm'),30,q('.stack'));",
    motion:
      groundIn +
      `tl.fromTo(q('.keep'),{opacity:0,x:-30},{opacity:1,x:0,duration:.5,ease:'power3.out'},.15);` +
      wordsIn('.take-words', 0.3, 'tk') +
      `var tkEnd=.3+tkS*tk.length;` +
      `tl.fromTo(q('.warm'),{opacity:0,y:22},{opacity:1,y:0,duration:.6,ease:'power2.out'},tkEnd+.45);` +
      `tl.fromTo(q('.chip'),{opacity:0,y:20},{opacity:1,y:0,duration:.5,ease:'power3.out'},tkEnd+.7);` +
      `tl.fromTo(q('.disclaimer'),{opacity:0},{opacity:1,duration:.6,ease:'sine.out'},tkEnd+.9);`,
    variables: [
      {
        id: 'title',
        type: 'string',
        label: 'The one gentle takeaway, short',
        labels: { vi: 'Một điều nhẹ nhàng để mang theo, ngắn' },
        default: 'Điều nên giữ lại',
        sample: 'Bạn được quyền tin vào cảm nhận của mình',
        maxLength: 56,
        required: true,
      },
      highlightVar('tin', 'the takeaway'),
      {
        id: 'warm',
        type: 'string',
        label: 'One warm line to close on: a small next step',
        labels: { vi: 'Một câu ấm áp để khép lại: một bước nhỏ tiếp theo' },
        default: '',
        sample: 'Ghi lại sự việc, nói chuyện với một người bạn tin, và cho mình thời gian. Nhận ra đã là bước đầu.',
        maxLength: 130,
      },
      {
        id: 'source',
        type: 'string',
        label: 'The study or author the film rests on, as "Dunning & Kruger, 1999"',
        labels: { vi: 'Nghiên cứu hay tác giả mà phim dựa vào, dạng "Dunning & Kruger, 1999"' },
        default: 'Tổng hợp nghiên cứu tâm lý học',
        sample: 'Stern, 2007 · Sweet, 2019',
        maxLength: 48,
        required: true,
      },
      secondsVar,
    ],
  },
};

const GUIDE = `---
first: hook
last: outro
repeat: 3
---
Làm một video tiếng Việt, dọc 9:16, khoảng 50–70 giây, về chủ đề tâm lý học đời thường trong Brief: một hiệu ứng hay thiên kiến (Dunning–Kruger, hiệu ứng chim mồi, thiên kiến xác nhận), một thói quen (trì hoãn, so sánh bản thân), hay các dấu hiệu cần để ý (bị thao túng, kiệt sức). Giọng ấm, thẳng thắn và thấu cảm, như một người bạn hiểu chuyện: xưng "mình", gọi người xem là "bạn", câu ngắn. Mỗi cảnh là chữ động cỡ lớn trên nền giấy sáng, một từ quan trọng được tô bằng vệt bút đỏ cam.
Chỉ dùng những gì Research tìm được, ghi chú người viết và các đường link họ đưa. Mỗi ý dựa trên tâm lý học đã được nghiên cứu: nêu tên tác giả và năm khi có (Kruger & Dunning, 1999; Steel, 2007; Stern, 2007). Không bịa nghiên cứu, con số, phần trăm hay câu trích. Khi Research nói kết quả còn tranh luận hay không lặp lại được, nói đúng như vậy.
Mở đầu bằng cảnh hook (psy-hook): một câu gây chú ý, tối đa khoảng 8–10 từ, như "5 dấu hiệu bạn đang bị thao túng tâm lý" hay "Vì sao bạn hay trì hoãn?"; highlight là một hoặc hai từ trong câu, viết đúng như trong câu; count là số dấu hiệu hay mẹo phía sau (để trống nếu không có danh sách); sub là một dòng nói phim giúp gì.
Phần thân: các cảnh psy-sign, mỗi cảnh một dấu hiệu, mẹo hay lý do, đánh số liên tục từ 1 (number), total bằng tổng số cảnh psy-sign, label là DẤU HIỆU, MẸO, LÝ DO hay CÁCH. Mỗi cảnh: title một dòng đậm (tối đa 60 ký tự), why một dòng giải thích, example một ví dụ đời thường rất ngắn, source là tác giả và năm khi Research có. Thường 3–5 cảnh psy-sign.
Thêm một cảnh proof (psy-myth) khi có một lầm tưởng phổ biến mà nghiên cứu đã làm rõ: myth là điều nhiều người nghĩ, truth là điều nghiên cứu cho thấy, source bắt buộc là nghiên cứu cụ thể. Không dùng psy-myth nếu Research không có nghiên cứu chống đỡ.
Có thể thêm một cảnh psy-checklist trước khi khép lại: một câu hỏi "Gần đây bạn có thường…?" và 3–5 dòng ngắn để người xem tự quan sát; notetext luôn nói rõ đây không phải bài kiểm tra hay chẩn đoán.
Khép lại bằng cảnh outro (psy-close): một điều nhẹ nhàng để mang theo, một bước nhỏ tiếp theo, và source là nghiên cứu hay tác giả chính của phim. Cảnh này luôn tự hiện dòng "Nội dung tham khảo, không thay thế tư vấn của chuyên gia tâm lý."
Không chẩn đoán: không nói "bạn bị bệnh X", "bạn bị rối loạn Y", không gán nhãn người khác là "kẻ thao túng" hay "người ái kỷ". Nói "có thể", "nhiều người", "nghiên cứu cho thấy". Không hứa hẹn kiểu "đổi đời sau 7 ngày", không câu kéo tương tác ("share nếu…", "comment ngay", "tag người ấy"). Khi chủ đề chạm đến khủng hoảng, tự hại hay bạo lực, khuyên người xem tìm đến chuyên gia hay người thân tin cậy. Bỏ một ý khi Research không có gì chống đỡ cho nó.`;

// Keep the workflow JSON in sync with the five scenes and the guide.
await editComposition(new URL('./workflow.json', import.meta.url), (files) => {
  for (const key of Object.keys(files)) delete files[key];
  // The shell the Studio previews and the inspector lints, until a run has Assemble write the entry.
  files['index.html'] = filmShell({ id: 'psy-shell', background: PAPER });
  for (const [kind, scene] of Object.entries(scenes)) files[`compositions/psy-${kind}.html`] = sceneBlock({ ...scene, id: `psy-${kind}`, seconds: 4, fonts: FONTS });
  files['storyboard-guide.md'] = GUIDE;
});
