import { component, editComposition, filmShell, sceneBlock } from '../_kit/build.mjs';

/**
 * The ranking as a sports broadcast.
 *
 * The grammar of a scoreboard on a match night: a score bug in the corner, condensed italic type set
 * as big as the frame allows, rank tiles down the left edge, one vivid colour per contender that it
 * keeps from scene to scene, a light sweeping across the glass as a graphic lands, and the source in a
 * fine line along the foot. Flags are the system's own emoji, drawn by Noto Color Emoji so every
 * renderer shows the same flag.
 *
 * Five scenes: a "TOP N" cover, the race itself — a true bar chart race, every bar's value, rank and
 * the year counter read from one tween of the block's own timeline, so any frame can be sought — a
 * standing board of one year, a spotlight on one contender, and the closing word with a question.
 */

const ACCENT = '#ffd60a';
const HOT = '#ff2e4d';
const INK = '#f4f6ff';
const MUTED = '#8e9bc4';
const LINE = '#25305a';
const DARK = '#060a18';

/** Barlow Condensed for the scoreboard, Be Vietnam Pro for sentences, both with the Vietnamese alphabet; Noto Color Emoji for the flags. */
const FONTS =
  'https://fonts.googleapis.com/css2?family=Barlow+Condensed:ital,wght@0,600;0,700;0,800;0,900;1,800;1,900&family=Be+Vietnam+Pro:wght@500;600;700;800&family=Noto+Color+Emoji&display=swap';
const DISPLAY = '"Barlow Condensed","Noto Color Emoji",sans-serif';
const BODY = '"Be Vietnam Pro","Noto Color Emoji",Arial,sans-serif';

/* ------------------------------------------------------------------------------------------------
 * The helpers every scene's script shares. They are written here as real functions and pasted into
 * the page by their source, so the page and this file cannot drift apart.
 * ---------------------------------------------------------------------------------------------- */

/** "🇺🇸 Mỹ" → ['🇺🇸', 'Mỹ']: a leading flag or emoji, and the name after it. */
function splitName(s) {
  s = String(s == null ? '' : s).trim();
  const m = /^((?:[\u{1F1E6}-\u{1F1FF}]{2})|(?:\p{Extended_Pictographic}[\u{E0020}-\u{E007F}️]*(?:‍\p{Extended_Pictographic}️?)*))\s*/u.exec(s);
  return m ? [m[1], s.slice(m[0].length)] : ['', s];
}

/** A figure as a writer may type it: "5.9", "5,9", "29.18". Returns NaN when there is none. */
function parseNum(s) {
  let t = String(s == null ? '' : s).replace(/\s/g, '');
  if (t.indexOf(',') >= 0 && t.indexOf('.') < 0) t = t.replace(',', '.');
  else t = t.replace(/,/g, '');
  t = t.replace(/[^0-9.-]/g, '');
  return t ? parseFloat(t) : NaN;
}

/** How many decimals a typed figure carries, to print it back the same way. */
function decimalsOf(s) {
  let t = String(s == null ? '' : s).replace(/\s/g, '');
  if (t.indexOf(',') >= 0 && t.indexOf('.') < 0) t = t.replace(',', '.');
  const at = t.indexOf('.');
  return at < 0 ? 0 : Math.min(3, t.length - at - 1);
}

/** A figure the Vietnamese way: a comma before the decimals, dots between thousands. */
function fmtNum(n, d) {
  try {
    return Number(n).toLocaleString('vi-VN', { minimumFractionDigits: d, maximumFractionDigits: d });
  } catch {
    return Number(n).toFixed(d);
  }
}

/** "🇺🇸 Mỹ:29.18,🇨🇳 Trung Quốc:18.75" → entries. A comma splits only where a new "name:" follows, so "5,9" stays one figure. */
function parseEntries(s) {
  return String(s == null ? '' : s)
    .split(/,(?=[^,:]+:)/)
    .map(function (piece) {
      const at = piece.lastIndexOf(':');
      if (at < 0) return null;
      const raw = piece.slice(at + 1).trim();
      return { name: piece.slice(0, at).trim(), value: parseNum(raw), dec: decimalsOf(raw) };
    })
    .filter(function (e) {
      return e && e.name && isFinite(e.value);
    });
}

/** A contender's colour, from its name, so it wears the same one in every scene; `used` keeps a scene's colours apart. */
function colorFor(name, used) {
  const P = ['#ff3b5c', '#ffb800', '#00c2ff', '#8b5cff', '#00e08a', '#ff6a00', '#ff4fd8', '#2f7bff', '#b8f000', '#18e0c8'];
  let h = 7;
  const s = String(name);
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  const k = h % P.length;
  for (let j = 0; j < P.length; j++) {
    const c = P[(k + j) % P.length];
    if (!used || !used[c]) {
      if (used) used[c] = 1;
      return c;
    }
  }
  return P[k];
}

/**
 * A plain object whose `p` paints the scene whenever it is set. GSAP writes the property on every render,
 * however the timeline is sought — an onUpdate callback is skipped when a seek suppresses events, a setter
 * is not — so tweening `p` drives the drawing from the timeline itself.
 */
function driver(paint) {
  let value = 0;
  const target = {};
  Object.defineProperty(target, 'p', {
    get: function () {
      return value;
    },
    set: function (next) {
      value = next;
      paint(next);
    },
  });
  return target;
}

/** Shrink one line (or, with `box`, a box of lines) of type until it fits the room it was given. */
function fitText(el, floor, box) {
  if (!el) return;
  let size = parseFloat(getComputedStyle(el).fontSize);
  while ((el.scrollWidth > el.clientWidth + 1 || (box && el.scrollHeight > el.clientHeight + Math.max(4, size * 0.2))) && size > floor) {
    size -= 2;
    el.style.fontSize = size + 'px';
  }
}

/**
 * Fit every element marked `data-fit="<floor>"` (`data-fit-box` for several lines), from its base size.
 * Run again once the faces have loaded: measured in a fallback face, condensed type is far too wide
 * and would be shrunk for nothing.
 */
function fitAll(root) {
  const run = function () {
    root.querySelectorAll('[data-fit]').forEach(function (el) {
      el.style.fontSize = el.dataset.base || '';
      fitText(el, Number(el.dataset.fit) || 20, el.hasAttribute('data-fit-box'));
    });
  };
  run();
  if (document.fonts) {
    document.fonts.ready.then(run);
    if (document.fonts.addEventListener) document.fonts.addEventListener('loadingdone', run);
    Promise.all([document.fonts.load('900 80px "Barlow Condensed"'), document.fonts.load('italic 900 80px "Barlow Condensed"'), document.fonts.load('700 40px "Be Vietnam Pro"')]).then(run, run);
  }
}

/**
 * The race. Reads `v.data` — "1990|🇺🇸 Mỹ:5.96,🇯🇵 Nhật:3.13;2000|…" — lays out the rank tiles and one
 * bar per contender, and returns `paint(p)`: the whole board at progress p from the first year to the
 * last. Between two years every bar slides from its rank to its next, its value and the scale follow,
 * and the year counts; a short hold at each year lets it be read.
 */
function raceSetup(root, v) {
  const board = root.querySelector('.rc-board');
  const slots = root.querySelector('.rc-slots');
  const keys = String(v.data == null ? '' : v.data)
    .split(';')
    .map(function (chunk) {
      const bar = chunk.indexOf('|');
      if (bar < 0) return null;
      const vals = {};
      let dec = 0;
      let count = 0;
      parseEntries(chunk.slice(bar + 1)).forEach(function (e) {
        if (vals[e.name] === undefined) count++;
        vals[e.name] = e.value;
        dec = Math.max(dec, e.dec);
      });
      return count ? { label: chunk.slice(0, bar).trim(), vals: vals, dec: dec, count: count } : null;
    })
    .filter(Boolean)
    .slice(0, 8);
  if (!keys.length) keys.push({ label: '', vals: {}, dec: 0, count: 0 });
  // One year alone still races: the bars grow to it from nothing.
  if (keys.length === 1) keys.unshift({ label: keys[0].label, vals: {}, dec: 0, count: 0, ghost: true });
  const K = keys.length;
  const names = [];
  let dec = 0;
  let most = 1;
  keys.forEach(function (k) {
    dec = Math.max(dec, k.dec);
    most = Math.max(most, k.count);
    Object.keys(k.vals).forEach(function (n) {
      if (names.indexOf(n) < 0) names.push(n);
    });
  });
  const ROWS = Math.min(8, most);
  const AREA = 890;
  const rowH = Math.min(166, AREA / ROWS);
  const barMax = 856 - Math.round(rowH * 0.36 * 5.4);
  const ranks = keys.map(function (k) {
    const present = names
      .filter(function (n) {
        return k.vals[n] !== undefined;
      })
      .sort(function (a, b) {
        return k.vals[b] - k.vals[a];
      });
    const r = {};
    present.forEach(function (n, i) {
      r[n] = i;
    });
    let j = 0;
    names.forEach(function (n) {
      if (r[n] === undefined) r[n] = Math.max(ROWS, present.length) + j++;
    });
    return r;
  });
  const maxes = keys.map(function (k) {
    let m = 0;
    Object.keys(k.vals).forEach(function (n) {
      m = Math.max(m, k.vals[n]);
    });
    return m;
  });
  // A short race sits in the middle of the stage rather than at its top.
  const offset = Math.max(0, (AREA - ROWS * rowH) / 2);
  board.style.height = ROWS * rowH + 'px';
  slots.style.height = ROWS * rowH + 'px';
  board.style.top = offset + 'px';
  slots.style.top = offset + 'px';
  for (let i = 0; i < ROWS; i++) {
    const slot = document.createElement('div');
    slot.className = 'rc-slot' + (i === 0 ? ' rc-slot-1' : '');
    slot.style.top = i * rowH + 'px';
    slot.style.height = rowH - 14 + 'px';
    slot.style.fontSize = Math.round(rowH * 0.5) + 'px';
    slot.textContent = String(i + 1);
    slots.appendChild(slot);
  }
  const used = {};
  const bars = names.map(function (n) {
    const el = document.createElement('div');
    el.className = 'rc-bar';
    el.style.height = rowH - 14 + 'px';
    const color = colorFor(n, used);
    const name = document.createElement('div');
    name.className = 'rc-name';
    name.style.fontSize = Math.round(rowH * 0.32) + 'px';
    name.dataset.base = name.style.fontSize;
    name.dataset.fit = '20';
    name.textContent = n;
    const line = document.createElement('div');
    line.className = 'rc-line';
    line.style.height = Math.round(rowH * 0.4) + 'px';
    const fill = document.createElement('span');
    fill.className = 'rc-fill';
    fill.style.background = 'linear-gradient(90deg,' + color + 'cc,' + color + ')';
    fill.style.boxShadow = '0 0 26px ' + color + '66, inset 0 -6px 0 #00000033, inset 0 4px 0 #ffffff44';
    const val = document.createElement('span');
    val.className = 'rc-val';
    val.style.fontSize = Math.round(rowH * 0.36) + 'px';
    val.style.color = color;
    line.appendChild(fill);
    line.appendChild(val);
    el.appendChild(name);
    el.appendChild(line);
    board.appendChild(el);
    return { n: n, el: el, fill: fill, val: val };
  });
  const numeric = keys.every(function (k) {
    return /^-?\d{1,5}$/.test(k.label);
  });
  const year = root.querySelector('.rc-year');
  const fillRail = root.querySelector('.rc-rail-fill');
  const ticks = root.querySelector('.rc-ticks');
  keys.forEach(function (k, i) {
    if (k.ghost) return;
    const t = document.createElement('span');
    t.className = 'rc-tick';
    t.style.left = (K > 1 ? (i / (K - 1)) * 100 : 100) + '%';
    t.innerHTML = '<i></i><b></b>';
    t.querySelector('b').textContent = k.label;
    ticks.appendChild(t);
  });
  function paint(p) {
    p = Math.max(0, Math.min(1, p));
    const s = p * (K - 1);
    const i = Math.min(K - 2, Math.floor(s));
    let g = Math.max(0, Math.min(1, (s - i - 0.16) / 0.68));
    g = g * g * (3 - 2 * g);
    const max = maxes[i] + (maxes[i + 1] - maxes[i]) * g;
    bars.forEach(function (b) {
      const a = keys[i].vals[b.n] || 0;
      const z = keys[i + 1].vals[b.n] || 0;
      const value = a + (z - a) * g;
      const r = ranks[i][b.n] + (ranks[i + 1][b.n] - ranks[i][b.n]) * g;
      b.el.style.transform = 'translateY(' + (r * rowH).toFixed(2) + 'px)';
      b.el.style.opacity = String(Math.max(0, Math.min(1, ROWS - r)));
      b.el.style.zIndex = String(1000 - Math.round(r * 10));
      b.fill.style.width = (max > 0 ? Math.max(6, (value / max) * barMax) : 6).toFixed(1) + 'px';
      b.val.textContent = fmtNum(value, dec);
    });
    if (year) year.textContent = numeric ? String(Math.round(Number(keys[i].label) + (Number(keys[i + 1].label) - Number(keys[i].label)) * g)) : g < 0.5 ? keys[i].label : keys[i + 1].label;
    if (fillRail) fillRail.style.width = (p * 100).toFixed(2) + '%';
  }
  paint(0);
  return { paint: paint, K: K };
}

/** The standing board of one year: `v.data` as "🇺🇸 Mỹ:29.18,…" in rank order, rows and bars scaled to the first. */
function boardSetup(root, v) {
  const list = root.querySelector('.bd-rows');
  const entries = parseEntries(v.data).slice(0, 10);
  let dec = 0;
  let max = 0;
  entries.forEach(function (e) {
    dec = Math.max(dec, e.dec);
    max = Math.max(max, e.value);
  });
  if (entries.length > 5) list.classList.add('bd-compact');
  const used = {};
  entries.forEach(function (e, i) {
    const parts = splitName(e.name);
    const color = colorFor(e.name, used);
    const row = document.createElement('div');
    row.className = 'bd-row' + (i === 0 ? ' bd-first' : '');
    row.innerHTML = '<span class="bd-rank"></span><span class="bd-flag"></span><span class="bd-main"><span class="bd-top"><span class="bd-name" data-fit="26"></span><span class="bd-val"></span></span><span class="bd-track"><span class="bd-fill"></span></span></span>';
    row.querySelector('.bd-rank').textContent = String(i + 1);
    row.querySelector('.bd-flag').textContent = parts[0] || '•';
    row.querySelector('.bd-name').textContent = parts[1] || e.name;
    row.querySelector('.bd-val').textContent = fmtNum(e.value, dec);
    row.querySelector('.bd-val').style.color = color;
    const fill = row.querySelector('.bd-fill');
    fill.style.width = (max > 0 ? Math.max(2, (e.value / max) * 100) : 2) + '%';
    fill.style.background = 'linear-gradient(90deg,' + color + 'bb,' + color + ')';
    fill.style.boxShadow = '0 0 22px ' + color + '55';
    list.appendChild(row);
  });
}

const HELPERS = [driver, splitName, parseNum, decimalsOf, fmtNum, parseEntries, colorFor, fitText, fitAll].map((fn) => fn.toString()).join('\n');

/* ------------------------------------------------------------------------------------------------
 * The ground every scene stands on.
 * ---------------------------------------------------------------------------------------------- */

/** The score bug in the corner: what the scene is, on a slanted plate. Published as a component too. */
function scoreBug({ label = 'XẾP HẠNG', tag = 'TOP' } = {}) {
  return {
    name: 'score-bug',
    role: 'ui',
    description: 'The score bug of a broadcast: a slanted yellow plate with what the scene is, and a dark tag beside it.',
    css:
      '.sb{position:absolute;inset:0;display:flex;align-items:stretch;transform:skewX(-12deg)}' +
      `.sb-plate{display:flex;align-items:center;padding:0 24px;background:${ACCENT};color:#0a0f22;font-family:${DISPLAY};font-weight:900;font-size:31px;letter-spacing:.08em;line-height:1.2;white-space:nowrap}` +
      `.sb-tag{display:flex;align-items:center;padding:0 20px;background:#ffffff16;color:${INK};font-family:${DISPLAY};font-weight:800;font-size:27px;letter-spacing:.12em;line-height:1.2;white-space:nowrap;border:2px solid #ffffff22;border-left:0}` +
      '.sb-plate>span,.sb-tag>span{transform:skewX(12deg)}' +
      `.sb-dot{display:inline-block;width:14px;height:14px;border-radius:50%;background:${HOT};margin-right:12px;box-shadow:0 0 14px ${HOT}}`,
    markup: `<span class="sb"><span class="sb-plate"><span>${label}</span></span><span class="sb-tag"><span><i class="sb-dot"></i>${tag}</span></span></span>`,
    motion: `tl.fromTo(q('.sb'),{x:-60,opacity:0},{x:0,opacity:1,duration:.45,ease:'power3.out'},.05);`,
  };
}

const ground =
  // Room under the last line and over it, for descenders (g, y, p) and stacked Vietnamese accents, in boxes that clip.
  '#root .sp-name{padding-top:.1em;padding-bottom:.2em}#root .bd-name{padding-top:.08em;padding-bottom:.2em}#root .rc-name{padding-top:.08em;padding-bottom:.2em}' +
  `html,body{margin:0;background:${DARK}}*{box-sizing:border-box}` +
  `#root{position:absolute;inset:0;width:1080px;height:1920px;overflow:hidden;color:${INK};font-family:${BODY}}` +
  `.nc-backdrop{position:absolute;inset:0;background:radial-gradient(ellipse at 88% -4%,#24358a 0,#0d1640 40%,${DARK} 78%)}` +
  '.stripes{position:absolute;left:-300px;right:-300px;top:0;bottom:0;background:repeating-linear-gradient(115deg,#ffffff07 0 38px,transparent 38px 132px)}' +
  '.dots{position:absolute;inset:0;background-image:radial-gradient(#ffffff10 1.4px,transparent 1.6px);background-size:36px 36px;-webkit-mask-image:linear-gradient(180deg,transparent,#000 30%,#000 70%,transparent)}' +
  `.floor{position:absolute;left:0;right:0;bottom:0;height:420px;background:linear-gradient(180deg,transparent,${HOT}14)}` +
  `.sweep{position:absolute;top:-200px;bottom:-200px;left:-420px;width:280px;background:linear-gradient(90deg,transparent,${ACCENT}26,#ffffff30,${ACCENT}26,transparent);transform:skewX(-18deg);z-index:50;pointer-events:none}` +
  '.slot-bug{position:absolute;left:60px;top:76px;width:620px;height:58px}' +
  `.folio{position:absolute;right:60px;top:92px;color:${MUTED};font-family:${DISPLAY};font-weight:800;font-size:24px;letter-spacing:.24em;line-height:1.2}` +
  `.disp{font-family:${DISPLAY};text-transform:uppercase}` +
  `.src{position:absolute;left:60px;right:60px;top:1566px;height:56px;display:flex;align-items:center;gap:20px;border-top:2px solid ${LINE};padding-top:12px}` +
  `.src-tag{flex:none;color:${ACCENT};font-family:${DISPLAY};font-weight:800;font-size:22px;letter-spacing:.2em;line-height:1.3}` +
  `.src .source{flex:1;color:${MUTED};font-size:24px;line-height:1.4;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}`;

const backdrop = '<div class="stripes"></div><div class="dots"></div><div class="floor"></div><div class="sweep"></div>';
const bugSlot = (label, tag) => {
  const bug = scoreBug({ label, tag });
  return { css: bug.css, markup: `<span class="slot slot-bug">${bug.markup}</span>`, motion: bug.motion };
};
const srcLine = '<div class="src"><span class="src-tag">NGUỒN</span><span class="source"></span></div>';

/** The entrance every scene shares: the stripes drift for the whole scene, a light sweeps the glass once, the folio and source settle. */
const groundIn =
  `tl.fromTo(q('.stripes'),{x:0},{x:-140,duration:duration,ease:'none'},0);` +
  `tl.fromTo(q('.sweep'),{x:0},{x:1900,duration:1.1,ease:'power2.inOut'},.25);` +
  `tl.fromTo(q('.folio'),{opacity:0},{opacity:1,duration:.5,ease:'sine.out'},.2);` +
  `if(q('.src'))tl.fromTo(q('.src'),{opacity:0,y:14},{opacity:1,y:0,duration:.5,ease:'power2.out'},.9);`;

const secondsVar = { id: 'seconds', type: 'number', label: 'Length in seconds (the Assemble node gives it)', default: 4 };
const sourceVar = (sample, label = 'Where the figures come from, with the year', vi = 'Số liệu theo nguồn nào, kèm năm') => ({
  id: 'source',
  type: 'string',
  label,
  labels: { vi },
  default: 'Nguồn số liệu',
  sample,
  maxLength: 60,
  required: true,
});
const unitVar = (sample = 'nghìn tỷ USD') => ({
  id: 'unit',
  type: 'string',
  label: 'The unit the figures are in',
  labels: { vi: 'Đơn vị của số liệu' },
  default: '',
  sample,
  maxLength: 32,
});

const RACE_SAMPLE = [
  '1990|🇺🇸 Mỹ:5.96,🇯🇵 Nhật Bản:3.13,🇩🇪 Đức:1.60,🇫🇷 Pháp:1.27,🇮🇹 Ý:1.18,🇬🇧 Anh:1.09,🇨🇳 Trung Quốc:0.36,🇮🇳 Ấn Độ:0.32',
  '2000|🇺🇸 Mỹ:10.25,🇯🇵 Nhật Bản:4.97,🇩🇪 Đức:1.95,🇬🇧 Anh:1.67,🇫🇷 Pháp:1.37,🇨🇳 Trung Quốc:1.21,🇮🇹 Ý:1.15,🇮🇳 Ấn Độ:0.47',
  '2010|🇺🇸 Mỹ:15.05,🇨🇳 Trung Quốc:6.09,🇯🇵 Nhật Bản:5.76,🇩🇪 Đức:3.40,🇫🇷 Pháp:2.65,🇬🇧 Anh:2.49,🇮🇹 Ý:2.13,🇮🇳 Ấn Độ:1.68',
  '2020|🇺🇸 Mỹ:21.35,🇨🇳 Trung Quốc:14.86,🇯🇵 Nhật Bản:5.04,🇩🇪 Đức:3.89,🇬🇧 Anh:2.70,🇮🇳 Ấn Độ:2.67,🇫🇷 Pháp:2.64,🇮🇹 Ý:1.90',
  '2024|🇺🇸 Mỹ:29.18,🇨🇳 Trung Quốc:18.75,🇩🇪 Đức:4.66,🇯🇵 Nhật Bản:4.03,🇮🇳 Ấn Độ:3.89,🇬🇧 Anh:3.59,🇫🇷 Pháp:3.17,🇮🇹 Ý:2.38',
].join(';');

const hookBug = bugSlot('BẢNG XẾP HẠNG', 'TOP');
const raceBug = bugSlot('ĐUA TOP', 'TRỰC TIẾP');
const boardBug = bugSlot('BẢNG XẾP HẠNG', 'CHỐT SỔ');
const spotBug = bugSlot('TÂM ĐIỂM', 'NHÌN KỸ');
const closeBug = bugSlot('CHUNG CUỘC', 'HẾT GIỜ');

const scenes = {
  hook: {
    role: 'hook',
    description:
      'Cover: TOP and the count at poster size, a row of the contenders flags, the ranking’s name on a slanted yellow band, a one-line teaser, and the period as a scoreboard chip (1990 → 2024).',
    css:
      ground +
      hookBug.css +
      `.top-word{position:absolute;left:64px;top:214px;font-family:${DISPLAY};font-style:italic;font-weight:900;font-size:180px;line-height:1;letter-spacing:.02em;color:${INK}}` +
      `.count{position:absolute;left:44px;top:330px;font-family:${DISPLAY};font-style:italic;font-weight:900;font-size:640px;line-height:.84;letter-spacing:-.04em;color:${ACCENT};text-shadow:14px 14px 0 ${HOT},0 30px 80px #000c;white-space:nowrap}` +
      '.flags{position:absolute;right:60px;top:300px;width:260px;display:flex;flex-direction:column;gap:18px;align-items:flex-end}' +
      `.flag{width:120px;height:120px;border-radius:22px;background:#ffffff12;border:2px solid #ffffff26;display:flex;align-items:center;justify-content:center;font-size:76px;line-height:1;font-family:"Noto Color Emoji",sans-serif;box-shadow:0 14px 30px #0008}` +
      '.flag:nth-child(even){margin-right:120px;margin-top:-80px}' +
      '.stack{position:absolute;left:60px;right:60px;top:1000px;bottom:330px;display:flex;flex-direction:column;justify-content:center;gap:36px}' +
      `.band{align-self:flex-start;max-width:100%;transform:skewX(-8deg);background:${ACCENT};box-shadow:12px 12px 0 ${HOT};padding:18px 34px 14px}` +
      `.band .title{display:block;transform:skewX(8deg);margin:0;font-family:${DISPLAY};font-weight:900;font-size:104px;line-height:1.08;text-transform:uppercase;text-wrap:balance;color:#0a0f22;max-height:350px;overflow:hidden;padding-top:6px}` +
      `.teaser{margin:8px 0 0;font-size:44px;line-height:1.38;font-weight:700;color:${INK};max-height:190px;overflow:hidden}` +
      `.period{align-self:flex-start;display:flex;align-items:center;gap:22px;padding:10px 30px;border:3px solid ${ACCENT};border-radius:14px;background:#0a0f22cc;font-family:${DISPLAY};font-weight:800;font-size:64px;line-height:1.15;color:${INK};letter-spacing:.04em}` +
      `.period .tick{width:16px;height:16px;border-radius:50%;background:${HOT};box-shadow:0 0 16px ${HOT}}`,
    markup: `${backdrop}
      ${hookBug.markup}
      <span class="folio">NODECINE</span>
      <span class="top-word">TOP</span>
      <span class="count"></span>
      <div class="flags"></div>
      <div class="stack">
        <div class="band"><h1 class="title" data-fit="56" data-fit-box></h1></div>
        <p class="teaser detail" data-fit="30" data-fit-box></p>
        <div class="period"><i class="tick"></i><span class="period-text"></span></div>
      </div>`,
    motion:
      groundIn +
      hookBug.motion +
      `tl.fromTo(q('.top-word'),{x:-120,opacity:0},{x:0,opacity:1,duration:.5,ease:'power4.out'},.1);` +
      `tl.fromTo(q('.count'),{scale:1.7,opacity:0,transformOrigin:'20% 60%'},{scale:1,opacity:1,duration:.6,ease:'power4.out'},.22);` +
      `tl.fromTo(root.querySelectorAll('.flag'),{scale:0,rotation:-25},{scale:1,rotation:0,duration:.45,ease:'back.out(2)',stagger:.08},.55);` +
      `tl.fromTo(q('.band'),{clipPath:'inset(0 100% 0 0)'},{clipPath:'inset(0 0% 0 0)',duration:.55,ease:'power3.inOut'},.75);` +
      `tl.fromTo(q('.band .title'),{x:-40},{x:0,duration:.7,ease:'power3.out'},.8);` +
      `tl.fromTo(q('.teaser'),{y:30,opacity:0},{y:0,opacity:1,duration:.5,ease:'power2.out'},1.15);` +
      `if(q('.period'))tl.fromTo(q('.period'),{rotationX:-90,opacity:0,transformOrigin:'50% 0%'},{rotationX:0,opacity:1,duration:.5,ease:'back.out(1.6)'},1.35);` +
      `tl.fromTo(q('.count'),{y:0},{y:-24,duration:duration,ease:'none'},0);`,
    textKeys: ['title', 'detail'],
    extraScript:
      HELPERS +
      `var countEl=q('.count');var countText=String(v.count==null?'10':v.count).trim().replace(/^top\\s*/i,'');countEl.textContent=countText||'10';countEl.style.fontSize=[640,640,600,440][Math.min(3,countEl.textContent.length)]+'px';` +
      `var flagsEl=q('.flags');String(v.flags==null?'':v.flags).split(/[\\s,]+/).filter(Boolean).slice(0,6).forEach(function(f){var t=document.createElement('span');t.className='flag';t.textContent=f;flagsEl.appendChild(t)});` +
      `var periodText=String(v.period==null?'':v.period).trim();if(periodText)q('.period-text').textContent=periodText;else q('.period').style.display='none';` +
      `if(!String(v.detail==null?'':v.detail).trim())q('.teaser').style.display='none';fitAll(root);`,
    variables: [
      { id: 'count', type: 'string', label: 'How many the ranking counts: 5, 10…', labels: { vi: 'Bảng xếp hạng có bao nhiêu vị trí: 5, 10…' }, default: '10', sample: '8', maxLength: 3, required: true },
      {
        id: 'title',
        type: 'string',
        label: 'What is being ranked, in a few words',
        labels: { vi: 'Xếp hạng cái gì, vài chữ' },
        default: 'Bảng xếp hạng',
        sample: 'Nền kinh tế lớn nhất thế giới',
        maxLength: 44,
        required: true,
      },
      {
        id: 'detail',
        type: 'string',
        label: 'A one-line teaser: the question the film answers',
        labels: { vi: 'Một dòng gợi tò mò: câu hỏi mà phim trả lời' },
        default: '',
        sample: '34 năm, ai vượt lên, ai tụt hạng?',
        maxLength: 70,
      },
      { id: 'period', type: 'string', label: 'The period, as "1990 → 2024", or one year, or empty', labels: { vi: 'Giai đoạn, dạng "1990 → 2024", hoặc một năm, hoặc để trống' }, default: '', sample: '1990 → 2024', maxLength: 24 },
      {
        id: 'flags',
        type: 'string',
        label: 'Up to six flag emoji of the contenders, separated by spaces, or empty',
        labels: { vi: 'Tối đa sáu cờ (emoji) của các ứng viên, cách nhau bằng dấu cách, hoặc để trống' },
        default: '',
        sample: '🇺🇸 🇨🇳 🇯🇵 🇩🇪 🇮🇳 🇬🇧',
        maxLength: 60,
      },
      secondsVar,
    ],
  },
  race: {
    role: 'feature',
    description:
      'THE BAR CHART RACE: up to 8 contenders racing across up to 8 years. Bars grow, overtake and swap places while a big year counter ticks; it plays over the whole scene, so give it 2–3 sentences of voice-over. data is YEAR|🇺🇸 Name:value,🇯🇵 Name:value;YEAR|… with dot decimals and no thousands separators.',
    css:
      ground +
      raceBug.css +
      `.rc-head{position:absolute;left:60px;right:60px;top:160px}` +
      `.rc-head .title{display:block;margin:0;font-family:${DISPLAY};font-weight:900;font-size:80px;line-height:1.08;text-transform:uppercase;text-wrap:balance;color:${INK};max-height:182px;overflow:hidden;padding-top:6px}` +
      `.rc-unit{margin-top:10px;display:flex;align-items:center;gap:16px;color:${MUTED};font-size:28px;font-weight:600;line-height:1.4}` +
      `.rc-unit b{color:${ACCENT};font-family:${DISPLAY};font-weight:800;letter-spacing:.18em;font-size:24px}` +
      '.rc-stage{position:absolute;left:0;right:0;top:440px;height:890px}' +
      '.rc-slots{position:absolute;left:60px;top:0;width:88px}' +
      `.rc-slot{position:absolute;left:0;width:88px;display:flex;align-items:center;justify-content:center;background:#ffffff10;border:2px solid #ffffff1c;border-radius:12px;font-family:${DISPLAY};font-weight:900;font-style:italic;color:${INK};line-height:1}` +
      `.rc-slot-1{background:${ACCENT};border-color:${ACCENT};color:#0a0f22;box-shadow:0 0 30px ${ACCENT}66}` +
      '.rc-board{position:absolute;left:166px;width:856px;top:0}' +
      '.rc-bar{position:absolute;left:0;top:0;width:856px;display:flex;flex-direction:column;justify-content:center;gap:4px;will-change:transform}' +
      `.rc-name{font-family:${DISPLAY};font-weight:800;color:${INK};line-height:1.2;white-space:nowrap;overflow:hidden;width:856px;padding-top:2px}` +
      '.rc-line{display:flex;align-items:center;gap:14px}' +
      '.rc-fill{display:block;height:100%;border-radius:0 10px 10px 0}' +
      `.rc-val{font-family:${DISPLAY};font-weight:900;font-style:italic;line-height:1;white-space:nowrap;text-shadow:0 4px 18px #000c}` +
      '.rc-foot{position:absolute;left:60px;right:60px;top:1360px;height:196px}' +
      '.rc-rail{position:absolute;left:0;width:470px;top:96px;height:10px;border-radius:5px;background:#ffffff18}' +
      `.rc-rail-fill{display:block;height:100%;width:0;border-radius:5px;background:linear-gradient(90deg,${HOT},${ACCENT});box-shadow:0 0 18px ${ACCENT}88}` +
      '.rc-ticks{position:absolute;left:0;width:470px;top:96px;height:10px}' +
      `.rc-tick{position:absolute;top:0}.rc-tick i{position:absolute;left:-7px;top:-5px;width:14px;height:20px;border-radius:4px;background:${INK}}` +
      `.rc-tick b{position:absolute;left:0;top:26px;transform:translateX(-50%);color:${MUTED};font-family:${DISPLAY};font-weight:800;font-size:24px;letter-spacing:.06em;white-space:nowrap}` +
      `.rc-yearbox{position:absolute;right:0;top:-10px;text-align:right}` +
      `.rc-yearlabel{display:block;color:${MUTED};font-family:${DISPLAY};font-weight:800;font-size:24px;letter-spacing:.28em;line-height:1.2}` +
      `.rc-year{display:block;font-family:${DISPLAY};font-weight:900;font-style:italic;font-size:200px;line-height:.92;color:${INK};letter-spacing:-.02em;text-shadow:8px 8px 0 ${HOT}}`,
    markup: `${backdrop}
      ${raceBug.markup}
      <span class="folio">NODECINE</span>
      <div class="rc-head"><h1 class="title" data-fit="50" data-fit-box></h1><div class="rc-unit"><b>ĐƠN VỊ</b><span class="unit"></span></div></div>
      <div class="rc-stage"><div class="rc-slots"></div><div class="rc-board"></div></div>
      <div class="rc-foot"><div class="rc-rail"><span class="rc-rail-fill"></span></div><div class="rc-ticks"></div><div class="rc-yearbox"><span class="rc-yearlabel">NĂM</span><span class="rc-yearpunch"><span class="rc-year"></span></span></div></div>
      ${srcLine}`,
    motion:
      groundIn +
      raceBug.motion +
      `tl.fromTo(q('.rc-head'),{y:-30,opacity:0},{y:0,opacity:1,duration:.5,ease:'power3.out'},.1);` +
      `tl.fromTo(root.querySelectorAll('.rc-slot'),{x:-70,opacity:0},{x:0,opacity:1,duration:.4,ease:'power3.out',stagger:.045},.2);` +
      `tl.fromTo(q('.rc-board'),{x:60,opacity:0},{x:0,opacity:1,duration:.5,ease:'power3.out'},.3);` +
      `tl.fromTo(q('.rc-foot'),{y:40,opacity:0},{y:0,opacity:1,duration:.5,ease:'power3.out'},.4);` +
      // The race itself: one tween of a plain number, read by paint(). It is the timeline that moves the board, so a seek lands on the right frame.
      `var raceAt=.8;var raceEnd=Math.max(raceAt+1,duration-.45);` +
      `tl.to(driver(RACE.paint),{p:1,duration:raceEnd-raceAt,ease:'none'},raceAt);` +
      // Each year the counter lands on, it punches.
      `for(var yk=1;yk<RACE.K;yk++){var yt=raceAt+(raceEnd-raceAt)*((yk-1+.84)/(RACE.K-1));tl.fromTo(q('.rc-yearpunch'),{scale:1.12},{scale:1,duration:.35,ease:'power2.out',immediateRender:false},yt)}`,
    textKeys: ['title', 'unit', 'source'],
    extraScript:
      HELPERS +
      raceSetup.toString() +
      `q('.rc-yearpunch').style.display='inline-block';q('.rc-yearpunch').style.transformOrigin='100% 80%';` +
      `if(!String(v.unit==null?'':v.unit).trim())q('.rc-unit').style.display='none';` +
      'var RACE=raceSetup(root,v);fitAll(root);',
    variables: [
      {
        id: 'title',
        type: 'string',
        label: 'What is racing, in a few words',
        labels: { vi: 'Cuộc đua về cái gì, vài chữ' },
        default: 'Cuộc đua xếp hạng',
        sample: 'GDP danh nghĩa các nền kinh tế',
        maxLength: 44,
        required: true,
      },
      {
        id: 'data',
        type: 'string',
        label: 'The race: "YEAR|🇺🇸 Name:value,🇯🇵 Name:value;YEAR|…" — 2 to 8 years in order, up to 8 contenders, the same name spelled the same in every year, dot decimals, no thousands separators',
        labels: { vi: 'Dữ liệu cuộc đua: "NĂM|🇺🇸 Tên:giá trị,🇯🇵 Tên:giá trị;NĂM|…" — 2 đến 8 mốc năm theo thứ tự, tối đa 8 ứng viên, tên viết giống hệt nhau ở mọi năm, số thập phân dùng dấu chấm, không dùng dấu phân cách hàng nghìn' },
        default: '2000|A:1,B:2;2020|A:3,B:2.5',
        sample: RACE_SAMPLE,
        maxLength: 1600,
        required: true,
      },
      unitVar(),
      sourceVar('IMF World Economic Outlook, 4/2025'),
      secondsVar,
    ],
  },
  board: {
    role: 'feature',
    description:
      'The standing board of one year: up to 10 rows in rank order (5 or fewer get big rows), each with its rank, flag, name, value and a bar scaled to the leader; rows land one by one from the bottom up. data is 🇺🇸 Name:value,🇨🇳 Name:value.',
    css:
      ground +
      boardBug.css +
      `.bd-head{position:absolute;left:60px;right:60px;top:170px}` +
      `.bd-head .title{display:block;margin:0;font-family:${DISPLAY};font-weight:900;font-size:84px;line-height:1.1;text-transform:uppercase;text-wrap:balance;color:${INK};max-height:190px;overflow:hidden;padding-top:6px}` +
      `.bd-meta{margin-top:12px;display:flex;align-items:center;gap:16px;color:${MUTED};font-size:28px;font-weight:600;line-height:1.4}` +
      `.bd-year{padding:2px 16px;border-radius:8px;background:${HOT};color:#fff;font-family:${DISPLAY};font-weight:900;font-size:32px;letter-spacing:.06em;line-height:1.25}` +
      '.bd-rows{position:absolute;left:60px;right:60px;top:430px;bottom:380px;display:flex;flex-direction:column;justify-content:center;gap:22px}' +
      '.bd-row{display:flex;align-items:center;gap:22px;height:190px;padding:0 26px 0 0;background:linear-gradient(90deg,#ffffff12,#ffffff06);border:2px solid #ffffff16;border-radius:18px;overflow:hidden}' +
      `.bd-first{border-color:${ACCENT}aa;background:linear-gradient(90deg,${ACCENT}26,#ffffff08)}` +
      `.bd-rank{flex:none;width:130px;height:100%;display:flex;align-items:center;justify-content:center;background:#ffffff10;font-family:${DISPLAY};font-weight:900;font-style:italic;font-size:110px;line-height:1;color:${INK}}` +
      `.bd-first .bd-rank{background:${ACCENT};color:#0a0f22}` +
      '.bd-flag{flex:none;width:96px;text-align:center;font-family:"Noto Color Emoji",sans-serif;font-size:78px;line-height:1}' +
      '.bd-main{flex:1;min-width:0;display:flex;flex-direction:column;gap:14px}' +
      '.bd-top{display:flex;align-items:baseline;gap:16px}' +
      `.bd-name{flex:1;min-width:0;font-family:${DISPLAY};font-weight:800;font-size:58px;line-height:1.2;white-space:nowrap;overflow:hidden;color:${INK};padding-top:4px}` +
      `.bd-val{flex:none;font-family:${DISPLAY};font-weight:900;font-style:italic;font-size:66px;line-height:1.1}` +
      '.bd-track{display:block;height:24px;border-radius:12px;background:#ffffff12;overflow:hidden}' +
      '.bd-fill{display:block;height:100%;border-radius:12px}' +
      '.bd-compact{gap:12px}.bd-compact .bd-row{height:98px;border-radius:12px}.bd-compact .bd-rank{width:90px;font-size:62px}' +
      '.bd-compact .bd-flag{width:64px;font-size:48px}.bd-compact .bd-main{gap:6px}.bd-compact .bd-name{font-size:38px}.bd-compact .bd-val{font-size:42px}.bd-compact .bd-track{height:14px}',
    markup: `${backdrop}
      ${boardBug.markup}
      <span class="folio">NODECINE</span>
      <div class="bd-head"><h1 class="title" data-fit="50" data-fit-box></h1><div class="bd-meta"><span class="bd-year year"></span><span class="unit"></span></div></div>
      <div class="bd-rows"></div>
      ${srcLine}`,
    motion:
      groundIn +
      boardBug.motion +
      `tl.fromTo(q('.bd-head'),{y:-30,opacity:0},{y:0,opacity:1,duration:.5,ease:'power3.out'},.1);` +
      `var bdRows=root.querySelectorAll('.bd-row');var bdStep=Math.min(.22,1.5/Math.max(1,bdRows.length));` +
      `tl.fromTo(bdRows,{x:-90,opacity:0},{x:0,opacity:1,duration:.45,ease:'power3.out',stagger:{each:bdStep,from:'end'}},.35);` +
      `tl.fromTo(root.querySelectorAll('.bd-fill'),{scaleX:0,transformOrigin:'left center'},{scaleX:1,duration:.7,ease:'power3.out',stagger:{each:bdStep,from:'end'}},.5);` +
      `if(bdRows[0])tl.fromTo(bdRows[0].querySelector('.bd-rank'),{scale:1.5},{scale:1,duration:.5,ease:'back.out(2)'},.35+bdStep*(bdRows.length-1)+.1);`,
    textKeys: ['title', 'year', 'unit', 'source'],
    extraScript:
      HELPERS +
      boardSetup.toString() +
      'boardSetup(root,v);' +
      `if(!String(v.year==null?'':v.year).trim())q('.bd-year').style.display='none';fitAll(root);`,
    variables: [
      {
        id: 'title',
        type: 'string',
        label: 'What the board ranks, in a few words',
        labels: { vi: 'Bảng xếp hạng cái gì, vài chữ' },
        default: 'Bảng xếp hạng',
        sample: 'Top 5 nền kinh tế 2024',
        maxLength: 44,
        required: true,
      },
      {
        id: 'data',
        type: 'string',
        label: 'The rows in rank order: "🇺🇸 Name:value,🇨🇳 Name:value" — 3 to 10 rows, dot decimals, no thousands separators',
        labels: { vi: 'Các dòng theo thứ hạng: "🇺🇸 Tên:giá trị,🇨🇳 Tên:giá trị" — 3 đến 10 dòng, số thập phân dùng dấu chấm, không dùng dấu phân cách hàng nghìn' },
        default: 'A:3,B:2,C:1',
        sample: '🇺🇸 Mỹ:29.18,🇨🇳 Trung Quốc:18.75,🇩🇪 Đức:4.66,🇯🇵 Nhật Bản:4.03,🇮🇳 Ấn Độ:3.89',
        maxLength: 400,
        required: true,
      },
      { id: 'year', type: 'string', label: 'The year the board stands at, or empty', labels: { vi: 'Năm của bảng, hoặc để trống' }, default: '', sample: '2024', maxLength: 12 },
      unitVar(),
      sourceVar('IMF World Economic Outlook, 4/2025'),
      secondsVar,
    ],
  },
  spotlight: {
    role: 'feature',
    description:
      'Spotlight on one contender: the #1, or the surprise of the ranking. Its flag in a ring, its rank stamped on, its name, its value at scoreboard size with the unit, and one line why it matters.',
    css:
      ground +
      spotBug.css +
      `.ghost{position:absolute;right:-40px;top:120px;font-family:${DISPLAY};font-weight:900;font-style:italic;font-size:760px;line-height:.9;color:transparent;-webkit-text-stroke:4px #ffffff1a;letter-spacing:-.04em;white-space:nowrap}` +
      `.kick{position:absolute;left:60px;top:200px;padding:8px 22px;background:${HOT};color:#fff;font-family:${DISPLAY};font-weight:900;font-size:38px;letter-spacing:.14em;line-height:1.25;transform:skewX(-10deg);box-shadow:8px 8px 0 #0008}` +
      '.ring{position:absolute;left:50%;top:330px;width:400px;height:400px;margin-left:-200px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:radial-gradient(circle at 50% 40%,#ffffff22,#ffffff06 70%);border:10px solid var(--c,#ffd60a);box-shadow:0 0 0 14px #ffffff10,0 0 90px var(--c,#ffd60a)}' +
      '.ring-flag{font-family:"Noto Color Emoji",sans-serif;font-size:220px;line-height:1}' +
      `.ring-rank{font-family:${DISPLAY};font-weight:900;font-style:italic;font-size:220px;line-height:1;color:${INK}}` +
      `.medal{position:absolute;left:50%;top:620px;margin-left:110px;width:170px;height:170px;border-radius:50%;background:${ACCENT};color:#0a0f22;display:flex;align-items:center;justify-content:center;font-family:${DISPLAY};font-weight:900;font-style:italic;font-size:92px;line-height:1;border:8px solid ${DARK};box-shadow:0 14px 34px #000a}` +
      '.sp-stack{position:absolute;left:60px;right:60px;top:810px;bottom:370px;display:flex;flex-direction:column;align-items:center;text-align:center;gap:10px}' +
      `.sp-name{margin:0;font-family:${DISPLAY};font-weight:900;font-size:124px;line-height:1.12;text-transform:uppercase;text-wrap:balance;color:${INK};max-height:150px;width:100%;overflow:hidden;white-space:nowrap;padding-top:6px}` +
      `.sp-value{font-family:${DISPLAY};font-weight:900;font-style:italic;font-size:220px;line-height:.98;color:var(--c,${ACCENT});text-shadow:0 0 60px #0009;white-space:nowrap;max-width:100%;overflow:hidden}` +
      `.sp-unit{color:${MUTED};font-family:${DISPLAY};font-weight:800;font-size:40px;letter-spacing:.14em;line-height:1.25;text-transform:uppercase}` +
      `.sp-stack .detail{margin:16px 0 0;font-size:40px;line-height:1.42;font-weight:600;color:${INK};max-height:180px;overflow:hidden}`,
    markup: `${backdrop}
      ${spotBug.markup}
      <span class="folio">NODECINE</span>
      <span class="ghost"></span>
      <span class="kick label"></span>
      <div class="ring"><span class="ring-flag"></span></div>
      <span class="medal"></span>
      <div class="sp-stack"><h1 class="sp-name" data-fit="56"></h1><span class="sp-value" data-fit="100"></span><span class="sp-unit unit"></span><p class="detail" data-fit="28" data-fit-box></p></div>
      ${srcLine}`,
    motion:
      groundIn +
      spotBug.motion +
      `tl.fromTo(q('.ghost'),{x:120,opacity:0},{x:0,opacity:1,duration:.9,ease:'power3.out'},0);` +
      `tl.fromTo(q('.ghost'),{y:0},{y:-40,duration:duration,ease:'none',immediateRender:false},0);` +
      `if(q('.kick'))tl.fromTo(q('.kick'),{x:-80,opacity:0},{x:0,opacity:1,duration:.45,ease:'power3.out'},.2);` +
      `tl.fromTo(q('.ring'),{scale:.3,opacity:0,rotation:-40},{scale:1,opacity:1,rotation:0,duration:.7,ease:'back.out(1.5)'},.25);` +
      `tl.fromTo(q('.ring>span'),{scale:.4},{scale:1,duration:.6,ease:'back.out(2.2)'},.4);` +
      `tl.fromTo(q('.medal'),{scale:2.2,opacity:0,rotation:-30},{scale:1,opacity:1,rotation:-8,duration:.45,ease:'power4.out'},.75);` +
      `tl.fromTo(q('.sp-name'),{y:40,opacity:0},{y:0,opacity:1,duration:.5,ease:'power3.out'},.6);` +
      `tl.fromTo(q('.sp-value'),{scale:.6,opacity:0},{scale:1,opacity:1,duration:.5,ease:'back.out(1.8)'},.8);` +
      `if(spNum!==null){var spValEl=q('.sp-value');tl.fromTo(driver(function(p){spValEl.textContent=p>=1?spText:fmtNum(spNum*p,spDec)}),{p:0},{p:1,duration:1,ease:'power2.out',immediateRender:false},.8)}` +
      `tl.fromTo(q('.sp-unit'),{opacity:0},{opacity:1,duration:.4,ease:'sine.out'},1.1);` +
      `tl.fromTo(q('.sp-stack .detail'),{y:24,opacity:0},{y:0,opacity:1,duration:.5,ease:'power2.out'},1.3);`,
    textKeys: ['detail', 'unit', 'source', 'label'],
    extraScript:
      HELPERS +
      `var spParts=splitName(v.name==null?'':v.name);var spRank=String(v.rank==null?'1':v.rank).replace(/^#/,'').trim()||'1';` +
      `q('.sp-name').textContent=spParts[1]||String(v.name||'');` +
      `q('.ghost').textContent='#'+spRank;q('.medal').textContent='#'+spRank;` +
      `var ringSpan=q('.ring-flag');if(spParts[0])ringSpan.textContent=spParts[0];else{ringSpan.className='ring-rank';ringSpan.textContent='#'+spRank;q('.medal').style.display='none'}` +
      `var spColor=colorFor(String(v.name||''));if(spRank==='1')spColor='${ACCENT}';root.style.setProperty('--c',spColor);` +
      `var spText=String(v.value==null?'':v.value).trim();q('.sp-value').textContent=spText;` +
      `var spNum=/^[0-9.,\\s]+$/.test(spText)?parseNum(spText):NaN;var spDec=decimalsOf(spText);if(!isFinite(spNum))spNum=null;` +
      `if(spNum!==null&&spText.indexOf('.')>=0&&spText.indexOf(',')<0&&spText.split('.').pop().length===3)spNum=null;` +
      `if(!String(v.label==null?'':v.label).trim())q('.kick').style.display='none';` +
      `if(!String(v.unit==null?'':v.unit).trim())q('.sp-unit').style.display='none';fitAll(root);`,
    variables: [
      {
        id: 'label',
        type: 'string',
        label: 'A few words over the spotlight: SỐ 1 THẾ GIỚI, BẤT NGỜ, CÚ BỨT PHÁ…, or empty',
        labels: { vi: 'Vài chữ trên đầu: SỐ 1 THẾ GIỚI, BẤT NGỜ, CÚ BỨT PHÁ…, hoặc để trống' },
        default: '',
        sample: 'CÚ BỨT PHÁ',
        maxLength: 22,
      },
      { id: 'rank', type: 'string', label: 'Its rank: 1, 2, 3…', labels: { vi: 'Thứ hạng: 1, 2, 3…' }, default: '1', sample: '5', maxLength: 3, required: true },
      { id: 'name', type: 'string', label: 'Its flag emoji and name, as "🇮🇳 Ấn Độ"', labels: { vi: 'Cờ (emoji) và tên, dạng "🇮🇳 Ấn Độ"' }, default: 'Số 1', sample: '🇮🇳 Ấn Độ', maxLength: 30, required: true },
      { id: 'value', type: 'string', label: 'Its figure, as the source prints it ("3,89")', labels: { vi: 'Con số, đúng như nguồn ghi ("3,89")' }, default: '', sample: '3,89', maxLength: 12, required: true },
      unitVar(),
      {
        id: 'detail',
        type: 'string',
        label: 'One line: why it is here',
        labels: { vi: 'Một dòng: vì sao đáng chú ý' },
        default: 'Vì sao đáng chú ý, trong một dòng.',
        sample: 'Năm 1990 còn xếp sau cả Ý; đến 2024 đã vượt Anh và Pháp.',
        maxLength: 90,
        required: true,
      },
      sourceVar('IMF World Economic Outlook, 4/2025'),
      secondsVar,
    ],
  },
  close: {
    role: 'outro',
    description: 'Closing: the takeaway of the ranking at headline size under a trophy, and one question for the viewer to think about, in a box.',
    css:
      ground +
      closeBug.css +
      '.trophy{position:absolute;right:60px;top:170px;font-family:"Noto Color Emoji",sans-serif;font-size:200px;line-height:1;filter:drop-shadow(0 20px 40px #000a)}' +
      `.cl-kick{position:absolute;left:60px;top:250px;color:${ACCENT};font-family:${DISPLAY};font-weight:800;font-size:34px;letter-spacing:.24em;line-height:1.3}` +
      `.cl-rule{position:absolute;left:60px;top:310px;width:180px;height:10px;background:${HOT};transform:skewX(-20deg)}` +
      '.cl-stack{position:absolute;left:60px;right:60px;top:420px;bottom:380px;display:flex;flex-direction:column;justify-content:center;gap:70px}' +
      `.cl-stack .title{margin:0;font-family:${DISPLAY};font-weight:900;font-size:120px;line-height:1.1;text-transform:uppercase;text-wrap:balance;color:${INK};max-height:540px;overflow:hidden;padding-top:8px}` +
      `.cl-stack .title em{font-style:normal;color:${ACCENT}}` +
      `.ask{position:relative;display:flex;gap:30px;align-items:flex-start;padding:36px 40px 36px 36px;background:#ffffff0e;border:2px solid #ffffff1c;border-left:14px solid ${ACCENT};border-radius:18px}` +
      `.ask-mark{flex:none;width:96px;height:96px;border-radius:50%;background:${HOT};color:#fff;display:flex;align-items:center;justify-content:center;font-family:${DISPLAY};font-weight:900;font-size:76px;line-height:1;box-shadow:0 0 30px ${HOT}88}` +
      `.ask .detail{margin:0;flex:1;font-size:46px;line-height:1.4;font-weight:700;color:${INK};max-height:330px;overflow:hidden}`,
    markup: `${backdrop}
      ${closeBug.markup}
      <span class="folio">NODECINE</span>
      <span class="trophy">🏆</span>
      <span class="cl-kick">ĐIỀU ĐÁNG NHỚ</span><i class="cl-rule"></i>
      <div class="cl-stack"><h1 class="title" data-fit="56" data-fit-box></h1><div class="ask"><span class="ask-mark">?</span><p class="detail" data-fit="30" data-fit-box></p></div></div>
      ${srcLine}`,
    motion:
      groundIn +
      closeBug.motion +
      `tl.fromTo(q('.trophy'),{y:-260,rotation:-20,opacity:0},{y:0,rotation:0,opacity:1,duration:.7,ease:'bounce.out'},.15);` +
      `tl.fromTo(q('.cl-kick'),{x:-40,opacity:0},{x:0,opacity:1,duration:.45,ease:'power3.out'},.25);` +
      `tl.fromTo(q('.cl-rule'),{scaleX:0,transformOrigin:'left center'},{scaleX:1,duration:.45,ease:'power3.out'},.35);` +
      `tl.fromTo(q('.cl-stack .title'),{y:60,opacity:0},{y:0,opacity:1,duration:.6,ease:'power4.out'},.45);` +
      `tl.fromTo(q('.ask'),{x:120,opacity:0},{x:0,opacity:1,duration:.55,ease:'power3.out'},.95);` +
      `tl.fromTo(q('.ask-mark'),{scale:0,rotation:-90},{scale:1,rotation:0,duration:.5,ease:'back.out(2.4)'},1.15);`,
    textKeys: ['title', 'detail', 'source'],
    extraScript: HELPERS + 'fitAll(root);',
    variables: [
      {
        id: 'title',
        type: 'string',
        label: 'The takeaway of the ranking, in one short sentence',
        labels: { vi: 'Điều đáng nhớ của bảng xếp hạng, một câu ngắn' },
        default: 'Điều đáng nhớ',
        sample: 'Ngôi đầu chưa đổi, nhưng phía sau đã khác hẳn',
        maxLength: 60,
        required: true,
      },
      {
        id: 'detail',
        type: 'string',
        label: 'One question for the viewer to think about (not "share", "like" or "follow")',
        labels: { vi: 'Một câu hỏi để người xem suy nghĩ (không kêu gọi chia sẻ, thích hay theo dõi)' },
        default: 'Bạn nghĩ thứ hạng sẽ thay đổi thế nào?',
        sample: 'Đến năm 2035, ai sẽ đứng ở vị trí thứ ba?',
        maxLength: 110,
        required: true,
      },
      sourceVar('IMF World Economic Outlook, 4/2025'),
      secondsVar,
    ],
  },
};

const GUIDE = `---
first: hook
last: outro
repeat: 2
---
Làm một video tiếng Việt, dọc 9:16, khoảng 50–70 giây, về bảng xếp hạng trong Brief: top nền kinh tế, quốc gia đông dân, thương hiệu giá trị nhất, cầu thủ ghi bàn nhiều nhất… Giọng dẫn hào hứng như bình luận viên thể thao, câu ngắn, có nhịp, nhưng mọi con số phải đúng.
Chỉ dùng số liệu Research tìm được, kèm nguồn và năm của số liệu. Không bịa, không làm tròn khác nguồn, không tự nội suy một năm còn thiếu: năm nào không có số thì bỏ năm đó, dùng ít mốc hơn. Hai nguồn khác nhau thì chọn một và dùng nhất quán cho cả bảng.
Thứ tự gợi ý:
1. hook (rank-hook): count là số vị trí (5, 10…), title là xếp hạng cái gì (vài chữ), detail là câu hỏi gợi tò mò, period dạng "1990 → 2024", flags là tối đa sáu cờ emoji cách nhau bằng dấu cách.
2. rank-race: cảnh chính của phim, cuộc đua biểu đồ thanh. Lời đọc cho cảnh này dài 2–3 câu (khoảng 12–18 giây) để cuộc đua có thời gian chạy: kể ai dẫn đầu lúc đầu, ai vượt lên, ai tụt lại. data dạng "1990|🇺🇸 Mỹ:5.96,🇯🇵 Nhật Bản:3.13;2000|🇺🇸 Mỹ:10.25,…": 2 đến 8 mốc năm theo thứ tự thời gian, mỗi mốc tối đa 8 ứng viên, cờ emoji trước tên, tên viết giống hệt nhau ở mọi mốc, số thập phân dùng dấu chấm, không dùng dấu phân cách hàng nghìn. unit là đơn vị (ví dụ "nghìn tỷ USD", "triệu người"); mọi mốc cùng một đơn vị.
3. rank-board: bảng chốt của một năm (thường là năm mới nhất), 3–10 dòng theo đúng thứ hạng, data dạng "🇺🇸 Mỹ:29.18,🇨🇳 Trung Quốc:18.75". Có thể bỏ cảnh này khi rank-race đã đủ.
4. rank-spotlight: một hoặc hai cảnh soi kỹ số 1 hoặc một ứng viên gây bất ngờ: label vài chữ (SỐ 1 THẾ GIỚI, BẤT NGỜ, CÚ BỨT PHÁ), rank, name dạng "🇮🇳 Ấn Độ", value đúng như nguồn ghi (dấu phẩy thập phân kiểu Việt Nam, ví dụ "3,89"), một dòng vì sao đáng chú ý dựa trên số liệu.
5. outro (rank-close): title là điều đáng nhớ rút ra từ bảng xếp hạng, detail là một câu hỏi để người xem suy nghĩ. Không kêu gọi chia sẻ, thích, bình luận hay theo dõi.
Mỗi cảnh có số liệu mang source (tối đa 60 ký tự): tên tổ chức và năm công bố, ví dụ "IMF World Economic Outlook, 4/2025", "Liên Hợp Quốc · World Population Prospects 2024", "Brand Finance Global 500, 2025". Lời đọc nhắc nguồn ít nhất một lần.
Số liệu ước tính hay dự báo thì nói rõ là ước tính. Không so sánh hơn kém khi bảng không có số chống đỡ; không dùng từ ngữ miệt thị quốc gia, dân tộc hay cầu thủ.`;

// Keep the workflow JSON in sync with the five scenes, the component this kit publishes, and the guide.
await editComposition(new URL('./workflow.json', import.meta.url), (files) => {
  for (const key of Object.keys(files)) delete files[key];
  // The shell the Studio previews and the inspector lints, until a run has Assemble write the entry.
  files['index.html'] = filmShell({ id: 'ranking-shell', background: DARK });
  for (const [kind, scene] of Object.entries(scenes)) files[`compositions/rank-${kind}.html`] = sceneBlock({ ...scene, id: `rank-${kind}`, seconds: 4, fonts: FONTS });
  // Published, not pasted: a writer may mount the score bug into a frame of its own.
  files['compositions/components/score-bug.html'] = component({ ...scoreBug({ label: 'BẢNG XẾP HẠNG', tag: 'TOP' }), fonts: FONTS });
  files['storyboard-guide.md'] = GUIDE;
});
