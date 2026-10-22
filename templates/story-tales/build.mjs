import { editComposition, filmShell, sceneBlock } from '../_kit/build.mjs';

/**
 * Illustrated tales as a living storybook.
 *
 * Not a slideshow: every scene stands in a paper-cut landscape that is drawn, not shipped. The writer
 * names a setting ("đêm trăng", "mưa", "rừng", "làng quê", "biển", "thành phố", "cung điện") and the
 * scene's own script cuts that landscape out of layered SVG — far hills, a middle ground, a stage the
 * characters stand on — from a seed made of the setting and the scene's words, so the same storyboard
 * draws the same picture every time and two scenes in the same village are not the same picture. The
 * layers rise like the pages of a pop-up book, then drift at their own depth for the whole scene, and
 * what lives in the air (stars, rain, fireflies, birds, lanterns, waves) moves on the same paused
 * timeline, so every frame is seekable.
 *
 * Characters are the system's own emoji, set large on the stage as puppets that breathe; the text sits
 * on torn paper. Five blocks: the title page, a passage of the tale (the one that repeats), two
 * characters talking, the turning point with a change of light, and the moral with where the tale is
 * told.
 */

const W = 1920;
const H = 1080;
const PAPER = '#f6ead0';
const INK = '#3a2414';
const RUST = '#a2401f';
const CREAM = '#fff3d8';
const GOLD = '#f0c56a';

/** Lora for the telling and Be Vietnam Pro for the small labels: both carry the Vietnamese alphabet. */
const FONTS = 'https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,500;0,700;1,500;1,600&family=Be+Vietnam+Pro:wght@600;800&family=Noto+Color+Emoji&display=swap';

/**
 * The landscape, cut from paper. Runs inside the scene (it is written into the page as source), so it
 * is plain browser JavaScript: it takes the setting and a seed and returns the SVG layers as markup.
 * Every random number comes from the seed.
 */
function paintScenery(setting, seedText) {
  var LW = 2240;
  var LH = 1080;
  var s = String(setting || '').toLowerCase();
  var kind = /cung|điện|hoàng|vua|kinh thành|lâu đài|palace/.test(s)
    ? 'palace'
    : /mưa|bão|giông|rain/.test(s)
      ? 'rain'
      : /rừng|núi|forest/.test(s)
        ? 'forest'
        : /biển|sông|hồ|thuyền|đảo|sea/.test(s)
          ? 'sea'
          : /làng|quê|đồng|ruộng|chợ|village/.test(s)
            ? 'village'
            : /thành phố|phố|đô thị|city/.test(s)
              ? 'city'
              : 'night';
  var str = kind + '|' + String(seedText || '');
  var h = 2166136261;
  for (var c = 0; c < str.length; c++) h = Math.imul(h ^ str.charCodeAt(c), 16777619) >>> 0;
  var rand = function () {
    h = (h + 0x6d2b79f5) >>> 0;
    var t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  var bt = function (a, b) {
    return a + (b - a) * rand();
  };
  var f = function (x) {
    return Math.round(x * 10) / 10;
  };
  var P = {
    night: { sky: ['#0a1136', '#232966', '#5e4c88'], l: ['#3b3a72', '#29295a', '#1a1a42', '#0b0b22'], orb: [1560, 205, 92], orbFill: '#fff2cc', glow: '#fff2cc', stars: 80, ff: 8 },
    rain: { sky: ['#19222b', '#34424d', '#66727a'], l: ['#4a5760', '#333f48', '#222c33', '#10171c'], stars: 0, ff: 0 },
    forest: { sky: ['#0a201b', '#1c4637', '#6d9562'], l: ['#2e5d47', '#1e4535', '#123126', '#061811'], stars: 0, ff: 26 },
    village: { sky: ['#2c1944', '#b54e69', '#f6b366'], l: ['#94506a', '#6a3355', '#43213b', '#1f0e1d'], orb: [1000, 610, 140], orbFill: '#ffe08f', glow: '#ffc36a', stars: 0, ff: 0 },
    sea: { sky: ['#0c1d3c', '#2d507e', '#eaa26f'], l: ['#2f5d86', '#1f466c', '#133150', '#08192c'], orb: [1380, 628, 118], orbFill: '#ffe4ab', glow: '#ffcf8a', stars: 16, ff: 0 },
    city: { sky: ['#0e0a29', '#34215f', '#8f4e8e'], l: ['#3d2f6e', '#2a2054', '#1a143a', '#0b0820'], orb: [1590, 185, 70], orbFill: '#f7eeff', glow: '#e3d2ff', stars: 34, ff: 0 },
    palace: { sky: ['#240910', '#7d1e27', '#ee9250'], l: ['#7c2b30', '#571b23', '#381016', '#1a0609'], orb: [1150, 575, 175], orbFill: '#ffdb8e', glow: '#ffbf6a', stars: 0, ff: 6 },
  }[kind];
  var L = P.l;

  /** A ridge line across the layer: smooth, from two slow waves and a little seeded roughness. */
  var ridge = function (base, amp, step, rough) {
    var p1 = bt(0, 6.28);
    var p2 = bt(0, 6.28);
    var f1 = bt(0.0018, 0.0034);
    var f2 = bt(0.005, 0.009);
    var pts = [];
    for (var x = -step; x <= LW + step; x += step) pts.push([x, base - amp * (0.55 + 0.3 * Math.sin(x * f1 + p1) + 0.15 * Math.sin(x * f2 + p2)) - rand() * rough]);
    var d = 'M' + pts[0][0] + ' ' + f(pts[0][1]);
    for (var i = 1; i < pts.length - 1; i++) d += ' Q' + pts[i][0] + ' ' + f(pts[i][1]) + ' ' + (pts[i][0] + pts[i + 1][0]) / 2 + ' ' + f((pts[i][1] + pts[i + 1][1]) / 2);
    d += ' L' + (LW + step) + ' ' + LH + ' L' + -step + ' ' + LH + ' Z';
    return {
      d: d,
      at: function (x) {
        var i = Math.max(0, Math.min(pts.length - 2, Math.floor((x + step) / step)));
        var k = (x - pts[i][0]) / step;
        return pts[i][1] + (pts[i + 1][1] - pts[i][1]) * k;
      },
    };
  };
  var path = function (d, fill, extra) {
    return '<path d="' + d + '" fill="' + fill + '"' + (extra || '') + '/>';
  };
  var pine = function (x, base, ht, fill) {
    var w = ht * 0.42;
    var out = '<rect x="' + f(x - ht * 0.025) + '" y="' + f(base - ht * 0.18) + '" width="' + f(ht * 0.05) + '" height="' + f(ht * 0.2) + '" fill="' + fill + '"/>';
    for (var i = 0; i < 3; i++) {
      var top = base - ht + i * ht * 0.24;
      var bot = top + ht * 0.42;
      var hw = w * (0.32 + i * 0.17);
      out += '<polygon points="' + f(x) + ',' + f(top) + ' ' + f(x + hw) + ',' + f(bot) + ' ' + f(x - hw) + ',' + f(bot) + '" fill="' + fill + '"/>';
    }
    return out;
  };
  var roundTree = function (x, base, ht, fill) {
    var r = ht * 0.26;
    return (
      '<rect x="' + f(x - ht * 0.035) + '" y="' + f(base - ht * 0.55) + '" width="' + f(ht * 0.07) + '" height="' + f(ht * 0.57) + '" fill="' + fill + '"/>' +
      '<circle cx="' + f(x) + '" cy="' + f(base - ht + r) + '" r="' + f(r) + '" fill="' + fill + '"/>' +
      '<circle cx="' + f(x - r * 0.8) + '" cy="' + f(base - ht + r * 1.7) + '" r="' + f(r * 0.78) + '" fill="' + fill + '"/>' +
      '<circle cx="' + f(x + r * 0.85) + '" cy="' + f(base - ht + r * 1.6) + '" r="' + f(r * 0.82) + '" fill="' + fill + '"/>'
    );
  };
  var banyan = function (x, base, ht, fill) {
    var out = '<path d="M' + f(x - 26) + ' ' + base + ' Q' + f(x - 10) + ' ' + f(base - ht * 0.4) + ' ' + f(x - 14) + ' ' + f(base - ht * 0.62) + ' L' + f(x + 14) + ' ' + f(base - ht * 0.62) + ' Q' + f(x + 10) + ' ' + f(base - ht * 0.4) + ' ' + f(x + 30) + ' ' + base + ' Z" fill="' + fill + '"/>';
    for (var i = 0; i < 7; i++) {
      var a = -Math.PI + (i / 6) * Math.PI;
      out += '<ellipse cx="' + f(x + Math.cos(a) * ht * 0.42) + '" cy="' + f(base - ht * 0.66 + Math.sin(a) * ht * 0.26) + '" rx="' + f(ht * bt(0.2, 0.28)) + '" ry="' + f(ht * bt(0.14, 0.19)) + '" fill="' + fill + '"/>';
    }
    for (var j = 0; j < 5; j++) {
      var rx = x + bt(-ht * 0.5, ht * 0.5);
      out += '<rect x="' + f(rx) + '" y="' + f(base - ht * 0.6) + '" width="3" height="' + f(ht * bt(0.25, 0.45)) + '" fill="' + fill + '"/>';
    }
    return out;
  };
  var bamboo = function (x, base, ht, fill, lean) {
    var tx = x + lean;
    var out = '<path d="M' + f(x) + ' ' + base + ' Q' + f(x + lean * 0.2) + ' ' + f(base - ht * 0.6) + ' ' + f(tx) + ' ' + f(base - ht) + '" stroke="' + fill + '" stroke-width="' + f(Math.max(5, ht * 0.022)) + '" fill="none" stroke-linecap="round"/>';
    for (var i = 1; i < 6; i++) {
      var k = i / 6;
      var nx = x + (lean * k * k);
      var ny = base - ht * k;
      out += '<rect x="' + f(nx - 8) + '" y="' + f(ny) + '" width="16" height="3" fill="' + fill + '"/>';
      if (i > 2) {
        var side = i % 2 ? 1 : -1;
        out += '<ellipse cx="' + f(nx + side * 34) + '" cy="' + f(ny - 6) + '" rx="40" ry="7" fill="' + fill + '" transform="rotate(' + side * -24 + ' ' + f(nx + side * 34) + ' ' + f(ny - 6) + ')"/>';
      }
    }
    return out;
  };
  var house = function (x, base, w, fill, lit) {
    var ht = w * 0.46;
    var roof = w * 0.4;
    return (
      '<rect x="' + f(x - w / 2) + '" y="' + f(base - ht) + '" width="' + f(w) + '" height="' + f(ht + 4) + '" fill="' + fill + '"/>' +
      '<path d="M' + f(x - w * 0.68) + ' ' + f(base - ht + 6) + ' Q' + f(x - w * 0.45) + ' ' + f(base - ht - roof * 0.45) + ' ' + f(x - w * 0.18) + ' ' + f(base - ht - roof) + ' L' + f(x + w * 0.18) + ' ' + f(base - ht - roof) + ' Q' + f(x + w * 0.45) + ' ' + f(base - ht - roof * 0.45) + ' ' + f(x + w * 0.68) + ' ' + f(base - ht + 6) + ' Z" fill="' + fill + '"/>' +
      (lit ? '<rect class="win" x="' + f(x - w * 0.12) + '" y="' + f(base - ht * 0.66) + '" width="' + f(w * 0.24) + '" height="' + f(ht * 0.36) + '" fill="#ffcf72"/>' : '')
    );
  };
  var roofTier = function (cx, y, w, ht, fill) {
    return '<path d="M' + f(cx - w - 26) + ' ' + f(y - 30) + ' Q' + f(cx - w + 4) + ' ' + f(y + 2) + ' ' + f(cx - w + 30) + ' ' + f(y) + ' L' + f(cx + w - 30) + ' ' + f(y) + ' Q' + f(cx + w - 4) + ' ' + f(y + 2) + ' ' + f(cx + w + 26) + ' ' + f(y - 30) + ' Q' + f(cx + w * 0.62) + ' ' + f(y - ht * 0.4) + ' ' + f(cx + w * 0.4) + ' ' + f(y - ht) + ' L' + f(cx - w * 0.4) + ' ' + f(y - ht) + ' Q' + f(cx - w * 0.62) + ' ' + f(y - ht * 0.4) + ' ' + f(cx - w - 26) + ' ' + f(y - 30) + ' Z" fill="' + fill + '"/>';
  };
  var palace = function (cx, base, w, fill) {
    var out = '<rect x="' + f(cx - w * 0.62) + '" y="' + f(base - 70) + '" width="' + f(w * 1.24) + '" height="74" fill="' + fill + '"/>';
    out += '<rect x="' + f(cx - w * 0.48) + '" y="' + f(base - 190) + '" width="' + f(w * 0.96) + '" height="124" fill="' + fill + '"/>';
    for (var i = 0; i < 5; i++) out += '<rect class="win" x="' + f(cx - w * 0.4 + i * w * 0.18) + '" y="' + f(base - 160) + '" width="' + f(w * 0.08) + '" height="56" rx="' + f(w * 0.04) + '" fill="#ffc96a"/>';
    out += '<path d="M' + f(cx - 44) + ' ' + f(base) + ' L' + f(cx - 44) + ' ' + f(base - 40) + ' Q' + f(cx) + ' ' + f(base - 90) + ' ' + f(cx + 44) + ' ' + f(base - 40) + ' L' + f(cx + 44) + ' ' + f(base) + ' Z" fill="#ffb85a" opacity=".55"/>';
    out += roofTier(cx, base - 186, w * 0.62, 90, fill);
    out += '<rect x="' + f(cx - w * 0.3) + '" y="' + f(base - 330) + '" width="' + f(w * 0.6) + '" height="62" fill="' + fill + '"/>';
    out += roofTier(cx, base - 322, w * 0.42, 74, fill);
    out += '<rect x="' + f(cx - 4) + '" y="' + f(base - 440) + '" width="8" height="50" fill="' + fill + '"/><circle cx="' + f(cx) + '" cy="' + f(base - 444) + '" r="11" fill="' + fill + '"/>';
    return out;
  };
  var building = function (x, base, w, ht, fill, litOdds) {
    var out = '<rect x="' + f(x) + '" y="' + f(base - ht) + '" width="' + f(w) + '" height="' + f(ht + 4) + '" fill="' + fill + '"/>';
    if (rand() < 0.4) out += '<rect x="' + f(x + w * 0.3) + '" y="' + f(base - ht - 26) + '" width="' + f(w * 0.12) + '" height="28" fill="' + fill + '"/>';
    for (var yy = base - ht + 26; yy < base - 40; yy += 44) for (var xx = x + 16; xx < x + w - 26; xx += 34) if (rand() < litOdds) out += '<rect class="win" x="' + f(xx) + '" y="' + f(yy) + '" width="14" height="20" fill="#ffd98a"/>';
    return out;
  };
  var waves = function (base, amp, wl, fill, cls) {
    var p = bt(0, 6.28);
    var d = 'M-140 ' + LH;
    for (var x = -140; x <= LW + 140; x += 20) d += ' L' + x + ' ' + f(base + amp * Math.sin((x / wl) * 6.283 + p) + amp * 0.4 * Math.sin((x / (wl * 0.37)) * 6.283));
    d += ' L' + (LW + 140) + ' ' + LH + ' Z';
    return '<g class="' + (cls || '') + '" data-dx="' + f(bt(18, 34)) + '">' + path(d, fill) + '</g>';
  };
  var boat = function (x, base, fill) {
    return (
      '<g class="bob">' +
      path('M' + (x - 120) + ' ' + (base - 30) + ' Q' + x + ' ' + (base + 26) + ' ' + (x + 130) + ' ' + (base - 34) + ' L' + (x + 92) + ' ' + (base - 14) + ' L' + (x - 92) + ' ' + (base - 12) + ' Z', fill) +
      '<rect x="' + (x - 4) + '" y="' + (base - 230) + '" width="7" height="206" fill="' + fill + '"/>' +
      path('M' + (x + 6) + ' ' + (base - 226) + ' Q' + (x + 120) + ' ' + (base - 170) + ' ' + (x + 104) + ' ' + (base - 50) + ' L' + (x + 6) + ' ' + (base - 50) + ' Z', fill) +
      '</g>'
    );
  };
  var palm = function (x, base, ht, fill, dir) {
    var tx = x + dir * ht * 0.32;
    var ty = base - ht;
    var out = '<path d="M' + f(x - 12) + ' ' + base + ' Q' + f(x + dir * ht * 0.02) + ' ' + f(base - ht * 0.6) + ' ' + f(tx) + ' ' + f(ty) + ' L' + f(tx + 10) + ' ' + f(ty + 6) + ' Q' + f(x + dir * ht * 0.06 + 14) + ' ' + f(base - ht * 0.58) + ' ' + f(x + 14) + ' ' + base + ' Z" fill="' + fill + '"/>';
    for (var i = 0; i < 7; i++) {
      var a = -2.9 + i * 0.8;
      var ex = tx + Math.cos(a) * 190;
      var ey = ty + Math.sin(a) * 120 + 70;
      out += '<path d="M' + f(tx) + ' ' + f(ty) + ' Q' + f((tx + ex) / 2) + ' ' + f(Math.min(ty, ey) - 50) + ' ' + f(ex) + ' ' + f(ey) + ' Q' + f((tx + ex) / 2) + ' ' + f(Math.min(ty, ey) - 20) + ' ' + f(tx) + ' ' + f(ty + 12) + ' Z" fill="' + fill + '"/>';
    }
    return out;
  };
  var cloud = function (x, y, sc, fill) {
    return (
      '<g opacity=".92">' +
      '<ellipse cx="' + f(x) + '" cy="' + f(y) + '" rx="' + f(150 * sc) + '" ry="' + f(46 * sc) + '" fill="' + fill + '"/>' +
      '<circle cx="' + f(x - 60 * sc) + '" cy="' + f(y - 26 * sc) + '" r="' + f(56 * sc) + '" fill="' + fill + '"/>' +
      '<circle cx="' + f(x + 30 * sc) + '" cy="' + f(y - 46 * sc) + '" r="' + f(74 * sc) + '" fill="' + fill + '"/>' +
      '<circle cx="' + f(x + 100 * sc) + '" cy="' + f(y - 14 * sc) + '" r="' + f(48 * sc) + '" fill="' + fill + '"/>' +
      '</g>'
    );
  };
  var grass = function (rg, fill, count) {
    var out = '';
    for (var i = 0; i < count; i++) {
      var x = bt(0, LW);
      var y = rg.at(x) + 4;
      var ht = bt(18, 46);
      out += '<polygon points="' + f(x - 7) + ',' + f(y) + ' ' + f(x + bt(-10, 10)) + ',' + f(y - ht) + ' ' + f(x + 7) + ',' + f(y) + '" fill="' + fill + '"/>';
    }
    return out;
  };
  var lantern = function (x, y, len) {
    return (
      '<g class="lan" data-swing="' + f(bt(3, 6)) + '">' +
      '<rect x="' + f(x - 1.5) + '" y="' + f(y) + '" width="3" height="' + f(len) + '" fill="#2a0a0a"/>' +
      '<circle cx="' + f(x) + '" cy="' + f(y + len + 26) + '" r="60" fill="#ffb24a" opacity=".22"/>' +
      '<ellipse cx="' + f(x) + '" cy="' + f(y + len + 26) + '" rx="24" ry="30" fill="#e2412b"/>' +
      '<ellipse cx="' + f(x - 6) + '" cy="' + f(y + len + 20) + '" rx="9" ry="14" fill="#ff9b5c" opacity=".7"/>' +
      '<rect x="' + f(x - 10) + '" y="' + f(y + len - 6) + '" width="20" height="6" fill="#d9a441"/>' +
      '<rect x="' + f(x - 2) + '" y="' + f(y + len + 56) + '" width="4" height="22" fill="#d9a441"/>' +
      '</g>'
    );
  };

  var layers = [];
  var add = function (depth, body) {
    layers.push('<svg class="lyr" data-depth="' + depth + '" viewBox="0 0 ' + LW + ' ' + LH + '" width="' + LW + '" height="' + LH + '">' + body + '</svg>');
  };
  var far;
  var mid;
  var mid2;
  var near;
  var body;
  var i;
  var x;
  if (kind === 'night') {
    far = ridge(650, 300, 90, 12);
    add(0.1, path(far.d, L[0]));
    mid = ridge(800, 180, 80, 6);
    body = path(mid.d, L[1]);
    for (i = 0; i < 7; i++) {
      x = bt(80, LW - 80);
      body += roundTree(x, mid.at(x) + 8, bt(110, 170), L[1]);
    }
    add(0.32, body);
    mid2 = ridge(890, 90, 70, 4);
    body = path(mid2.d, L[2]);
    for (i = 0; i < 9; i++) {
      x = bt(500, 1500) + (i - 4) * 18;
      body += bamboo(x, mid2.at(x) + 6, bt(240, 380), L[2], bt(-50, 50));
    }
    add(0.58, body);
  } else if (kind === 'rain') {
    body = '';
    for (i = 0; i < 6; i++) body += cloud(i * 420 + bt(-60, 60), bt(90, 200), bt(1, 1.6), i % 2 ? '#2b353e' : '#3a4650');
    add(0.2, body);
    far = ridge(680, 260, 90, 10);
    add(0.12, path(far.d, L[0]));
    mid = ridge(820, 150, 80, 6);
    body = path(mid.d, L[1]);
    x = bt(600, 1600);
    var hy = mid.at(x) + 10;
    body += '<rect x="' + f(x - 70) + '" y="' + f(hy - 70) + '" width="8" height="74" fill="' + L[1] + '"/><rect x="' + f(x + 62) + '" y="' + f(hy - 70) + '" width="8" height="74" fill="' + L[1] + '"/>' + house(x, hy - 66, 170, L[1], true);
    for (i = 0; i < 5; i++) {
      var tx2 = bt(80, LW - 80);
      if (Math.abs(tx2 - x) > 200) body += roundTree(tx2, mid.at(tx2) + 8, bt(110, 160), L[1]);
    }
    add(0.34, body);
    mid2 = ridge(905, 70, 70, 4);
    body = path(mid2.d, L[2]);
    for (i = 0; i < 7; i++) {
      x = bt(100, 900) + i * 26;
      body += bamboo(x, mid2.at(x) + 6, bt(260, 360), L[2], bt(-40, 30));
    }
    add(0.58, body);
  } else if (kind === 'forest') {
    far = ridge(620, 120, 90, 8);
    body = path(far.d, L[0]);
    for (i = 0; i < 46; i++) {
      x = i * 50 + bt(-15, 15);
      body += pine(x, far.at(x) + 10, bt(130, 210), L[0]);
    }
    add(0.12, body);
    mid = ridge(780, 80, 80, 6);
    body = path(mid.d, L[1]);
    for (i = 0; i < 16; i++) {
      x = i * 145 + bt(-30, 30);
      body += pine(x, mid.at(x) + 10, bt(260, 380), L[1]);
    }
    add(0.34, body);
    mid2 = ridge(900, 50, 80, 4);
    body = path(mid2.d, L[2]);
    for (i = 0; i < 8; i++) {
      x = i * 290 + bt(-40, 40);
      body += pine(x, mid2.at(x) + 10, bt(440, 620), L[2]);
    }
    add(0.58, body);
  } else if (kind === 'village') {
    far = ridge(660, 90, 100, 6);
    add(0.1, path(far.d, L[0]));
    mid = ridge(780, 50, 90, 3);
    body = path(mid.d, L[1]);
    for (var t = 1; t < 4; t++) {
      var tr = ridge(780 + t * 26, 50, 90, 3);
      body += '<path d="' + tr.d.split(' L' + (LW + 90))[0] + '" stroke="' + L[0] + '" stroke-width="3" fill="none" opacity=".55"/>';
    }
    for (i = 0; i < 4; i++) {
      x = 240 + i * 520 + bt(-80, 80);
      body += house(x, mid.at(x) + 6, bt(120, 160), L[1], rand() < 0.75);
    }
    add(0.32, body);
    mid2 = ridge(880, 40, 80, 3);
    body = path(mid2.d, L[2]);
    x = bt(1720, 2020);
    body += banyan(x, mid2.at(x) + 6, bt(300, 360), L[2]);
    for (i = 0; i < 6; i++) {
      var bx = bt(150, 700) + i * 20;
      body += bamboo(bx, mid2.at(bx) + 6, bt(260, 380), L[2], bt(-40, 40));
    }
    add(0.58, body);
  } else if (kind === 'sea') {
    body = '';
    for (i = 0; i < 3; i++) {
      x = bt(150, 2000);
      var iw = bt(90, 220);
      body += path('M' + f(x - iw) + ' 642 Q' + f(x - iw * 0.3) + ' ' + f(642 - iw * 0.55) + ' ' + f(x) + ' ' + f(642 - iw * 0.45) + ' Q' + f(x + iw * 0.4) + ' ' + f(642 - iw * 0.6) + ' ' + f(x + iw) + ' 642 Z', L[0]);
    }
    add(0.08, body);
    body = '<rect x="0" y="640" width="' + LW + '" height="440" fill="' + L[0] + '"/>';
    for (i = 0; i < 14; i++) body += '<rect class="glint" x="' + f(1380 + 300 - bt(40, 140) * (1 + i * 0.12)) + '" y="' + (652 + i * 20) + '" width="' + f(bt(80, 200) * (1 + i * 0.12)) + '" height="4" rx="2" fill="#ffd9a0" opacity="' + f(0.7 - i * 0.04) + '"/>';
    add(0.14, body);
    add(0.3, waves(724, 9, 260, L[1], 'wv') + boat(bt(500, 1700), 760, L[3]));
    add(0.5, waves(830, 14, 330, L[2], 'wv'));
  } else if (kind === 'city') {
    body = '';
    for (x = -40; x < LW; x += bt(90, 170)) body += building(x, 780, bt(80, 150), bt(260, 520), L[0], 0.06);
    add(0.1, body);
    body = '';
    for (x = -40; x < LW; x += bt(130, 210)) body += building(x, 880, bt(120, 190), bt(180, 380), L[1], 0.3);
    add(0.32, body);
    body = '';
    for (x = -40; x < LW; x += bt(100, 150)) {
      var bw = bt(90, 130);
      var bh = bt(90, 190);
      body += building(x, 960, bw, bh, L[2], 0.2) + path('M' + f(x - 6) + ' ' + f(960 - bh) + ' L' + f(x + bw / 2) + ' ' + f(960 - bh - 40) + ' L' + f(x + bw + 6) + ' ' + f(960 - bh) + ' Z', L[2]);
    }
    add(0.58, body);
  } else {
    far = ridge(660, 230, 100, 10);
    add(0.1, path(far.d, L[0]));
    mid = ridge(840, 20, 120, 2);
    body = path(mid.d, L[1]) + palace(bt(820, 1350), 830, 330, L[1]);
    add(0.32, body);
    mid2 = ridge(905, 30, 90, 3);
    body = path(mid2.d, L[2]);
    for (i = 0; i < 5; i++) {
      x = i * 520 + bt(-60, 60);
      body += roundTree(x, mid2.at(x) + 8, bt(150, 210), L[2]);
    }
    var sag = bt(120, 150);
    body += '<path d="M120 ' + f(sag - 60) + ' Q620 ' + f(sag + 30) + ' 1120 ' + f(sag - 60) + ' Q1620 ' + f(sag + 30) + ' 2120 ' + f(sag - 60) + '" stroke="#2a0a0a" stroke-width="3" fill="none"/>';
    for (i = 0; i < 8; i++) {
      x = 250 + i * 250;
      var u = ((x - 120) % 1000) / 1000;
      body += lantern(x, sag - 60 + 90 * u * (1 - u) * 1.0 + 0, bt(20, 60));
    }
    add(0.58, body);
  }
  near = ridge(980, kind === 'city' ? 4 : 28, 90, 2);
  body = path(near.d, L[3]);
  if (kind === 'night' || kind === 'rain') {
    for (i = 0; i < 5; i++) body += bamboo(30 + i * 34, near.at(40) + 8, bt(700, 1000), L[3], bt(20, 90));
    for (i = 0; i < 4; i++) body += bamboo(LW - 360 + i * 40, near.at(LW - 300) + 8, bt(640, 980), L[3], bt(-90, -20));
  } else if (kind === 'forest') {
    body += '<rect x="20" y="0" width="70" height="1000" fill="' + L[3] + '"/><rect x="' + (LW - 380) + '" y="0" width="96" height="1000" fill="' + L[3] + '"/>';
    body += path('M90 260 Q220 230 330 160 L336 172 Q230 252 90 300 Z', L[3]) + path('M' + (LW - 380) + ' 340 Q' + (LW - 520) + ' 300 ' + (LW - 640) + ' 220 L' + (LW - 650) + ' 236 Q' + (LW - 520) + ' 330 ' + (LW - 380) + ' 384 Z', L[3]);
  } else if (kind === 'village') {
    body += palm(120, near.at(120) + 6, 560, L[3], 1);
  } else if (kind === 'sea') {
    body = waves(930, 10, 300, L[2], 'wv') + body + palm(70, near.at(70) + 6, 600, L[3], 1);
  } else if (kind === 'city') {
    for (i = 0; i < 6; i++) {
      x = 160 + i * 380;
      body += '<rect x="' + (x - 4) + '" y="770" width="8" height="220" fill="' + L[3] + '"/><path d="M' + (x - 4) + ' 774 Q' + x + ' 752 ' + (x + 40) + ' 760" stroke="' + L[3] + '" stroke-width="6" fill="none"/><circle class="lamp" cx="' + (x + 42) + '" cy="770" r="46" fill="#ffd98a" opacity=".22"/><circle cx="' + (x + 42) + '" cy="766" r="9" fill="#ffe7b0"/>';
    }
  } else if (kind === 'palace') {
    for (i = 0; i < 2; i++) {
      x = i ? LW - 360 : 80;
      body += '<rect x="' + x + '" y="640" width="14" height="360" fill="' + L[3] + '"/><rect x="' + (x - 40) + '" y="636" width="94" height="10" fill="' + L[3] + '"/>' + lantern(x + 7, 646, 26);
    }
  }
  if (kind !== 'city' && kind !== 'sea') body += grass(near, L[3], 60);
  add(0.82, body);

  var sky = '<div class="sky" style="background:linear-gradient(180deg,' + P.sky[0] + ' 0%,' + P.sky[1] + ' 52%,' + P.sky[2] + ' 100%)"></div>';
  var air = '';
  if (P.stars) {
    var st = '';
    for (i = 0; i < P.stars; i++) {
      var sr = bt(1, 2.8);
      st += '<circle' + (i % 3 === 0 ? ' class="tw"' : '') + ' cx="' + f(bt(0, 1920)) + '" cy="' + f(bt(10, kind === 'sea' ? 420 : 560)) + '" r="' + f(sr) + '" fill="#fff6dc" opacity="' + f(bt(0.4, 0.95)) + '"/>';
    }
    air += '<svg class="stars" viewBox="0 0 1920 1080" width="1920" height="1080">' + st + '</svg>';
  }
  if (kind === 'forest') {
    var sh = '';
    for (i = 0; i < 4; i++) {
      x = bt(200, 1700);
      sh += '<polygon class="shaft" points="' + f(x) + ',-20 ' + f(x + 120) + ',-20 ' + f(x + 520) + ',1080 ' + f(x + 260) + ',1080" fill="#f4ffd6" opacity=".09"/>';
    }
    air += '<svg class="beams" viewBox="0 0 1920 1080" width="1920" height="1080">' + sh + '</svg>';
  }
  if (P.orb) {
    air +=
      '<svg class="orb" viewBox="0 0 1920 1080" width="1920" height="1080"><defs><radialGradient id="orbglow"><stop offset="0" stop-color="' + P.glow + '" stop-opacity=".55"/><stop offset=".4" stop-color="' + P.glow + '" stop-opacity=".18"/><stop offset="1" stop-color="' + P.glow + '" stop-opacity="0"/></radialGradient></defs>' +
      '<circle cx="' + P.orb[0] + '" cy="' + P.orb[1] + '" r="' + P.orb[2] * 4 + '" fill="url(#orbglow)"/>' +
      '<circle cx="' + P.orb[0] + '" cy="' + P.orb[1] + '" r="' + P.orb[2] + '" fill="' + P.orbFill + '"/>' +
      (kind === 'night' || kind === 'city' ? '<circle cx="' + (P.orb[0] - P.orb[2] * 0.3) + '" cy="' + (P.orb[1] - P.orb[2] * 0.2) + '" r="' + P.orb[2] * 0.18 + '" fill="#000" opacity=".06"/><circle cx="' + (P.orb[0] + P.orb[2] * 0.35) + '" cy="' + (P.orb[1] + P.orb[2] * 0.25) + '" r="' + P.orb[2] * 0.12 + '" fill="#000" opacity=".06"/>' : '') +
      '</svg>';
  }
  var front = '';
  if (kind === 'village') {
    var bd = '';
    for (i = 0; i < 5; i++) {
      var bxx = 300 + i * 70 + bt(-20, 20);
      var byy = 260 + bt(-50, 50);
      var bs = bt(0.7, 1.2);
      bd += '<path d="M' + f(bxx) + ' ' + f(byy) + ' q' + f(14 * bs) + ' ' + f(-12 * bs) + ' ' + f(28 * bs) + ' 0 q' + f(14 * bs) + ' ' + f(-12 * bs) + ' ' + f(28 * bs) + ' 0" stroke="#2c1427" stroke-width="4" fill="none" stroke-linecap="round"/>';
    }
    front += '<svg class="birds" viewBox="0 0 1920 1080" width="1920" height="1080">' + bd + '</svg>';
  }
  if (kind === 'rain') {
    var rn = '';
    for (i = 0; i < 160; i++) {
      var rx = bt(-100, 2000);
      var ry = bt(0, 2160);
      var rl = bt(28, 64);
      rn += '<line x1="' + f(rx) + '" y1="' + f(ry) + '" x2="' + f(rx - rl * 0.25) + '" y2="' + f(ry + rl) + '" stroke="#cfe0ea" stroke-width="' + f(bt(1.2, 2.6)) + '" opacity="' + f(bt(0.25, 0.6)) + '"/>';
    }
    front += '<svg class="rain-sheet" viewBox="0 0 1920 2160" width="1920" height="2160">' + rn + '</svg>';
    front += '<div class="mist"></div>';
  }
  if (P.ff) {
    var ff = '';
    for (i = 0; i < P.ff; i++) ff += '<circle class="ff" data-dx="' + f(bt(-60, 60)) + '" data-dy="' + f(bt(-40, 40)) + '" cx="' + f(bt(80, 1840)) + '" cy="' + f(bt(420, 900)) + '" r="' + f(bt(3, 6)) + '" fill="' + (kind === 'palace' ? '#ffcf70' : '#eaff9e') + '"/>';
    front += '<svg class="fireflies" viewBox="0 0 1920 1080" width="1920" height="1080"><defs><filter id="ffblur"><feGaussianBlur stdDeviation="2.4"/></filter></defs><g filter="url(#ffblur)">' + ff + '</g></svg>';
  }
  return { kind: kind, html: sky + air + layers.join('') + front };
}

/** A torn-paper edge for each card, cut from the scene's own seed. */
function tearPaper(el, seedText) {
  var h = 2166136261;
  var str = 'paper|' + String(seedText || '');
  for (var c = 0; c < str.length; c++) h = Math.imul(h ^ str.charCodeAt(c), 16777619) >>> 0;
  var rand = function () {
    h = (h + 0x6d2b79f5) >>> 0;
    var t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  var pts = [];
  var j = function (a) {
    return (rand() * a).toFixed(2);
  };
  for (var x = 0; x <= 100; x += 2.5) pts.push(x + '% ' + j(1.4) + '%');
  for (var y = 2.5; y <= 100; y += 4) pts.push(100 - j(0.7) + '% ' + y + '%');
  for (var x2 = 100; x2 >= 0; x2 -= 2.5) pts.push(x2 + '% ' + (100 - j(1.6)) + '%');
  for (var y2 = 97.5; y2 > 0; y2 -= 4) pts.push(j(0.7) + '% ' + y2 + '%');
  el.style.clipPath = 'polygon(' + pts.join(',') + ')';
}

/** Shrinks a box's type until it fits, for classes the kit's own fitter does not know. */
const FIT = `var fit=function(sel,floor){root.querySelectorAll(sel).forEach(function(el){var g=0;while(el.scrollHeight>el.clientHeight+2&&parseFloat(getComputedStyle(el).fontSize)>floor&&g++<60){el.style.fontSize=(parseFloat(getComputedStyle(el).fontSize)-2)+'px'}})};`;

/** Draws the scene's landscape and its torn paper. `seedKeys` are the values the seed is made of. */
const stage = (seedKeys) =>
  `${paintScenery.toString()}\n  ${tearPaper.toString()}\n  ${FIT}\n` +
  `var seed=[${seedKeys.map((k) => `v['${k}']`).join(',')}].join('|');var painted=paintScenery(v.setting,seed);var sceneEl=q('.scenery');sceneEl.innerHTML=painted.html;root.classList.add('k-'+painted.kind);` +
  `root.querySelectorAll('.torn').forEach(function(el,i){tearPaper(el,seed+i)});` +
  // A puppet is a character the storyboard names; an empty one takes its puppet off the stage.
  `root.querySelectorAll('[data-puppet]').forEach(function(el){var key=el.getAttribute('data-puppet');var val=String(v[key]==null?'':v[key]).trim();if(!val){el.style.display='none';root.classList.add('no-'+key);return}el.querySelector('.pp-glyph').textContent=val});` +
  `root.querySelectorAll('[data-optional]').forEach(function(el){var key=el.getAttribute('data-optional');if(!String(v[key]==null?'':v[key]).trim())el.style.display='none'});`;

/**
 * The landscape's life over the whole scene: the layers rise like a pop-up page, then drift at their
 * own depth; the air moves; puppets breathe. Everything is a tween on the paused timeline, with repeats
 * counted from the scene's length, so a frame anywhere in the scene is the same frame every time.
 */
const ambient =
  `var D=duration;var reps=function(p){return Math.max(1,Math.ceil(D/p))};` +
  `root.querySelectorAll('.lyr').forEach(function(el,i){var d=Number(el.getAttribute('data-depth'))||0;tl.fromTo(el,{x:0},{x:-300*d,duration:D,ease:'none'},0);tl.fromTo(el,{y:70+220*d},{y:0,duration:1.15,ease:'power3.out'},.04+.09*i)});` +
  `tl.fromTo(q('.sky'),{opacity:.4},{opacity:1,duration:1,ease:'sine.out'},0);` +
  `if(q('.orb'))tl.fromTo(q('.orb'),{y:60,opacity:0},{y:-24,opacity:1,duration:D,ease:'sine.out'},0);` +
  `if(q('.stars'))tl.fromTo(q('.stars'),{opacity:0},{opacity:1,duration:1.2,ease:'sine.out'},.2);` +
  `root.querySelectorAll('.tw').forEach(function(el,i){tl.fromTo(el,{opacity:.15},{opacity:1,duration:.7+(i%5)*.22,ease:'sine.inOut',yoyo:true,repeat:reps(1.4)},(i%7)*.15)});` +
  `root.querySelectorAll('.shaft').forEach(function(el,i){tl.fromTo(el,{opacity:.03},{opacity:.13,duration:2.2+i*.5,ease:'sine.inOut',yoyo:true,repeat:reps(4)},i*.3)});` +
  `root.querySelectorAll('.rain-sheet').forEach(function(el){tl.fromTo(el,{y:-1080},{y:0,duration:.7,ease:'none',repeat:reps(.7)},0)});` +
  `if(q('.mist'))tl.fromTo(q('.mist'),{x:-120,opacity:.5},{x:120,opacity:.9,duration:D,ease:'sine.inOut'},0);` +
  `root.querySelectorAll('.ff').forEach(function(el,i){var dx=Number(el.getAttribute('data-dx'))||20,dy=Number(el.getAttribute('data-dy'))||20;tl.fromTo(el,{x:0,y:0,opacity:.2},{x:dx,y:dy,opacity:1,duration:1.6+(i%4)*.4,ease:'sine.inOut',yoyo:true,repeat:reps(2)},(i%6)*.2)});` +
  `root.querySelectorAll('.wv').forEach(function(el,i){var dx=Number(el.getAttribute('data-dx'))||24;tl.fromTo(el,{x:-dx},{x:dx,duration:2.4+i*.6,ease:'sine.inOut',yoyo:true,repeat:reps(2.4)},0)});` +
  `root.querySelectorAll('.bob').forEach(function(el){tl.fromTo(el,{y:-4,rotation:-1.5,transformOrigin:'50% 100%'},{y:6,rotation:1.5,duration:1.6,ease:'sine.inOut',yoyo:true,repeat:reps(1.6)},0)});` +
  `root.querySelectorAll('.lan').forEach(function(el,i){var a=Number(el.getAttribute('data-swing'))||4;tl.fromTo(el,{rotation:-a,transformOrigin:'50% 0%'},{rotation:a,duration:1.8+(i%3)*.3,ease:'sine.inOut',yoyo:true,repeat:reps(1.8)},0)});` +
  `if(q('.birds'))tl.fromTo(q('.birds'),{x:-200,y:20},{x:420,y:-50,duration:D,ease:'none'},0);` +
  `root.querySelectorAll('.win').forEach(function(el,i){if(i%4===0)tl.fromTo(el,{opacity:.55},{opacity:1,duration:1.3,ease:'sine.inOut',yoyo:true,repeat:reps(2.6)},(i%5)*.3)});` +
  `root.querySelectorAll('.puppet').forEach(function(el,i){tl.fromTo(el,{y:80,opacity:0},{y:0,opacity:1,duration:.8,ease:'back.out(1.4)'},.5+i*.25);var emo=el.querySelector('.pp-emo');tl.fromTo(emo,{y:0,rotation:-2.5},{y:-16,rotation:2.5,duration:.95,ease:'sine.inOut',yoyo:true,repeat:reps(.95),transformOrigin:'50% 100%'},1.2+i*.3);tl.fromTo(el.querySelector('.pp-shadow'),{scaleX:1},{scaleX:.86,duration:.95,ease:'sine.inOut',yoyo:true,repeat:reps(.95)},1.2+i*.3)});` +
  `tl.fromTo(q('.folio'),{opacity:0},{opacity:1,duration:.8,ease:'sine.out'},1);`;

/** The page every scene is drawn on. */
const ground =
  // Room under the last line and over it, for descenders (g, y, p) and stacked Vietnamese accents, in boxes that clip.
  '#root .source{padding-top:.08em;padding-bottom:.2em}' +
  'html,body{margin:0;background:#0a0a1f}*{box-sizing:border-box}' +
  `#root{position:absolute;inset:0;width:${W}px;height:${H}px;overflow:hidden;color:${CREAM};font-family:"Lora",Georgia,serif}` +
  '.nc-backdrop{position:absolute;inset:0;background:#0a0a1f}' +
  '.scenery{position:absolute;inset:0;overflow:hidden}' +
  '.sky,.stars,.beams,.orb,.birds,.fireflies{position:absolute;left:0;top:0}.sky{inset:0}' +
  '.lyr{position:absolute;left:0;top:0;filter:drop-shadow(0 -5px 9px rgba(0,0,0,.38))}' +
  '.rain-sheet{position:absolute;left:0;top:0}' +
  '.mist{position:absolute;left:-200px;right:-200px;bottom:0;height:420px;background:linear-gradient(180deg,transparent,#9fb2bd33 60%,#9fb2bd22)}' +
  // Grain and vignette: the paper the landscape is cut from, and the lamp it is read under.
  '.grain{position:absolute;inset:0;opacity:.16;mix-blend-mode:overlay;pointer-events:none}' +
  '.vignette{position:absolute;inset:0;background:radial-gradient(ellipse 75% 70% at 50% 45%,transparent 55%,#0006 82%,#000a 100%);pointer-events:none}' +
  '.dim{position:absolute;inset:0;background:#05040c;opacity:0;pointer-events:none}' +
  // A puppet: an emoji on the stage, with its own shadow on the ground and its name on a paper tag.
  '.puppet{position:absolute;bottom:118px;width:340px;margin-left:-170px;display:flex;flex-direction:column;align-items:center}' +
  '.pp-emo{display:block;font-size:236px;line-height:1.1;font-family:"Noto Color Emoji",sans-serif;filter:drop-shadow(0 14px 18px rgba(0,0,0,.45)) saturate(.92)}' +
  '.pp-shadow{width:220px;height:30px;margin-top:-24px;border-radius:50%;background:radial-gradient(ellipse,#000a,transparent 70%)}' +
  `.pp-name{margin-top:12px;padding:8px 24px 10px;background:${PAPER};color:${INK};font-family:"Be Vietnam Pro",Arial,sans-serif;font-size:24px;font-weight:800;letter-spacing:.08em;line-height:1.3;white-space:nowrap;max-width:360px;overflow:hidden;text-overflow:ellipsis;transform:rotate(-2deg);box-shadow:0 8px 20px #0007}` +
  '.paper-wrap{position:absolute;filter:drop-shadow(0 22px 34px rgba(0,0,0,.5))}' +
  `.paper{position:relative;background:radial-gradient(ellipse at 30% 20%,#fbf3df,${PAPER} 60%,#ead8b2);color:${INK}}` +
  `.paper:after{content:"";position:absolute;inset:16px;border:1.5px solid ${RUST}33;pointer-events:none}` +
  `.label{font-family:"Be Vietnam Pro",Arial,sans-serif;font-weight:800;letter-spacing:.22em;font-size:21px;line-height:1.5;text-transform:uppercase}` +
  `.folio{position:absolute;right:64px;bottom:40px;color:${CREAM}88;font-family:"Be Vietnam Pro",Arial,sans-serif;font-size:16px;font-weight:800;letter-spacing:.24em}`;

const GRAIN = `<svg class="grain" viewBox="0 0 960 540" width="${W}" height="${H}" preserveAspectRatio="none"><filter id="paperGrain"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" seed="7"/><feColorMatrix values="0 0 0 0 .5  0 0 0 0 .45  0 0 0 0 .4  0 0 0 .9 0"/></filter><rect width="960" height="540" filter="url(#paperGrain)"/></svg>`;
const backdrop = `<div class="scenery"></div>${GRAIN}<div class="vignette"></div><div class="dim"></div>`;
const puppet = (key, nameKey, x, extra = '') =>
  `<div class="puppet puppet-${key}" data-puppet="${key}" style="left:${x}px"><span class="pp-emo"${extra}><b class="pp-glyph"></b></span><span class="pp-shadow"></span>${nameKey ? `<span class="pp-name ${nameKey}" data-optional="${nameKey}"></span>` : ''}</div>`;
const folio = (label) => `<div class="folio">NODECINE · ${label}</div>`;

const secondsVar = { id: 'seconds', type: 'number', label: 'Length in seconds (the Assemble node gives it)', labels: { vi: 'Độ dài, giây (node Assemble cấp)' }, default: 4 };
const settingVar = (sample, dflt = 'đêm trăng') => ({
  id: 'setting',
  type: 'string',
  label: 'Where the scene happens, which draws the landscape: đêm trăng, mưa, rừng, làng quê, biển, thành phố or cung điện',
  labels: { vi: 'Cảnh diễn ra ở đâu, quyết định phong cảnh: đêm trăng, mưa, rừng, làng quê, biển, thành phố hay cung điện' },
  default: dflt,
  sample,
  maxLength: 24,
  required: true,
});
const characterVar = (id, label, labelVi, sample, required = false) => ({ id, type: 'string', label, labels: { vi: labelVi }, default: required ? '🙂' : '', sample, maxLength: 12, required });
const nameVar = (id, label, labelVi, sample, required = false) => ({ id, type: 'string', label, labels: { vi: labelVi }, default: '', sample, maxLength: 22, required });

const scenes = {
  hook: {
    role: 'hook',
    description:
      'The title page: the tale’s name in large type over the drawn landscape, an opening line such as “Ngày xửa ngày xưa…”, what kind of tale it is, and optionally its main character as a puppet on the stage.',
    css:
      ground +
      `.kicker{position:absolute;left:260px;right:260px;top:214px;text-align:center;font-style:italic;font-weight:500;font-size:44px;line-height:1.4;color:${GOLD};text-shadow:0 3px 14px #000a}` +
      `.title{position:absolute;left:250px;right:250px;top:292px;height:330px;margin:0;padding-top:8px;display:flex;align-items:center;justify-content:center;text-align:center;font-weight:700;font-size:124px;line-height:1.2;color:${CREAM};text-shadow:0 4px 0 #0005,0 18px 44px #000c;overflow:hidden}` +
      `.orn{position:absolute;left:50%;top:650px;transform:translateX(-50%);display:flex;align-items:center;gap:22px;white-space:nowrap;color:${CREAM}}` +
      `.orn i{display:block;width:90px;height:2px;background:${GOLD}aa}.orn b{color:${GOLD};font-size:22px}` +
      `.orn .source{font-family:"Be Vietnam Pro",Arial,sans-serif;font-weight:800;letter-spacing:.22em;font-size:22px;text-transform:uppercase;max-width:900px;overflow:hidden;text-overflow:ellipsis}` +
      '.puppet-character{bottom:96px}.puppet-character .pp-emo{font-size:200px}',
    markup: `${backdrop}
      <p class="kicker detail"></p>
      <h1 class="title"></h1>
      <div class="orn"><i></i><b>✦</b><span class="source"></span><b>✦</b><i></i></div>
      ${puppet('character', '', 300)}
      ${folio('TRUYỆN KỂ')}`,
    motion:
      ambient +
      `tl.fromTo(q('.kicker'),{opacity:0,y:-14},{opacity:1,y:0,duration:.9,ease:'sine.out'},.5);` +
      `tl.fromTo(q('.title'),{opacity:0,y:40,scale:.96},{opacity:1,y:0,scale:1,duration:1.1,ease:'power3.out'},.75);` +
      `tl.fromTo(root.querySelectorAll('.orn i'),{scaleX:0},{scaleX:1,duration:.7,ease:'power2.out'},1.3);` +
      `tl.fromTo(q('.orn'),{opacity:0},{opacity:1,duration:.6,ease:'sine.out'},1.2);`,
    extraScript: stage(['title', 'setting']),
    variables: [
      { id: 'title', type: 'string', label: 'The name of the tale', labels: { vi: 'Tên truyện' }, default: 'Tên câu chuyện', sample: 'Sự tích cây vú sữa', maxLength: 48, required: true },
      { id: 'detail', type: 'string', label: 'The opening line, a few words', labels: { vi: 'Câu mở đầu, vài chữ' }, default: 'Ngày xửa ngày xưa…', sample: 'Ngày xửa ngày xưa…', maxLength: 40, required: true },
      {
        id: 'source',
        type: 'string',
        label: 'What kind of tale it is: Truyện cổ tích Việt Nam, Truyện ngụ ngôn, Chuyện có thật…',
        labels: { vi: 'Thể loại: Truyện cổ tích Việt Nam, Truyện ngụ ngôn, Chuyện có thật…' },
        default: 'Truyện cổ tích Việt Nam',
        sample: 'Truyện cổ tích Việt Nam',
        maxLength: 40,
        required: true,
      },
      settingVar('làng quê'),
      characterVar('character', 'The main character as one emoji (👦, 🐢, 🐯, 👸…), or empty', 'Nhân vật chính, một emoji (👦, 🐢, 🐯, 👸…), hoặc để trống', '👦'),
      secondsVar,
    ],
  },
  narrate: {
    role: 'scene',
    description:
      'A page of the tale: the setting drawn as a landscape, a short passage of one or two sentences on torn paper, and optionally the character it is about, as a puppet with its name. The block that carries the story; play it for each part of the tale, changing the setting when the story moves.',
    css:
      ground +
      '.paper-wrap{left:760px;right:130px;top:150px}' +
      '.k-solo .paper-wrap{left:330px;right:330px}' +
      '.paper{padding:58px 70px 64px}' +
      `.paper .label{color:${RUST};margin-bottom:18px;display:flex;align-items:center;gap:16px}.paper .label:after{content:"";flex:1;height:1.5px;background:${RUST}44}` +
      `.detail{margin:0;max-height:430px;overflow:hidden;font-size:50px;line-height:1.45;font-weight:500;color:${INK}}` +
      `.detail::first-letter{float:left;font-size:2.5em;line-height:1;font-weight:700;color:${RUST};margin:8px 16px 0 0}` +
      '.puppet-character{bottom:120px}',
    markup: `${backdrop}
      ${puppet('character', 'name', 400)}
      <div class="paper-wrap"><div class="paper torn"><div class="label"><span class="chapter"></span></div><p class="detail"></p></div></div>
      ${folio('TRUYỆN KỂ')}`,
    motion:
      ambient +
      `tl.fromTo(q('.paper-wrap'),{opacity:0,y:50,rotation:-2.5},{opacity:1,y:0,rotation:-.6,duration:.95,ease:'power3.out'},.65);` +
      `tl.fromTo(q('.paper .label'),{opacity:0},{opacity:1,duration:.6,ease:'sine.out'},1.15);` +
      `tl.fromTo(q('.detail'),{opacity:0,y:14},{opacity:1,y:0,duration:.9,ease:'power2.out'},1.05);`,
    textKeys: ['detail', 'name', 'chapter'],
    extraScript: stage(['detail', 'setting']) + `if(!String(v.character==null?'':v.character).trim())root.classList.add('k-solo');`,
    variables: [
      {
        id: 'detail',
        type: 'string',
        label: 'The passage: one or two short sentences of the tale',
        labels: { vi: 'Đoạn kể: một hoặc hai câu ngắn của truyện' },
        default: 'Một đoạn của câu chuyện.',
        sample: 'Ngày xưa, có một cậu bé ham chơi. Một lần bị mẹ mắng, cậu bỏ nhà ra đi, mặc mẹ mỏi mòn chờ đợi.',
        maxLength: 180,
        required: true,
      },
      {
        id: 'chapter',
        type: 'string',
        label: 'A small head over the passage: where or when it happens ("Ở một làng nọ", "Nhiều năm sau")',
        labels: { vi: 'Dòng nhỏ trên đoạn kể: ở đâu hay khi nào ("Ở một làng nọ", "Nhiều năm sau")' },
        default: 'Ngày ấy',
        sample: 'Ở một làng nọ',
        maxLength: 30,
        required: true,
      },
      settingVar('làng quê'),
      characterVar('character', 'The character this passage is about, as one emoji, or empty', 'Nhân vật của đoạn này, một emoji, hoặc để trống', '👦'),
      nameVar('name', 'Their name, or empty', 'Tên nhân vật, hoặc để trống', 'Cậu bé'),
      secondsVar,
    ],
  },
  dialogue: {
    role: 'feature',
    description: 'Two characters face each other on the stage, each an emoji puppet with a name, and their words appear in speech bubbles one after the other.',
    css:
      ground +
      '.bubble-wrap{position:absolute;width:800px;filter:drop-shadow(0 18px 28px rgba(0,0,0,.45))}' +
      '.bw-1{left:120px;top:110px}.bw-2{right:120px;top:300px}' +
      `.bubble{position:relative;background:${PAPER};color:${INK};border-radius:46px;padding:36px 50px 40px}` +
      `.bubble .who{display:block;color:${RUST};margin-bottom:8px}` +
      `.bubble p{margin:0;font-size:44px;line-height:1.42;font-weight:500;font-style:italic;max-height:192px;overflow:hidden}` +
      `.tail{position:absolute;bottom:-46px;width:70px;height:50px;background:${PAPER}}` +
      '.bw-1 .tail{left:150px;clip-path:polygon(0 0,100% 0,8% 100%)}' +
      '.bw-2 .tail{right:150px;clip-path:polygon(0 0,100% 0,92% 100%)}' +
      '.pp-glyph{display:inline-block;font-weight:400}.puppet-char1 .pp-glyph{transform:scaleX(-1)}' +
      '.puppet .pp-name{margin-top:12px}',
    markup: `${backdrop}
      ${puppet('char1', 'name1', 360)}
      ${puppet('char2', 'name2', 1560)}
      <div class="bubble-wrap bw-1"><div class="bubble"><span class="who label name1"></span><p class="line1"></p><span class="tail"></span></div></div>
      <div class="bubble-wrap bw-2"><div class="bubble"><span class="who label name2"></span><p class="line2"></p><span class="tail"></span></div></div>
      ${folio('TRUYỆN KỂ')}`,
    motion:
      ambient +
      `var at2=Math.max(1.6,D*.42);` +
      `tl.fromTo(q('.bw-1'),{opacity:0,scale:.6,transformOrigin:'20% 100%'},{opacity:1,scale:1,duration:.6,ease:'back.out(1.7)'},.9);` +
      `tl.fromTo(q('.bw-2'),{opacity:0,scale:.6,transformOrigin:'80% 100%'},{opacity:1,scale:1,duration:.6,ease:'back.out(1.7)'},at2);` +
      `tl.to(q('.puppet-char1 .pp-shadow'),{opacity:.5,duration:.3},at2);` +
      `tl.fromTo(q('.puppet-char2'),{scale:1},{scale:1.06,duration:.3,ease:'power2.out',yoyo:true,repeat:1,transformOrigin:'50% 100%'},at2);` +
      `tl.fromTo(q('.puppet-char1'),{scale:1},{scale:1.06,duration:.3,ease:'power2.out',yoyo:true,repeat:1,transformOrigin:'50% 100%'},.9);`,
    textKeys: ['name1', 'name2', 'line1', 'line2'],
    // The puppets' own tween puts the second one on the stage a beat after the first; the opposite
    // puppet is mirrored so the two face each other.
    extraScript: stage(['line1', 'line2', 'setting']) + `fit('.bubble p',30);`,
    variables: [
      settingVar('rừng'),
      characterVar('char1', 'The first speaker, as one emoji', 'Người nói thứ nhất, một emoji', '🐇', true),
      nameVar('name1', 'Their name', 'Tên người nói thứ nhất', 'Thỏ', true),
      { id: 'line1', type: 'string', label: 'What they say', labels: { vi: 'Lời họ nói' }, default: 'Lời thứ nhất.', sample: 'Chậm như anh thì bao giờ mới tới đích?', maxLength: 110, required: true },
      characterVar('char2', 'The second speaker, as one emoji', 'Người nói thứ hai, một emoji', '🐢', true),
      nameVar('name2', 'Their name', 'Tên người nói thứ hai', 'Rùa', true),
      { id: 'line2', type: 'string', label: 'What they answer', labels: { vi: 'Lời đáp' }, default: 'Lời đáp.', sample: 'Anh cứ thử chạy thi với tôi xem sao.', maxLength: 110, required: true },
      secondsVar,
    ],
  },
  moment: {
    role: 'proof',
    description: 'The turning point of the tale: the landscape darkens, a light breaks behind one line set large, the moment everything changes.',
    css:
      ground +
      `.burst{position:absolute;left:50%;top:46%;width:1700px;height:1700px;margin:-850px 0 0 -850px;border-radius:50%;background:radial-gradient(circle,${GOLD}cc 0,${GOLD}55 18%,${GOLD}18 38%,transparent 62%);opacity:0;mix-blend-mode:screen}` +
      '.rays{position:absolute;left:50%;top:46%;width:2400px;height:2400px;margin:-1200px 0 0 -1200px;opacity:0;mix-blend-mode:screen;background:repeating-conic-gradient(from 0deg,#ffe2a022 0deg 5deg,transparent 5deg 15deg);-webkit-mask:radial-gradient(circle,#000 0,transparent 60%);mask:radial-gradient(circle,#000 0,transparent 60%)}' +
      '.flash{position:absolute;inset:0;background:#fff8e6;opacity:0}' +
      `.kicker{position:absolute;left:0;right:0;top:250px;text-align:center;font-style:italic;font-size:40px;line-height:1.4;color:${GOLD};text-shadow:0 3px 14px #000}` +
      `.title{position:absolute;left:200px;right:200px;top:320px;height:420px;margin:0;display:flex;align-items:center;justify-content:center;text-align:center;font-weight:700;font-size:96px;line-height:1.26;color:${CREAM};text-shadow:0 4px 0 #0006,0 0 60px #000c;overflow:hidden}`,
    markup: `${backdrop}
      <div class="rays"></div><div class="burst"></div>
      <p class="kicker" data-optional="kicker"></p>
      <h1 class="title"></h1>
      <div class="flash"></div>
      ${folio('TRUYỆN KỂ')}`,
    motion:
      ambient +
      `tl.fromTo(q('.dim'),{opacity:0},{opacity:.62,duration:.9,ease:'power2.in'},.2);` +
      `tl.fromTo(q('.flash'),{opacity:0},{opacity:.75,duration:.08,ease:'none'},1.05).to(q('.flash'),{opacity:0,duration:.7,ease:'power2.out'},1.13);` +
      `tl.to(q('.dim'),{opacity:.38,duration:1.2,ease:'sine.out'},1.15);` +
      `tl.fromTo(q('.burst'),{opacity:0,scale:.3},{opacity:1,scale:1,duration:1.4,ease:'expo.out'},1.08);` +
      `tl.fromTo(q('.rays'),{opacity:0,rotation:0},{opacity:1,rotation:24,duration:D,ease:'none'},1.1);` +
      `tl.fromTo(q('.kicker'),{opacity:0},{opacity:1,duration:.5,ease:'sine.out'},.6);` +
      `tl.fromTo(q('.title'),{opacity:0,scale:1.18},{opacity:1,scale:1,duration:1,ease:'power3.out'},1.1);`,
    textKeys: ['title', 'kicker'],
    extraScript: stage(['title', 'setting']),
    variables: [
      { id: 'title', type: 'string', label: 'The line the tale turns on', labels: { vi: 'Câu ngoặt của câu chuyện' }, default: 'Và rồi mọi thứ thay đổi.', sample: 'Cây bỗng run rẩy, những trái chín căng tròn rơi vào tay cậu.', maxLength: 90, required: true },
      { id: 'kicker', type: 'string', label: 'A few words before it ("Bỗng nhiên…", "Và rồi…"), or empty', labels: { vi: 'Vài chữ dẫn ("Bỗng nhiên…", "Và rồi…"), hoặc để trống' }, default: '', sample: 'Bỗng nhiên…', maxLength: 30 },
      settingVar('làng quê'),
      secondsVar,
    ],
  },
  moral: {
    role: 'outro',
    description: 'The close: “Bài học” and the moral of the tale in one sentence on a paper scroll under the evening landscape, with where the tale comes from and which version was told.',
    css:
      ground +
      '.paper-wrap{left:300px;right:300px;top:170px}' +
      '.paper{padding:64px 96px 70px;text-align:center}' +
      `.end{position:absolute;left:0;right:0;top:86px;text-align:center;font-style:italic;font-size:34px;line-height:1.4;color:${GOLD};text-shadow:0 3px 12px #000a}` +
      `.paper .label{color:${RUST};display:flex;align-items:center;justify-content:center;gap:20px}.paper .label i{display:block;width:70px;height:1.5px;background:${RUST}66}` +
      `.title{margin:26px 0 0;max-height:300px;overflow:hidden;font-size:62px;line-height:1.36;font-weight:600;font-style:italic;color:${INK}}` +
      `.rule{width:120px;height:2px;margin:34px auto 26px;background:${RUST}55}` +
      `.source{display:block;font-family:"Be Vietnam Pro",Arial,sans-serif;font-weight:800;letter-spacing:.14em;font-size:24px;line-height:1.4;color:${INK};text-transform:uppercase}` +
      `.version{display:block;margin-top:8px;font-size:26px;line-height:1.45;color:#6a4a32;font-style:italic;max-height:76px;overflow:hidden}`,
    markup: `${backdrop}
      <p class="end">— Hết —</p>
      <div class="paper-wrap"><div class="paper torn"><div class="label"><i></i>BÀI HỌC<i></i></div><p class="title"></p><div class="rule"></div><span class="source"></span><span class="version detail" data-optional="detail"></span></div></div>
      ${folio('TRUYỆN KỂ')}`,
    motion:
      ambient +
      `tl.fromTo(q('.dim'),{opacity:0},{opacity:.3,duration:1.6,ease:'sine.inOut'},.4);` +
      `tl.fromTo(q('.end'),{opacity:0,y:-10},{opacity:1,y:0,duration:.8,ease:'sine.out'},.4);` +
      `tl.fromTo(q('.paper-wrap'),{opacity:0,y:60,scaleY:.7,transformOrigin:'50% 0%'},{opacity:1,y:0,scaleY:1,duration:1,ease:'power3.out'},.6);` +
      `tl.fromTo(q('.title'),{opacity:0,y:16},{opacity:1,y:0,duration:.9,ease:'power2.out'},1.1);` +
      `tl.fromTo(q('.rule'),{scaleX:0},{scaleX:1,duration:.6,ease:'power2.out'},1.5);` +
      `tl.fromTo(root.querySelectorAll('.source,.version'),{opacity:0},{opacity:1,duration:.6,ease:'sine.out',stagger:.15},1.6);`,
    extraScript: stage(['title', 'setting']) + `fit('.title',40);`,
    variables: [
      {
        id: 'title',
        type: 'string',
        label: 'The moral, in one sentence',
        labels: { vi: 'Bài học, trong một câu' },
        default: 'Bài học của câu chuyện.',
        sample: 'Tình mẹ bao la như dòng sữa ngọt: hãy biết yêu thương khi mẹ còn bên ta.',
        maxLength: 110,
        required: true,
      },
      {
        id: 'source',
        type: 'string',
        label: 'Where the tale comes from: Truyện cổ tích Việt Nam, Ngụ ngôn Aesop, a newspaper…',
        labels: { vi: 'Truyện từ đâu: Truyện cổ tích Việt Nam, Ngụ ngôn Aesop, một tờ báo…' },
        default: 'Truyện cổ tích Việt Nam',
        sample: 'Truyện cổ tích Việt Nam',
        maxLength: 48,
        required: true,
      },
      {
        id: 'detail',
        type: 'string',
        label: 'Which version was told, or empty',
        labels: { vi: 'Kể theo bản nào, hoặc để trống' },
        default: '',
        sample: 'Kể theo bản trong sách Tiếng Việt lớp 2',
        maxLength: 80,
      },
      settingVar('đêm trăng'),
      secondsVar,
    ],
  },
};

const guide = `---
first: hook
last: outro
repeat: 3
---
Làm một phim truyện kể tiếng Việt, ngang 16:9, khoảng 100–120 giây, kể lại câu chuyện trong Brief: truyện cổ tích Việt Nam, truyện ngụ ngôn, truyện ngắn ý nghĩa, hay một chuyện có thật được kể lại. Giọng kể ấm, chậm, như bà kể chuyện trước giờ ngủ: câu ngắn, dễ nghe, có khoảng lặng ở khúc ngoặt.
Mỗi cảnh đứng trong một phong cảnh cắt giấy do biến setting vẽ ra. Chỉ viết một trong các từ: "đêm trăng", "mưa", "rừng", "làng quê", "biển", "thành phố", "cung điện". Đổi setting khi câu chuyện đổi nơi chốn hay thời tiết; giữ nguyên khi câu chuyện còn ở đó.
Nhân vật là emoji, đứng trên sân khấu như con rối: một emoji duy nhất cho mỗi nhân vật (👦 👧 👩 👵 🧓 👸 🤴 🐢 🐇 🐯 🦊 🐦 🐟 🐃…), và giữ đúng emoji đó cho nhân vật đó suốt phim. Để trống khi đoạn kể không nói về một nhân vật.
Mở đầu bằng cảnh hook (story-hook): tên truyện, câu mở đầu ("Ngày xửa ngày xưa…", "Chuyện kể rằng…", hoặc với chuyện có thật: "Câu chuyện này có thật…" chỉ khi có nguồn), thể loại, setting của đoạn đầu và nhân vật chính.
Phần thân là các cảnh story-narrate nối nhau (tối đa 3 cảnh liền nhau, rồi chen một cảnh khác): mỗi cảnh một đoạn 1–2 câu (tối đa 180 ký tự), một dòng nhỏ ở đâu hay khi nào (tối đa 30 ký tự), kể theo đúng trình tự của truyện. Dùng story-dialogue (một đến hai lần) khi hai nhân vật nói với nhau: mỗi lời tối đa 110 ký tự, đúng ý của bản gốc. Đặt story-moment (một lần) ở khúc ngoặt của truyện: một câu ngắn, tối đa 90 ký tự, và vài chữ dẫn nếu muốn.
Khép lại bằng cảnh outro (story-moral): bài học trong một câu, nhẹ nhàng, không giảng giải; nguồn (thể loại hay nơi đưa tin) và kể theo bản nào.
Lời kể của mỗi cảnh dài vừa đủ cho cảnh đó (khoảng 10–18 giây), tổng cộng khoảng 7–10 cảnh.
Trung thực: với truyện cổ tích, truyền thuyết, ngụ ngôn, kể lại trung thành theo bản Research tìm được và ghi bản đó ở cảnh cuối (ví dụ "Kể theo Kho tàng truyện cổ tích Việt Nam, Nguyễn Đổng Chi"); khi có nhiều dị bản, chọn một bản và kể theo bản đó. Không thêm nhân vật, tình tiết hay kết thúc mà bản gốc không có; lời thoại có thể kể lại bằng lời mình nhưng không đổi ý. Với chuyện có thật: chỉ kể điều có nguồn, ghi nguồn ở cảnh cuối, không bịa tên, ngày tháng, con số hay lời nói; nếu Research không xác minh được, gọi đó là "một câu chuyện" hay "ngụ ngôn" và ghi thể loại là "Câu chuyện suy ngẫm", không gọi là chuyện có thật.`;

// Keep the workflow JSON in sync with the five scenes and the guide.
await editComposition(new URL('./workflow.json', import.meta.url), (files) => {
  for (const key of Object.keys(files)) delete files[key];
  // The shell the Studio previews and the inspector lints, until a run has Assemble write the entry.
  files['index.html'] = filmShell({ id: 'tales-shell', width: W, height: H, background: '#0a0a1f' });
  for (const [kind, scene] of Object.entries(scenes)) files[`compositions/story-${kind}.html`] = sceneBlock({ ...scene, id: `story-${kind}`, width: W, height: H, seconds: 4, fonts: FONTS });
  files['storyboard-guide.md'] = guide;
});
