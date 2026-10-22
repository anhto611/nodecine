import { component, editComposition, filmShell, paste, sceneBlock, sealStamp, sourceLine } from '../_kit/build.mjs';

/**
 * Eastern wisdom as a zodiac poster.
 *
 * The grammar of the folk-astrology posters people share: a night sky with lanterns, a headline in
 * gold on red, a parchment panel with a double gold border and corner ornaments, section heads on a
 * red band, numbered rows with gold medallions, and always a line saying "theo quan niệm dân gian"
 * or which book. The animals are the twelve zodiac signs, drawn as the system's own emoji inside a
 * gold medallion — the kit ships no illustrations, so a name on the storyboard is enough to show one.
 *
 * Six scenes, each a block the writer may play: a cover, a numbered list on a panel, the three best
 * matches, the birth years with their elements, a saying, and the closing word. A zodiac topic plays
 * all six; a teaching or a feng shui question plays the cover, the list, the saying and the close.
 */

const GOLD = '#e3b65a';
const PALE = '#f6e0a0';
const CRIMSON = '#9b1c1c';
const INK = '#3b1f0e';
const INK_SOFT = '#5f3b22';
const PAPER_LINE = '#c9a35a';

/** The faces the poster writes with, from Google Fonts: both carry the Vietnamese alphabet, and the renderer fetches what a link names. */
const FONTS = 'https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,900;1,700&family=Be+Vietnam+Pro:wght@400;700&display=swap';

const seal = paste(sealStamp({ label: 'TỬ VI', cinnabar: '#b8322a', ink: '#f6e7c8' }));
const foot = paste(sourceLine({ accent: CRIMSON, color: INK_SOFT, track: PAPER_LINE, label: 'THEO' }));

/** The twelve signs, by the name the storyboard writes, and the five elements by theirs. Shared by every scene's script. */
const LOOKUPS =
  "var ZODIAC=[['tý','🐭'],['sửu','🐮'],['dần','🐯'],['mão','🐰'],['mẹo','🐰'],['thìn','🐲'],['tỵ','🐍'],['tị','🐍'],['ngọ','🐴'],['mùi','🐐'],['thân','🐵'],['dậu','🐔'],['tuất','🐶'],['hợi','🐷']];" +
  "var zodiacOf=function(s){s=String(s||'').toLowerCase();for(var i=0;i<ZODIAC.length;i++){if(s.indexOf(ZODIAC[i][0])>=0)return ZODIAC[i][1]}return '☯'};" +
  "var ELEMENT={kim:'#8f8a7a',mộc:'#3f8f4f',thủy:'#2f6fc4',thuỷ:'#2f6fc4',hỏa:'#c4302a',hoả:'#c4302a',thổ:'#9a6a24'};" +
  "var elementOf=function(s){s=String(s||'').toLowerCase();for(var k in ELEMENT){if(s.indexOf(k)>=0)return ELEMENT[k]}return '#6b4a2a'};";

/** The ground every scene stands on: the night, the lanterns, the parchment and the type. */
const ground =
  'html,body{margin:0;background:#120404}*{box-sizing:border-box}' +
  `#root{position:absolute;inset:0;width:1080px;height:1920px;overflow:hidden;color:${INK};font-family:"Be Vietnam Pro",Arial,sans-serif}` +
  '.nc-backdrop{position:absolute;inset:0;background:radial-gradient(ellipse at 50% -10%,#6a1818 0,#2c0909 46%,#120404 100%)}' +
  `.stars{position:absolute;inset:0;background-image:radial-gradient(circle,${GOLD}99 1.2px,transparent 2px),radial-gradient(circle,${GOLD}55 1px,transparent 1.8px);background-size:150px 150px,260px 260px;background-position:0 0,70px 110px;opacity:.7}` +
  `.glow{position:absolute;left:50%;top:-200px;width:1400px;height:900px;transform:translateX(-50%);border-radius:50%;background:radial-gradient(circle,${GOLD}22 0,transparent 60%)}` +
  '.lantern{position:absolute;width:76px;display:flex;flex-direction:column;align-items:center}' +
  `.lantern i{display:block}.lantern .cord{width:2px;height:140px;background:${GOLD}99}.lantern .cap{width:44px;height:12px;background:${GOLD};border-radius:3px}` +
  `.lantern .body{width:76px;height:98px;margin:-2px 0;background:radial-gradient(circle at 50% 38%,#ff7a4a,#b8141d 72%);border-radius:40%/46%;border:2px solid ${GOLD};box-shadow:0 0 46px #ff5a2a66}` +
  `.lantern .tassel{width:4px;height:64px;margin-top:4px;background:${GOLD}}` +
  '.lantern-l{left:88px;top:-10px}.lantern-r{right:88px;top:-10px}' +
  `.kicker{position:absolute;left:0;right:0;text-align:center;color:${GOLD};font-size:22px;font-weight:850;letter-spacing:.3em}` +
  `.headline{position:absolute;left:80px;right:80px;margin:0;text-align:center;font-family:"Playfair Display","Times New Roman",serif;font-weight:900;color:${PALE};line-height:1.06;letter-spacing:-.01em;text-shadow:0 3px 0 #6e0f0f,0 12px 30px #000c;overflow:hidden}` +
  `.banner{position:absolute;left:50%;transform:translateX(-50%);white-space:nowrap;background:linear-gradient(180deg,#c42323,#8a1212);color:${PALE};border:2px solid ${GOLD};padding:14px 44px;border-radius:14px;font-weight:900;letter-spacing:.16em;font-size:26px;box-shadow:0 10px 30px #0009}` +
  `.paper{position:absolute;left:70px;right:70px;background:linear-gradient(180deg,#f9edd2,#eedaae);border:3px solid ${PAPER_LINE};border-radius:16px;box-shadow:0 30px 80px #000a,inset 0 0 0 9px #f6e7c4,inset 0 0 0 11px ${PAPER_LINE}66}` +
  `.corner{position:absolute;width:42px;height:42px;border:4px solid ${CRIMSON}}.corner-tl{left:22px;top:22px;border-right:0;border-bottom:0}.corner-tr{right:22px;top:22px;border-left:0;border-bottom:0}.corner-bl{left:22px;bottom:22px;border-right:0;border-top:0}.corner-br{right:22px;bottom:22px;border-left:0;border-top:0}` +
  `.section{position:absolute;left:50%;transform:translateX(-50%);white-space:nowrap;background:linear-gradient(180deg,${CRIMSON},#6f0f0f);color:${PALE};border:2px solid ${GOLD};padding:12px 36px;border-radius:999px;font-weight:900;letter-spacing:.2em;font-size:22px}` +
  `.panel-title{position:absolute;left:60px;right:60px;margin:0;text-align:center;font-family:"Playfair Display","Times New Roman",serif;font-weight:900;color:${CRIMSON};line-height:1.12;overflow:hidden}` +
  '.rows{position:absolute;left:60px;right:60px;display:flex;flex-direction:column}' +
  `.row{display:flex;gap:20px;align-items:flex-start;padding:20px 0;border-bottom:1px dashed ${PAPER_LINE}}.row:last-child{border-bottom:0}` +
  `.num{flex:none;width:50px;height:50px;border-radius:50%;background:radial-gradient(circle at 40% 35%,#fff0c0,${GOLD} 70%);color:#5a1010;font-weight:900;font-size:22px;display:flex;align-items:center;justify-content:center;border:2px solid ${CRIMSON};margin-top:2px}` +
  `.row p{margin:0;flex:1;font-size:31px;line-height:1.36;color:${INK}}` +
  `.medal{border-radius:50%;background:radial-gradient(circle at 50% 36%,#fff6d8,${GOLD} 72%);border:6px solid ${CRIMSON};box-shadow:0 0 0 8px ${GOLD},0 24px 60px #000b;display:flex;align-items:center;justify-content:center;line-height:1}` +
  '.slot-seal{position:absolute;right:180px;top:130px;width:136px;height:136px}' +
  '.slot-foot{position:absolute;left:60px;right:60px;bottom:38px;height:52px}' +
  `.folio{position:absolute;left:100px;right:100px;bottom:70px;display:flex;align-items:center;justify-content:space-between;color:${GOLD}99;font-size:18px;font-weight:800;letter-spacing:.2em}` +
  `.note{position:absolute;left:100px;right:100px;text-align:center;color:${GOLD}aa;font-size:20px;line-height:1.4}`;

const sky = `<div class="stars"></div><div class="glow"></div>
      <div class="lantern lantern-l"><i class="cord"></i><i class="cap"></i><i class="body"></i><i class="cap"></i><i class="tassel"></i></div>
      <div class="lantern lantern-r"><i class="cord"></i><i class="cap"></i><i class="body"></i><i class="cap"></i><i class="tassel"></i></div>`;
const corners = '<i class="corner corner-tl"></i><i class="corner corner-tr"></i><i class="corner corner-bl"></i><i class="corner corner-br"></i>';

/** The entrance every scene shares: the sky settles, the lanterns swing in, the kicker lands. */
const skyIn =
  `tl.fromTo(q('.stars'),{opacity:0},{opacity:.7,duration:1.2,ease:'sine.out'},0);` +
  `tl.fromTo(q('.lantern-l'),{y:-120,opacity:0,rotation:-6,transformOrigin:'top center'},{y:0,opacity:1,rotation:0,duration:1,ease:'power3.out'},.1);` +
  `tl.fromTo(q('.lantern-r'),{y:-120,opacity:0,rotation:6,transformOrigin:'top center'},{y:0,opacity:1,rotation:0,duration:1,ease:'power3.out'},.2);` +
  `tl.fromTo(q('.kicker'),{opacity:0,y:-10},{opacity:1,y:0,duration:.5,ease:'power2.out'},.3);` +
  `tl.fromTo(q('.folio'),{opacity:0},{opacity:1,duration:.6,ease:'sine.out'},1.2);`;
/** A parchment panel rises, then its rows follow one after another. */
const paperIn = (at) =>
  `tl.fromTo(q('.paper'),{y:80,opacity:0},{y:0,opacity:1,duration:.8,ease:'power3.out'},${at});` +
  `tl.fromTo(q('.section'),{scale:.8,opacity:0},{scale:1,opacity:1,duration:.5,ease:'back.out(1.6)'},${at + 0.35});` +
  `if(q('.panel-title'))tl.fromTo(q('.panel-title'),{y:20,opacity:0},{y:0,opacity:1,duration:.6,ease:'power2.out'},${at + 0.45});` +
  `tl.fromTo(root.querySelectorAll('.row,.card'),{y:24,opacity:0},{y:0,opacity:1,duration:.5,ease:'power2.out',stagger:.12},${at + 0.6});`;

/** Rows a storyboard may leave empty are taken out of the panel, and the numbers follow what is left. */
const hideEmpty = (keys) =>
  `['${keys.join("','")}'].forEach(function(key){var row=root.querySelector('.row-'+key);if(row&&!String(v[key]==null?'':v[key]).trim())row.style.display='none'});` +
  `Array.prototype.slice.call(root.querySelectorAll('.row')).filter(function(r){return r.style.display!=='none'}).forEach(function(r,i){var n=r.querySelector('.num');if(n)n.textContent=String(i+1)});`;

const sourceVar = (label, labelVi, sample, dflt = 'Quan niệm dân gian') => ({ id: 'source', type: 'string', label, labels: { vi: labelVi }, default: dflt, sample, maxLength: 48, required: true });
const secondsVar = { id: 'seconds', type: 'number', label: 'Length in seconds (the Assemble node gives it)', default: 4 };
const itemVar = (n, sample) => ({
  id: `item${n}`,
  type: 'string',
  label: `Row ${n} of the list${n > 3 ? ', or empty' : ''}`,
  labels: { vi: `Dòng ${n} của danh sách${n > 3 ? ', hoặc để trống' : ''}` },
  default: '',
  sample,
  maxLength: 96,
  required: n <= 2,
});

const scenes = {
  cover: {
    role: 'hook',
    description: 'Cover: the headline in gold on the night sky under two lanterns, the sign in a gold medallion, and a red banner with the question.',
    css:
      ground +
      seal.css +
      foot.css +
      '.kicker{top:300px}' +
      '.medal{position:absolute;left:50%;top:370px;width:340px;height:340px;margin-left:-170px;font-size:190px}' +
      '.headline{top:800px;font-size:108px;max-height:480px}' +
      '.banner{top:1330px}' +
      `.strip{position:absolute;left:70px;right:70px;top:1470px;height:150px;background:linear-gradient(180deg,#f9edd2,#eedaae);border:3px solid ${PAPER_LINE};border-radius:14px;box-shadow:0 20px 60px #000a}` +
      '.strip .slot-foot{bottom:48px}',
    markup: `${sky}
      <span class="kicker">THEO QUAN NIỆM DÂN GIAN</span>
      <span class="slot slot-seal">${seal.markup}</span>
      <div class="medal"><span class="sign"></span></div>
      <h1 class="headline title"></h1>
      <span class="banner detail"></span>
      <div class="strip"><span class="slot slot-foot">${foot.markup}</span></div>
      <div class="folio"><span>01 / MỞ ĐẦU</span><span>NODECINE</span></div>`,
    motion:
      skyIn +
      `tl.fromTo(q('.medal'),{scale:.4,opacity:0},{scale:1,opacity:1,duration:.8,ease:'back.out(1.5)'},.35);` +
      `tl.fromTo(q('.headline'),{y:50,opacity:0},{y:0,opacity:1,duration:.8,ease:'power3.out'},.6);` +
      `tl.fromTo(q('.banner'),{scale:.7,opacity:0},{scale:1,opacity:1,duration:.5,ease:'back.out(1.8)'},1.05);` +
      `tl.fromTo(q('.strip'),{y:40,opacity:0},{y:0,opacity:1,duration:.6,ease:'power2.out'},1.2);` +
      seal.motion +
      foot.motion,
    extraScript: LOOKUPS + "q('.sign').textContent=zodiacOf(v.sign);" + foot.before,
    variables: [
      {
        id: 'title',
        type: 'string',
        label: 'The headline: the question the film answers',
        labels: { vi: 'Tiêu đề: câu hỏi mà phim trả lời' },
        default: 'Tuổi này hợp với tuổi nào?',
        sample: 'Tuổi Mão hợp với tuổi nào?',
        maxLength: 44,
        required: true,
      },
      { id: 'detail', type: 'string', label: 'The banner under it, a few words', labels: { vi: 'Băng rôn bên dưới, vài chữ' }, default: 'VÌ SAO?', sample: 'VÌ SAO?', maxLength: 28, required: true },
      {
        id: 'sign',
        type: 'string',
        label: 'The zodiac sign the film is about (Tý, Sửu, Dần, Mão, Thìn, Tỵ, Ngọ, Mùi, Thân, Dậu, Tuất, Hợi), or empty',
        labels: { vi: 'Con giáp của phim (Tý, Sửu, Dần, Mão, Thìn, Tỵ, Ngọ, Mùi, Thân, Dậu, Tuất, Hợi), hoặc để trống' },
        default: '',
        sample: 'Mão',
        maxLength: 12,
      },
      sourceVar('Where the reading comes from', 'Luận giải theo nguồn nào', 'Quan niệm dân gian · Tam hợp, Lục hợp'),
      secondsVar,
    ],
  },
  list: {
    role: 'feature',
    description: 'A parchment panel: a section head on a red band, the panel’s title, and up to five numbered rows.',
    css:
      ground +
      foot.css +
      '.kicker{top:150px}' +
      '.paper{top:250px;bottom:300px}' +
      '.section{top:-28px}' +
      '.panel-title{top:80px;font-size:58px;max-height:270px}' +
      '.rows{top:340px;bottom:120px;overflow:hidden;justify-content:center}.row{padding:24px 0}.row p{font-size:34px}',
    markup: `${sky}
      <span class="kicker">THEO QUAN NIỆM DÂN GIAN</span>
      <div class="paper">${corners}
        <span class="section heading"></span>
        <h2 class="panel-title title"></h2>
        <div class="rows">
          <div class="row row-item1"><span class="num">1</span><p class="item1"></p></div>
          <div class="row row-item2"><span class="num">2</span><p class="item2"></p></div>
          <div class="row row-item3"><span class="num">3</span><p class="item3"></p></div>
          <div class="row row-item4"><span class="num">4</span><p class="item4"></p></div>
          <div class="row row-item5"><span class="num">5</span><p class="item5"></p></div>
        </div>
        <span class="slot slot-foot">${foot.markup}</span>
      </div>
      <div class="folio"><span>02 / LUẬN GIẢI</span><span>NODECINE</span></div>`,
    motion: skyIn + paperIn(0.3) + foot.motion,
    textKeys: ['title', 'source', 'heading', 'item1', 'item2', 'item3', 'item4', 'item5'],
    extraScript: hideEmpty(['item1', 'item2', 'item3', 'item4', 'item5']) + foot.before,
    variables: [
      { id: 'heading', type: 'string', label: 'The section head, in capitals', labels: { vi: 'Tên mục, viết hoa' }, default: 'TÍNH CÁCH', sample: 'TÍNH CÁCH', maxLength: 24, required: true },
      {
        id: 'title',
        type: 'string',
        label: 'What this panel answers',
        labels: { vi: 'Tấm bảng này trả lời điều gì' },
        default: 'Người tuổi này là người như thế nào?',
        sample: 'Người tuổi Mão là người như thế nào?',
        maxLength: 52,
        required: true,
      },
      itemVar(1, 'Hiền lành, chân thành: sống tình cảm, ít thích hơn thua.'),
      itemVar(2, 'Rộng lượng, hay giúp đỡ: quan tâm và sẵn lòng chia sẻ.'),
      itemVar(3, 'Lạc quan, thích bình yên: yêu sự thoải mái, ngại tranh cãi.'),
      itemVar(4, 'Kiên trì khi có mục tiêu: đã quyết thì rất bền bỉ.'),
      itemVar(5, ''),
      sourceVar('Where these rows come from', 'Các dòng này theo nguồn nào', 'Quan niệm dân gian'),
      secondsVar,
    ],
  },
  match: {
    role: 'feature',
    description: 'The three signs that suit this one best: each in its medallion with its name, the kind of match, and one line why.',
    css:
      ground +
      foot.css +
      '.kicker{top:150px}' +
      '.headline{top:330px;font-size:72px;max-height:170px}' +
      '.paper{top:580px;bottom:380px}' +
      '.section{top:-28px}' +
      '.cards{position:absolute;left:50px;right:50px;top:90px;display:flex;gap:22px}' +
      `.card{flex:1;display:flex;flex-direction:column;align-items:center;text-align:center;padding:30px 16px 26px;background:#fff8e6;border:2px solid ${PAPER_LINE};border-radius:14px}` +
      `.card .medal{width:150px;height:150px;font-size:84px;border-width:4px;box-shadow:0 0 0 6px ${GOLD},0 14px 30px #0006}` +
      `.card .name{margin:26px 0 10px;font-family:"Playfair Display","Times New Roman",serif;font-size:34px;font-weight:900;color:${CRIMSON}}` +
      `.card .tag{display:inline-block;background:${CRIMSON};color:${PALE};font-size:16px;font-weight:900;letter-spacing:.14em;padding:6px 14px;border-radius:999px}` +
      `.card .why{margin:18px 0 0;font-size:24px;line-height:1.34;color:${INK};overflow:hidden;max-height:300px}` +
      `.lucky{position:absolute;left:60px;right:60px;top:600px;bottom:110px;border-top:1px dashed ${PAPER_LINE};padding-top:30px;text-align:center}` +
      `.lucky p{margin:0;font-size:30px;line-height:1.4;color:${INK_SOFT};overflow:hidden;max-height:270px}`,
    markup: `${sky}
      <span class="kicker">THEO QUAN NIỆM DÂN GIAN</span>
      <h1 class="headline title"></h1>
      <div class="paper">${corners}
        <span class="section">HỢP VỚI TUỔI NÀO</span>
        <div class="cards">
          <div class="card card-1"><div class="medal"><span class="sign1"></span></div><span class="name name1"></span><span class="tag tag1"></span><p class="why why1"></p></div>
          <div class="card card-2"><div class="medal"><span class="sign2"></span></div><span class="name name2"></span><span class="tag tag2"></span><p class="why why2"></p></div>
          <div class="card card-3"><div class="medal"><span class="sign3"></span></div><span class="name name3"></span><span class="tag tag3"></span><p class="why why3"></p></div>
        </div>
        <div class="lucky"><p class="detail"></p></div>
        <span class="slot slot-foot">${foot.markup}</span>
      </div>
      <div class="folio"><span>03 / HỢP TUỔI</span><span>NODECINE</span></div>`,
    motion:
      skyIn +
      `tl.fromTo(q('.headline'),{y:30,opacity:0},{y:0,opacity:1,duration:.7,ease:'power3.out'},.3);` +
      paperIn(0.5) +
      `tl.fromTo(q('.lucky'),{opacity:0},{opacity:1,duration:.6,ease:'sine.out'},1.5);` +
      foot.motion,
    textKeys: ['title', 'detail', 'source', 'name1', 'name2', 'name3', 'tag1', 'tag2', 'tag3', 'why1', 'why2', 'why3'],
    extraScript: LOOKUPS + "[1,2,3].forEach(function(i){q('.sign'+i).textContent=zodiacOf(v['name'+i])});" + foot.before,
    variables: [
      {
        id: 'title',
        type: 'string',
        label: 'The headline over the three',
        labels: { vi: 'Tiêu đề phía trên ba con giáp' },
        default: '3 con giáp hợp nhất',
        sample: '3 con giáp hợp nhất với tuổi Mão',
        maxLength: 40,
        required: true,
      },
      { id: 'name1', type: 'string', label: 'First sign, as "Tuổi Mùi"', labels: { vi: 'Con giáp thứ nhất, dạng "Tuổi Mùi"' }, default: 'Tuổi Mùi', sample: 'Tuổi Mùi', maxLength: 12, required: true },
      {
        id: 'tag1',
        type: 'string',
        label: 'The kind of match: Tam hợp, Lục hợp…',
        labels: { vi: 'Kiểu hợp: Tam hợp, Lục hợp…' },
        default: 'TAM HỢP',
        sample: 'TAM HỢP',
        maxLength: 14,
        required: true,
      },
      {
        id: 'why1',
        type: 'string',
        label: 'One line why',
        labels: { vi: 'Một dòng vì sao' },
        default: 'Vì sao hợp, trong một dòng.',
        sample: 'Cùng nhóm Mộc, dễ đồng thuận và nâng đỡ nhau.',
        maxLength: 80,
        required: true,
      },
      { id: 'name2', type: 'string', label: 'Second sign', labels: { vi: 'Con giáp thứ hai' }, default: 'Tuổi Hợi', sample: 'Tuổi Hợi', maxLength: 12, required: true },
      { id: 'tag2', type: 'string', label: 'The kind of match', labels: { vi: 'Kiểu hợp' }, default: 'TAM HỢP', sample: 'TAM HỢP', maxLength: 14, required: true },
      {
        id: 'why2',
        type: 'string',
        label: 'One line why',
        labels: { vi: 'Một dòng vì sao' },
        default: 'Vì sao hợp, trong một dòng.',
        sample: 'Hiền hoà gặp bao dung, ít va chạm, dễ bền lâu.',
        maxLength: 80,
        required: true,
      },
      { id: 'name3', type: 'string', label: 'Third sign', labels: { vi: 'Con giáp thứ ba' }, default: 'Tuổi Tuất', sample: 'Tuổi Tuất', maxLength: 12, required: true },
      { id: 'tag3', type: 'string', label: 'The kind of match', labels: { vi: 'Kiểu hợp' }, default: 'LỤC HỢP', sample: 'LỤC HỢP', maxLength: 14, required: true },
      {
        id: 'why3',
        type: 'string',
        label: 'One line why',
        labels: { vi: 'Một dòng vì sao' },
        default: 'Vì sao hợp, trong một dòng.',
        sample: 'Mão và Tuất là cặp lục hợp, tin nhau và giữ lời.',
        maxLength: 80,
        required: true,
      },
      {
        id: 'detail',
        type: 'string',
        label: 'One sentence under the three: the signs to be careful with, or what to keep in mind',
        labels: { vi: 'Một câu dưới ba con giáp: tuổi nên lưu ý, hay điều cần nhớ' },
        default: 'Điều nên lưu ý, trong một câu.',
        sample: 'Nên lưu ý tuổi Dậu (lục xung) và tuổi Thìn (lục hại): khác cách nghĩ, cần nhường nhau.',
        maxLength: 150,
        required: true,
      },
      sourceVar('Where the matches come from', 'Xét hợp tuổi theo nguồn nào', 'Tam hợp · Lục hợp · Lục xung'),
      secondsVar,
    ],
  },
  years: {
    role: 'feature',
    description: 'The birth years of a sign with the element of each, as a grid of six cards on the panel.',
    css:
      ground +
      foot.css +
      '.kicker{top:150px}' +
      '.headline{top:330px;font-size:72px;max-height:170px}' +
      '.paper{top:580px;bottom:300px}' +
      '.section{top:-28px}' +
      '.grid{position:absolute;left:50px;right:50px;top:90px;display:grid;grid-template-columns:1fr 1fr;gap:22px}' +
      `.card{display:flex;flex-direction:column;align-items:center;text-align:center;padding:30px 16px 28px;background:#fff8e6;border:2px solid ${PAPER_LINE};border-radius:14px}` +
      `.card .year{font-family:"Playfair Display","Times New Roman",serif;font-size:40px;font-weight:900;color:${CRIMSON};line-height:1.1}` +
      `.card .can{margin-top:10px;font-size:24px;color:${INK_SOFT};min-height:30px}` +
      '.card .elem{margin-top:18px;display:inline-block;color:#fff;font-size:18px;font-weight:900;letter-spacing:.16em;padding:8px 18px;border-radius:999px}' +
      `.lucky{position:absolute;left:60px;right:60px;top:790px;bottom:110px;border-top:1px dashed ${PAPER_LINE};padding-top:28px;text-align:center}` +
      `.lucky p{margin:0;font-size:29px;line-height:1.4;color:${INK_SOFT};overflow:hidden;max-height:200px}`,
    markup: `${sky}
      <span class="kicker">THEO QUAN NIỆM DÂN GIAN</span>
      <h1 class="headline title"></h1>
      <div class="paper">${corners}
        <span class="section">NĂM SINH VÀ NGŨ HÀNH</span>
        <div class="grid">
          <div class="card card-1"><span class="year year1"></span><span class="can can1"></span><span class="elem elem1"></span></div>
          <div class="card card-2"><span class="year year2"></span><span class="can can2"></span><span class="elem elem2"></span></div>
          <div class="card card-3"><span class="year year3"></span><span class="can can3"></span><span class="elem elem3"></span></div>
          <div class="card card-4"><span class="year year4"></span><span class="can can4"></span><span class="elem elem4"></span></div>
          <div class="card card-5"><span class="year year5"></span><span class="can can5"></span><span class="elem elem5"></span></div>
          <div class="card card-6"><span class="year year6"></span><span class="can can6"></span><span class="elem elem6"></span></div>
        </div>
        <div class="lucky"><p class="detail"></p></div>
        <span class="slot slot-foot">${foot.markup}</span>
      </div>
      <div class="folio"><span>04 / NĂM SINH</span><span>NODECINE</span></div>`,
    motion:
      skyIn +
      `tl.fromTo(q('.headline'),{y:30,opacity:0},{y:0,opacity:1,duration:.7,ease:'power3.out'},.3);` +
      paperIn(0.5) +
      `tl.fromTo(q('.lucky'),{opacity:0},{opacity:1,duration:.6,ease:'sine.out'},1.6);` +
      foot.motion,
    textKeys: ['title', 'detail', 'source', 'year1', 'year2', 'year3', 'year4', 'year5', 'year6', 'can1', 'can2', 'can3', 'can4', 'can5', 'can6', 'elem1', 'elem2', 'elem3', 'elem4', 'elem5', 'elem6'],
    extraScript:
      LOOKUPS +
      "[1,2,3,4,5,6].forEach(function(i){var card=q('.card-'+i);if(!String(v['year'+i]==null?'':v['year'+i]).trim()){card.style.visibility='hidden';return}var el=q('.elem'+i);el.style.background=elementOf(v['elem'+i])});" +
      foot.before,
    variables: [
      {
        id: 'title',
        type: 'string',
        label: 'The headline over the grid',
        labels: { vi: 'Tiêu đề phía trên lưới' },
        default: 'Các năm sinh và ngũ hành',
        sample: 'Các năm sinh tuổi Mão và ngũ hành',
        maxLength: 40,
        required: true,
      },
      ...[1, 2, 3, 4, 5, 6].flatMap((i) => [
        {
          id: `year${i}`,
          type: 'string',
          label: `Year ${i}${i > 2 ? ', or empty' : ''}`,
          labels: { vi: `Năm thứ ${i}${i > 2 ? ', hoặc để trống' : ''}` },
          default: i <= 2 ? '1999' : '',
          sample: ['1963', '1975', '1987', '1999', '2011', '2023'][i - 1],
          maxLength: 10,
          required: i <= 2,
        },
        {
          id: `can${i}`,
          type: 'string',
          label: 'Its stem and branch, as "Đinh Mão"',
          labels: { vi: 'Can chi của năm, dạng "Đinh Mão"' },
          default: '',
          sample: ['Quý Mão', 'Ất Mão', 'Đinh Mão', 'Kỷ Mão', 'Tân Mão', 'Quý Mão'][i - 1],
          maxLength: 16,
        },
        {
          id: `elem${i}`,
          type: 'string',
          label: 'Its element: Kim, Mộc, Thủy, Hỏa or Thổ',
          labels: { vi: 'Mệnh: Kim, Mộc, Thủy, Hỏa hay Thổ' },
          default: 'Thổ',
          sample: ['KIM', 'THỦY', 'HỎA', 'THỔ', 'MỘC', 'KIM'][i - 1],
          maxLength: 8,
        },
      ]),
      {
        id: 'detail',
        type: 'string',
        label: 'One sentence under the grid',
        labels: { vi: 'Một câu dưới lưới' },
        default: 'Một câu về mệnh của tuổi này.',
        sample: 'Cùng một con giáp nhưng mỗi mệnh một nết: mệnh Hỏa nóng tính mà thẳng, mệnh Thủy mềm mà sâu.',
        maxLength: 150,
        required: true,
      },
      sourceVar('Where the years and elements come from', 'Năm sinh và mệnh theo nguồn nào', 'Lục thập hoa giáp'),
      secondsVar,
    ],
  },
  saying: {
    role: 'proof',
    description: 'A saying on the parchment at poster size, who said it, and where it is written.',
    css:
      ground +
      foot.css +
      '.kicker{top:150px}' +
      '.paper{top:420px;bottom:420px}' +
      '.section{top:-28px}' +
      `.mark{position:absolute;left:60px;top:40px;font-size:300px;line-height:.8;color:${PAPER_LINE}66;font-family:"Playfair Display","Times New Roman",serif}` +
      `.quote{position:absolute;left:80px;right:80px;top:200px;bottom:230px;margin:0;display:flex;align-items:center;justify-content:center;text-align:center;font-family:"Playfair Display","Times New Roman",serif;font-style:italic;font-weight:700;font-size:74px;line-height:1.22;color:${INK};overflow:hidden}` +
      `.who{position:absolute;left:80px;right:80px;bottom:120px;text-align:center;font-size:30px;font-weight:900;letter-spacing:.12em;color:${CRIMSON}}` +
      '.who:before{content:"— "}',
    markup: `${sky}
      <span class="kicker">LỜI XƯA</span>
      <div class="paper">${corners}
        <span class="section">LỜI NGƯỜI XƯA</span>
        <span class="mark">“</span>
        <p class="quote title"></p>
        <span class="who detail"></span>
        <span class="slot slot-foot">${foot.markup}</span>
      </div>
      <div class="folio"><span>05 / LỜI XƯA</span><span>NODECINE</span></div>`,
    motion:
      skyIn +
      paperIn(0.3) +
      `tl.fromTo(q('.mark'),{opacity:0,x:-20},{opacity:1,x:0,duration:.7,ease:'power3.out'},.7);` +
      `tl.fromTo(q('.quote'),{y:30,opacity:0},{y:0,opacity:1,duration:.8,ease:'power3.out'},.85);` +
      `tl.fromTo(q('.who'),{opacity:0},{opacity:1,duration:.6,ease:'sine.out'},1.4);` +
      foot.motion,
    extraScript: foot.before,
    variables: [
      {
        id: 'title',
        type: 'string',
        label: 'The saying, as it is said',
        labels: { vi: 'Câu nói, đúng như lời' },
        default: 'Lời xưa để lại',
        sample: 'Có đức mặc sức mà ăn.',
        maxLength: 120,
        required: true,
      },
      {
        id: 'detail',
        type: 'string',
        label: 'Who said it, or "Lời xưa" when unsure',
        labels: { vi: 'Ai nói, hoặc "Lời xưa" nếu không chắc' },
        default: 'Lời xưa',
        sample: 'Tục ngữ Việt Nam',
        maxLength: 60,
        required: true,
      },
      sourceVar('Where the saying is written', 'Câu nói chép ở đâu', 'Ca dao tục ngữ'),
      secondsVar,
    ],
  },
  close: {
    role: 'outro',
    description: 'Closing: the one thing to keep, in gold on the night sky, and a note that the reading is for reflection.',
    css:
      ground +
      seal.css +
      foot.css +
      '.kicker{top:300px}' +
      '.banner{top:380px}' +
      '.headline{top:520px;font-size:92px;max-height:500px}' +
      '.closing{position:absolute;left:110px;right:110px;top:900px;margin:0;text-align:center;font-size:38px;line-height:1.45;color:#f3e2bd;overflow:hidden;max-height:280px}' +
      `.strip{position:absolute;left:70px;right:70px;top:1230px;height:150px;background:linear-gradient(180deg,#f9edd2,#eedaae);border:3px solid ${PAPER_LINE};border-radius:14px;box-shadow:0 20px 60px #000a}` +
      '.strip .slot-foot{bottom:48px}' +
      '.note{top:1420px}',
    markup: `${sky}
      <span class="kicker">THEO QUAN NIỆM DÂN GIAN</span>
      <span class="slot slot-seal">${seal.markup}</span>
      <span class="banner">LỜI NHẮN</span>
      <h1 class="headline title"></h1>
      <p class="closing detail"></p>
      <div class="strip"><span class="slot slot-foot">${foot.markup}</span></div>
      <p class="note">Tử vi và phong thuỷ là lời người xưa để lại: xem để suy ngẫm, không phải để định đoạt.</p>
      <div class="folio"><span>06 / KHÉP LẠI</span><span>NODECINE</span></div>`,
    motion:
      skyIn +
      `tl.fromTo(q('.banner'),{scale:.7,opacity:0},{scale:1,opacity:1,duration:.5,ease:'back.out(1.8)'},.4);` +
      `tl.fromTo(q('.headline'),{y:50,opacity:0},{y:0,opacity:1,duration:.8,ease:'power3.out'},.6);` +
      `tl.fromTo(q('.closing'),{y:24,opacity:0},{y:0,opacity:1,duration:.6,ease:'power2.out'},1);` +
      `tl.fromTo(q('.strip'),{y:40,opacity:0},{y:0,opacity:1,duration:.6,ease:'power2.out'},1.2);` +
      `tl.fromTo(q('.note'),{opacity:0},{opacity:1,duration:.6,ease:'sine.out'},1.5);` +
      seal.motion +
      foot.motion,
    extraScript: foot.before,
    variables: [
      {
        id: 'title',
        type: 'string',
        label: 'The one thing to keep',
        labels: { vi: 'Điều nên giữ lại' },
        default: 'Điều nên giữ',
        sample: 'Hợp tuổi là thuận, không phải là đủ',
        maxLength: 56,
        required: true,
      },
      {
        id: 'detail',
        type: 'string',
        label: 'One sentence to close on',
        labels: { vi: 'Một câu kết' },
        default: 'Một câu để khép lại.',
        sample: 'Hạnh phúc không nằm ở con giáp mà ở cách hai người đối đãi với nhau mỗi ngày.',
        maxLength: 160,
        required: true,
      },
      sourceVar('Where the reading comes from', 'Luận giải theo nguồn nào', 'Quan niệm dân gian'),
      secondsVar,
    ],
  },
};

// Keep the workflow JSON in sync with the six scenes, the components this kit publishes, and the guide.
await editComposition(new URL('./workflow.json', import.meta.url), (files) => {
  for (const key of Object.keys(files)) delete files[key];
  // The shell the Studio previews and the inspector lints, until a run has Assemble write the entry.
  files['index.html'] = filmShell({ id: 'wisdom-shell', background: '#120404' });
  for (const [kind, scene] of Object.entries(scenes)) files[`compositions/wisdom-${kind}.html`] = sceneBlock({ ...scene, id: `wisdom-${kind}`, seconds: 4, fonts: FONTS });
  // Published, not pasted: a writer may mount these into a frame of its own.
  files['compositions/components/seal-stamp.html'] = component({ ...sealStamp({ label: 'TỬ VI', cinnabar: '#b8322a', ink: '#f6e7c8' }), fonts: FONTS });
  files['compositions/components/source-line.html'] = component({ ...sourceLine({ accent: CRIMSON, color: INK_SOFT, track: PAPER_LINE, label: 'THEO' }), fonts: FONTS });
  files['storyboard-guide.md'] =
    `---\nfirst: hook\nlast: outro\nrepeat: 2\n---\nLàm một cuộn phim tiếng Việt, dọc 9:16, khoảng 50–70 giây, về chủ đề trong Brief: tử vi 12 con giáp, hợp tuổi, phong thuỷ, triết lý hay đạo lý. Giọng kể điềm đạm, như người lớn tuổi kể lại điều ông bà dạy. Mỗi cảnh là một tấm bảng của poster tử vi: tiêu đề vàng trên nền trời đêm, bảng giấy da viền vàng, mục trên băng đỏ, dòng đánh số.\nChỉ dùng những gì Research tìm được, ghi chú người viết và các đường link họ đưa. Không bịa lá số, năm sinh, mệnh hay câu trích; không chắc ai nói thì ghi là "Lời xưa".\nMở đầu bằng cảnh hook (wisdom-cover): câu hỏi phim trả lời làm tiêu đề, băng rôn vài chữ, và tên con giáp nếu phim nói về một tuổi (để trống khi không có).\nVới chủ đề một con giáp hay hợp tuổi: một hoặc hai cảnh wisdom-list (mỗi cảnh một mục: TÍNH CÁCH, TRONG CÔNG VIỆC, TRONG TÌNH CẢM, ĐIỂM MẠNH, ĐIỂM CẦN LƯU Ý; 3–5 dòng, mỗi dòng một ý ngắn), rồi wisdom-match với ba tuổi hợp nhất (tên dạng "Tuổi Mùi", kiểu hợp TAM HỢP hay LỤC HỢP, một dòng vì sao) và một câu về tuổi nên lưu ý, rồi wisdom-years với các năm sinh của tuổi đó kèm can chi và mệnh (Kim, Mộc, Thủy, Hỏa, Thổ) khi Research có.\nVới triết lý, đạo lý hay phong thuỷ: wisdom-list cho từng mục, không dùng wisdom-match và wisdom-years.\nTrước khi khép lại, một cảnh proof (wisdom-saying) với một câu nói đúng nguyên văn, ai nói, chép ở đâu. Khép lại bằng cảnh outro (wisdom-close): một điều nên giữ cho mình.\nMỗi cảnh mang một nguồn (tối đa 48 ký tự): "Quan niệm dân gian", một hệ thống (Tam hợp · Lục hợp, Lục thập hoa giáp, Ngũ hành, Bát trạch), hay tên sách và chương (Kinh Dịch · quẻ Càn, Luận Ngữ · Vi Chính). Dòng chân bảng đọc nguồn đó.\nTử vi và phong thuỷ là tham khảo: nói "theo quan niệm", "người xưa cho rằng"; không khẳng định điều gì chắc chắn sẽ xảy ra, không khuyên bỏ việc, bỏ thuốc, đầu tư hay chi tiền. Bỏ một ý khi Research không có gì chống đỡ cho nó.`;
});
