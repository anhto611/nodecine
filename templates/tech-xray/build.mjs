import { component, editComposition, filmShell, sceneBlock } from '../_kit/build.mjs';

/**
 * Inside the machine: how a piece of technology works, drawn as an x-ray.
 *
 * The grammar of the neon-blueprint explainer: the object is a hologram — glowing blue lines on a deep
 * navy night with faint stars, sometimes over a Tron grid floor — and the part the voice is talking about
 * lights up red. The camera never cuts inside a scene: it drifts and pushes in from part to part. The
 * frame is portrait, but the picture lives in a 4:3 band across the middle with black above and below;
 * a round mark sits in the band's top-right corner, the channel's handle in its bottom-right, and one
 * line of white subtitle — the scene's own sentence — at its foot.
 *
 * The hologram is not drawn by anyone: it is the Assets node's own pictures (a product shot on a plain
 * ground, a side view, a technical drawing, a cutaway) put through an SVG filter. The filter takes the
 * picture's luminance, finds its edges with a Laplacian (both signs, so a line comes out of a light edge
 * and of a dark one), turns their strength into neon blue with a hot white core, blooms it twice, and
 * lays a faint blue body under it from the inverted luminance — a grey car on white becomes dark glass
 * with glowing outlines. The highlighted part is the same picture through the same chain in red, clipped
 * to the box the writer marks, with a soft bloom that pulses. Where a picture is on a dark ground the
 * body would light the ground, so the writer picks the "lines" look; where its edges are weak, "negative"
 * (an x-ray film) or "plain" (the photo tinted blue under scanlines). With no picture at all, a code-drawn
 * neon machine — a cylinder, a piston, two gears — stands in, so the film still stands.
 *
 * Six blocks: a hook that scans the object in, the focus scene that is the film's workhorse (the camera
 * moves into a box and the part lights red), a flow of particles along a path (gas, air, fire), a big
 * neon number, an everyday analogy as a small neon icon, and the open-ended outro.
 */

const W = 1080;
const H = 1920;
/** The 4:3 band the picture lives in, centred in the portrait frame. */
const BAND_W = 1080;
const BAND_H = 810;
const BAND_TOP = (H - BAND_H) / 2;
/** The box the picture is fitted into inside the band: above the subtitle. */
const VIEW_H = 680;
const FIT_W = 1000;
const FIT_H = 590;

const BLUE = '#3fa9ff';
const ICE = '#8fd3ff';
const CORE = '#dff3ff';
const RED = '#ff3b2f';
const EMBER = '#ff8a5c';
const NIGHT = '#020713';

/** Be Vietnam Pro carries the Vietnamese alphabet. */
const FONTS = 'https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@500;700;800;900&display=swap';
const SANS = '"Be Vietnam Pro",Arial,sans-serif';
const HANDLE = '@NODECINE';

/* ------------------------------------------------------------------------------------------------ */
/* Drawn at build time: the night sky, the noise, the stand-in machine, the icons.                   */
/* ------------------------------------------------------------------------------------------------ */

/** A seeded generator, so the stars land in the same place on every build. */
function seeded(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const svgUrl = (svg) => `url("data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}")`;

const STARS = (() => {
  const rnd = seeded(1949);
  const dots = Array.from({ length: 150 }, () => {
    const r = rnd() < 0.86 ? 0.5 + rnd() * 0.9 : 1.3 + rnd() * 1.1;
    return `<circle cx='${(rnd() * 1160).toFixed(1)}' cy='${(rnd() * 890).toFixed(1)}' r='${r.toFixed(2)}' fill='${rnd() < 0.7 ? '#cfe6ff' : '#7fb8ff'}' opacity='${(0.25 + rnd() * 0.7).toFixed(2)}'/>`;
  }).join('');
  return svgUrl(`<svg xmlns='http://www.w3.org/2000/svg' width='1160' height='890'>${dots}</svg>`);
})();
const NOISE = svgUrl(
  "<svg xmlns='http://www.w3.org/2000/svg' width='300' height='300'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 .55 0 0 0 0 .75 0 0 0 0 1 0 0 0 1.4 -.6'/></filter><rect width='100%' height='100%' filter='url(#n)'/></svg>",
);
const NEBULA = svgUrl(
  "<svg xmlns='http://www.w3.org/2000/svg' width='1160' height='890'><filter id='m'><feTurbulence type='fractalNoise' baseFrequency='.0035 .006' numOctaves='4' seed='11'/><feColorMatrix values='0 0 0 0 .08 0 0 0 0 .25 0 0 0 0 .7 0 0 0 1.6 -.72'/></filter><rect width='100%' height='100%' filter='url(#m)'/></svg>",
);

/** A gear as one closed path, centred where it is drawn, so it turns about its own middle. */
function gearPath(cx, cy, r, teeth, depth) {
  const pts = [];
  for (let i = 0; i < teeth * 4; i++) {
    const a = (i / (teeth * 4)) * Math.PI * 2;
    const rr = i % 4 === 0 || i % 4 === 1 ? r : r - depth;
    pts.push(`${(cx + rr * Math.cos(a)).toFixed(1)} ${(cy + rr * Math.sin(a)).toFixed(1)}`);
  }
  return `M${pts.join(' L')} Z`;
}

/**
 * The stand-in machine, in a 900×560 box: a cylinder with its piston and rod, a crank wheel, two gears
 * in mesh, a pipe and the faint dimension lines of a blueprint. Its moving parts carry `ph-*` classes.
 */
const MACHINE = [
  `<g class="ph-dim"><path d="M40 500 L860 500 M40 490 L40 510 M860 490 L860 510 M80 40 L80 470 M70 40 L90 40 M70 470 L90 470"/><path d="M220 30 L220 540 M560 120 L560 480" stroke-dasharray="10 8"/></g>`,
  `<g class="ph-body"><path d="M130 70 L130 330 M310 70 L310 330 M118 70 L322 70 M118 58 L322 58 L322 70 M118 58 L118 70"/><path d="M322 110 L420 110 L420 200 M322 130 L400 130 L400 200"/><circle cx="220" cy="420" r="92"/><circle cx="220" cy="420" r="14"/></g>`,
  `<g class="ph-crank"><path d="M220 420 L220 352"/><circle cx="220" cy="352" r="10"/><path d="M168 420 A52 52 0 0 1 272 420"/></g>`,
  `<g class="ph-pis"><rect x="142" y="140" width="156" height="86" rx="6"/><path d="M142 160 L298 160 M142 174 L298 174"/><path d="M220 226 L220 330"/></g>`,
  `<path class="ph-g1" d="${gearPath(560, 300, 140, 18, 16)}"/>`,
  `<circle class="ph-hub" cx="560" cy="300" r="34"/>`,
  `<path class="ph-g2" d="${gearPath(740, 196, 80, 11, 14)}"/>`,
  `<circle class="ph-hub" cx="740" cy="196" r="20"/>`,
].join('');

/**
 * The neon icons an analogy may use, each in a 200×200 box. A part that moves is a `<g>` or a shape of
 * its own with an `nia-*` class and no transform attribute, so GSAP may move it.
 */
const ICONS = {
  balloon: {
    label: 'bong bóng xì hơi',
    svg: `<g class="nia-move"><ellipse cx="82" cy="100" rx="58" ry="44"/><path d="M140 92 L156 100 L140 108 Z"/><path class="ni-thin" d="M52 76 Q62 64 80 62"/></g><g class="nia-air"><path d="M158 100 L198 84"/><path d="M158 100 L200 100"/><path d="M158 100 L198 116"/></g>`,
  },
  rocket: {
    label: 'tên lửa',
    svg: `<g class="nia-move"><path d="M100 22 C124 44 130 86 124 126 L76 126 C70 86 76 44 100 22 Z"/><circle cx="100" cy="74" r="13"/><path d="M76 104 L54 136 L77 130 M124 104 L146 136 L123 130"/><path class="nia-flame ni-hot" d="M84 132 Q100 186 116 132"/></g>`,
  },
  spring: {
    label: 'lò xo',
    svg: `<path d="M56 176 L144 176"/><g class="nia-coil"><path d="M100 172 L100 160 L70 150 L130 136 L70 122 L130 108 L70 94 L130 80 L70 66 L130 52 L100 42 L100 34"/></g><path class="nia-plate" d="M60 30 L140 30"/>`,
  },
  magnet: {
    label: 'nam châm',
    svg: `<path class="ni-bold" d="M62 84 L62 140 A38 38 0 0 0 138 140 L138 84"/><path class="ni-hot" d="M50 84 L74 84 M126 84 L150 84"/><path class="nia-f nia-f1" d="M62 70 Q100 38 138 70"/><path class="nia-f nia-f2" d="M54 66 Q100 14 146 66"/><path class="nia-f nia-f3" d="M46 62 Q100 -8 154 62"/>`,
  },
  wave: {
    label: 'sóng',
    svg: `<path class="nia-w1" d="M-100 100 Q-75 56 -50 100 T0 100 T50 100 T100 100 T150 100 T200 100 T250 100 T300 100"/><path class="nia-w2 ni-thin" d="M-100 132 Q-75 112 -50 132 T0 132 T50 132 T100 132 T150 132 T200 132 T250 132 T300 132"/>`,
  },
  gear: {
    label: 'bánh răng',
    svg: `<path class="nia-g1" d="${gearPath(82, 112, 56, 14, 10)}"/><circle cx="82" cy="112" r="14"/><path class="nia-g2" d="${gearPath(148, 58, 34, 9, 8)}"/><circle cx="148" cy="58" r="8"/>`,
  },
  piston: {
    label: 'pít-tông',
    svg: `<path d="M62 20 L62 120 M138 20 L138 120 M56 20 L144 20"/><g class="nia-pis"><rect x="68" y="44" width="64" height="36" rx="4"/><path d="M100 80 L100 128"/></g><circle cx="100" cy="158" r="30"/><g class="nia-crank"><path d="M100 158 L100 134"/><circle cx="100" cy="134" r="5"/></g>`,
  },
  fan: {
    label: 'quạt',
    svg: `<circle cx="100" cy="100" r="84"/><g class="nia-spin"><path d="M100 100 C96 66 112 34 132 30 C142 52 128 84 100 100 Z"/><path d="M100 100 C130 116 148 148 136 166 C112 166 92 132 100 100 Z"/><path d="M100 100 C70 116 34 112 26 92 C40 74 76 76 100 100 Z"/></g><circle cx="100" cy="100" r="12"/>`,
  },
  battery: {
    label: 'pin',
    svg: `<rect x="66" y="40" width="68" height="136" rx="10"/><path d="M88 30 L112 30 L112 40 L88 40 Z"/><rect class="nia-b nia-b1" x="78" y="146" width="44" height="20" rx="3"/><rect class="nia-b nia-b2" x="78" y="120" width="44" height="20" rx="3"/><rect class="nia-b nia-b3" x="78" y="94" width="44" height="20" rx="3"/><rect class="nia-b nia-b4" x="78" y="68" width="44" height="20" rx="3"/>`,
  },
  lightning: {
    label: 'tia điện',
    svg: `<path class="nia-bolt ni-hot" d="M114 18 L62 108 L98 108 L82 182 L142 82 L104 82 L126 18 Z"/>`,
  },
  drop: {
    label: 'giọt nước',
    svg: `<path class="nia-drop" d="M100 24 C100 24 64 78 64 108 A36 36 0 0 0 136 108 C136 78 100 24 100 24 Z"/><ellipse class="nia-ripple" cx="100" cy="176" rx="40" ry="8"/>`,
  },
  flame: {
    label: 'ngọn lửa',
    svg: `<path class="nia-fo ni-hot" d="M100 18 C130 64 152 98 142 138 A42 42 0 0 1 58 138 C48 98 78 76 100 18 Z"/><path class="nia-fi" d="M100 80 C116 104 122 126 116 146 A16 16 0 0 1 84 146 C78 126 88 108 100 80 Z"/>`,
  },
};
const ICON_NAMES = Object.keys(ICONS);
const ICON_LIBRARY = JSON.stringify(Object.fromEntries(Object.entries(ICONS).map(([k, i]) => [k, i.svg])));

/** How each icon moves, from its own classes. `D` is the length, `R(p)` a bounded repeat count for a cycle of p seconds. */
const ICON_MOTION = `var niMove=function(s,name,D,R){var A=function(c){return s.querySelectorAll('.'+c)};
 if(name==='balloon'){tl.fromTo(A('nia-move'),{x:10,scale:1},{x:-22,scale:.88,transformOrigin:'50% 50%',duration:D,ease:'sine.out'},0);A('nia-air').forEach(function(g){g.querySelectorAll('path').forEach(function(p,i){p.setAttribute('stroke-dasharray','6 12');tl.fromTo(p,{strokeDashoffset:i*5},{strokeDashoffset:i*5-60*D,duration:D,ease:'none'},0)})})}
 else if(name==='rocket'){tl.fromTo(A('nia-move'),{y:14},{y:-14,duration:D,ease:'sine.inOut'},0);tl.fromTo(A('nia-flame'),{scaleY:.7,transformOrigin:'50% 0%'},{scaleY:1.15,duration:.16,ease:'sine.inOut',yoyo:true,repeat:R(.32)*2+1},0)}
 else if(name==='spring'){tl.fromTo(A('nia-coil'),{scaleY:1,transformOrigin:'50% 100%'},{scaleY:.62,duration:.7,ease:'sine.inOut',yoyo:true,repeat:R(1.4)*2+1},0);tl.fromTo(A('nia-plate'),{y:0},{y:52,duration:.7,ease:'sine.inOut',yoyo:true,repeat:R(1.4)*2+1},0)}
 else if(name==='magnet'){['nia-f1','nia-f2','nia-f3'].forEach(function(c,i){tl.fromTo(A(c),{opacity:.15},{opacity:1,duration:.5,ease:'sine.inOut',yoyo:true,repeat:R(1)*2+1},i*.22)})}
 else if(name==='wave'){tl.fromTo(A('nia-w1'),{x:0},{x:-100*Math.max(1,Math.round(D/1.1)),duration:D,ease:'none'},0);tl.fromTo(A('nia-w2'),{x:-50},{x:-50-100*Math.max(1,Math.round(D/1.6)),duration:D,ease:'none'},0)}
 else if(name==='gear'){tl.fromTo(A('nia-g1'),{rotation:0,transformOrigin:'50% 50%'},{rotation:70*D,duration:D,ease:'none'},0);tl.fromTo(A('nia-g2'),{rotation:0,transformOrigin:'50% 50%'},{rotation:-70*D*14/9,duration:D,ease:'none'},0)}
 else if(name==='piston'){tl.fromTo(A('nia-pis'),{y:0},{y:30,duration:.45,ease:'sine.inOut',yoyo:true,repeat:R(.9)*2+1},0);tl.fromTo(A('nia-crank'),{rotation:0,svgOrigin:'100 158'},{rotation:360*Math.max(1,R(.9)+1),duration:.9*Math.max(1,R(.9)+1),ease:'none'},0)}
 else if(name==='fan'){tl.fromTo(A('nia-spin'),{rotation:0,svgOrigin:'100 100'},{rotation:300*D,duration:D,ease:'none'},0)}
 else if(name==='battery'){['nia-b1','nia-b2','nia-b3','nia-b4'].forEach(function(c,i){tl.fromTo(A(c),{opacity:.08},{opacity:1,duration:.25,ease:'sine.out'},.25+i*.3)})}
 else if(name==='lightning'){tl.fromTo(A('nia-bolt'),{opacity:.35},{opacity:1,duration:.09,ease:'steps(1)',yoyo:true,repeat:R(.5)*2+1},0)}
 else if(name==='drop'){tl.fromTo(A('nia-drop'),{y:-24,opacity:0},{y:30,opacity:1,duration:.9,ease:'power2.in',repeat:R(1.3)},0);tl.fromTo(A('nia-ripple'),{scale:.2,opacity:0,transformOrigin:'50% 50%'},{scale:1.4,opacity:1,duration:.4,ease:'sine.out',repeat:R(1.3),repeatDelay:.9},.9)}
 else if(name==='flame'){tl.fromTo(A('nia-fo'),{scaleY:.93,scaleX:1.03,transformOrigin:'50% 100%'},{scaleY:1.07,scaleX:.96,duration:.21,ease:'sine.inOut',yoyo:true,repeat:R(.42)*2+1},0);tl.fromTo(A('nia-fi'),{scaleY:1.08,transformOrigin:'50% 100%'},{scaleY:.9,duration:.15,ease:'sine.inOut',yoyo:true,repeat:R(.3)*2+1},0)}};`;

/* ------------------------------------------------------------------------------------------------ */
/* The hologram: the filters every picture goes through.                                            */
/* ------------------------------------------------------------------------------------------------ */

/**
 * One filter chain per look, all in the picture's own box (`x=0 y=0 width=100% height=100%`), so the
 * edge of the picture itself never reads as a line.
 *
 *   luminance → a slight blur (JPEG noise and fine texture fall below the edge threshold) → a Laplacian
 *   in both signs, summed (a line from either side of an edge) → its strength as alpha, gain 5 over a
 *   floor of .12 → dilated by a pixel, so a line holds at 1080 → that line in near-white, a blue copy
 *   bloomed at 3 and 12 px → under it all, the inverted luminance as a faint body ("holo" only).
 *
 * The red chain is the same with an ember core and a stronger body: the part reads filled, not traced.
 */
const edges = `<feColorMatrix in="SourceGraphic" type="matrix" values=".3 .59 .11 0 0 .3 .59 .11 0 0 .3 .59 .11 0 0 0 0 0 0 1" result="L"/><feGaussianBlur in="L" stdDeviation=".8" result="Ls"/><feConvolveMatrix in="Ls" order="3" kernelMatrix="-1 -1 -1 -1 8 -1 -1 -1 -1" edgeMode="duplicate" preserveAlpha="true" result="e1"/><feConvolveMatrix in="Ls" order="3" kernelMatrix="1 1 1 1 -8 1 1 1 1" edgeMode="duplicate" preserveAlpha="true" result="e2"/><feComposite in="e1" in2="e2" operator="arithmetic" k2="1" k3="1" result="E"/>`;
const neon = (core, glow, id) =>
  `<feColorMatrix in="E" type="matrix" values="0 0 0 0 ${core[0]} 0 0 0 0 ${core[1]} 0 0 0 0 ${core[2]} 5 0 0 0 -.12" result="${id}l0"/><feMorphology in="${id}l0" operator="dilate" radius=".7" result="${id}l"/><feColorMatrix in="${id}l" type="matrix" values="0 0 0 0 ${glow[0]} 0 0 0 0 ${glow[1]} 0 0 0 0 ${glow[2]} 0 0 0 1 0" result="${id}c"/><feGaussianBlur in="${id}c" stdDeviation="3" result="${id}g1"/><feGaussianBlur in="${id}c" stdDeviation="12" result="${id}g2"/>`;
const body = (rgb, strength, id) =>
  `<feColorMatrix in="L" type="matrix" values="0 0 0 0 ${rgb[0]} 0 0 0 0 ${rgb[1]} 0 0 0 0 ${rgb[2]} -${strength} 0 0 0 ${strength}" result="${id}b0"/><feGaussianBlur in="${id}b0" stdDeviation="1.5" result="${id}b"/>`;
const merge = (id, withBody) => `<feMerge>${withBody ? `<feMergeNode in="${id}b"/>` : ''}<feMergeNode in="${id}g2"/><feMergeNode in="${id}g1"/><feMergeNode in="${id}g1"/><feMergeNode in="${id}l"/></feMerge>`;
const filterTag = (id, inner) => `<filter id="${id}" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">${inner}</filter>`;
const BLUE_CORE = [0.78, 0.92, 1];
const BLUE_GLOW = [0.16, 0.55, 1];
const RED_CORE = [1, 0.84, 0.76];
const RED_GLOW = [1, 0.16, 0.08];
const FILTERS =
  '<svg class="xr-defs" width="0" height="0" aria-hidden="true" style="position:absolute;width:0;height:0;overflow:hidden">' +
  filterTag('xr-holo', edges + neon(BLUE_CORE, BLUE_GLOW, 'h') + body([0.1, 0.32, 0.85], 0.5, 'h') + merge('h', true)) +
  filterTag('xr-lines', edges + neon(BLUE_CORE, BLUE_GLOW, 'n') + merge('n', false)) +
  filterTag('xr-red', edges + neon(RED_CORE, RED_GLOW, 'r') + body([1, 0.17, 0.1], 0.95, 'r') + merge('r', true)) +
  filterTag('xr-redline', edges + neon(RED_CORE, RED_GLOW, 's') + merge('s', false)) +
  // An x-ray film: the inverted luminance in blue, with the edges laid over it.
  filterTag(
    'xr-neg',
    edges +
      neon(BLUE_CORE, BLUE_GLOW, 'x') +
      '<feColorMatrix in="L" type="matrix" values="-.3 0 0 0 .3 -.62 0 0 0 .62 -1 0 0 0 1 0 0 0 0 1" result="xb"/><feMerge><feMergeNode in="xb"/><feMergeNode in="xg1"/><feMergeNode in="xl"/></feMerge>',
  ) +
  // The photo itself, tinted: night for its shadows, ice for its lights.
  filterTag('xr-plain', '<feColorMatrix in="SourceGraphic" type="matrix" values=".09 .18 .03 0 .01 .2 .4 .07 0 .03 .3 .58 .11 0 .07 0 0 0 1 0"/>') +
  '</svg>';

/* ------------------------------------------------------------------------------------------------ */
/* What every part's script shares.                                                                 */
/* ------------------------------------------------------------------------------------------------ */

/**
 * Reading values, seeded randomness, fitting the picture, and the three things drawn per scene: the
 * red highlight boxes, the particle flows and the stand-in machine. `P` is the class prefix of the part
 * that runs it, so a component mounted over a block never styles the block's own pieces.
 */
const RUNTIME = `var xrS=function(k){return String(v[k]==null?'':v[k]).trim()};
var xrC=function(x,a,b){return Math.max(a,Math.min(b,x))};
var xrJ=function(raw){if(raw==null)return null;if(typeof raw!=='string')return raw;var s=raw.trim();if(!s)return null;try{return JSON.parse(s)}catch(e){var n=s.match(/-?\\d+(?:\\.\\d+)?/g);return n?n.map(Number):null}};
var xrBoxes=function(raw){var a=xrJ(raw);if(!Array.isArray(a)||!a.length)return[];if(typeof a[0]==='number'){var f=[];for(var i=0;i+3<a.length;i+=4)f.push(a.slice(i,i+4));a=f}var out=[];a.forEach(function(b){if(b&&!Array.isArray(b)&&typeof b==='object')b=[b.left!=null?b.left:b.x,b.top!=null?b.top:b.y,b.width!=null?b.width:b.w,b.height!=null?b.height:b.h];if(!Array.isArray(b)||b.length<4)return;var n=b.slice(0,4).map(Number);if(n.some(function(x){return !isFinite(x)}))return;if(n.every(function(x){return x>=0&&x<=1}))n=n.map(function(x){return x*100});var l=xrC(n[0],0,97),t=xrC(n[1],0,97);out.push([l,t,xrC(n[2],3,100-l),xrC(n[3],3,100-t)])});return out.slice(0,3)};
var xrUnion=function(bs){if(!bs.length)return null;var l=100,t=100,r=0,b=0;bs.forEach(function(x){l=Math.min(l,x[0]);t=Math.min(t,x[1]);r=Math.max(r,x[0]+x[2]);b=Math.max(b,x[1]+x[3])});return[l,t,r-l,b-t]};
var xrCam=function(b,k){k=k||1;if(!b)return{scale:1.02*k,xPercent:0,yPercent:0};var cx=b[0]+b[2]/2,cy=b[1]+b[3]/2,s=xrC(Math.min(46/b[2],58/b[3]),1.15,2.1)*k;return{scale:s,xPercent:-s*(cx-50),yPercent:-s*(cy-50)}};
var xrSeed=function(s){var h=2166136261;s=String(s);for(var i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}return h>>>0};
var xrRng=function(seed){var a=seed>>>0;return function(){a=(a+0x6D2B79F5)>>>0;var t=a;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296}};
var xrSize=null,xrOnSize=[];var xrSized=function(f){xrOnSize.push(f);if(xrSize)f(xrSize[0],xrSize[1])};var xrSetSize=function(w,h){xrSize=[w,h];xrOnSize.forEach(function(f){f(w,h)})};
var xrFit=function(img,mw,mh){var go=function(){var nw=img.naturalWidth,nh=img.naturalHeight;if(!nw||!nh)return;var s=Math.min(mw/nw,mh/nh),w=Math.round(nw*s),h=Math.round(nh*s);img.style.width=w+'px';img.style.height=h+'px';xrSetSize(w,h)};go();img.addEventListener('load',go)};
var xrLook=function(){var l=xrS('look').toLowerCase();return ['holo','lines','negative','plain'].indexOf(l)<0?'holo':l};
var xrMachine=${JSON.stringify(MACHINE)};
var xrHL=function(host,P,boxes,src,look){host.innerHTML='';var red=look==='holo'||look==='negative'?'xr-red':'xr-redline';boxes.forEach(function(b0){var l=Math.max(0,b0[0]-b0[2]*.08),t=Math.max(0,b0[1]-b0[3]*.08),b=[l,t,Math.min(100-l,b0[2]*1.16),Math.min(100-t,b0[3]*1.16)];var el=document.createElement('div');el.className=P+'-hbox';el.style.left=b[0]+'%';el.style.top=b[1]+'%';el.style.width=b[2]+'%';el.style.height=b[3]+'%';var pos='left:'+(-b[0]/b[2]*100)+'%;top:'+(-b[1]/b[3]*100)+'%;width:'+(1e4/b[2])+'%;height:'+(1e4/b[3])+'%';el.innerHTML='<div class="'+P+'-hglow"></div><div class="'+P+'-hclip"><div class="'+P+'-hwash"></div>'+(src?'<img class="'+P+'-hcopy" alt="" style="'+pos+';filter:url(#'+red+')">':'<svg class="'+P+'-hcopy '+P+'-ph '+P+'-ph-red" viewBox="0 0 900 560" style="'+pos+'">'+xrMachine+'</svg>')+'</div><i class="'+P+'-k '+P+'-k1"></i><i class="'+P+'-k '+P+'-k2"></i><i class="'+P+'-k '+P+'-k3"></i><i class="'+P+'-k '+P+'-k4"></i>';if(src)el.querySelector('img').setAttribute('src',src);host.appendChild(el)})};
var xrPaths=function(raw){var a=xrJ(raw);if(!Array.isArray(a)||!a.length)return[];if(typeof a[0]==='number'){var p=[];for(var i=0;i+1<a.length;i+=2)p.push([a[i],a[i+1]]);a=[p]}else if(Array.isArray(a[0])&&typeof a[0][0]!=='object')a=[a];return a.slice(0,3).map(function(p){return(Array.isArray(p)?p:[]).filter(function(q){return Array.isArray(q)&&q.length>=2&&isFinite(+q[0])&&isFinite(+q[1])}).map(function(q){return[xrC(+q[0],-10,110),xrC(+q[1],-10,110)]})}).filter(function(p){return p.length>=2})};
var xrSmooth=function(p){var d='M'+p[0][0].toFixed(2)+' '+p[0][1].toFixed(2);for(var i=0;i<p.length-1;i++){var a=p[Math.max(0,i-1)],b=p[i],c=p[i+1],e=p[Math.min(p.length-1,i+2)];d+=' C'+(b[0]+(c[0]-a[0])/6).toFixed(2)+' '+(b[1]+(c[1]-a[1])/6).toFixed(2)+' '+(c[0]-(e[0]-b[0])/6).toFixed(2)+' '+(c[1]-(e[1]-b[1])/6).toFixed(2)+' '+c[0].toFixed(2)+' '+c[1].toFixed(2)}return d};
var xrOffset=function(p,off){var n=p.length;return p.map(function(q,i){var a=p[Math.max(0,i-1)],b=p[Math.min(n-1,i+1)],dx=b[0]-a[0],dy=b[1]-a[1],l=Math.sqrt(dx*dx+dy*dy)||1,g=off*(.35+.9*i/(n-1));return[q[0]-dy/l*g,q[1]+dx/l*g]})};
var XR_COLORS={blue:['#cfeaff','#3fa9ff'],cyan:['#d6fbff','#2fe0ff'],red:['#ffd2c8','#ff2a1a'],orange:['#ffe0b8','#ff7a1a'],white:['#ffffff','#9fd8ff']};
var xrFlow=function(svg,P,paths,color,back,arrow){var NS='http://www.w3.org/2000/svg',col=XR_COLORS[color]||XR_COLORS.blue,rnd=xrRng(xrSeed(JSON.stringify(paths)+color)),out=[],shapes=[];svg.innerHTML='';svg.style.color=col[0];svg.style.setProperty('--glow',col[1]);var mk=function(tag,at){var e=document.createElementNS(NS,tag);for(var k in at)e.setAttribute(k,at[k]);svg.appendChild(e);return e};
 paths.forEach(function(pts){if(back)pts=pts.slice().reverse();[[30,.07],[14,.1],[3,.28]].forEach(function(d){shapes.push({el:mk('path',{'class':P+'-fduct','stroke-width':d[0],opacity:d[1]}),pts:pts})});for(var k=0;k<11;k++){var o0=rnd()*10,sp=14+rnd()*18;var el=mk('path',{pathLength:'100','class':P+'-fdot','stroke-width':(2+rnd()*6).toFixed(1),'stroke-dasharray':'0.01 '+(2.6+rnd()*4.4).toFixed(2),'stroke-dashoffset':o0.toFixed(2),opacity:(.35+rnd()*.65).toFixed(2)});shapes.push({el:el,pts:xrOffset(pts,(rnd()-.5)*9)});out.push({el:el,o:o0,sp:sp})}if(arrow)shapes.push({el:mk('path',{'class':P+'-farrow'}),pts:pts,arrow:true})});
 var layout=function(w,h){svg.setAttribute('viewBox','0 0 '+w+' '+h);shapes.forEach(function(s){var p=s.pts.map(function(q){return[q[0]*w/100,q[1]*h/100]});if(!s.arrow){s.el.setAttribute('d',xrSmooth(p));return}var a=p[p.length-2],b=p[p.length-1],dx=b[0]-a[0],dy=b[1]-a[1],l=Math.sqrt(dx*dx+dy*dy)||1;dx/=l;dy/=l;var L=Math.max(16,(w+h)*.022),c=Math.cos(.55),n=Math.sin(.55);s.el.setAttribute('d','M'+(b[0]-L*(dx*c-dy*n)).toFixed(1)+' '+(b[1]-L*(dy*c+dx*n)).toFixed(1)+' L'+b[0].toFixed(1)+' '+b[1].toFixed(1)+' L'+(b[0]-L*(dx*c+dy*n)).toFixed(1)+' '+(b[1]-L*(dy*c-dx*n)).toFixed(1))})};layout(100,100);return{dots:out,layout:layout}};`;

/** The stand-in machine's own motion, for every copy of it in the part. */
const machineMotion = (P) =>
  `var phA=function(c){return root.querySelectorAll('.${P}-ph .'+c)};tl.fromTo(phA('ph-g1'),{rotation:0,svgOrigin:'560 300'},{rotation:24*D,duration:D,ease:'none'},0);tl.fromTo(phA('ph-g2'),{rotation:0,svgOrigin:'740 196'},{rotation:-24*D*18/11,duration:D,ease:'none'},0);tl.fromTo(phA('ph-pis'),{y:0},{y:56,duration:.5,ease:'sine.inOut',yoyo:true,repeat:R(1)*2+1},0);tl.fromTo(phA('ph-crank'),{rotation:0,svgOrigin:'220 420'},{rotation:180*(R(1)+1)*2,duration:(R(1)+1)*2*.5,ease:'none'},0);`;

/* ------------------------------------------------------------------------------------------------ */
/* Styles.                                                                                           */
/* ------------------------------------------------------------------------------------------------ */

/** The hologram stage: the fitted picture (or the stand-in), its looks, its highlight boxes and flows. */
const stageCss = (P) =>
  `.${P}-stage{position:relative;flex:none;transform-origin:50% 50%}` +
  `.${P}-img{display:none;max-width:${FIT_W}px;max-height:${FIT_H}px;filter:url(#xr-holo);-webkit-mask-image:linear-gradient(90deg,transparent,#000 2.5%,#000 97.5%,transparent),linear-gradient(transparent,#000 2.5%,#000 97.5%,transparent);-webkit-mask-composite:source-in;mask-image:linear-gradient(90deg,transparent,#000 2.5%,#000 97.5%,transparent),linear-gradient(transparent,#000 2.5%,#000 97.5%,transparent);mask-composite:intersect}` +
  `.${P}-on .${P}-img{display:block}.${P}-on .${P}-ph-main{display:none}` +
  `.${P}-look-lines .${P}-img{filter:url(#xr-lines)}.${P}-look-negative .${P}-img{filter:url(#xr-neg)}.${P}-look-plain .${P}-img{filter:url(#xr-plain) brightness(1.25) contrast(1.1)}` +
  `.${P}-scanov{position:absolute;inset:0;display:none;pointer-events:none;background:repeating-linear-gradient(0deg,#02071399 0 2px,transparent 2px 5px)}.${P}-look-negative .${P}-scanov,.${P}-look-plain .${P}-scanov{display:block}` +
  `.${P}-ph{display:block;width:900px;height:560px;max-width:none;overflow:visible;fill:none;stroke:${ICE};stroke-width:3.2;stroke-linecap:round;stroke-linejoin:round;filter:drop-shadow(0 0 3px ${BLUE}) drop-shadow(0 0 14px ${BLUE})}` +
  `.${P}-ph .ph-dim{stroke:${BLUE};stroke-width:1.4;opacity:.55}.${P}-ph .ph-g1,.${P}-ph .ph-g2,.${P}-ph .ph-pis rect{fill:#3fa9ff14}` +
  `.${P}-ph-red{stroke:#ffb4a4;filter:drop-shadow(0 0 3px ${RED}) drop-shadow(0 0 14px ${RED})}.${P}-ph-red .ph-g1,.${P}-ph-red .ph-g2,.${P}-ph-red .ph-pis rect{fill:#ff3b2f40}.${P}-ph-red .ph-dim{opacity:0}` +
  `.${P}-hl{position:absolute;inset:0;pointer-events:none}` +
  `.${P}-hbox{position:absolute}` +
  `.${P}-hglow{position:absolute;inset:-45%;background:radial-gradient(closest-side,${RED}66 0,${RED}26 48%,transparent 100%);mix-blend-mode:screen}` +
  `.${P}-hclip{position:absolute;inset:0;overflow:hidden;-webkit-mask-image:linear-gradient(90deg,transparent,#000 10%,#000 90%,transparent),linear-gradient(transparent,#000 10%,#000 90%,transparent);-webkit-mask-composite:source-in;mask-image:linear-gradient(90deg,transparent,#000 10%,#000 90%,transparent),linear-gradient(transparent,#000 10%,#000 90%,transparent);mask-composite:intersect}` +
  `.${P}-hclip>.${P}-hcopy{position:absolute;max-width:none;max-height:none;margin:0}` +
  `.${P}-hwash{position:absolute;inset:0;background:radial-gradient(closest-side,${RED}38,${RED}10 70%,transparent)}` +
  `.${P}-k{position:absolute;width:12%;height:12%;min-width:10px;min-height:10px;border:0 solid ${EMBER};opacity:.9}` +
  `.${P}-k1{left:-4%;top:-4%;border-left-width:2px;border-top-width:2px}.${P}-k2{right:-4%;top:-4%;border-right-width:2px;border-top-width:2px}.${P}-k3{left:-4%;bottom:-4%;border-left-width:2px;border-bottom-width:2px}.${P}-k4{right:-4%;bottom:-4%;border-right-width:2px;border-bottom-width:2px}` +
  `.${P}-flow{position:absolute;inset:0;width:100%;height:100%;overflow:visible;pointer-events:none;filter:drop-shadow(0 0 3px var(--glow)) drop-shadow(0 0 10px var(--glow))}` +
  `.${P}-fduct{fill:none;stroke:currentColor;stroke-linecap:round}.${P}-fdot{fill:none;stroke:currentColor;stroke-linecap:round}.${P}-farrow{fill:none;stroke:currentColor;stroke-width:5;stroke-linecap:round;stroke-linejoin:round}`;

/** The frame: black outside the band; inside it, the night, the grid floor, the mark, the subtitle and the handle. */
const frameCss =
  `html,body{margin:0;background:#000}*{box-sizing:border-box}` +
  `#root{position:absolute;inset:0;width:${W}px;height:${H}px;overflow:hidden;font-family:${SANS};color:#fff}` +
  '.nc-backdrop{position:absolute;inset:0;background:#000}' +
  `.xr-band{position:absolute;left:0;top:${BAND_TOP}px;width:${BAND_W}px;height:${BAND_H}px;overflow:hidden;background:${NIGHT}}` +
  `.xr-sky{position:absolute;inset:-40px;background:radial-gradient(ellipse 58% 52% at 50% 44%,#0d2a5c 0,#071737 42%,${NIGHT} 78%)}` +
  `.xr-neb{position:absolute;inset:-40px;background-image:${NEBULA};background-size:1160px 890px;opacity:.42}` +
  `.xr-stars{position:absolute;inset:-40px;background-image:${STARS};background-size:1160px 890px;opacity:.85}` +
  `.xr-noise{position:absolute;inset:0;background-image:${NOISE};background-size:300px 300px;opacity:.07}` +
  `.xr-vig{position:absolute;inset:0;background:radial-gradient(ellipse 75% 70% at 50% 45%,transparent 55%,#000000b0 100%)}` +
  `.xr-floor{position:absolute;left:0;right:0;top:56%;bottom:0;display:none;overflow:hidden;perspective:500px;perspective-origin:50% 0%}` +
  `.xr-plane{position:absolute;left:-150%;right:-150%;top:0;height:300%;transform-origin:50% 0%;transform:rotateX(79deg);background-image:linear-gradient(${BLUE}99 2px,transparent 2px),linear-gradient(90deg,${BLUE}99 2px,transparent 2px);background-size:72px 72px;-webkit-mask-image:linear-gradient(to bottom,transparent 0,#000 22%);mask-image:linear-gradient(to bottom,transparent 0,#000 22%)}` +
  `.xr-horizon{position:absolute;left:0;right:0;top:${Math.round(BAND_H * 0.56) - 60}px;height:120px;display:none;background:radial-gradient(ellipse 55% 50% at 50% 50%,${BLUE}40,transparent 70%)}` +
  '.xr-ground-grid .xr-floor,.xr-ground-grid .xr-horizon{display:block}' +
  `.xr-view{position:absolute;left:0;right:0;top:0;height:${VIEW_H}px;display:flex;align-items:center;justify-content:center}` +
  `.xr-logo{position:absolute;right:26px;top:24px;width:64px;height:64px;border-radius:50%;border:2.5px solid ${ICE};box-shadow:0 0 12px ${BLUE},inset 0 0 12px ${BLUE}88;display:flex;align-items:center;justify-content:center}` +
  `.xr-logo b{font-family:${SANS};font-weight:900;font-size:30px;line-height:1;color:${CORE};text-shadow:0 0 10px ${BLUE},0 0 2px #fff}` +
  `.slot-logo{position:absolute;right:26px;top:24px;width:64px;height:64px}` +
  `.xr-sub{position:absolute;left:54px;right:54px;bottom:92px;margin:0;max-height:100px;overflow:hidden;text-align:center;font-family:${SANS};font-weight:800;font-size:34px;line-height:1.32;padding:.1em 0 .16em;color:#fff;text-shadow:0 2px 4px #000,0 0 18px #000c}.xr-band::after{content:'';position:absolute;left:0;right:0;bottom:0;height:230px;pointer-events:none;background:linear-gradient(transparent,#020713b3 45%,#020713e6)}.xr-sub,.xr-handle{z-index:3}` +
  '.xr-sub:empty{display:none}' +
  `#root.xr-nopic .xr-sub{font-size:42px;max-height:120px;bottom:86px}` +
  `.xr-handle{position:absolute;right:26px;bottom:14px;font-family:${SANS};font-weight:800;font-size:18px;letter-spacing:.06em;color:#e6f2ff;opacity:.92;text-shadow:0 0 8px #000}` +
  `.xr-tag{position:absolute;left:34px;top:30px;display:flex;align-items:center;gap:14px;max-width:760px}` +
  `.xr-tag i{flex:none;width:14px;height:14px;border-radius:50%;background:${RED};box-shadow:0 0 10px ${RED},0 0 22px ${RED}}` +
  `.xr-tag span{font-family:${SANS};font-weight:800;font-size:26px;line-height:1.3;letter-spacing:.06em;text-transform:uppercase;color:#ffc2b0;text-shadow:0 0 12px ${RED}aa;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;padding:.12em 0 .18em}` +
  `.xr-tag em{flex:none;width:120px;height:2px;background:linear-gradient(90deg,${EMBER},transparent)}` +
  '.xr-tag.off{display:none}' +
  `.xr-fade{position:absolute;inset:0;background:#000;opacity:0;pointer-events:none}`;

/* ------------------------------------------------------------------------------------------------ */
/* Markup and motion the blocks share.                                                              */
/* ------------------------------------------------------------------------------------------------ */

const ground = '<div class="xr-sky"></div><div class="xr-neb"></div><div class="xr-stars"></div><div class="xr-horizon"></div><div class="xr-floor"><div class="xr-plane"></div></div>';
const stageMarkup = (P, extra = '') =>
  `<div class="${P}-stage"><img class="${P}-img" data-var-src="picture" alt="" /><svg class="${P}-ph ${P}-ph-main" viewBox="0 0 900 560" aria-hidden="true">${MACHINE}</svg><div class="${P}-scanov"></div><div class="${P}-hl"></div>${extra}</div>`;
/** Over the picture: the noise, the vignette, the part's tag, the mark, the subtitle, the handle. */
const chrome = (tag = '') =>
  `<div class="xr-noise"></div><div class="xr-vig"></div>${tag}<span class="slot slot-logo"><span class="xr-logo"><b>N</b></span></span><p class="xr-sub"></p><span class="xr-handle"></span><div class="xr-fade"></div>`;
const band = (inner, tag = '') => `${FILTERS}<div class="xr-band">${ground}${inner}${chrome(tag)}</div>`;

/**
 * The script every block runs before its motion: the look and ground classes on the root, the picture
 * (hidden when empty, fitted when given), the subtitle and the handle, and shrinking the subtitle to its
 * two lines.
 */
const setup =
  RUNTIME +
  `var xrPic=xrS('picture');var xrL=xrLook();root.classList.add('xr-look-'+xrL);if(xrS('ground').toLowerCase()==='grid')root.classList.add('xr-ground-grid');` +
  `var xrImg=q('.xr-img');if(xrPic&&xrImg){root.classList.add('xr-on','has-picture');if(!xrImg.getAttribute('src'))xrImg.setAttribute('src',xrPic);xrFit(xrImg,${FIT_W},${FIT_H})}else{root.classList.add('xr-nopic');xrSetSize(900,560)}` +
  `var xrSub=q('.xr-sub');if(xrSub)xrSub.textContent=xrS('caption');var xrH=q('.xr-handle');if(xrH)xrH.textContent=xrS('handle')||${JSON.stringify(HANDLE)};` +
  `var xrFitText=function(el,floor){if(!el)return;var g=0;while(el.scrollHeight>el.clientHeight+2&&parseFloat(getComputedStyle(el).fontSize)>floor&&g++<40){el.style.fontSize=(parseFloat(getComputedStyle(el).fontSize)-1)+'px'}};xrFitText(xrSub,24);`;

/** The motion every block shares: the night drifts, the floor runs toward the viewer, the subtitle comes up. */
const common =
  `var D=duration;var R=function(p){return Math.max(0,Math.floor(D/p)-1)};` +
  `tl.fromTo(q('.xr-sky'),{scale:1.02},{scale:1.08,duration:D,ease:'none'},0);` +
  `tl.fromTo(q('.xr-stars'),{x:0,y:0},{x:-26,y:-6,duration:D,ease:'none'},0);` +
  `tl.fromTo(q('.xr-neb'),{x:0},{x:18,duration:D,ease:'none'},0);` +
  `tl.fromTo(q('.xr-plane'),{backgroundPosition:'0px 0px'},{backgroundPosition:'0px '+Math.round(36*D)+'px',duration:D,ease:'none'},0);` +
  `tl.fromTo(q('.xr-sub'),{opacity:0,y:10},{opacity:1,y:0,duration:.28,ease:'power2.out'},.04);`;
/** Last in every block's motion: the stand-in machine turns, its red copies with it (they are drawn by then). */
const machine = machineMotion('xr');

/** The red highlight: drawn from the scene's boxes, faded in at `at`, its bloom and its copy pulsing until the end. */
const highlight = (at) =>
  `var hlBoxes=xrBoxes(v.boxes);xrHL(q('.xr-hl'),'xr',hlBoxes,xrPic,xrL);if(hlBoxes.length){var hlAt=${at};` +
  `tl.fromTo(q('.xr-hl'),{opacity:0},{opacity:1,duration:.45,ease:'sine.out'},hlAt);` +
  `tl.fromTo(root.querySelectorAll('.xr-hglow'),{opacity:.5,scale:.92},{opacity:1,scale:1.06,duration:.45,ease:'sine.inOut',yoyo:true,repeat:Math.max(1,Math.floor((D-hlAt)/.9)*2-1)},hlAt);` +
  `tl.fromTo(root.querySelectorAll('.xr-hclip'),{opacity:.82},{opacity:1,duration:.45,ease:'sine.inOut',yoyo:true,repeat:Math.max(1,Math.floor((D-hlAt)/.9)*2-1)},hlAt);` +
  `tl.fromTo(root.querySelectorAll('.xr-k'),{opacity:0,scale:1.25},{opacity:.85,scale:1,duration:.4,ease:'power2.out'},hlAt+.1);}`;

/** The part's tag, top-left: shown when the scene names one. */
const tagMarkup = '<div class="xr-tag"><i></i><span class="xr-tag-text"></span><em></em></div>';
const tagScript = `var tagS=xrS('label');var tagEl=q('.xr-tag');if(tagS)q('.xr-tag-text').textContent=tagS;else tagEl.classList.add('off');`;
const tagMotion = (at) =>
  `if(tagS){tl.fromTo(q('.xr-tag'),{opacity:0,x:-20},{opacity:1,x:0,duration:.5,ease:'power2.out'},${at});tl.fromTo(q('.xr-tag em'),{scaleX:0,transformOrigin:'0% 50%'},{scaleX:1,duration:.6,ease:'power2.out'},${at}+.15);tl.fromTo(q('.xr-tag i'),{scale:.7},{scale:1.25,duration:.45,ease:'sine.inOut',yoyo:true,repeat:Math.max(1,Math.floor((D-${at})/.9)*2-1)},${at});}`;

/* ------------------------------------------------------------------------------------------------ */
/* Variables.                                                                                        */
/* ------------------------------------------------------------------------------------------------ */

const pictureVar = (label, labelVi, required = false) => ({ id: 'picture', type: 'string', label, labels: { vi: labelVi }, default: '', sample: '', maxLength: 120, ...(required ? { required: true } : {}) });
const lookVar = {
  id: 'look',
  type: 'enum',
  label: 'How the picture becomes a hologram',
  labels: { vi: 'Ảnh thành hologram theo kiểu nào' },
  default: 'holo',
  options: [
    { value: 'holo', label: 'glowing lines and a faint body: a product photo or a drawing on a light, plain ground (the default)' },
    { value: 'lines', label: 'glowing lines only: a picture on a dark ground' },
    { value: 'negative', label: 'an x-ray film: a light-ground photo whose outlines are soft' },
    { value: 'plain', label: 'the photo tinted blue under scanlines: a busy or dark photo' },
  ],
};
const groundVar = {
  id: 'ground',
  type: 'enum',
  label: 'What the object stands on',
  labels: { vi: 'Vật đặt trên nền gì' },
  default: 'space',
  options: [
    { value: 'space', label: 'a night of faint stars' },
    { value: 'grid', label: 'a glowing perspective grid floor: for a vehicle or anything that stands on the ground' },
  ],
};
const captionVar = {
  id: 'caption',
  type: 'string',
  label: "The subtitle: this scene's voiceover, word for word (one short sentence)",
  labels: { vi: 'Phụ đề: đúng nguyên văn lời đọc của cảnh (một câu ngắn)' },
  default: '',
  sample: 'Khí nóng đẩy viên đạn lao ra khỏi nòng.',
  maxLength: 90,
  required: true,
};
const handleVar = {
  id: 'handle',
  type: 'string',
  label: "The channel's handle, bottom right; empty for the film's own",
  labels: { vi: 'Tên kênh ở góc dưới phải; để trống là tên mặc định' },
  default: HANDLE,
  sample: HANDLE,
  maxLength: 24,
};
const boxesVar = (required) => ({
  id: 'boxes',
  type: 'string',
  label: 'The part being talked about, as a JSON list of 1–3 boxes in percent of the picture: [[left, top, width, height]]',
  labels: { vi: 'Bộ phận đang nói tới: danh sách JSON 1–3 khung, theo phần trăm của ảnh: [[trái, trên, rộng, cao]]' },
  default: '',
  sample: '[[44,48,12,40]]',
  maxLength: 120,
  ...(required ? { required: true } : {}),
});
const fromVar = {
  id: 'from',
  type: 'string',
  label: "Where the camera starts: the previous scene's boxes when it showed the same picture, else empty",
  labels: { vi: 'Máy quay bắt đầu từ đâu: các khung của cảnh trước nếu cảnh trước cùng ảnh, không thì để trống' },
  default: '',
  sample: '',
  maxLength: 120,
};
const labelVar = (sample) => ({
  id: 'label',
  type: 'string',
  label: 'The name of the part, a few words, or empty',
  labels: { vi: 'Tên bộ phận, vài chữ, hoặc để trống' },
  default: '',
  sample,
  maxLength: 28,
});
const secondsVar = { id: 'seconds', type: 'number', label: 'Length in seconds (the Assemble node gives it)', labels: { vi: 'Độ dài, giây (node Assemble cấp)' }, default: 3.5 };
const base = [captionVar, handleVar, secondsVar];

/* ------------------------------------------------------------------------------------------------ */
/* The blocks.                                                                                       */
/* ------------------------------------------------------------------------------------------------ */

const sceneCss = frameCss + stageCss('xr');

const scenes = {
  hook: {
    role: 'hook',
    description:
      'Opening: the object is scanned in — a bright line sweeps across the band and the hologram appears behind it, then the camera pushes in slowly. The striking claim is the subtitle. Opens the film.',
    css:
      sceneCss +
      `.xr-scan{position:absolute;top:0;bottom:0;left:0;width:4px;background:${CORE};box-shadow:0 0 10px ${BLUE},0 0 30px ${BLUE},0 0 60px ${BLUE};opacity:0}` +
      `.xr-scan::after{content:"";position:absolute;top:0;bottom:0;right:4px;width:160px;background:linear-gradient(90deg,transparent,${BLUE}2e)}`,
    markup: band(`<div class="xr-view">${stageMarkup('xr')}</div><div class="xr-scan"></div>`),
    extraScript: setup,
    motion:
      common +
      `var SW=Math.min(1.7,D*.5);` +
      `tl.fromTo(q('.xr-view'),{clipPath:'inset(0% 100% 0% 0%)'},{clipPath:'inset(0% 0% 0% 0%)',duration:SW,ease:'power1.inOut'},.1);` +
      `tl.fromTo(q('.xr-scan'),{x:-20,opacity:1},{x:${BAND_W + 20},opacity:1,duration:SW,ease:'power1.inOut'},.1);` +
      `tl.to(q('.xr-scan'),{opacity:0,duration:.2,ease:'none'},.1+SW);` +
      `tl.fromTo(q('.xr-stage'),{scale:.98},{scale:1.1,duration:D,ease:'sine.out'},0);` + machine,
    textKeys: [],
    variables: [
      pictureVar('The object, whole: a product photo on a plain ground, a side view or a technical drawing; or empty', 'Toàn bộ vật: ảnh sản phẩm trên nền trơn, hình chiếu cạnh hay bản vẽ kỹ thuật; hoặc để trống'),
      lookVar,
      groundVar,
      ...base,
    ],
  },
  focus: {
    role: 'feature',
    description:
      'The workhorse: the hologram picture, the camera moving into the part being talked about (its boxes) while that part glows red and pulses, with an optional small tag naming it. One part per scene; repeat it scene after scene over the same picture, moving from part to part.',
    css: sceneCss,
    markup: band(`<div class="xr-view">${stageMarkup('xr')}</div>`, tagMarkup),
    extraScript: setup + tagScript,
    motion:
      common +
      `var fB=xrUnion(xrBoxes(v.boxes)),fF=xrUnion(xrBoxes(v.from));var M=Math.min(1.8,Math.max(.9,D*.42));` +
      `var c0=fF?xrCam(fF,1.07):xrCam(null,1),c1=xrCam(fB,1),c2=xrCam(fB,1.07);` +
      `tl.fromTo(q('.xr-stage'),c0,Object.assign({duration:M,ease:'power2.inOut'},c1),0);` +
      `tl.to(q('.xr-stage'),Object.assign({duration:Math.max(.2,D-M),ease:'none'},c2),M);` +
      highlight('M*.45') +
      tagMotion('M*.6') + machine,
    textKeys: [],
    variables: [
      pictureVar('The picture the part is in: the same one as the scenes around it, as long as it shows the part', 'Ảnh có bộ phận đó: dùng lại ảnh của các cảnh liền kề, miễn là ảnh cho thấy bộ phận'),
      boxesVar(true),
      fromVar,
      labelVar('Ống trích khí'),
      lookVar,
      groundVar,
      ...base,
    ],
  },
  flow: {
    role: 'feature',
    description:
      'The hologram picture with a stream of glowing particles running along a path drawn over it: gas, air, fuel, current, fire or sparks, in a colour, forward or back, with an arrowhead for a force or thrust. For anything that flows or pushes.',
    css: sceneCss,
    markup: band(`<div class="xr-view">${stageMarkup('xr', '<svg class="xr-flow" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"></svg>')}</div>`, tagMarkup),
    extraScript:
      setup +
      tagScript +
      `var flP=xrPaths(v.path);var flD=xrS('direction').toLowerCase()==='back';var flA=xrS('arrow').toLowerCase()!=='no';var flF=xrFlow(q('.xr-flow'),'xr',flP,xrS('color').toLowerCase()||'blue',flD,flA);var flDots=flF.dots;xrSized(flF.layout);`,
    motion:
      common +
      `var flAll=[];flP.forEach(function(p){p.forEach(function(x){flAll.push(x)})});var flB=null;if(flAll.length){var xs=flAll.map(function(x){return x[0]}),ys=flAll.map(function(x){return x[1]});var l=xrC(Math.min.apply(null,xs),0,100),t=xrC(Math.min.apply(null,ys),0,100);flB=[l,t,Math.max(20,xrC(Math.max.apply(null,xs),0,100)-l),Math.max(20,xrC(Math.max.apply(null,ys),0,100)-t)]}` +
      `var fF=xrUnion(xrBoxes(v.from));var flCam=function(k,floor){var c=xrCam(flB,k);if(c.scale<floor){var f=floor/c.scale;c={scale:floor,xPercent:c.xPercent*f,yPercent:c.yPercent*f}}return c};var c0=fF?xrCam(fF,1.07):xrCam(null,1),c1=flCam(.7,1.04),c2=flCam(.75,1.1);var M=Math.min(1.6,Math.max(.8,D*.4));` +
      `tl.fromTo(q('.xr-stage'),c0,Object.assign({duration:M,ease:'power2.inOut'},c1),0);` +
      `tl.to(q('.xr-stage'),Object.assign({duration:Math.max(.2,D-M),ease:'none'},c2),M);` +
      `tl.fromTo(q('.xr-flow'),{opacity:0},{opacity:1,duration:.5,ease:'sine.out'},.25);` +
      `flDots.forEach(function(d){tl.fromTo(d.el,{strokeDashoffset:d.o},{strokeDashoffset:d.o-d.sp*D,duration:D,ease:'none'},0)});` +
      `tl.fromTo(root.querySelectorAll('.xr-farrow'),{opacity:.35},{opacity:1,duration:.35,ease:'sine.inOut',yoyo:true,repeat:Math.max(1,Math.floor(D/.7)*2-1)},.3);` +
      highlight('.5') +
      tagMotion('.5') + machine,
    textKeys: [],
    variables: [
      pictureVar('The picture the flow runs over', 'Ảnh có dòng chảy chạy qua'),
      {
        id: 'path',
        type: 'string',
        label: 'Where it flows: a JSON list of 2–6 points in percent of the picture, [[x, y], …], from where it starts to where it goes; or a list of up to 3 such paths',
        labels: { vi: 'Dòng chảy đi đâu: danh sách JSON 2–6 điểm theo phần trăm của ảnh, [[x, y], …], từ điểm đầu tới điểm cuối; hoặc tối đa 3 đường như vậy' },
        default: '[[10,50],[50,50],[90,50]]',
        sample: '[[30,56],[55,52],[78,47],[98,47]]',
        maxLength: 160,
        required: true,
      },
      {
        id: 'color',
        type: 'enum',
        label: 'Its colour',
        labels: { vi: 'Màu dòng chảy' },
        default: 'blue',
        options: [
          { value: 'blue', label: 'air, cold gas, water' },
          { value: 'cyan', label: 'current, coolant' },
          { value: 'orange', label: 'hot gas, exhaust, fire' },
          { value: 'red', label: 'burning powder, the part that matters' },
          { value: 'white', label: 'steam, light' },
        ],
      },
      {
        id: 'direction',
        type: 'enum',
        label: 'Which way it runs along the points',
        labels: { vi: 'Chiều chạy theo các điểm' },
        default: 'forward',
        options: [
          { value: 'forward', label: 'from the first point to the last' },
          { value: 'back', label: 'from the last point to the first' },
        ],
      },
      {
        id: 'arrow',
        type: 'enum',
        label: 'An arrowhead where it ends: a force or a thrust',
        labels: { vi: 'Mũi tên ở cuối: một lực hay lực đẩy' },
        default: 'yes',
        options: [
          { value: 'yes', label: 'with an arrowhead' },
          { value: 'no', label: 'without' },
        ],
      },
      boxesVar(false),
      fromVar,
      labelVar('Khí nén'),
      lookVar,
      groundVar,
      ...base,
    ],
  },
  number: {
    role: 'proof',
    description: 'A big neon number with its unit and a short label, counting up over the dimmed hologram picture: a speed, a pressure, a rate, a count.',
    css:
      sceneCss +
      '.xr-number .xr-view{opacity:.32;filter:blur(1.5px)}' +
      `.xn{position:absolute;left:40px;right:40px;top:120px;height:470px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;text-align:center}` +
      `.xn-row{display:flex;align-items:baseline;justify-content:center;gap:22px;max-width:1000px}` +
      `.xn-value{font-family:${SANS};font-weight:900;font-size:220px;line-height:1.08;padding:.04em 0 .1em;color:${CORE};white-space:nowrap;text-shadow:0 0 8px ${ICE},0 0 26px ${BLUE},0 0 70px ${BLUE};font-variant-numeric:tabular-nums}` +
      `.xn-unit{font-family:${SANS};font-weight:800;font-size:64px;line-height:1.2;color:${ICE};white-space:nowrap;text-shadow:0 0 18px ${BLUE};padding:.1em 0 .2em}` +
      `.xn-rule{width:280px;height:2px;background:linear-gradient(90deg,transparent,${ICE},transparent);box-shadow:0 0 12px ${BLUE}}` +
      `.xn-label{margin:0;flex:none;font-family:${SANS};font-weight:800;font-size:34px;line-height:1.3;letter-spacing:.08em;text-transform:uppercase;color:#cfe6ff;max-width:960px;max-height:96px;overflow:hidden;padding:.12em 0 .18em}`,
    markup: band(
      `<div class="xr-view">${stageMarkup('xr')}</div><div class="xn"><div class="xn-row"><span class="xn-value"></span><span class="xn-unit"></span></div><span class="xn-rule"></span><p class="xn-label"></p></div>`,
    ),
    extraScript:
      setup +
      `root.classList.add('xr-number');var xnS=xrS('number')||'0';var xnV=q('.xn-value');xnV.textContent=xnS;var xnU=xrS('unit');q('.xn-unit').textContent=xnU;if(!xnU)q('.xn-unit').style.display='none';var xnLab=xrS('label');q('.xn-label').textContent=xnLab;if(!xnLab)q('.xn-label').style.display='none';` +
      `var xnRow=q('.xn-row');var xg=0;while(xnRow.scrollWidth>1000&&parseFloat(getComputedStyle(xnV).fontSize)>90&&xg++<80){xnV.style.fontSize=(parseFloat(getComputedStyle(xnV).fontSize)-6)+'px'}xrFitText(q('.xn-label'),24);` +
      // The figure counts up as written: its digits, its grouping and its decimals, in the separators it came with.
      `var xnM=/^(\\D*?)(\\d[\\d.,\\u00a0 ]*\\d|\\d)(.*)$/.exec(xnS);var xnCount=null;if(xnM){var raw=xnM[2].replace(/[\\u00a0 ]/g,''),dec='',grp='';var last=Math.max(raw.lastIndexOf('.'),raw.lastIndexOf(','));if(last>=0){var sc=raw.charAt(last),other=sc==='.'?',':'.';if(raw.length-last-1===3)grp=sc;else{dec=sc;if(raw.indexOf(other)>=0)grp=other}}var num=raw;if(grp)num=num.split(grp).join('');if(dec)num=num.replace(dec,'.');var target=parseFloat(num),places=dec?raw.length-raw.indexOf(dec)-1:0;if(isFinite(target)&&target>0){var fmt=function(n){var s=n.toFixed(places),ip=s.split('.')[0],fp=s.split('.')[1];if(grp)ip=ip.replace(/\\B(?=(\\d{3})+(?!\\d))/g,grp);return xnM[1]+ip+(fp?(dec||'.')+fp:'')+xnM[3]};xnCount={target:target,fmt:fmt}}}`,
    motion:
      common +
      `tl.fromTo(q('.xr-stage'),{scale:1.08},{scale:1.16,duration:D,ease:'none'},0);` +
      `tl.fromTo(q('.xn-row'),{opacity:0,scale:.86},{opacity:1,scale:1,duration:.6,ease:'power3.out'},.15);` +
      `if(xnCount){var xnO={};var xnN=0;Object.defineProperty(xnO,'n',{get:function(){return xnN},set:function(x){xnN=x;xnV.textContent=xnCount.fmt(x)}});tl.fromTo(xnO,{n:0},{n:xnCount.target,duration:Math.min(1.4,D*.45),ease:'power2.out'},.15);}` +
      `tl.fromTo(q('.xn-value'),{opacity:.82},{opacity:1,duration:.5,ease:'sine.inOut',yoyo:true,repeat:Math.max(1,Math.floor(D/1)*2-1)},.8);` +
      `tl.fromTo(q('.xn-rule'),{scaleX:0},{scaleX:1,duration:.6,ease:'power2.out'},.5);` +
      `tl.fromTo(q('.xn-label'),{opacity:0,y:12},{opacity:1,y:0,duration:.5,ease:'power2.out'},.65);` + machine,
    textKeys: [],
    variables: [
      pictureVar('The picture shown dim behind the number, or empty', 'Ảnh mờ phía sau con số, hoặc để trống'),
      { id: 'number', type: 'string', label: 'The figure as the source gives it, digits only ("715", "600", "1,5", "100 triệu")', labels: { vi: 'Con số đúng như nguồn ghi, chỉ chữ số ("715", "600", "1,5", "100 triệu")' }, default: '715', sample: '715', maxLength: 12, required: true },
      { id: 'unit', type: 'string', label: 'Its unit, short ("m/s", "phát/phút", "bar", "km/h"), or empty', labels: { vi: 'Đơn vị, viết ngắn ("m/s", "phát/phút", "bar", "km/h"), hoặc để trống' }, default: '', sample: 'm/s', maxLength: 12 },
      { id: 'label', type: 'string', label: 'What the figure is, a few words', labels: { vi: 'Con số đó là gì, vài chữ' }, default: '', sample: 'Sơ tốc đầu nòng', maxLength: 40, required: true },
      lookVar,
      groundVar,
      ...base,
    ],
  },
  analogy: {
    role: 'feature',
    description:
      'An everyday analogy: a small neon icon from a fixed set (balloon, rocket, spring, magnet, wave, gear, piston, fan, battery, lightning, drop, flame), animated, floating over the dimmed hologram picture, with an optional short label.',
    css:
      sceneCss +
      '.xr-analogy .xr-view{opacity:.62;transform:translateY(112px) scale(.72)}' +
      `.xa{position:absolute;left:0;right:0;top:14px;height:330px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px}` +
      `.xa-halo{position:absolute;left:50%;top:50%;width:440px;height:440px;margin:-220px 0 0 -220px;border-radius:50%;background:radial-gradient(closest-side,#02071399 0,#02071366 55%,transparent)}` +
      `.xa-icon{position:relative;width:250px;height:250px;overflow:visible;fill:none;stroke:${ICE};stroke-width:5;stroke-linecap:round;stroke-linejoin:round;filter:drop-shadow(0 0 4px ${BLUE}) drop-shadow(0 0 16px ${BLUE}) drop-shadow(0 0 34px ${BLUE}88)}` +
      `.xa-icon .ni-thin{stroke-width:3;opacity:.7}.xa-icon .ni-bold{stroke-width:9}.xa-icon .ni-hot{stroke:${CORE}}.xa-icon .nia-b{fill:${ICE};stroke:none}.xa-icon .nia-drop{fill:#3fa9ff22}` +
      `.xa-label{position:relative;margin:0;flex:none;font-family:${SANS};font-weight:800;font-size:28px;line-height:1.3;letter-spacing:.08em;text-transform:uppercase;color:#d8ecff;text-shadow:0 0 14px ${BLUE};max-width:900px;max-height:80px;overflow:hidden;text-align:center;padding:.12em 0 .18em}`,
    markup: band(`<div class="xr-view">${stageMarkup('xr')}</div><div class="xa"><div class="xa-halo"></div><svg class="xa-icon" viewBox="0 0 200 200" aria-hidden="true"></svg><p class="xa-label"></p></div>`),
    extraScript:
      setup +
      `root.classList.add('xr-analogy');var XA=${ICON_LIBRARY};var xaN=xrS('icon').toLowerCase();if(!XA[xaN])xaN='balloon';var xaSvg=q('.xa-icon');xaSvg.innerHTML=XA[xaN];var xaL=xrS('label');q('.xa-label').textContent=xaL;if(!xaL)q('.xa-label').style.display='none';xrFitText(q('.xa-label'),24);` +
      ICON_MOTION,
    motion:
      common +
      `tl.fromTo(q('.xr-stage'),{scale:1.02},{scale:1.1,duration:D,ease:'none'},0);` +
      `tl.fromTo(q('.xa-icon'),{opacity:0,scale:.6,y:30},{opacity:1,scale:1,y:0,duration:.6,ease:'back.out(1.6)'},.1);` +
      `tl.fromTo(q('.xa-label'),{opacity:0,y:10},{opacity:1,y:0,duration:.45,ease:'power2.out'},.45);` +
      `niMove(xaSvg,xaN,D,R);` + machine,
    textKeys: [],
    variables: [
      pictureVar('The picture shown dim under the icon: the machine the analogy is about, or empty', 'Ảnh mờ dưới biểu tượng: cỗ máy mà phép so sánh nói tới, hoặc để trống'),
      {
        id: 'icon',
        type: 'enum',
        label: 'The everyday thing the scene compares it with',
        labels: { vi: 'Vật quen thuộc mà cảnh so sánh' },
        default: 'balloon',
        options: ICON_NAMES.map((name) => ({ value: name, label: ICONS[name].label })),
      },
      { id: 'label', type: 'string', label: 'A few words under the icon, or empty', labels: { vi: 'Vài chữ dưới biểu tượng, hoặc để trống' }, default: '', sample: 'Như quả bóng xì hơi', maxLength: 32 },
      lookVar,
      groundVar,
      ...base,
    ],
  },
  outro: {
    role: 'outro',
    description: "Closing: the hologram pulls back and dims, the channel's round mark and handle come up in the middle, and the open-ended teaser line is the subtitle.",
    css:
      sceneCss +
      `.xo{position:absolute;left:0;right:0;top:200px;display:flex;flex-direction:column;align-items:center;gap:22px}` +
      `.xo-mark{width:150px;height:150px;border-radius:50%;border:4px solid ${ICE};box-shadow:0 0 20px ${BLUE},0 0 60px ${BLUE}88,inset 0 0 22px ${BLUE}99;display:flex;align-items:center;justify-content:center;background:#02071399}` +
      `.xo-mark b{font-family:${SANS};font-weight:900;font-size:76px;line-height:1;color:${CORE};text-shadow:0 0 14px ${BLUE},0 0 3px #fff}` +
      `.xo-handle{font-family:${SANS};font-weight:900;font-size:46px;line-height:1.3;letter-spacing:.04em;color:#fff;text-shadow:0 0 18px ${BLUE};padding:.1em 0 .18em;white-space:nowrap}` +
      `.xo-cta{font-family:${SANS};font-weight:700;font-size:28px;line-height:1.3;letter-spacing:.12em;text-transform:uppercase;color:${ICE};max-width:900px;text-align:center;padding:.1em 0 .18em}`,
    markup: band(`<div class="xr-view">${stageMarkup('xr')}</div><div class="xo"><div class="xo-mark"><b>N</b></div><span class="xo-handle"></span><span class="xo-cta"></span></div>`),
    extraScript: setup + `q('.xo-handle').textContent=xrS('handle')||${JSON.stringify(HANDLE)};var xoC=xrS('cta');q('.xo-cta').textContent=xoC;if(!xoC)q('.xo-cta').style.display='none';`,
    motion:
      common +
      `tl.fromTo(q('.xr-stage'),{scale:1.12},{scale:.9,duration:D,ease:'sine.inOut'},0);` +
      `tl.fromTo(q('.xr-view'),{opacity:1},{opacity:.38,duration:Math.min(1.4,D*.5),ease:'sine.inOut'},.4);` +
      `tl.fromTo(q('.xo-mark'),{opacity:0,scale:.7},{opacity:1,scale:1,duration:.7,ease:'back.out(1.5)'},.5);` +
      `tl.fromTo(q('.xo-handle'),{opacity:0,y:16},{opacity:1,y:0,duration:.5,ease:'power2.out'},.8);` +
      `tl.fromTo(q('.xo-cta'),{opacity:0},{opacity:1,duration:.5,ease:'sine.out'},1.05);` +
      `tl.to(q('.xr-fade'),{opacity:1,duration:.5,ease:'sine.in'},Math.max(1.6,D-.5));` + machine,
    textKeys: [],
    variables: [
      pictureVar('The object, whole, as the film opened on it; or empty', 'Toàn bộ vật, như lúc mở đầu phim; hoặc để trống'),
      { id: 'cta', type: 'string', label: 'A short line under the handle, or empty', labels: { vi: 'Một dòng ngắn dưới tên kênh, hoặc để trống' }, default: 'Theo dõi để xem cỗ máy tiếp theo', sample: 'Theo dõi để xem cỗ máy tiếp theo', maxLength: 40 },
      lookVar,
      groundVar,
      { ...captionVar, label: 'The subtitle: the open-ended teaser line, the voiceover word for word', labels: { vi: 'Phụ đề: câu kết bỏ ngỏ, đúng nguyên văn lời đọc' }, sample: 'Nhưng đó vẫn chưa phải chiếc xe bay trong phim…' },
      handleVar,
      secondsVar,
    ],
  },
};

/* ------------------------------------------------------------------------------------------------ */
/* The components: the same parts, published for the writer and the forge to mount.                */
/* ------------------------------------------------------------------------------------------------ */

const compLength = (seconds) => `var D=Math.max(1,Number(v.seconds)||(typeof duration!=='undefined'?duration:${seconds}));var R=function(p){return Math.max(0,Math.floor(D/p)-1)};`;
/** A component's picture: fitted to its own box, measured when the box is there and again when the picture loads. */
const compPicture = (P) =>
  `var ${P}Pic=xrS('picture');var ${P}Img=root.querySelector('.${P}-img');var ${P}Box=root.querySelector('.${P}');if(${P}Pic&&${P}Img){${P}Box.classList.add('${P}-on');root.classList.add('has-picture');if(!${P}Img.getAttribute('src'))${P}Img.setAttribute('src',${P}Pic);xrFit(${P}Img,Math.max(80,(root.clientWidth||${FIT_W})*.94),Math.max(60,(root.clientHeight||${FIT_H})*.94))}else{var ${P}Ph=root.querySelector('.${P}-ph-main'),${P}K=Math.min((root.clientWidth||900)*.94/900,(root.clientHeight||560)*.94/560);if(${P}Ph){${P}Ph.style.width=Math.round(900*${P}K)+'px';${P}Ph.style.height=Math.round(560*${P}K)+'px'}}`;
const compStage = (P) =>
  stageCss(P) +
  `.${P}{position:absolute;inset:0;display:flex;align-items:center;justify-content:center}` +
  `.${P}-img{max-width:none;max-height:none}`;

const holoPicture = {
  name: 'holo-picture',
  role: 'piece',
  description: 'A picture turned into a neon-blue hologram (glowing edges, a faint body), fitted to its box, drifting slowly; a code-drawn neon machine stands in when there is no picture. Reads picture, look and move.',
  css: compStage('hp'),
  markup: `${FILTERS}<div class="hp">${stageMarkup('hp')}</div>`,
  variables: [
    pictureVar('The picture: one of the listed picture paths', 'Ảnh: một trong các đường dẫn ảnh được liệt kê', true),
    lookVar,
    { id: 'move', type: 'enum', label: 'How the camera drifts over it', labels: { vi: 'Máy quay trôi trên ảnh thế nào' }, default: 'in', options: [{ value: 'in', label: 'push in' }, { value: 'out', label: 'pull back' }, { value: 'left', label: 'drift left' }, { value: 'right', label: 'drift right' }] },
  ],
  extraScript: RUNTIME + `var hpL=xrLook();root.querySelector('.hp').classList.add('hp-look-'+hpL);` + compPicture('hp'),
  motion:
    compLength(6) +
    `var hpM=xrS('move').toLowerCase();var hpF={scale:1,xPercent:0},hpT={scale:1.08,xPercent:0};if(hpM==='out'){hpF={scale:1.08,xPercent:0};hpT={scale:1,xPercent:0}}else if(hpM==='left'){hpF={scale:1.06,xPercent:2.5};hpT={scale:1.06,xPercent:-2.5}}else if(hpM==='right'){hpF={scale:1.06,xPercent:-2.5};hpT={scale:1.06,xPercent:2.5}}` +
    `tl.fromTo(root.querySelector('.hp-stage'),hpF,Object.assign({duration:D,ease:'none'},hpT),0);tl.fromTo(root.querySelector('.hp'),{opacity:0},{opacity:1,duration:.6,ease:'sine.out'},0);` +
    machineMotion('hp'),
};

const holoHighlight = {
  name: 'holo-highlight',
  role: 'effect',
  description:
    'The part being talked about, glowing red and pulsing, with ember corner marks: boxes in percent of the picture. Mount it in the same slot as a holo-picture and give it the same picture, and the red copy of that part lines up with it; with no picture, the glow sits in percent of its own box.',
  css: compStage('hh') + '.hh-img{opacity:0}.hh-noimg .hh-stage{position:absolute;inset:0}',
  markup: `${FILTERS}<div class="hh">${stageMarkup('hh')}</div>`,
  variables: [boxesVar(true), pictureVar('The same picture as the holo-picture under it, or empty', 'Cùng ảnh với holo-picture bên dưới, hoặc để trống'), lookVar],
  extraScript:
    RUNTIME +
    `var hhL=xrLook();` +
    compPicture('hh') +
    `if(!hhPic){hhBox.classList.add('hh-noimg');root.querySelector('.hh-ph-main').style.display='none'}var hhB=xrBoxes(v.boxes);xrHL(root.querySelector('.hh-hl'),'hh',hhB,hhPic,hhL);if(!hhPic)root.querySelectorAll('.hh-hclip').forEach(function(e){e.style.display='none'});`,
  motion:
    compLength(5) +
    `tl.fromTo(root.querySelector('.hh-hl'),{opacity:0},{opacity:1,duration:.45,ease:'sine.out'},.1);` +
    `tl.fromTo(root.querySelectorAll('.hh-hglow'),{opacity:.5,scale:.92},{opacity:1,scale:1.06,duration:.45,ease:'sine.inOut',yoyo:true,repeat:Math.max(1,Math.floor(D/.9)*2-1)},.1);` +
    `tl.fromTo(root.querySelectorAll('.hh-k'),{opacity:0,scale:1.25},{opacity:.85,scale:1,duration:.4,ease:'power2.out'},.2);`,
};

const particleFlow = {
  name: 'particle-flow',
  role: 'effect',
  description: 'A stream of glowing particles along a path through its box — gas, air, fuel, current, fire or sparks — in a colour, forward or back, with an arrowhead for a force or thrust. Points are in percent of its own box.',
  css: stageCss('pf') + '.pf{position:absolute;inset:0}',
  markup: '<div class="pf"><svg class="pf-flow" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"></svg></div>',
  variables: [
    { id: 'path', type: 'string', label: 'A JSON list of 2–6 points in percent of the box, [[x, y], …], or up to 3 such paths', labels: { vi: 'Danh sách JSON 2–6 điểm theo phần trăm của ô, [[x, y], …], hoặc tối đa 3 đường' }, default: '[[5,50],[50,45],[95,50]]', sample: '[[5,60],[40,55],[70,40],[95,35]]', maxLength: 160, required: true },
    scenes.flow.variables.find((x) => x.id === 'color'),
    scenes.flow.variables.find((x) => x.id === 'direction'),
    scenes.flow.variables.find((x) => x.id === 'arrow'),
  ],
  extraScript: RUNTIME + `var pfF=xrFlow(root.querySelector('.pf-flow'),'pf',xrPaths(v.path),xrS('color').toLowerCase()||'blue',xrS('direction').toLowerCase()==='back',xrS('arrow').toLowerCase()!=='no');var pfDots=pfF.dots;pfF.layout(root.clientWidth||600,root.clientHeight||400);`,
  motion:
    compLength(5) +
    `tl.fromTo(root.querySelector('.pf-flow'),{opacity:0},{opacity:1,duration:.4,ease:'sine.out'},0);pfDots.forEach(function(d){tl.fromTo(d.el,{strokeDashoffset:d.o},{strokeDashoffset:d.o-d.sp*D,duration:D,ease:'none'},0)});`,
};

const neonNumber = {
  name: 'neon-number',
  role: 'piece',
  description: 'A big neon figure with its unit and a short label, set to its box: a speed, a pressure, a rate.',
  css:
    '#root{container-type:size}' +
    `.nn{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2cqh;text-align:center}` +
    `.nn-row{display:flex;align-items:baseline;gap:3cqw}` +
    `.nn-value{font-family:var(--font-display,${SANS});font-weight:900;font-size:min(26cqw,52cqh);line-height:1.1;padding:.04em 0 .12em;color:${CORE};white-space:nowrap;text-shadow:0 0 8px ${ICE},0 0 26px ${BLUE},0 0 60px ${BLUE}}` +
    `.nn-unit{font-family:var(--font-body,${SANS});font-weight:800;font-size:min(8cqw,16cqh);line-height:1.25;padding:.1em 0 .2em;color:${ICE};text-shadow:0 0 16px ${BLUE}}` +
    `.nn-label{font-family:var(--font-body,${SANS});font-weight:800;font-size:min(4.4cqw,10cqh);line-height:1.3;padding:.12em 0 .2em;letter-spacing:.08em;text-transform:uppercase;color:#cfe6ff}`,
  markup: '<div class="nn"><div class="nn-row"><span class="nn-value"></span><span class="nn-unit"></span></div><span class="nn-label"></span></div>',
  variables: [
    { id: 'number', type: 'string', label: 'The figure, as the source gives it', labels: { vi: 'Con số, đúng như nguồn ghi' }, default: '600', sample: '600', maxLength: 12, required: true },
    { id: 'unit', type: 'string', label: 'Its unit, short, or empty', labels: { vi: 'Đơn vị, viết ngắn, hoặc để trống' }, default: '', sample: 'phát/phút', maxLength: 12 },
    { id: 'label', type: 'string', label: 'What it is, a few words, or empty', labels: { vi: 'Đó là gì, vài chữ, hoặc để trống' }, default: '', sample: 'Tốc độ bắn', maxLength: 32 },
  ],
  extraScript:
    "var nnS=function(k){return String(v[k]==null?'':v[k]).trim()};root.querySelector('.nn-value').textContent=nnS('number')||'0';var nnU=nnS('unit');root.querySelector('.nn-unit').textContent=nnU;if(!nnU)root.querySelector('.nn-unit').style.display='none';var nnL=nnS('label');root.querySelector('.nn-label').textContent=nnL;if(!nnL)root.querySelector('.nn-label').style.display='none';",
  motion:
    compLength(5) +
    "tl.fromTo(root.querySelector('.nn-row'),{opacity:0,scale:.85},{opacity:1,scale:1,duration:.6,ease:'power3.out'},0);tl.fromTo(root.querySelector('.nn-label'),{opacity:0,y:10},{opacity:1,y:0,duration:.5,ease:'power2.out'},.35);tl.fromTo(root.querySelector('.nn-value'),{opacity:.8},{opacity:1,duration:.5,ease:'sine.inOut',yoyo:true,repeat:Math.max(1,Math.floor(D/1)*2-1)},.6);",
};

const neonIcon = {
  name: 'neon-icon',
  role: 'piece',
  description: `A small animated neon icon for an everyday analogy, one of: ${ICON_NAMES.join(', ')}; with an optional label under it.`,
  css:
    '#root{container-type:size}' +
    `.ni{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2cqh}` +
    `.ni-icon{width:min(80cqw,74cqh);height:min(80cqw,74cqh);overflow:visible;fill:none;stroke:${ICE};stroke-width:5;stroke-linecap:round;stroke-linejoin:round;filter:drop-shadow(0 0 4px ${BLUE}) drop-shadow(0 0 14px ${BLUE})}` +
    `.ni-icon .ni-thin{stroke-width:3;opacity:.7}.ni-icon .ni-bold{stroke-width:9}.ni-icon .ni-hot{stroke:${CORE}}.ni-icon .nia-b{fill:${ICE};stroke:none}.ni-icon .nia-drop{fill:#3fa9ff22}` +
    `.ni-label{font-family:var(--font-body,${SANS});font-weight:800;font-size:min(7cqw,11cqh);line-height:1.3;padding:.12em 0 .2em;letter-spacing:.06em;text-transform:uppercase;color:#d8ecff;text-shadow:0 0 12px ${BLUE};text-align:center}`,
  markup: '<div class="ni"><svg class="ni-icon" viewBox="0 0 200 200" aria-hidden="true"></svg><span class="ni-label"></span></div>',
  variables: [scenes.analogy.variables.find((x) => x.id === 'icon'), { id: 'label', type: 'string', label: 'A few words under it, or empty', labels: { vi: 'Vài chữ bên dưới, hoặc để trống' }, default: '', sample: 'Tên lửa', maxLength: 24 }],
  extraScript: `var niS=function(k){return String(v[k]==null?'':v[k]).trim()};var NI=${ICON_LIBRARY};var niN=niS('icon').toLowerCase();if(!NI[niN])niN='balloon';var niSvg=root.querySelector('.ni-icon');niSvg.innerHTML=NI[niN];var niL=niS('label');root.querySelector('.ni-label').textContent=niL;if(!niL)root.querySelector('.ni-label').style.display='none';`,
  motion: compLength(5) + ICON_MOTION + "tl.fromTo(niSvg,{opacity:0,scale:.6},{opacity:1,scale:1,duration:.55,ease:'back.out(1.6)'},0);niMove(niSvg,niN,D,R);",
};

const scanline = {
  name: 'scanline',
  role: 'effect',
  description: 'A bright neon line sweeping across its box, with a soft trail: a scan passing over the object.',
  css: `.sl{position:absolute;inset:0;overflow:hidden}.sl-line{position:absolute;top:0;bottom:0;left:0;width:4px;background:${CORE};box-shadow:0 0 10px ${BLUE},0 0 30px ${BLUE},0 0 60px ${BLUE}}.sl-line::after{content:"";position:absolute;top:0;bottom:0;right:4px;width:140px;background:linear-gradient(90deg,transparent,${BLUE}33)}`,
  markup: '<div class="sl"><span class="sl-line"></span></div>',
  variables: [{ id: 'sweeps', type: 'number', label: 'How many times it sweeps across (1 to 4)', labels: { vi: 'Quét qua mấy lần (1 đến 4)' }, default: 1, sample: 1 }],
  motion:
    compLength(3) +
    "var slN=Math.max(1,Math.min(4,Math.round(Number(v.sweeps)||1)));var slW=Math.max(40,root.clientWidth||1000);tl.fromTo(root.querySelector('.sl-line'),{x:-20},{x:slW+20,duration:Math.max(.6,D/slN),ease:'power1.inOut',repeat:slN-1},0);",
};

const gridFloor = {
  name: 'grid-floor',
  role: 'effect',
  description: 'A glowing perspective grid floor running toward the viewer, fading into the distance: the ground under a vehicle or a machine.',
  css: `.gf{position:absolute;inset:0;overflow:hidden;perspective:500px;perspective-origin:50% 0%}.gf-plane{position:absolute;left:-150%;right:-150%;top:0;height:300%;transform-origin:50% 0%;transform:rotateX(79deg);background-image:linear-gradient(${BLUE}99 2px,transparent 2px),linear-gradient(90deg,${BLUE}99 2px,transparent 2px);background-size:72px 72px;-webkit-mask-image:linear-gradient(to bottom,transparent 0,#000 22%);mask-image:linear-gradient(to bottom,transparent 0,#000 22%)}`,
  markup: '<div class="gf"><div class="gf-plane"></div></div>',
  motion: compLength(5) + "tl.fromTo(root.querySelector('.gf-plane'),{backgroundPosition:'0px 0px'},{backgroundPosition:'0px '+Math.round(36*D)+'px',duration:D,ease:'none'},0);tl.fromTo(root.querySelector('.gf'),{opacity:0},{opacity:1,duration:.6,ease:'sine.out'},0);",
};

/**
 * Where a mount goes, in frame pixels: the whole band, the middle of the picture where the camera ends
 * up, a corner inset under the mark, the subtitle's place, and the mark itself.
 */
const SLOTS = {
  band: [0, BAND_TOP, BAND_W, BAND_H],
  focus: [190, BAND_TOP + 90, 700, 500],
  inset: [700, BAND_TOP + 100, 340, 300],
  caption: [54, BAND_TOP + BAND_H - 160, 972, 104],
  logo: [W - 90, BAND_TOP + 24, 64, 64],
};

const GUIDE = `---
first: hook
last: outro
repeat: 3
---
Làm một phim tiếng Việt, dọc 9:16, khoảng 100–120 giây, giải thích một cỗ máy hay một món công nghệ vận hành ra sao (chủ đề trong Brief: một chiếc xe, một khẩu súng, một động cơ, một chiếc điện thoại, một máy bay phản lực, một ổ khoá…). Phong cách "bên trong cỗ máy": vật hiện lên như bản vẽ hologram xanh neon trên nền đêm, bộ phận đang nói tới sáng đỏ, máy quay trôi từ bộ phận này sang bộ phận khác.
NHỊP PHIM: MỖI CẢNH LÀ MỘT CÂU NGẮN. Lời đọc của mỗi cảnh đúng một câu, tối đa khoảng 90 ký tự (8–18 từ, đọc mất 2,5–4 giây), và giá trị caption của cảnh là chính câu đó, chép nguyên văn. Vì vậy phim có khoảng 25–35 cảnh. Không gộp hai ý vào một câu; câu dài thì tách thành hai cảnh.
CẤU TRÚC LỜI ĐỌC:
1. Mở bằng một tuyên bố gây sững sờ hoặc một kỷ lục, đúng như Research ghi ("Khẩu súng này có mặt ở khắp hành tinh: khoảng 100 triệu khẩu.", "Chiếc xe này lộn ngược, bay lên… mà không có cánh quạt.").
2. Một phép so sánh đời thường ("Hãy nghĩ tới quả bóng bay bạn thả tay ra."), rồi nguyên lý trong một hai câu.
3. Cơ chế, từng bước, MỖI CÂU MỘT BỘ PHẬN, theo đúng thứ tự vận hành, với con số cụ thể (715 m/s, 600 phát mỗi phút, 700 bar) đúng như Research.
4. Một câu hỏi chuyển ý ("Còn để cất cánh?") rồi phần tiếp theo của cơ chế.
5. Kết bỏ ngỏ: một giới hạn, một điều còn chưa làm được, hay điều sắp tới ("Nhưng đó vẫn chưa phải chiếc xe bay trong phim…").
Giọng như một kỹ sư giỏi kể chuyện: chính xác, gọn, có nhịp; câu khẳng định ngắn; dùng "bạn" khi so sánh. Không rào đón, không đọc tên nguồn.
CÁC KHỐI:
- xray-hook (cảnh đầu): vật hiện ra sau một đường quét. Ảnh toàn thân vật.
- xray-focus: khối chính, dùng nhiều nhất. Mỗi cảnh nói về một bộ phận: boxes là khung bao bộ phận đó theo phần trăm của ảnh, [[trái, trên, rộng, cao]], tính từ góc trên bên trái (ví dụ băng đạn của khẩu súng nằm ở khoảng [[42,45,14,45]]). Nhìn ảnh để đặt khung cho khít bộ phận; 1 khung là thường, tối đa 3 khi nói về một cặp hay một nhóm. label là tên bộ phận, vài chữ (tối đa 28 ký tự), hoặc để trống. Các cảnh focus liền nhau nên dùng CÙNG MỘT ẢNH, đi từ bộ phận này sang bộ phận kia; khi đó điền from bằng đúng boxes của cảnh trước để máy quay đi tiếp từ chỗ cũ thay vì lùi ra.
- xray-flow: khi có thứ gì chảy hay đẩy (khí, không khí, nhiên liệu, dòng điện, lửa, tia lửa). path là danh sách JSON 2–6 điểm theo phần trăm của ảnh, [[x, y], …], đi từ nơi bắt đầu tới nơi kết thúc (khí từ buồng đốt ra nòng, khí từ bình ra vòi phun); có thể đưa tối đa 3 đường. color: blue (khí lạnh, không khí, nước), cyan (điện), orange (khí nóng, lửa), red (thuốc súng cháy, phần quan trọng), white (hơi nước, ánh sáng). arrow "yes" khi đó là một lực hay lực đẩy. Có thể kèm boxes để tô đỏ bộ phận nơi dòng chảy bắt đầu.
- xray-number: một con số lớn, đơn vị ngắn, nhãn vài chữ, trên ảnh mờ. Chỉ dùng con số Research có. 2–4 cảnh trong phim.
- xray-analogy: phép so sánh đời thường bằng một biểu tượng neon: balloon (bóng xì hơi: phản lực), rocket (tên lửa), spring (lò xo), magnet (nam châm), wave (sóng), gear (bánh răng), piston, fan (quạt), battery (pin), lightning (điện), drop (giọt nước), flame (lửa). 1–3 cảnh.
- xray-outro (cảnh cuối): câu kết bỏ ngỏ làm caption; cta một dòng ngắn mời theo dõi.
ẢNH: lấy từ danh sách ảnh. Ảnh tốt nhất là bản vẽ kỹ thuật, hình cắt (cutaway), hình chiếu cạnh hay ảnh sản phẩm trên nền trơn. KHÔNG BAO GIỜ dùng biểu đồ, đồ thị, bảng số, logo, ảnh chụp màn hình hay ảnh nhiều chữ (chữ thành nét sáng rối mắt): bỏ qua những ảnh mà ghi chú nói là biểu đồ, logo hay có nhiều chú thích chữ. boxes chỉ khoanh BỘ PHẬN MÁY MÓC, không bao giờ khoanh chữ, nhãn, chú giải hay con số in trên ảnh. Một ý so sánh hay số liệu (hiệu suất, tiết kiệm, nhanh hơn) thì nói bằng xray-number hay xray-analogy, không zoom vào biểu đồ. Mỗi ảnh thành hologram theo look:
- holo (mặc định): ảnh sản phẩm hay bản vẽ trên nền sáng, trơn.
- lines: ảnh trên nền tối (nếu để holo, nền tối sẽ sáng lên).
- negative: ảnh nền sáng nhưng đường nét mờ, ít tương phản.
- plain: ảnh rối hay tối, nhiều chi tiết.
ground "grid" (sàn lưới phát sáng) cho xe cộ và vật đứng trên mặt đất; "space" (nền sao) cho vật cầm tay hay vật bay.
DÙNG ÍT ẢNH, DÙNG LÂU: một ảnh tốt của cả vật dùng cho nhiều cảnh liền nhau (khoảng 4–8 cảnh), máy quay đi từ bộ phận này sang bộ phận khác; không quá 3 cảnh xray-focus liền nhau, nên xen xray-flow, xray-number hay xray-analogy trên cùng ảnh đó vào giữa (from vẫn là boxes của cảnh trước nếu có); chỉ đổi ảnh khi cần một góc nhìn khác (hình cắt viên đạn, sơ đồ động cơ). Đừng dùng ảnh không cho thấy bộ phận đang nói. Không có ảnh hợp thì để trống picture: một cỗ máy neon vẽ bằng code sẽ thay vào.
CHUYỂN CẢNH: dùng "crossfade" giữa các cảnh (phim không có cú cắt cứng), trừ cảnh đầu.
"mounts" (tuỳ chọn, ít dùng): neon-icon hay neon-number ở ô "inset" để thêm một biểu tượng nhỏ lên cảnh focus; particle-flow ở ô "band" hay "focus". Không che bộ phận đang được tô đỏ.
Chỉ dùng những gì Research, ghi chú người viết và các đường link họ đưa có. Con số, năm, tên người, tên bộ phận đúng như Research; không bịa con số hay cơ chế cho hấp dẫn hơn. Khi các nguồn khác nhau thì nói "khoảng". Với vũ khí: giải thích cơ chế như một bài kỹ thuật, không hướng dẫn chế tạo, sửa đổi hay sử dụng, không cổ vũ bạo lực.`;

// Keep the workflow JSON in sync with the six scenes, the components this kit publishes, and the guide.
await editComposition(new URL('./workflow.json', import.meta.url), (files) => {
  for (const key of Object.keys(files)) delete files[key];
  // The shell the Studio previews and the inspector lints, until a run has Assemble write the entry.
  files['index.html'] = filmShell({
    id: 'xray-shell',
    width: W,
    height: H,
    background: '#000',
    // What a component from the library paints with, so a borrowed one wears this film.
    theme: { bg: NIGHT, fg: '#ffffff', brand: BLUE, fontDisplay: SANS, fontBody: SANS },
  });
  files['assemble.json'] = JSON.stringify({ slots: SLOTS }, null, 2);
  for (const [kind, scene] of Object.entries(scenes)) files[`compositions/xray-${kind}.html`] = sceneBlock({ ...scene, id: `xray-${kind}`, width: W, height: H, seconds: 3.5, fonts: FONTS });
  // Published, not only pasted: a writer may mount these, and the forge reads them as the kit's own.
  for (const part of [holoPicture, holoHighlight, particleFlow, neonNumber, neonIcon, scanline, gridFloor]) files[`compositions/components/${part.name}.html`] = component({ ...part, fonts: FONTS });
  files['storyboard-guide.md'] = GUIDE;
});
