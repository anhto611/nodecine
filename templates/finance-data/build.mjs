import { component, editComposition, filmShell, sceneBlock, sourceLine } from '../_kit/build.mjs';

/**
 * Personal finance told with numbers, as a calm financial terminal.
 *
 * The grammar of a market screen set down as an editorial page: a deep navy ground ruled with a faint
 * grid, a status bar along the top (the film's mark on the left, which panel this is on the right, in
 * a monospaced face), one money colour — gold — for what the story is about, a red for what fell, and
 * every figure set in tabular numerals so the digits stand in columns while they count. The last value
 * of a line is tagged on its right axis the way a terminal tags a price.
 *
 * Six scenes: the money question with one headline figure that counts up, a line drawn from a series,
 * two to four columns side by side, where the money goes as a donut, two rates set against each other,
 * and what it means for the viewer's wallet with the standing disclaimer. Every chart is drawn by the
 * scene's own script from a short text variable ("2015:3.4;2020:5.6"), and every figure carries its
 * unit and the line saying where it came from.
 */

const GOLD = '#e8b84a';
const RED = '#ff6464';
const STEEL = '#7f9cc0';
const MUTED = '#8ea3bd';
const LINE = '#1f3350';
const INK = '#071322';

/** Be Vietnam Pro for the words and the figures (it carries the Vietnamese alphabet and tabular digits), JetBrains Mono for the terminal's labels. */
const FONTS = 'https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;600;800&family=JetBrains+Mono:wght@500;700&display=swap';

/*
 * The scenes' shared browser code. These functions are never called here: their source text is
 * written into every scene's script, so one definition reads every figure the same way.
 */

/** A figure as the storyboard writes it ("9.1", "9,1", "+6.9", "1.200.000") to a number and its decimals. */
function ncParse(s) {
  let t = String(s == null ? '' : s)
    .replace(/\s/g, '')
    .replace(/−/g, '-');
  if (/^[-+]?\d{1,3}(\.\d{3}){2,}/.test(t)) t = t.replace(/\./g, '');
  else if (/^[-+]?\d+,\d+/.test(t) && t.indexOf('.') < 0) t = t.replace(',', '.');
  const m = /[-+]?\d+(?:\.(\d+))?/.exec(t);
  return m ? { n: parseFloat(m[0]), d: Math.min(2, m[1] ? m[1].length : 0) } : { n: NaN, d: 0 };
}

/** A number the Vietnamese way: dots between thousands, a comma before the decimals, a true minus. */
function ncFmt(n, d, sign) {
  const parts = Math.abs(n).toFixed(d).split('.');
  const whole = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const zero = Number(Math.abs(n).toFixed(d)) === 0;
  const lead = n < 0 && !zero ? '−' : sign && n > 0 && !zero ? '+' : '';
  return lead + whole + (parts[1] ? ',' + parts[1] : '');
}

/** "Label:value;Label:value" to rows; a row without a readable value is dropped. */
function ncPairs(s, max) {
  return String(s == null ? '' : s)
    .split(';')
    .map(function (p) {
      const i = p.lastIndexOf(':');
      if (i < 0) return null;
      const label = p.slice(0, i).trim();
      const v = ncParse(p.slice(i + 1));
      return label && isFinite(v.n) ? { label: label, value: v.n, d: v.d } : null;
    })
    .filter(Boolean)
    .slice(0, max);
}

/** A round step for an axis between lo and hi, in about `count` steps. */
function ncNice(lo, hi, count) {
  if (hi === lo) hi = lo + 1;
  const raw = (hi - lo) / count;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const f = raw / mag;
  const step = (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * mag;
  return { lo: Math.floor(lo / step + 1e-9) * step, hi: Math.ceil(hi / step - 1e-9) * step, step: step };
}

function ncEsc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
}

/** Shrink a line of type until it fits its box, across or down. */
function ncFit(el, floor) {
  if (!el) return;
  let size = parseFloat(getComputedStyle(el).fontSize);
  while ((el.scrollWidth > el.clientWidth + 2 || el.scrollHeight > el.clientHeight + 2) && size > floor) {
    size -= 3;
    el.style.fontSize = size + 'px';
  }
}

/** A figure that counts up from zero on the timeline: seekable, since the tween writes the text on every update. */
function ncCount(tl, el, to, d, sign, at, dur, suffix) {
  if (!el || !isFinite(to)) return;
  // A setter, not onUpdate: the runtime seeks with events suppressed, and a suppressed seek skips onUpdate but still writes the property.
  const p = {
    _n: 0,
    get n() {
      return this._n;
    },
    set n(x) {
      this._n = x;
      el.textContent = ncFmt(x, d, sign) + (suffix || '');
    },
  };
  tl.fromTo(p, { n: 0 }, { n: to, duration: dur, ease: 'power2.out' }, at);
}

/** Whether a unit is itself a rate, so a change in it is told in points rather than in percent of percent. */
function ncIsPct(unit) {
  return /%/.test(String(unit || ''));
}

const HELPERS = [ncParse, ncFmt, ncPairs, ncNice, ncEsc, ncFit, ncCount, ncIsPct].map((fn) => fn.toString()).join('\n');

/** The ground every scene stands on: the navy, the grid, the status bar, the type, the source row. */
const ground =
  // Room under the last line and over it, for descenders (g, y, p) and stacked Vietnamese accents, in boxes that clip.
  '#root .center-value{padding-top:.08em;padding-bottom:.2em}#root .lg-label{padding-top:.08em;padding-bottom:.2em}#root .lab{padding-top:.08em;padding-bottom:.2em}#root .unit{padding-top:.08em;padding-bottom:.2em}#root .unit-tag{padding-top:.08em;padding-bottom:.2em}' +
  'html,body{margin:0;background:#050c16}*{box-sizing:border-box}' +
  '#root{position:absolute;inset:0;width:1080px;height:1920px;overflow:hidden;color:#eef3f8;font-family:"Be Vietnam Pro",Arial,sans-serif}' +
  '.nc-backdrop{position:absolute;inset:0;background:linear-gradient(180deg,#0c1c31 0%,#081627 52%,#050c16 100%)}' +
  '.grid{position:absolute;inset:0;background-image:linear-gradient(#ffffff07 1px,transparent 1px),linear-gradient(90deg,#ffffff07 1px,transparent 1px);background-size:72px 72px;background-position:0 20px}' +
  `.glow{position:absolute;right:-320px;top:-360px;width:1100px;height:1100px;border-radius:50%;background:radial-gradient(circle,${GOLD}1c 0,transparent 62%)}` +
  '.mono{font-family:"JetBrains Mono",ui-monospace,monospace}' +
  '.tab{font-variant-numeric:tabular-nums lining-nums}' +
  '.bar{position:absolute;left:72px;right:72px;top:92px;height:44px;display:flex;align-items:center;justify-content:space-between;font-family:"JetBrains Mono",ui-monospace,monospace;font-size:21px;font-weight:700;letter-spacing:.12em}' +
  `.bar-brand{color:#c9d4e2;display:flex;align-items:center;gap:14px}.bar-brand i{display:block;width:12px;height:12px;border-radius:50%;background:${GOLD};box-shadow:0 0 16px ${GOLD}}` +
  `.bar-sec{color:${GOLD}}` +
  `.bar-rule{position:absolute;left:72px;right:72px;top:152px;height:2px;background:linear-gradient(90deg,${GOLD},${GOLD}44 38%,${LINE})}` +
  `.kicker{position:absolute;left:72px;right:72px;font-family:"JetBrains Mono",ui-monospace,monospace;font-size:24px;line-height:1.4;font-weight:700;letter-spacing:.16em;color:${MUTED};white-space:nowrap;overflow:hidden;text-overflow:ellipsis}` +
  '.title{position:absolute;left:72px;right:72px;margin:0;padding-top:6px;font-weight:800;line-height:1.24;letter-spacing:-.015em;color:#f4f7fb;overflow:hidden}' +
  '.detail{position:absolute;left:72px;right:72px;margin:0;font-size:36px;line-height:1.45;color:#b4c3d6;overflow:hidden}' +
  // Every scene's body flows down one column between the status bar and the source row, so a short headline leaves no hole under it.
  '.flow{position:absolute;left:72px;right:72px;top:204px;height:1280px;display:flex;flex-direction:column}' +
  '.flow>.kicker,.flow>.title,.flow>.detail,.flow .detail{position:relative;left:auto;right:auto;top:auto;flex:none}' +
  '.flow>.title{margin-top:12px}' +
  `.src{position:absolute;left:72px;right:72px;top:1512px;padding-top:22px;border-top:1px solid ${LINE};display:flex;gap:24px;align-items:baseline}` +
  `.src-tag{flex:none;font-family:"JetBrains Mono",ui-monospace,monospace;font-size:19px;font-weight:700;color:${GOLD};letter-spacing:.16em}` +
  `.source{flex:1;font-size:25px;line-height:1.4;color:${MUTED};max-height:72px;overflow:hidden}`;

const chrome = (section) => `<div class="grid"></div><div class="glow"></div>
      <div class="bar"><span class="bar-brand"><i></i>NODECINE · TÀI CHÍNH</span><span class="bar-sec">${section}</span></div><div class="bar-rule"></div>`;
const sourceRow = '<div class="src"><span class="src-tag">NGUỒN</span><span class="source"></span></div>';

/** The entrance every scene shares: the grid settles, the bar slides down, its rule draws across, and the glow drifts for as long as the scene lasts. */
const chromeIn =
  `tl.fromTo(q('.grid'),{opacity:0},{opacity:1,duration:1,ease:'sine.out'},0);` +
  `tl.fromTo(q('.glow'),{x:0,opacity:0},{x:-90,opacity:1,duration:duration,ease:'none'},0);` +
  `tl.fromTo(q('.bar'),{y:-16,opacity:0},{y:0,opacity:1,duration:.5,ease:'power2.out'},.05);` +
  `tl.fromTo(q('.bar-rule'),{scaleX:0,transformOrigin:'left center'},{scaleX:1,duration:.8,ease:'power2.out'},.15);` +
  `if(q('.kicker'))tl.fromTo(q('.kicker'),{opacity:0,x:-14},{opacity:1,x:0,duration:.5,ease:'power2.out'},.25);` +
  `if(q('.title'))tl.fromTo(q('.title'),{opacity:0,y:30},{opacity:1,y:0,duration:.7,ease:'power3.out'},.35);` +
  `tl.fromTo(q('.src'),{opacity:0,y:12},{opacity:1,y:0,duration:.5,ease:'power2.out'},1.1);`;

const sourceVar = (sample) => ({
  id: 'source',
  type: 'string',
  label: 'Where the figures come from: the publisher and the year',
  labels: { vi: 'Số liệu lấy từ đâu: tên nguồn và năm' },
  default: 'Tổng cục Thống kê',
  sample,
  maxLength: 80,
  required: true,
});
const secondsVar = { id: 'seconds', type: 'number', label: 'Length in seconds (the Assemble node gives it)', default: 4 };
const unitVar = (sample, label = 'The unit of the figures', vi = 'Đơn vị của các con số') => ({
  id: 'unit',
  type: 'string',
  label: `${label}, as "triệu đồng/lượng", "%/năm", "triệu đồng/tháng"`,
  labels: { vi: `${vi}, dạng "triệu đồng/lượng", "%/năm", "triệu đồng/tháng"` },
  default: '',
  sample,
  maxLength: 28,
  required: true,
});

const scenes = {
  hook: {
    role: 'hook',
    description:
      'Opening: the money question as the headline, then one headline figure that counts up in a bracketed terminal panel, with its unit, the date it holds for, an optional change badge, one line of context and the source.',
    css:
      ground +
      '.flow{justify-content:center}' +
      '.kicker{color:' +
      GOLD +
      '}' +
      '.title{font-size:86px;max-height:410px}' +
      `.panel{position:relative;flex:none;margin-top:64px;height:470px;border:1px solid ${LINE};background:linear-gradient(180deg,#0e2139cc,#0a182acc);border-radius:6px}` +
      `.br{position:absolute;width:38px;height:38px;border:3px solid ${GOLD}}.br-tl{left:-2px;top:-2px;border-right:0;border-bottom:0}.br-tr{right:-2px;top:-2px;border-left:0;border-bottom:0}.br-bl{left:-2px;bottom:-2px;border-right:0;border-top:0}.br-br{right:-2px;bottom:-2px;border-left:0;border-top:0}` +
      `.p-head{position:absolute;left:44px;right:44px;top:34px;display:flex;justify-content:space-between;font-size:20px;font-weight:700;letter-spacing:.14em;color:${MUTED}}.p-head b{color:${GOLD};font-weight:700}` +
      `.figure{position:absolute;left:40px;right:40px;top:96px;height:230px;margin:0;font-size:220px;line-height:1.05;font-weight:800;letter-spacing:-.045em;color:${GOLD};white-space:nowrap;overflow:hidden;text-shadow:0 0 60px ${GOLD}33}` +
      '.unit{position:absolute;left:44px;right:44px;top:330px;font-size:40px;line-height:1.3;font-weight:600;color:#dce5ef;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
      '.delta{position:absolute;left:44px;top:392px;display:inline-flex;align-items:center;gap:12px;padding:6px 18px;border-radius:6px;font-size:26px;font-weight:700;letter-spacing:.04em;white-space:nowrap;max-width:860px;overflow:hidden}' +
      `.delta.up{background:${GOLD}22;color:${GOLD};border:1px solid ${GOLD}66}.delta.down{background:${RED}22;color:${RED};border:1px solid ${RED}66}.delta.flat{background:#ffffff10;color:#c9d4e2;border:1px solid #ffffff30}` +
      '.detail{margin-top:48px;max-height:210px}',
    markup: `${chrome('01 · CÂU HỎI')}
      <div class="flow">
      <span class="kicker topic"></span>
      <h1 class="title"></h1>
      <div class="panel"><i class="br br-tl"></i><i class="br br-tr"></i><i class="br br-bl"></i><i class="br br-br"></i>
        <div class="p-head mono"><span>CON SỐ CHÍNH</span><b class="asof"></b></div>
        <p class="figure tab"></p>
        <span class="unit"></span>
        <span class="delta mono"><span class="delta-arrow"></span><span class="delta-text"></span></span>
      </div>
      <p class="detail"></p>
      </div>
      ${sourceRow}`,
    textKeys: ['title', 'detail', 'source', 'topic', 'unit', 'asof'],
    extraScript:
      HELPERS +
      `var fig=ncParse(v.figure);var figEl=q('.figure');figEl.textContent=isFinite(fig.n)?ncFmt(fig.n,fig.d):String(v.figure||'');ncFit(figEl,90);if(isFinite(fig.n))figEl.textContent=ncFmt(0,fig.d);` +
      `var dl=String(v.delta==null?'':v.delta).trim();var dEl=q('.delta');if(!dl){dEl.style.display='none'}else{var down=/^[-\\u2212▼↓]|giảm/i.test(dl);var up=/^[+▲↑]|tăng/i.test(dl);dEl.classList.add(down?'down':up?'up':'flat');q('.delta-arrow').textContent=down?'▼':up?'▲':'■';q('.delta-text').textContent=dl.replace(/^[▲▼↑↓]\\s*/,'')}` +
      `if(!String(v.asof==null?'':v.asof).trim())q('.asof').style.display='none';if(!String(v.detail==null?'':v.detail).trim())q('.detail').style.display='none';`,
    motion:
      chromeIn +
      `tl.fromTo(q('.panel'),{opacity:0,y:40},{opacity:1,y:0,duration:.7,ease:'power3.out'},.55);` +
      `tl.fromTo(root.querySelectorAll('.br'),{scale:1.6,opacity:0},{scale:1,opacity:1,duration:.5,ease:'power2.out',stagger:.05},.7);` +
      `tl.fromTo(q('.p-head'),{opacity:0},{opacity:1,duration:.5,ease:'sine.out'},.8);` +
      `tl.fromTo(q('.figure'),{opacity:0,y:20},{opacity:1,y:0,duration:.5,ease:'power2.out'},.75);` +
      `ncCount(tl,q('.figure'),fig.n,fig.d,false,.75,1.6);` +
      `tl.fromTo(q('.unit'),{opacity:0,x:-16},{opacity:1,x:0,duration:.5,ease:'power2.out'},1.1);` +
      `tl.fromTo(q('.delta'),{opacity:0,scale:.85,transformOrigin:'left center'},{opacity:1,scale:1,duration:.45,ease:'back.out(1.8)'},1.7);` +
      `tl.fromTo(q('.detail'),{opacity:0,y:20},{opacity:1,y:0,duration:.6,ease:'power2.out'},1.5);`,
    variables: [
      {
        id: 'title',
        type: 'string',
        label: 'The money question the film answers',
        labels: { vi: 'Câu hỏi về tiền mà phim trả lời' },
        default: 'Tiền của bạn đang đi về đâu?',
        sample: 'Giá vàng đã tăng bao nhiêu sau 10 năm?',
        maxLength: 60,
        required: true,
      },
      {
        id: 'topic',
        type: 'string',
        label: 'What is measured, a few words in capitals',
        labels: { vi: 'Đang đo cái gì, vài chữ viết hoa' },
        default: 'SỐ LIỆU',
        sample: 'GIÁ VÀNG MIẾNG SJC',
        maxLength: 32,
        required: true,
      },
      {
        id: 'figure',
        type: 'string',
        label: 'The headline figure, digits only with "." for decimals, as the source prints it (e.g. 148.5)',
        labels: { vi: 'Con số chính, chỉ chữ số, dùng "." cho phần thập phân, đúng như nguồn (vd 148.5)' },
        default: '0',
        sample: '148.5',
        maxLength: 14,
        required: true,
      },
      unitVar('triệu đồng/lượng', 'The unit of the figure', 'Đơn vị của con số'),
      {
        id: 'asof',
        type: 'string',
        label: 'The date or year the figure holds for, or empty',
        labels: { vi: 'Ngày hoặc năm của con số, hoặc để trống' },
        default: '',
        sample: 'THÁNG 10/2026',
        maxLength: 20,
      },
      {
        id: 'delta',
        type: 'string',
        label: 'A change the source states, starting with + or −, as "+31,9% so với 1 năm trước", or empty',
        labels: { vi: 'Mức thay đổi nguồn có nêu, bắt đầu bằng + hoặc −, dạng "+31,9% so với 1 năm trước", hoặc để trống' },
        default: '',
        sample: '+42% so với cùng kỳ 2025',
        maxLength: 40,
      },
      {
        id: 'detail',
        type: 'string',
        label: 'One line of context under the figure',
        labels: { vi: 'Một dòng bối cảnh dưới con số' },
        default: '',
        sample: 'Giá bán ra niêm yết tại TP.HCM. Mười năm trước, cùng một lượng vàng chỉ khoảng 33 triệu đồng.',
        maxLength: 130,
        required: true,
      },
      sourceVar('Bảng giá Công ty SJC, 10/2026'),
      secondsVar,
    ],
  },
  line: {
    role: 'feature',
    description:
      'A line chart drawn across the frame from a series of years and values: gridlines, the axis, every point, the first value labelled, the last value tagged on the right axis, and a badge with the change from first to last computed by the scene.',
    css:
      ground +
      '.title{font-size:66px;max-height:260px}' +
      '.head{flex:none;margin-top:46px;height:56px;display:flex;align-items:center;gap:20px}' +
      '.chg{display:inline-flex;align-items:center;gap:10px;padding:8px 18px;border-radius:6px;font-size:28px;font-weight:700;white-space:nowrap}' +
      `.chg.up{background:${GOLD}22;color:${GOLD};border:1px solid ${GOLD}66}.chg.down{background:${RED}22;color:${RED};border:1px solid ${RED}66}` +
      `.span{font-size:24px;font-weight:500;color:${MUTED};letter-spacing:.06em;white-space:nowrap}` +
      `.unit{margin-left:auto;font-size:24px;font-weight:600;color:#c9d4e2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:420px}` +
      '.chart{position:relative;flex:1;min-height:520px;margin-top:40px}.chart svg{position:absolute;left:0;top:0;display:block;overflow:visible}' +
      '.detail{margin-top:20px;max-height:150px;font-size:34px}',
    markup: `${chrome('02 · DIỄN BIẾN')}
      <div class="flow">
      <span class="kicker">DIỄN BIẾN THEO THỜI GIAN</span>
      <h1 class="title"></h1>
      <div class="head"><span class="chg mono"><span class="chg-arrow"></span><span class="chg-text"></span></span><span class="span mono"></span><span class="unit"></span></div>
      <div class="chart"></div>
      <p class="detail"></p>
      </div>
      ${sourceRow}`,
    textKeys: ['title', 'detail', 'source', 'unit'],
    extraScript:
      HELPERS +
      `if(!String(v.detail==null?'':v.detail).trim())q('.detail').style.display='none';` +
      `var pts=ncPairs(v.series,14);var chartEl=q('.chart');var W=936,H=Math.max(520,Math.round(chartEl.clientHeight)||700),X0=8,X1=760,Y0=44,Y1=H-104;var lineLen=0,cum=[0];` +
      `if(pts.length<2){q('.head').style.display='none';chartEl.style.display='none'}else{` +
      `var vals=pts.map(function(p){return p.value});var mn=Math.min.apply(null,vals),mx=Math.max.apply(null,vals);var lo=mn>=0&&mn<mx*.45?0:mn-(mx-mn)*.12;var ax=ncNice(lo,mx+(mx-mn)*.06,4);var dec=Math.max.apply(null,pts.map(function(p){return p.d}));var tdec=ax.step<1?(ax.step<.1?2:1):0;` +
      `var xs=function(i){return X0+(X1-X0)*i/(pts.length-1)};var ys=function(n){return Y1-(Y1-Y0)*(n-ax.lo)/(ax.hi-ax.lo)};` +
      `var svg='<svg width="'+W+'" height="'+H+'" viewBox="0 0 '+W+' '+H+'"><defs><linearGradient id="fdArea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${GOLD}" stop-opacity=".34"/><stop offset="1" stop-color="${GOLD}" stop-opacity="0"/></linearGradient><clipPath id="fdClip"><rect class="clip-rect" x="0" y="0" width="0" height="'+H+'"/></clipPath></defs>';` +
      `var lastY=ys(vals[vals.length-1]);for(var g=ax.lo;g<=ax.hi+ax.step*.01;g+=ax.step){var gy=ys(g);svg+='<line class="gl" x1="0" x2="790" y1="'+gy+'" y2="'+gy+'" stroke="${LINE}" stroke-width="'+(Math.abs(g-ax.lo)<1e-9?3:1.5)+'"/>';if(Math.abs(gy-lastY)>40)svg+='<text class="gt" x="'+W+'" y="'+(gy+8)+'" text-anchor="end" font-family="JetBrains Mono,monospace" font-size="22" fill="${MUTED}">'+ncFmt(g,tdec)+'</text>'}` +
      `var every=Math.ceil(pts.length/7);pts.forEach(function(p,i){if(i%every===0||i===pts.length-1)svg+='<text class="xt" x="'+xs(i)+'" y="'+(Y1+50)+'" text-anchor="'+(i===0?'start':i===pts.length-1?'middle':'middle')+'" font-family="JetBrains Mono,monospace" font-size="24" fill="${MUTED}">'+ncEsc(p.label)+'</text>'});` +
      `var d='';pts.forEach(function(p,i){var x=xs(i),y=ys(p.value);d+=(i?'L':'M')+x.toFixed(1)+' '+y.toFixed(1);if(i){var px=xs(i-1),py=ys(pts[i-1].value);lineLen+=Math.sqrt((x-px)*(x-px)+(y-py)*(y-py))}cum.push(lineLen)});` +
      `svg+='<path clip-path="url(#fdClip)" d="'+d+'L'+X1+' '+Y1+'L'+X0+' '+Y1+'Z" fill="url(#fdArea)"/>';` +
      `svg+='<path class="ln" d="'+d+'" fill="none" stroke="${GOLD}" stroke-width="7" stroke-linejoin="round" stroke-linecap="round" stroke-dasharray="'+lineLen+'" stroke-dashoffset="'+lineLen+'"/>';` +
      `pts.forEach(function(p,i){svg+='<circle class="dot dot'+i+'" cx="'+xs(i)+'" cy="'+ys(p.value)+'" r="'+(i===pts.length-1?13:8)+'" fill="'+(i===pts.length-1?'${GOLD}':'${INK}')+'" stroke="${GOLD}" stroke-width="4"/>'});` +
      `var fy=ys(vals[0]);svg+='<text class="first" x="'+(X0)+'" y="'+(fy-26)+'" font-family="Be Vietnam Pro,Arial" font-weight="800" font-size="34" fill="#dce5ef">'+ncFmt(vals[0],dec)+'</text>';` +
      `svg+='<g class="tag"><line x1="'+X1+'" x2="800" y1="'+lastY+'" y2="'+lastY+'" stroke="${GOLD}" stroke-width="2" stroke-dasharray="6 6"/><rect x="800" y="'+(lastY-28)+'" width="136" height="56" rx="6" fill="${GOLD}"/><text class="tag-t" x="868" y="'+(lastY+11)+'" text-anchor="middle" font-family="Be Vietnam Pro,Arial" font-weight="800" font-size="30" fill="${INK}">'+ncFmt(vals[vals.length-1],dec)+'</text></g>';` +
      `svg+='<circle class="pulse" cx="'+X1+'" cy="'+lastY+'" r="13" fill="none" stroke="${GOLD}" stroke-width="3" opacity="0"/></svg>';chartEl.innerHTML=svg;` +
      `var tagT=root.querySelector('.tag-t');if(tagT&&tagT.getComputedTextLength&&tagT.getComputedTextLength()>124){tagT.setAttribute('font-size','24')}` +
      `var a0=vals[0],a1=vals[vals.length-1];var down=a1<a0;var chg=q('.chg');chg.classList.add(down?'down':'up');q('.chg-arrow').textContent=down?'▼':'▲';` +
      `if(ncIsPct(v.unit))q('.chg-text').textContent=ncFmt(a1-a0,Math.max(1,dec),true)+' điểm %';else if(a0!==0)q('.chg-text').textContent=ncFmt((a1-a0)/Math.abs(a0)*100,1,true)+'%';else chg.style.display='none';` +
      `q('.span').textContent=pts[0].label+' → '+pts[pts.length-1].label}`,
    motion:
      chromeIn +
      `tl.fromTo(q('.head'),{opacity:0,y:14},{opacity:1,y:0,duration:.5,ease:'power2.out'},.55);` +
      `tl.fromTo(root.querySelectorAll('.gl,.gt'),{opacity:0},{opacity:1,duration:.5,ease:'sine.out',stagger:.04},.5);` +
      `tl.fromTo(root.querySelectorAll('.xt'),{opacity:0,y:10},{opacity:1,y:0,duration:.4,ease:'power2.out',stagger:.05},.6);` +
      `var DRAW=1.7,AT=.8;if(q('.ln')){tl.fromTo(q('.ln'),{attr:{'stroke-dashoffset':lineLen}},{attr:{'stroke-dashoffset':0},duration:DRAW,ease:'none'},AT);` +
      `tl.fromTo(q('.clip-rect'),{attr:{width:0}},{attr:{width:X1+4},duration:DRAW,ease:'none'},AT);` +
      `root.querySelectorAll('.dot').forEach(function(el,i){tl.fromTo(el,{scale:0,svgOrigin:el.getAttribute('cx')+' '+el.getAttribute('cy')},{scale:1,duration:.3,ease:'back.out(2.4)'},AT+DRAW*(lineLen?cum[i]/lineLen:0)-.05)});` +
      `tl.fromTo(q('.first'),{opacity:0},{opacity:1,duration:.4,ease:'sine.out'},AT+.1);` +
      `tl.fromTo(q('.tag'),{opacity:0,x:-20},{opacity:1,x:0,duration:.5,ease:'power2.out'},AT+DRAW);` +
      `var pul=q('.pulse');var reps=Math.max(0,Math.floor((duration-AT-DRAW-.2)/1.3)-1);tl.fromTo(pul,{attr:{r:13},opacity:.9},{attr:{r:40},opacity:0,duration:1.3,ease:'sine.out',repeat:reps,immediateRender:false},AT+DRAW+.1)}` +
      `tl.fromTo(q('.detail'),{opacity:0,y:20},{opacity:1,y:0,duration:.6,ease:'power2.out'},1.6);`,
    variables: [
      {
        id: 'title',
        type: 'string',
        label: 'What the line shows, as a short headline',
        labels: { vi: 'Đường này cho thấy điều gì, một tiêu đề ngắn' },
        default: 'Diễn biến qua các năm',
        sample: 'Giá vàng SJC gấp hơn 4 lần sau 10 năm',
        maxLength: 56,
        required: true,
      },
      {
        id: 'series',
        type: 'string',
        label: 'The series, oldest first, as "2015:33.4;2020:56.8;2025:120.5": a label, a colon, the value with "." for decimals and no thousands separators; 3 to 12 points, all in one unit from one source',
        labels: {
          vi: 'Chuỗi số liệu, cũ nhất trước, dạng "2015:33.4;2020:56.8;2025:120.5": nhãn, dấu hai chấm, giá trị dùng "." cho phần thập phân, không dấu phân cách hàng nghìn; 3 đến 12 điểm, cùng một đơn vị và một nguồn',
        },
        default: '2020:1;2025:2',
        sample: '2016:35.5;2018:36.7;2020:56.1;2022:67.3;2024:83.5;2026:148.5',
        maxLength: 200,
        required: true,
      },
      unitVar('triệu đồng/lượng'),
      {
        id: 'detail',
        type: 'string',
        label: 'One sentence under the chart: what the line means, or empty',
        labels: { vi: 'Một câu dưới biểu đồ: đường này có nghĩa gì, hoặc để trống' },
        default: '',
        sample: 'Hai năm gần nhất tăng nhanh hơn cả tám năm trước cộng lại.',
        maxLength: 110,
      },
      sourceVar('SJC, giá bán ra cuối năm, 2016–2026'),
      secondsVar,
    ],
  },
  compare: {
    role: 'feature',
    description:
      'Two to four columns side by side from zero, each with its value counting up on top and its label under the baseline; one column is lit in gold and a badge says how it stands against the others, computed by the scene.',
    css:
      ground +
      '.title{font-size:66px;max-height:260px}' +
      '.head{flex:none;margin-top:46px;height:60px;display:flex;align-items:center;gap:20px}' +
      '.ratio{flex:none;max-width:660px;display:inline-flex;align-items:center;gap:10px;padding:10px 20px;border-radius:6px;font-size:28px;font-weight:600;color:#eef3f8;background:#ffffff0c;border:1px solid #ffffff22;white-space:nowrap;overflow:hidden}' +
      `.ratio b{color:${GOLD};font-weight:800}` +
      `.unit-tag{margin-left:auto;font-size:22px;letter-spacing:.06em;color:${MUTED};white-space:nowrap;overflow:hidden;text-overflow:ellipsis}` +
      `.plot{position:relative;flex:1;min-height:420px;margin-top:40px;border-bottom:3px solid #3a5476;background-image:linear-gradient(${LINE} 1.5px,transparent 1.5px);background-size:100% 155px;background-position:0 0}` +
      '.cols{position:absolute;inset:0;display:flex;align-items:flex-end;justify-content:center;gap:34px;padding:0 10px}' +
      '.col{flex:1;max-width:240px;height:100%;display:flex;flex-direction:column;justify-content:flex-end;align-items:stretch;position:relative}' +
      '.col-val{font-size:58px;line-height:1.15;font-weight:800;text-align:center;white-space:nowrap;overflow:hidden;margin-bottom:12px;color:#dce5ef}' +
      `.col-bar{border-radius:6px 6px 0 0;background:linear-gradient(180deg,#3d5c84,#243a58);border-top:4px solid ${STEEL}}` +
      `.col.hi .col-val{color:${GOLD}}.col.hi .col-bar{background:linear-gradient(180deg,${GOLD},#a77a20);border-top-color:#ffe39a;box-shadow:0 0 60px ${GOLD}33}` +
      '.labels{flex:none;margin-top:20px;display:flex;justify-content:center;gap:34px;padding:0 10px}' +
      '.lab{flex:1;max-width:240px;text-align:center;font-size:30px;line-height:1.3;font-weight:600;color:#c9d4e2;max-height:80px;overflow:hidden}' +
      `.lab.hi{color:${GOLD}}` +
      '.detail{margin-top:30px;max-height:110px;font-size:32px}',
    markup: `${chrome('03 · SO SÁNH')}
      <div class="flow">
      <span class="kicker">SO SÁNH</span>
      <h1 class="title"></h1>
      <div class="head"><span class="ratio"></span><span class="unit-tag mono unit"></span></div>
      <div class="plot"><div class="cols"></div></div>
      <div class="labels"></div>
      <p class="detail"></p>
      </div>
      ${sourceRow}`,
    textKeys: ['title', 'detail', 'source', 'unit'],
    extraScript:
      HELPERS +
      `if(!String(v.detail==null?'':v.detail).trim())q('.detail').style.display='none';` +
      `var rows=ncPairs(v.bars,4);var BARMAX=Math.max(240,(q('.plot').clientHeight||620)-110);var hl=String(v.highlight==null?'':v.highlight).trim().toLowerCase();var mx=Math.max.apply(null,rows.map(function(r){return r.value}).concat([0]));var dec=Math.max.apply(null,rows.map(function(r){return r.d}).concat([0]));` +
      `var hi=-1;rows.forEach(function(r,i){if(hl&&hi<0&&r.label.toLowerCase().indexOf(hl)>=0)hi=i});if(hi<0)rows.forEach(function(r,i){if(hi<0||r.value>rows[hi].value)hi=i});` +
      `var colsEl=q('.cols'),labsEl=q('.labels');var cols='',labs='';rows.forEach(function(r,i){var h=mx>0?Math.max(0,r.value)/mx*BARMAX:0;cols+='<div class="col'+(i===hi?' hi':'')+'"><div class="col-val tab">'+ncFmt(r.value,dec)+'</div><div class="col-bar" style="height:'+h.toFixed(1)+'px"></div></div>';labs+='<div class="lab'+(i===hi?' hi':'')+'">'+ncEsc(r.label)+'</div>'});colsEl.innerHTML=cols;labsEl.innerHTML=labs;` +
      `var vEls=root.querySelectorAll('.col-val');var vSize=rows.length>3?50:58;vEls.forEach(function(el){el.style.fontSize=vSize+'px'});vEls.forEach(function(el){ncFit(el,28)});var minSize=Math.min.apply(null,Array.prototype.map.call(vEls,function(el){return parseFloat(el.style.fontSize)||vSize}));vEls.forEach(function(el){el.style.fontSize=minSize+'px';el.textContent=ncFmt(0,dec)});` +
      `var rEl=q('.ratio');var others=rows.filter(function(r,i){return i!==hi});if(rows.length<2||!others.length){rEl.style.display='none'}else{var h=rows[hi],pct=ncIsPct(v.unit);var lowest=others.reduce(function(a,b){return b.value<a.value?b:a});var highest=others.reduce(function(a,b){return b.value>a.value?b:a});var ref=h.value>=highest.value?lowest:highest;var txt='';` +
      `if(pct){var gap=h.value-ref.value;txt=gap===0?'ngang '+ncEsc(ref.label):(gap>0?'cao hơn ':'thấp hơn ')+ncEsc(ref.label)+' <b>'+ncFmt(Math.abs(gap),Math.max(1,dec))+' điểm %</b>'}` +
      `else if(ref.value>0&&h.value>0){var ratio=h.value/ref.value;if(ratio>=1.5)txt='gấp <b>'+ncFmt(ratio,1)+' lần</b> '+ncEsc(ref.label);else if(ratio>=1)txt='cao hơn '+ncEsc(ref.label)+' <b>'+ncFmt((ratio-1)*100,0)+'%</b>';else txt='thấp hơn '+ncEsc(ref.label)+' <b>'+ncFmt((1-ratio)*100,0)+'%</b>'}` +
      `if(txt)rEl.innerHTML='<span>'+ncEsc(h.label)+'</span><span>'+txt+'</span>';else rEl.style.display='none';if(rEl.scrollWidth>rEl.clientWidth+2)rEl.style.fontSize='24px'}`,
    motion:
      chromeIn +
      `tl.fromTo(q('.plot'),{opacity:0},{opacity:1,duration:.6,ease:'sine.out'},.45);` +
      `root.querySelectorAll('.col-bar').forEach(function(el,i){tl.fromTo(el,{scaleY:0,transformOrigin:'bottom center'},{scaleY:1,duration:1,ease:'power3.out'},.7+i*.14)});` +
      `root.querySelectorAll('.col-val').forEach(function(el,i){tl.fromTo(el,{opacity:0,y:20},{opacity:1,y:0,duration:.5,ease:'power2.out'},.8+i*.14);ncCount(tl,el,rows[i].value,dec,false,.8+i*.14,1.1)});` +
      `tl.fromTo(root.querySelectorAll('.lab'),{opacity:0,y:-10},{opacity:1,y:0,duration:.45,ease:'power2.out',stagger:.1},.9);` +
      `tl.fromTo(q('.ratio'),{opacity:0,x:-20},{opacity:1,x:0,duration:.5,ease:'power2.out'},1.7);` +
      `tl.fromTo(q('.unit-tag'),{opacity:0},{opacity:1,duration:.5,ease:'sine.out'},.6);` +
      `tl.fromTo(q('.detail'),{opacity:0,y:20},{opacity:1,y:0,duration:.6,ease:'power2.out'},1.8);`,
    variables: [
      {
        id: 'title',
        type: 'string',
        label: 'What the columns compare, as a short headline',
        labels: { vi: 'Các cột so sánh điều gì, một tiêu đề ngắn' },
        default: 'So sánh',
        sample: 'Lương bình quân ở bốn thành phố lớn',
        maxLength: 56,
        required: true,
      },
      {
        id: 'bars',
        type: 'string',
        label: 'Two to four columns, as "Hà Nội:11.2;TP.HCM:10.8;Đà Nẵng:8.9": a short label, a colon, the value with "." for decimals; one unit, one year, one source',
        labels: { vi: 'Hai đến bốn cột, dạng "Hà Nội:11.2;TP.HCM:10.8;Đà Nẵng:8.9": nhãn ngắn, dấu hai chấm, giá trị dùng "." cho phần thập phân; cùng đơn vị, cùng năm, cùng nguồn' },
        default: 'A:1;B:2',
        sample: 'Hà Nội:11.6;TP.HCM:11.2;Đà Nẵng:8.4;Cần Thơ:7.1',
        maxLength: 120,
        required: true,
      },
      unitVar('triệu đồng/tháng'),
      {
        id: 'highlight',
        type: 'string',
        label: 'The label of the column to light, or empty for the largest',
        labels: { vi: 'Nhãn của cột được tô sáng, hoặc để trống để tô cột lớn nhất' },
        default: '',
        sample: 'Hà Nội',
        maxLength: 24,
      },
      {
        id: 'detail',
        type: 'string',
        label: 'One sentence under the columns, or empty',
        labels: { vi: 'Một câu dưới các cột, hoặc để trống' },
        default: '',
        sample: 'Thu nhập bình quân của người lao động, năm 2025.',
        maxLength: 90,
      },
      sourceVar('Tổng cục Thống kê, Điều tra lao động 2025'),
      secondsVar,
    ],
  },
  breakdown: {
    role: 'feature',
    description:
      'Where the money goes: a donut drawn round from shares that add up to about one hundred, the whole set in its centre, and a legend with each part and its share, the largest in gold.',
    css:
      ground +
      '.title{font-size:66px;max-height:180px}' +
      '.body{flex:1;display:flex;flex-direction:column;justify-content:center;align-items:center;gap:54px}' +
      '.donut{position:relative;flex:none;width:560px;height:560px}.donut svg{display:block}' +
      '.center{position:absolute;left:90px;right:90px;top:0;bottom:0;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center}' +
      `.center-label{font-size:21px;font-weight:700;letter-spacing:.14em;color:${MUTED};line-height:1.4;max-width:340px}` +
      '.center-value{margin-top:6px;font-size:76px;font-weight:800;letter-spacing:-.03em;line-height:1.15;color:#f4f7fb;white-space:nowrap;max-width:360px;overflow:hidden}' +
      '.legend{align-self:stretch;flex:none;display:flex;flex-direction:column}' +
      `.lg{display:flex;align-items:center;gap:22px;padding:13px 0;border-bottom:1px solid ${LINE}}.lg:last-child{border-bottom:0}` +
      '.lg-sw{flex:none;width:26px;height:26px;border-radius:5px}' +
      '.lg-label{flex:1;font-size:32px;line-height:1.3;font-weight:600;color:#dce5ef;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
      '.lg-val{flex:none;font-size:34px;font-weight:800;color:#f4f7fb}' +
      `.lg.top .lg-label,.lg.top .lg-val{color:${GOLD}}`,
    markup: `${chrome('04 · CƠ CẤU')}
      <div class="flow">
      <span class="kicker">TIỀN ĐI ĐÂU</span>
      <h1 class="title"></h1>
      <div class="body">
      <div class="donut"><div class="ring"></div><div class="center"><span class="center-label mono centerLabel"></span><span class="center-value tab total"></span></div></div>
      <div class="legend"></div>
      </div>
      </div>
      ${sourceRow}`,
    textKeys: ['title', 'source', 'centerLabel', 'total'],
    extraScript:
      HELPERS +
      `var parts=ncPairs(v.parts,6).filter(function(p){return p.value>0});var sum=parts.reduce(function(a,p){return a+p.value},0)||1;var dec=Math.max.apply(null,parts.map(function(p){return p.d}).concat([0]));var unit=String(v.unit==null?'%':v.unit).trim()||'%';` +
      `var top=0;parts.forEach(function(p,i){if(p.value>parts[top].value)top=i});var PAL=['#5f86b8','#8fb3d9','#3f6290','#b9cde4','#2f4a6e','#7d8ea6'];var k=0;var colors=parts.map(function(p,i){return i===top?'${GOLD}':PAL[k++%PAL.length]});` +
      `var R=226,SW=70,C=2*Math.PI*R,GAP=parts.length>1?6:0;var svg='<svg width="560" height="560" viewBox="0 0 560 560"><circle cx="280" cy="280" r="'+R+'" fill="none" stroke="#12243b" stroke-width="'+SW+'"/><g transform="rotate(-90 280 280)">';var segs=[],acc=0;` +
      `parts.forEach(function(p,i){var len=p.value/sum*C;segs.push({start:acc,len:Math.max(0,len-GAP)});svg+='<circle class="seg" cx="280" cy="280" r="'+R+'" fill="none" stroke="'+colors[i]+'" stroke-width="'+(i===top?SW+12:SW)+'" stroke-dasharray="0 '+C+'" stroke-dashoffset="'+(-acc)+'"/>';acc+=len});svg+='</g></svg>';q('.ring').innerHTML=svg;` +
      `var segEls=root.querySelectorAll('.seg');var paint=function(t){segEls.forEach(function(el,i){var s=segs[i];var shown=Math.max(0,Math.min(s.len,t*C-s.start));el.setAttribute('stroke-dasharray',shown.toFixed(2)+' '+C.toFixed(2))})};paint(0);` +
      `var lg='';parts.forEach(function(p,i){var val=unit==='%'?ncFmt(p.value,dec)+'%':ncFmt(p.value,dec)+' '+ncEsc(unit);lg+='<div class="lg'+(i===top?' top':'')+'"><span class="lg-sw" style="background:'+colors[i]+'"></span><span class="lg-label">'+ncEsc(p.label)+'</span><span class="lg-val tab">'+val+'</span></div>'});q('.legend').innerHTML=lg;` +
      `var rowsN=parts.length;if(rowsN>5)root.querySelectorAll('.lg').forEach(function(el){el.style.padding='9px 0'});` +
      `ncFit(q('.center-value'),40);if(!String(v.total==null?'':v.total).trim())q('.center').style.display='none';`,
    motion:
      chromeIn +
      `tl.fromTo(q('.donut'),{opacity:0,scale:.9,rotation:-20},{opacity:1,scale:1,rotation:0,duration:.9,ease:'power3.out'},.4);` +
      `var sweep={_t:0,get t(){return this._t},set t(x){this._t=x;paint(x)}};tl.fromTo(sweep,{t:0},{t:1,duration:1.6,ease:'power2.inOut'},.6);` +
      `tl.fromTo(q('.center'),{opacity:0,scale:.85},{opacity:1,scale:1,duration:.6,ease:'back.out(1.6)'},1.2);` +
      `tl.fromTo(root.querySelectorAll('.lg'),{opacity:0,x:30},{opacity:1,x:0,duration:.45,ease:'power2.out',stagger:.1},1);`,
    variables: [
      {
        id: 'title',
        type: 'string',
        label: 'Whose money and where it goes, as a short headline',
        labels: { vi: 'Tiền của ai, đi về đâu, một tiêu đề ngắn' },
        default: 'Tiền đi về đâu?',
        sample: 'Một hộ gia đình chi tiêu vào đâu?',
        maxLength: 48,
        required: true,
      },
      {
        id: 'parts',
        type: 'string',
        label: 'Two to six parts, as "Ăn uống:34;Nhà ở:18;Đi lại:9;Khác:39": a label, a colon, its share with "." for decimals; the shares add up to about 100',
        labels: { vi: 'Hai đến sáu phần, dạng "Ăn uống:34;Nhà ở:18;Đi lại:9;Khác:39": nhãn, dấu hai chấm, tỷ trọng dùng "." cho phần thập phân; cộng lại khoảng 100' },
        default: 'A:50;B:50',
        sample: 'Ăn uống:34.5;Nhà ở, điện nước:18.2;Đi lại:9.6;Giáo dục:6.8;Y tế:6.1;Khác:24.8',
        maxLength: 180,
        required: true,
      },
      { id: 'unit', type: 'string', label: 'The unit of the parts, "%" for shares', labels: { vi: 'Đơn vị của các phần, "%" cho tỷ trọng' }, default: '%', sample: '%', maxLength: 20, required: true },
      {
        id: 'centerLabel',
        type: 'string',
        label: 'A label for the whole, in capitals, or empty',
        labels: { vi: 'Nhãn cho tổng thể, viết hoa, hoặc để trống' },
        default: '',
        sample: 'CHI TIÊU/THÁNG',
        maxLength: 20,
      },
      {
        id: 'total',
        type: 'string',
        label: 'The whole, as the source gives it ("5,4 triệu"), or empty',
        labels: { vi: 'Tổng thể, như nguồn nêu ("5,4 triệu"), hoặc để trống' },
        default: '',
        sample: '5,4 triệu',
        maxLength: 14,
      },
      sourceVar('Tổng cục Thống kê, Khảo sát mức sống 2024'),
      secondsVar,
    ],
  },
  versus: {
    role: 'proof',
    description:
      'Two figures in the same unit set against each other, such as wages against house prices: each with its label, its value counting up and a bar to scale, the larger in gold, and the gap between them computed by the scene.',
    css:
      ground +
      '.title{font-size:66px;max-height:260px}' +
      '.body{flex:1;display:flex;flex-direction:column;justify-content:center}' +
      `.vs{position:relative;flex:none;height:350px;padding:34px 40px;border:1px solid ${LINE};border-radius:6px;background:linear-gradient(180deg,#0e2139cc,#0a182acc)}` +
      '.vs-label{font-size:32px;line-height:1.35;font-weight:600;color:#c9d4e2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
      '.vs-row{display:flex;align-items:baseline;gap:18px;margin-top:8px;height:170px;overflow:hidden}' +
      '.vs-val{font-size:140px;line-height:1.15;font-weight:800;letter-spacing:-.04em;color:#dce5ef;white-space:nowrap}' +
      `.vs-unit{font-size:34px;font-weight:600;color:${MUTED};white-space:nowrap;overflow:hidden;text-overflow:ellipsis}` +
      '.vs-track{position:relative;height:18px;margin-top:22px;border-radius:9px;background:#12243b;overflow:hidden}' +
      `.vs-fill{position:absolute;left:0;top:0;bottom:0;border-radius:9px;background:${STEEL}}` +
      `.vs.win .vs-val{color:${GOLD}}.vs.win .vs-fill{background:${GOLD}}.vs.neg .vs-val{color:${RED}}.vs.neg .vs-fill{background:${RED}}` +
      `.vs-mid{position:relative;flex:none;align-self:center;margin:-10px 0;width:88px;height:48px;border-radius:24px;background:${INK};border:1px solid ${LINE};color:${MUTED};font-size:22px;font-weight:700;letter-spacing:.12em;display:flex;align-items:center;justify-content:center;z-index:2}` +
      `.gap{flex:none;margin-top:36px;display:flex;align-items:center;gap:20px;font-size:24px;font-weight:700;letter-spacing:.12em;color:${MUTED}}.gap b{font-family:"Be Vietnam Pro",Arial,sans-serif;font-size:40px;letter-spacing:-.01em;color:#f4f7fb}` +
      '.detail{margin-top:24px;max-height:140px;font-size:32px}',
    markup: `${chrome('05 · ĐỐI CHIẾU')}
      <div class="flow">
      <span class="kicker">ĐẶT CẠNH NHAU</span>
      <h1 class="title"></h1>
      <div class="body">
      <div class="vs vs-a"><div class="vs-label labelA"></div><div class="vs-row"><span class="vs-val tab"></span><span class="vs-unit unit"></span></div><div class="vs-track"><span class="vs-fill"></span></div></div>
      <span class="vs-mid mono">VS</span>
      <div class="vs vs-b"><div class="vs-label labelB"></div><div class="vs-row"><span class="vs-val tab"></span><span class="vs-unit unit"></span></div><div class="vs-track"><span class="vs-fill"></span></div></div>
      <div class="gap mono"><span>CHÊNH LỆCH</span><b class="tab gap-val"></b></div>
      <p class="detail"></p>
      </div>
      </div>
      ${sourceRow}`,
    textKeys: ['title', 'detail', 'source', 'labelA', 'labelB', 'unit'],
    extraScript:
      HELPERS +
      `var va=ncParse(v.valueA),vb=ncParse(v.valueB);var dec=Math.max(va.d,vb.d);var cards=[q('.vs-a'),q('.vs-b')];var nums=[va.n,vb.n];var mxAbs=Math.max(Math.abs(va.n)||0,Math.abs(vb.n)||0)||1;var signed=/^\\s*[+\\-\\u2212]/.test(String(v.valueA))||/^\\s*[+\\-\\u2212]/.test(String(v.valueB));` +
      `cards.forEach(function(c,i){var n=nums[i];var el=c.querySelector('.vs-val');el.textContent=isFinite(n)?ncFmt(n,dec,signed):'—';c.querySelector('.vs-fill').style.width=(isFinite(n)?Math.abs(n)/mxAbs*100:0)+'%';if(isFinite(n)&&n<0)c.classList.add('neg');else if(isFinite(n)&&n===Math.max(va.n,vb.n)&&va.n!==vb.n)c.classList.add('win')});` +
      `var row0=cards[0].querySelector('.vs-row'),row1=cards[1].querySelector('.vs-row');[row0,row1].forEach(function(r){var el=r.querySelector('.vs-val');var s=140;while(r.scrollWidth>r.clientWidth+2&&s>60){s-=4;el.style.fontSize=s+'px'}});` +
      `cards.forEach(function(c,i){if(isFinite(nums[i]))c.querySelector('.vs-val').textContent=ncFmt(0,dec)});` +
      `if(isFinite(va.n)&&isFinite(vb.n)){var gp=vb.n-va.n;q('.gap-val').textContent=ncFmt(gp,Math.max(dec,ncIsPct(v.unit)?1:0),true)+(ncIsPct(v.unit)?' điểm %':' '+String(v.unit||''))}else q('.gap').style.display='none';` +
      `if(!String(v.detail==null?'':v.detail).trim())q('.detail').style.display='none';`,
    motion:
      chromeIn +
      `tl.fromTo(q('.vs-a'),{opacity:0,x:-60},{opacity:1,x:0,duration:.7,ease:'power3.out'},.5);` +
      `tl.fromTo(q('.vs-b'),{opacity:0,x:60},{opacity:1,x:0,duration:.7,ease:'power3.out'},.7);` +
      `tl.fromTo(q('.vs-mid'),{opacity:0,scale:.5},{opacity:1,scale:1,duration:.45,ease:'back.out(2)'},1);` +
      `root.querySelectorAll('.vs-fill').forEach(function(el,i){tl.fromTo(el,{scaleX:0,transformOrigin:'left center'},{scaleX:1,duration:1.2,ease:'power3.out'},.85+i*.2)});` +
      `root.querySelectorAll('.vs .vs-val').forEach(function(el,i){ncCount(tl,el,nums[i],dec,signed,.8+i*.2,1.3)});` +
      `tl.fromTo(q('.gap'),{opacity:0,y:14},{opacity:1,y:0,duration:.5,ease:'power2.out'},2);` +
      `tl.fromTo(q('.detail'),{opacity:0,y:20},{opacity:1,y:0,duration:.6,ease:'power2.out'},2.1);`,
    variables: [
      {
        id: 'title',
        type: 'string',
        label: 'What is set against what, as a short headline',
        labels: { vi: 'Đặt cái gì cạnh cái gì, một tiêu đề ngắn' },
        default: 'Đặt cạnh nhau',
        sample: 'Lương tăng có kịp giá nhà?',
        maxLength: 56,
        required: true,
      },
      { id: 'labelA', type: 'string', label: 'The first figure: what it is', labels: { vi: 'Con số thứ nhất: là gì' }, default: 'Thứ nhất', sample: 'Thu nhập bình quân tăng', maxLength: 40, required: true },
      {
        id: 'valueA',
        type: 'string',
        label: 'The first value, with "." for decimals and a leading + or − for a change (e.g. +6.9)',
        labels: { vi: 'Giá trị thứ nhất, dùng "." cho phần thập phân, thêm + hoặc − nếu là mức thay đổi (vd +6.9)' },
        default: '1',
        sample: '+6.9',
        maxLength: 14,
        required: true,
      },
      { id: 'labelB', type: 'string', label: 'The second figure: what it is', labels: { vi: 'Con số thứ hai: là gì' }, default: 'Thứ hai', sample: 'Giá căn hộ Hà Nội tăng', maxLength: 40, required: true },
      { id: 'valueB', type: 'string', label: 'The second value, in the same unit', labels: { vi: 'Giá trị thứ hai, cùng đơn vị' }, default: '2', sample: '+21.5', maxLength: 14, required: true },
      unitVar('%/năm', 'The one unit both figures share', 'Đơn vị chung của hai con số'),
      {
        id: 'detail',
        type: 'string',
        label: 'One sentence under the two, or empty',
        labels: { vi: 'Một câu dưới hai con số, hoặc để trống' },
        default: '',
        sample: 'Giá nhà tăng nhanh gấp ba lần thu nhập: khoảng cách để mua được nhà ngày càng xa.',
        maxLength: 110,
      },
      sourceVar('GSO 2025; Báo cáo thị trường căn hộ Hà Nội 2025'),
      secondsVar,
    ],
  },
  close: {
    role: 'outro',
    description: 'Closing: what the numbers mean for the viewer’s wallet, up to three numbered points, and the standing line that this is information, not investment advice.',
    css:
      ground +
      '.kicker{color:' +
      GOLD +
      '}' +
      '.title{font-size:80px;max-height:400px}' +
      '.flow{justify-content:center}' +
      '.points{flex:none;display:flex;flex-direction:column;margin-top:64px}' +
      `.pt{display:flex;gap:28px;align-items:flex-start;padding:26px 0;border-top:1px solid ${LINE}}.pt:last-child{border-bottom:1px solid ${LINE}}` +
      `.pt-no{flex:none;width:64px;font-size:30px;font-weight:700;color:${GOLD};line-height:1.45}` +
      '.pt p{margin:0;flex:1;font-size:36px;line-height:1.42;color:#dce5ef;max-height:154px;overflow:hidden}' +
      `.note{flex:none;margin-top:56px;display:flex;align-items:center;gap:22px;padding:24px 30px;border-radius:6px;border:1px solid ${GOLD}55;background:${GOLD}12}` +
      `.note-i{flex:none;width:44px;height:44px;border-radius:50%;border:2px solid ${GOLD};color:${GOLD};display:flex;align-items:center;justify-content:center;font-size:24px;font-weight:700}` +
      '.note p{margin:0;font-size:30px;line-height:1.4;font-weight:600;color:#eef3f8}',
    markup: `${chrome('06 · VÍ CỦA BẠN')}
      <div class="flow">
      <span class="kicker">VỚI VÍ TIỀN CỦA BẠN</span>
      <h1 class="title"></h1>
      <div class="points">
        <div class="pt pt-point1"><span class="pt-no mono">01</span><p class="point1"></p></div>
        <div class="pt pt-point2"><span class="pt-no mono">02</span><p class="point2"></p></div>
        <div class="pt pt-point3"><span class="pt-no mono">03</span><p class="point3"></p></div>
      </div>
      <div class="note"><span class="note-i mono">i</span><p>Thông tin tham khảo, không phải lời khuyên đầu tư.</p></div>
      </div>
      ${sourceRow}`,
    textKeys: ['title', 'source', 'point1', 'point2', 'point3'],
    extraScript:
      `['point1','point2','point3'].forEach(function(key){var row=q('.pt-'+key);if(row&&!String(v[key]==null?'':v[key]).trim())row.style.display='none'});` +
      `Array.prototype.filter.call(root.querySelectorAll('.pt'),function(r){return r.style.display!=='none'}).forEach(function(r,i){r.querySelector('.pt-no').textContent=String(i+1).padStart(2,'0')});`,
    motion:
      chromeIn +
      `tl.fromTo(root.querySelectorAll('.pt'),{opacity:0,y:26},{opacity:1,y:0,duration:.55,ease:'power2.out',stagger:.16},.8);` +
      `tl.fromTo(q('.note'),{opacity:0,y:20},{opacity:1,y:0,duration:.6,ease:'power2.out'},1.5);` +
      `tl.fromTo(q('.note-i'),{scale:.4},{scale:1,duration:.5,ease:'back.out(2.2)'},1.6);`,
    variables: [
      {
        id: 'title',
        type: 'string',
        label: 'What the numbers mean for the viewer’s money, one sentence',
        labels: { vi: 'Những con số này có nghĩa gì với tiền của người xem, một câu' },
        default: 'Điều này có nghĩa gì với bạn?',
        sample: 'Tiền để yên đang mất giá từng năm',
        maxLength: 60,
        required: true,
      },
      ...[1, 2, 3].map((n) => ({
        id: `point${n}`,
        type: 'string',
        label: `Point ${n}: a plain fact or a question to ask yourself, not advice to buy or sell${n > 1 ? ', or empty' : ''}`,
        labels: { vi: `Ý ${n}: một sự thật rõ ràng hoặc câu tự hỏi, không khuyên mua bán${n > 1 ? ', hoặc để trống' : ''}` },
        default: '',
        sample: [
          'Lạm phát năm 2025 khoảng 3,3%: tiền để yên trong ví mất dần sức mua.',
          'Lãi suất tiết kiệm 12 tháng đang quanh 4,5–5%/năm: so với lạm phát, tiền gửi chỉ vừa giữ giá.',
          'Trước khi chọn kênh nào, hãy biết mình chịu được rủi ro đến đâu.',
        ][n - 1],
        maxLength: 110,
        required: n === 1,
      })),
      sourceVar('GSO, NHNN, biểu lãi suất các ngân hàng 10/2026'),
      secondsVar,
    ],
  },
};

// Keep the workflow JSON in sync with the six scenes, the component this kit publishes, and the guide.
await editComposition(new URL('./workflow.json', import.meta.url), (files) => {
  for (const key of Object.keys(files)) delete files[key];
  // The shell the Studio previews and the inspector lints, until a run has Assemble write the entry.
  files['index.html'] = filmShell({ id: 'finance-shell', background: '#050c16' });
  for (const [kind, scene] of Object.entries(scenes)) files[`compositions/finance-${kind}.html`] = sceneBlock({ ...scene, id: `finance-${kind}`, seconds: 4, fonts: FONTS });
  // Published, not pasted: a writer may mount it into a frame of its own.
  files['compositions/components/source-line.html'] = component({ ...sourceLine({ accent: GOLD, color: MUTED, track: LINE, label: 'NGUỒN' }), fonts: FONTS });
  files['storyboard-guide.md'] = `---
first: hook
last: outro
repeat: 1
---
Làm một phim tiếng Việt, dọc 9:16, khoảng 80–100 giây, trả lời câu hỏi về tiền trong Brief: giá vàng, lãi suất, lạm phát, lương so với chi phí sống, tiết kiệm, giá nhà. Giọng kể điềm tĩnh, đáng tin, như người dẫn bản tin tài chính. Mỗi cảnh là một màn hình của một "terminal" tài chính: nền xanh đêm, lưới mờ, một màu vàng cho điều đang nói, màu đỏ cho thứ giảm.
Quy tắc trung thực, không có ngoại lệ: chỉ dùng con số Research tìm được, mỗi con số phải có đơn vị, năm (hoặc ngày) và nguồn. Không bịa, không làm tròn khác nguồn, không ngoại suy, không dự báo, không tự tính ra số mới để đưa vào biểu đồ. Bỏ một cảnh khi Research không có số liệu cho nó. Không khuyên mua, bán hay đầu tư vào bất cứ thứ gì; chỉ giải thích con số nghĩa là gì.
Thứ tự gợi ý:
1. Mở đầu bằng finance-hook: câu hỏi về tiền làm tiêu đề (tối đa 60 ký tự), vài chữ viết hoa nói đang đo gì (topic), một con số chính (figure) kèm đơn vị, ngày/năm (asof), mức thay đổi nếu nguồn có nêu (delta, bắt đầu bằng + hoặc −), một dòng bối cảnh.
2. finance-line khi có chuỗi theo thời gian (3 đến 12 mốc, cũ nhất trước, cùng đơn vị, cùng nguồn): series dạng "2016:35.5;2020:56.1;2026:148.5". Cảnh tự tính mức thay đổi từ mốc đầu tới mốc cuối (theo %, hoặc theo điểm % khi đơn vị là %), nên lời đọc phải khớp với chính các mốc đó.
3. finance-compare khi so sánh 2–4 nơi, nhóm hay kênh cùng một thời điểm: bars dạng "Hà Nội:11.6;TP.HCM:11.2;Đà Nẵng:8.4", highlight là nhãn của cột muốn nhấn. Các cột bắt đầu từ 0, cảnh tự tính cột nhấn gấp bao nhiêu lần hoặc hơn bao nhiêu %.
4. finance-breakdown khi nói tiền đi đâu: parts dạng "Ăn uống:34.5;Nhà ở:18.2;Khác:47.3", 2–6 phần, cộng lại khoảng 100 (unit "%"); total là tổng nếu nguồn có ("5,4 triệu"), centerLabel là nhãn của nó.
5. finance-versus khi đặt hai con số cùng đơn vị cạnh nhau (lương tăng so với giá nhà tăng, lãi tiết kiệm so với lạm phát): labelA/valueA, labelB/valueB, unit chung. Cảnh tự tính chênh lệch B − A.
6. Khép lại bằng finance-close: điều con số này có nghĩa với ví tiền người xem (tiêu đề), 1–3 ý ngắn là sự thật hoặc câu tự hỏi, không phải lời khuyên. Cảnh luôn có dòng "Thông tin tham khảo, không phải lời khuyên đầu tư." và lời đọc cũng nói câu đó.
Một phim thường có 5–7 cảnh; có thể dùng finance-line hoặc finance-compare hai lần cho hai chuỗi số khác nhau, nhưng không đặt hai cảnh cùng loại liền nhau.
Định dạng số trong biến: chỉ chữ số, dùng dấu chấm "." cho phần thập phân, không dấu phân cách hàng nghìn (148.5, không viết 148,5 hay 1.200.000 — viết 1200000). Cảnh tự hiển thị kiểu Việt Nam (148,5). Đơn vị để riêng trong unit ("triệu đồng/lượng", "%/năm", "triệu đồng/tháng"); không ghép đơn vị vào giá trị.
Lời đọc đọc số theo kiểu Việt Nam ("một trăm bốn mươi tám phẩy năm triệu đồng một lượng", "sáu phẩy chín phần trăm") và nói nguồn ít nhất một lần cho mỗi con số chính.
Mỗi cảnh mang một nguồn (tối đa 80 ký tự): tên tổ chức và năm, ví dụ "Tổng cục Thống kê, 2025", "SJC, giá bán ra 10/2026", "NHNN, lãi suất điều hành 2026".`;
});
