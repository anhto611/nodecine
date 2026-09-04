import { writeFileSync } from 'node:fs';
import { dcOpen, dcClose, ICONS as I } from './tokens.mjs';

/* 10 khối trên canvas 1396 x 844 (đã trừ dải trái 44px) */
const N = {
  input:  { x:20,   y:300, w:190, h:116, ic:'bolt',   t:'Input Trigger'        },
  llm:    { x:230,  y:120, w:190, h:124, ic:'term',   t:'Claude Code Provider' },
  fetch:  { x:230,  y:300, w:190, h:140, ic:'branch', t:'GitHub Fetcher'       },
  direct: { x:440,  y:120, w:190, h:196, ic:'bot',    t:'AI Director'          },
  ttsp:   { x:440,  y:440, w:190, h:124, ic:'mic',    t:'System TTS Provider'  },
  tts:    { x:650,  y:380, w:190, h:150, ic:'wave',   t:'TTS Engine'           },
  engine: { x:650,  y:600, w:190, h:124, ic:'chip',   t:'Remotion Engine'      },
  asm:    { x:860,  y:230, w:190, h:150, ic:'layers', t:'Timeline Assembler' },
  out:    { x:1100, y:60,  w:284, h:584, ic:'screen', t:'Video Output'         },
  export: { x:1100, y:684, w:284, h:136, ic:'down',   t:'MP4 Export'           },
};
const EDGES = [
  { id:'e1',  d:'M210,358 C222,358 218,370 230,370' },
  { id:'e2',  d:'M420,370 C460,370 420,200 440,200' },
  { id:'e3',  d:'M420,370 C480,370 480,340 560,340 C700,340 800,270 860,270' },
  { id:'e4',  d:'M420,180 C460,180 420,232 440,232' },
  { id:'e5',  d:'M630,216 C670,216 630,440 650,440' },
  { id:'e6',  d:'M630,216 C700,216 790,305 860,305' },
  { id:'e7',  d:'M630,500 C642,500 638,472 650,472' },
  { id:'e8',  d:'M840,456 C880,456 840,340 860,340' },
  { id:'e9',  d:'M1050,305 C1080,305 1070,120 1100,120' },
  { id:'e10', d:'M1050,305 C1076,305 1074,728 1100,728' },
  { id:'e11', d:'M840,660 C980,660 1088,620 1088,420 C1088,200 1070,150 1100,150' },
  { id:'e12', d:'M840,660 C950,660 1000,758 1100,758' },
];
const P = {
  input:  { out:[[58,'Dữ liệu Nguồn']] },
  llm:    { out:[[60,'Mô hình ngôn ngữ']] },
  fetch:  { in:[[70,'']], out:[[70,'Dữ kiện']] },
  direct: { in:[[80,''],[112,'']], out:[[96,'Kịch bản · Lời thoại']] },
  ttsp:   { out:[[60,'Giọng đọc']] },
  tts:    { in:[[60,''],[92,'']], out:[[76,'Âm thanh']] },
  engine: { out:[[60,'Động cơ']] },
  asm:    { in:[[40,'Dữ kiện'],[75,''],[110,'']], out:[[75,'Bản đặc tả IR']] },
  out:    { in:[[60,'Bản đặc tả IR'],[90,'Động cơ']] },
  export: { in:[[44,'Bản đặc tả IR'],[74,'Động cơ']] },
};

const badge = (s, meta) => s === 'ok' ? `<span class="st s-ok"><span class="dot"></span>${meta||''}</span>`
  : s === 'run'  ? `<span class="st s-run">${I.spin}</span>`
  : s === 'err'  ? `<span class="st s-err">${I.warn}</span>`
  : s === 'byp'  ? `<span class="st s-byp"><span class="dot"></span>bỏ qua</span>`
  : s === 'warn' ? `<span class="st" style="color:var(--warn)"><span class="dot" style="background:var(--warn)"></span>${meta||''}</span>`
  : (s === 'queue' || s === 'block') ? `<span class="st s-queue"><span class="dot"></span>chờ</span>`
  : `<span class="st s-idle"><span class="dot"></span></span>`;
const cls = (s) => ({ ok:'n-ok', run:'n-run', err:'n-err', block:'n-block', byp:'n-byp', warn:'n-warn', idle:'n-idle', queue:'n-idle' }[s] || '');
const ports = (side, list, on) => (list||[]).map(([off,lab]) => `
      <div class="p p-${side} ${on?'on':''}" style="top:${off-3.5}px"></div>
      <div class="plab" style="top:${off-4}px;${side==='in'?'left:11px':'right:11px'}">${lab}</div>`).join('');
const mk = (key, state, meta, body, on, extraHdr, pOverride) => {
  const n = N[key], pp = pOverride || P[key];
  return `
    <div class="nd ${cls(state)}" style="left:${n.x}px;top:${n.y}px;width:${n.w}px;height:${n.h}px">
      <div class="nd-h"><span class="ic">${I[n.ic]}</span><span class="nd-t">${n.t}</span>${extraHdr||''}${badge(state,meta)}</div>
      <div class="nd-b">${body}</div>
      ${ports('in', pp.in, on)}${ports('out', pp.out, on)}
    </div>`;
};

/* ---------------- thân các khối ---------------- */
const B = {
  input: (f) => f
    ? `<div class="fld">github.com/anhto611/nodecine</div><div class="hint">27 ký tự · không diễn giải</div>`
    : `<div class="fld fld-ph">Dán link repo hoặc mô tả…</div><div class="hint">→ chưa có nội dung</div>`,
  fetch: (m) => m === 'done'
    ? `<div class="kv"><span class="k">nguồn</span><span class="v">github-url</span></div>
       <div class="kv"><span class="k">stars</span><span class="v" style="color:var(--warn)">${I.star} 1.284</span></div>
       <div class="kv"><span class="k">install</span><span class="v">npm i nodecine</span></div>
       <div class="hint">chụp 21:04 · làm mới</div>`
    : m === 'err'
    ? `<div class="fld" style="border-color:#5c2327;color:#ff8b85;background:#1a0e10">Đã vượt hạn mức GitHub API,<br>thử lại sau ít phút</div>
       <div style="display:flex;gap:5px;margin-top:7px">
         <span class="btn" style="height:21px;padding:0 7px;font-size:8.5px;background:#2a1416;border-color:#5c2327;color:#ff8b85">${I.retry} Thử lại</span>
         <span class="btn" style="height:21px;padding:0 7px;font-size:8.5px">Văn bản thô</span></div>`
    : `<div class="kv"><span class="k">repo</span><span class="v" style="color:var(--tx-3)">—</span></div>
       <div class="kv"><span class="k">stars</span><span class="v" style="color:var(--tx-3)">—</span></div>
       <div class="kv"><span class="k">install</span><span class="v" style="color:var(--tx-3)">—</span></div>
       <div class="hint">chờ Dữ liệu Nguồn</div>`,
  direct: (m) => m === 'done'
    ? `<div class="kv"><span class="k">ngôn ngữ</span><span class="v">English ${I.chev}</span></div>
       <div class="kv"><span class="k">model</span><span class="v">claude-opus-5</span></div>
       <div class="kv"><span class="k">theme</span><span class="v">developer-dark</span></div>
       <div style="margin-top:7px;display:flex;flex-direction:column;gap:4px">
         <div class="bul"><i>1</i><span>SHIP VIDEO FROM A REPO</span></div>
         <div class="bul"><i>2</i><span>nodecine · 3 features</span></div>
         <div class="bul"><i>3</i><span>Star on GitHub</span></div></div>`
    : m === 'run'
    ? `<div class="kv"><span class="k">ngôn ngữ</span><span class="v">English ${I.chev}</span></div>
       <div class="kv"><span class="k">model</span><span class="v">claude-opus-5</span></div>
       <div style="margin-top:9px;display:flex;flex-direction:column;gap:6px">
         <div style="height:6px;background:var(--bg-sunk);border-radius:3px;overflow:hidden"><div style="width:62%;height:100%;background:var(--run)"></div></div>
         <div class="hint" style="color:var(--run);margin:0">đang sinh 3 phân cảnh…</div></div>`
    : `<div class="kv"><span class="k">ngôn ngữ</span><span class="v">English ${I.chev}</span></div>
       <div class="kv"><span class="k">theme</span><span class="v" style="color:var(--tx-3)">developer-dark · cố định</span></div><div class="hint">chờ Hồ Sơ Repo</div>`,
  tts: (m) => m === 'done'
    ? `<div class="kv"><span class="k">giọng</span><span class="v">Samantha · en-US</span></div>
       <div class="kv"><span class="k">tốc độ</span><span class="v">1.00x</span></div>
       <div style="margin-top:7px;display:flex;align-items:flex-end;gap:2px;height:20px">
         ${[6,11,7,14,9,16,10,13,6,12,8,15,7,10,5,13,9,6,11,7,14,8,12,9].map(h=>`<span style="flex:1;height:${h*1.2}px;background:var(--accent);opacity:.65;border-radius:1px"></span>`).join('')}</div>
       <div class="hint">khớp ngôn ngữ kịch bản: en · 11.20 giây</div>`
    : `<div class="kv"><span class="k">giọng</span><span class="v">Samantha · en-US</span></div>
       <div class="kv"><span class="k">tốc độ</span><span class="v">1.00x</span></div><div class="hint">giọng lọc theo ngôn ngữ kịch bản</div>`,
  asm: (m) => m === 'done'
    ? `<div class="kv"><span class="k">tổng</span><span class="v">336 frames</span></div>
       <div class="kv"><span class="k">fps</span><span class="v">30 · 1080×1920</span></div>
       <div style="display:flex;gap:2px;margin-top:8px;height:10px">
         <div style="width:25%;background:var(--accent);border-radius:2px 0 0 2px"></div>
         <div style="width:50%;background:var(--accent-2)"></div>
         <div style="width:25%;background:var(--ok);border-radius:0 2px 2px 0"></div></div>
       <div class="kv" style="margin-top:4px"><span class="k">84 · w1</span><span class="k">168 · w2</span><span class="k">84 · w1</span></div>`
    : `<div class="kv"><span class="k">tổng</span><span class="v" style="color:var(--tx-3)">—</span></div>
       <div class="kv"><span class="k">fps</span><span class="v">30 · 1080×1920</span></div>
       <div style="display:flex;gap:2px;margin-top:8px;height:10px;opacity:.22">
         <div style="width:25%;background:var(--tx-3);border-radius:2px 0 0 2px"></div>
         <div style="width:50%;background:var(--tx-3)"></div>
         <div style="width:25%;background:var(--tx-3);border-radius:0 2px 2px 0"></div></div>
       <div class="hint">chờ 3 cổng nhận</div>`,
  llm: (m) => m === 'notready'
    ? `<div class="kv"><span class="k">công cụ</span><span class="v">claude 2.1.260</span></div>
       <div class="kv"><span class="k">trạng thái</span><span class="v" style="color:var(--warn)">chưa đăng nhập</span></div>
       <div class="fld" style="margin-top:5px;color:var(--tx-2)">$ claude login</div>
       <div style="display:flex;gap:5px;margin-top:6px"><span class="btn" style="height:20px;padding:0 7px;font-size:8.5px">${I.retry} Kiểm tra lại</span></div>`
    : `<div class="kv"><span class="k">công cụ</span><span class="v">claude 2.1.260</span></div>
       <div class="kv"><span class="k">trạng thái</span><span class="v" style="color:var(--ok)">● đã đăng nhập</span></div>
       <div class="kv"><span class="k">probe</span><span class="v" style="color:var(--tx-3)">mỗi lần Chạy Luồng</span></div>
       <div class="kv"><span class="k">model</span><span class="v" style="color:var(--tx-3)">mặc định</span></div>`,
  ttsp: () =>
      `<div class="kv"><span class="k">bộ tổng hợp</span><span class="v">macOS say</span></div>
       <div class="kv"><span class="k">ffmpeg</span><span class="v" style="color:var(--ok)">● tìm thấy</span></div>
       <div class="kv"><span class="k">giọng</span><span class="v">Samantha · en-US ${I.chev}</span></div>
       <div class="kv"><span class="k">trạng thái</span><span class="v" style="color:var(--ok)">● sẵn sàng · offline</span></div>`,
  engine: (m) => m === 'notready'
    ? `<div class="kv"><span class="k">adapter</span><span class="v">hyperframes 0.1</span></div>
       <div class="kv"><span class="k">trạng thái</span><span class="v" style="color:var(--warn)">chưa sẵn sàng · v0.2</span></div>
       <div class="kv"><span class="k">xem trước</span><span class="v" style="color:var(--tx-3)">—</span></div>
       <div class="kv"><span class="k">kết xuất</span><span class="v" style="color:var(--tx-3)">—</span></div>`
    : `<div class="kv"><span class="k">adapter</span><span class="v">remotion 4.0</span></div>
       <div class="kv"><span class="k">trạng thái</span><span class="v" style="color:var(--ok)">● sẵn sàng</span></div>
       <div class="kv"><span class="k">song song</span><span class="v">4</span></div>
       <div class="kv"><span class="k">backend</span><span class="v">angle</span></div>`,
  export: (m) => {
    const params = (dim) => `
      <div class="kv"><span class="k">codec</span><span class="v">H.264</span></div>
      <div class="kv"><span class="k">chất lượng</span><span class="v">cao · crf 18</span></div>
      <div class="kv"><span class="k">tên tệp</span><span class="v">nodecine-launch-video.mp4</span></div>`;
    if (m === 'run') return `
      <div class="kv"><span class="k">H.264 · crf 18</span><span class="v" style="color:var(--run)">208 / 336 · 7.9 fps</span></div>
      <div style="height:7px;background:var(--bg-sunk);border-radius:3px;overflow:hidden;margin-top:8px;border:1px solid var(--line)">
        <div style="width:62%;height:100%;background:var(--run)"></div></div>
      <div style="display:flex;gap:6px;margin-top:9px;align-items:center">
        <span class="hint" style="margin:0;color:var(--run);flex:1">62% · còn ~16s</span>
        <span class="btn" style="height:22px;padding:0 9px;font-size:8.5px;background:#2a1416;border-color:#5c2327;color:#ff8b85">Hủy</span></div>`;
    if (m === 'done') return `
      <div class="kv"><span class="k">tệp</span><span class="v" style="color:var(--ok)">nodecine-launch-video.mp4</span></div>
      <div class="kv"><span class="k">dung lượng</span><span class="v">4.8 MB · 42s</span></div>
      <span class="btn" style="height:24px;margin-top:8px;justify-content:center;font-size:9px;width:100%">${I.down} Tải xuống</span>`;
    if (m === 'off') return params() + `
      <span class="btn btn-off" style="height:24px;margin-top:8px;justify-content:center;font-size:9px;width:100%">${I.play} Kết xuất</span>
      <div class="hint" style="color:var(--warn);margin-top:5px">engine chưa hỗ trợ kết xuất</div>`;
    return params() + `
      <span class="btn btn-pri" style="height:24px;margin-top:8px;justify-content:center;font-size:9px;width:100%">${I.play} Kết xuất</span>`;
  },
};

/* ---------------- video giả lập ---------------- */
const VW = 252, VH = 448;
const videoInner = (s = 1) => `
  <div class="vs"><div class="vs-grid"></div>
    <div style="position:relative;padding:${26*s}px ${18*s}px 0;text-align:center">
      <div style="font-family:var(--mono);font-size:${7*s}px;letter-spacing:.22em;color:#a78bfa;text-transform:uppercase">Core features</div>
      <div style="font-family:var(--mono);font-size:${15.5*s}px;font-weight:700;color:#fff;margin-top:${9*s}px;line-height:1.32">nodecine<br><span style="color:#a78bfa">AI + Remotion</span></div></div>
    <div style="position:relative;margin:${19*s}px ${14*s}px 0;background:#0e1015;border:1px solid #2b2f38;border-radius:${5*s}px;overflow:hidden">
      <div style="height:${16*s}px;background:#171a20;border-bottom:1px solid #2b2f38;display:flex;align-items:center;gap:${3.5*s}px;padding:0 ${7*s}px">
        <span style="width:${5*s}px;height:${5*s}px;border-radius:50%;background:#f85149"></span>
        <span style="width:${5*s}px;height:${5*s}px;border-radius:50%;background:#d29922"></span>
        <span style="width:${5*s}px;height:${5*s}px;border-radius:50%;background:#3fb950"></span>
        <span style="font-family:var(--mono);font-size:${6.2*s}px;color:#5a5f6a;margin-left:${5*s}px">bash</span></div>
      <div style="padding:${9*s}px ${8*s}px;font-family:var(--mono);font-size:${8.2*s}px;line-height:1.95">
        <div><span style="color:#3fb950">$</span> <span style="color:#e4e6ea">npm i nodecine</span></div>
        <div style="height:${6*s}px"></div>
        <div style="color:#8b909b"><span style="color:#a78bfa">▸</span> Node graph, no timeline</div>
        <div style="color:#8b909b"><span style="color:#a78bfa">▸</span> AI writes a 3-scene script</div>
        <div style="color:#8b909b"><span style="color:#a78bfa">▸</span> Export MP4 on your machine</div></div></div>
    <div style="position:relative;margin-top:auto;padding:0 ${14*s}px ${22*s}px;display:flex;align-items:center;justify-content:space-between">
      <div style="font-family:var(--mono);font-size:${6.8*s}px;color:#5a5f6a">github.com/anhto611/nodecine</div>
      <div style="display:flex;align-items:center;gap:${3*s}px;font-family:var(--mono);font-size:${6.8*s}px;color:#d29922">${I.star} 1.284</div></div>
  </div>`;

/* ---------------- thân Video Output ---------------- */
function outBody(mode) {
  const shell = (inner, dim) => `<div style="width:${VW}px;height:${VH}px;background:#000;border:1px solid var(--line-2);border-radius:3px;overflow:hidden;position:relative;${dim?'opacity:.45':''}">${inner}</div>`;
  const transport = (on) => `
    <div style="display:flex;align-items:center;gap:8px;margin-top:9px">
      <span class="pbtn ${on?'':'btn-off'}" style="width:24px;height:24px">${I.start}</span>
      <span class="pbtn ${on?'':'btn-off'}" style="width:24px;height:24px;${on?'background:var(--accent);border-color:var(--accent);color:#fff':''}">${on?I.pause:I.play}</span>
      <div class="scrub" style="flex:1">${on?`<div class="fill" style="width:41%"></div><div class="head" style="left:41%"></div>`:''}</div>
      <div class="cnt" style="font-size:8.5px">${on?`<span>138 <em>/ 336</em></span><span><em>4.60 / 11.20s</em></span>`:`<span style="color:var(--tx-3)">— <em>/ —</em></span><span><em>— / —</em></span>`}</div></div>
    <div class="insp" style="margin-top:8px">
      ${[['Hook','0–84',25],['Feature','84–252',50],['CTA','252–336',25]].map(([n,f,w],i)=>`
        <div class="sc ${on&&i===1?'act':''}" style="flex:${w};padding:5px 6px"><div class="sc-n" style="font-size:8.5px;${on?'':'color:var(--tx-3)'}">${n}</div><div class="sc-f" style="font-size:8px">${on?f:'—'}</div></div>`).join('')}</div>`;
  const foot = (l, r, c) => `<div class="kv" style="margin-top:8px;padding-top:7px;border-top:1px solid var(--line)"><span class="k" style="${c||''}">${l}</span><span class="k">${r}</span></div>`;
  const center = (icon, t1, t2, bar) => `<div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;padding:0 26px;text-align:center">${icon}<div style="font-family:var(--mono);font-size:10px;color:var(--tx-2);line-height:1.6">${t1}</div><div style="font-family:var(--mono);font-size:8.5px;color:var(--tx-3)">${t2}</div>${bar||''}</div>`;
  if (mode === 'done')  return shell(videoInner(1)) + transport(true) + foot('336 frames · 30fps','1080×1920');
  if (mode === 'stale') return shell(`${videoInner(1)}<div style="position:absolute;left:8px;right:8px;bottom:8px;background:rgba(26,14,16,.95);border:1px solid #5c2327;border-radius:4px;padding:7px 9px;display:flex;gap:7px"><span style="color:var(--err);flex:0 0 auto;margin-top:1px">${I.warn}</span><span style="font-family:var(--mono);font-size:8px;color:#ff8b85;line-height:1.55">Kết quả lần chạy trước.<br><span style="color:var(--tx-3)">Luồng dừng ở GitHub Fetcher.</span></span></div>`, true) + transport(true) + foot('bị chặn','1080×1920','color:var(--err)');
  if (mode === 'notready') return shell(`<div class="vs" style="opacity:.14;filter:grayscale(1)"><div class="vs-grid"></div></div><div style="position:absolute;inset:0;background:rgba(10,10,11,.7)"></div>${center(`<span style="color:var(--warn)">${I.warn.replace('width="11" height="11"','width="22" height="22"')}</span>`,'Hyperframes Engine<br>sẽ có ở phiên bản v0.2','Bản đặc tả IR không đổi.<br>Nối lại Remotion Engine để xem.')}`) + transport(false) + foot('336 frames · 30fps','1080×1920','color:var(--warn)');
  if (mode === 'run')   return shell(center(`<span style="color:var(--run)">${I.spin.replace('width="11" height="11"','width="24" height="24"')}</span>`,'Đang sinh kịch bản<br>phân cảnh','bước 6 trên 9 · AI Director',`<div style="width:100%;height:3px;background:var(--bg-sunk);border-radius:2px;overflow:hidden"><div style="width:43%;height:100%;background:var(--run)"></div></div>`)) + transport(false) + foot('— frames · 30fps','1080×1920');
  return shell(center(`<span style="color:var(--tx-3);opacity:.5">${I.screen.replace('width="11" height="11"','width="26" height="26"')}</span>`,'Chưa có Bản đặc tả IR.<br>Bấm Chạy Luồng để dựng video.','')) + transport(false) + foot('— frames · 30fps','1080×1920');
}

/* ---------------- vỏ: dải trái, panel, header ---------------- */
const RAIL_CSS = `
    .rail{width:44px;flex:0 0 44px;background:var(--bg-panel);border-right:1px solid var(--line);display:flex;flex-direction:column;align-items:center;padding:8px 0;gap:4px}
    .rail .sp{flex:1}
    .rail .rt.b{margin-top:auto}
    .rt{width:36px;height:36px;display:flex;align-items:center;justify-content:center;color:var(--tx-3);border-radius:4px;position:relative}
    .rt.on{color:var(--accent-2);background:var(--accent-sunk)}
    .rt.on::before{content:"";position:absolute;left:-4px;top:8px;bottom:8px;width:2px;background:var(--accent);border-radius:1px}
    .rt .rd{position:absolute;top:6px;right:6px;width:6px;height:6px;border-radius:50%;background:var(--err);border:1.5px solid var(--bg-panel)}
    .panel{width:280px;flex:0 0 280px;background:var(--bg-panel);border-right:1px solid var(--line);display:flex;flex-direction:column;min-height:0}
    .pn-h{height:36px;flex:0 0 36px;display:flex;align-items:center;gap:8px;padding:0 12px;border-bottom:1px solid var(--line);font-family:var(--mono);font-size:9.5px;text-transform:uppercase;letter-spacing:.1em;color:var(--tx-2)}
    .pn-h .x{margin-left:auto;color:var(--tx-3);font-size:14px;text-transform:none;letter-spacing:0}
    .srch{margin:10px 12px 4px;height:28px;background:var(--bg-sunk);border:1px solid var(--line-2);border-radius:4px;display:flex;align-items:center;gap:7px;padding:0 9px;font-family:var(--mono);font-size:10px;color:var(--tx-3)}
    .grp{font-family:var(--mono);font-size:8px;text-transform:uppercase;letter-spacing:.13em;color:var(--tx-3);padding:10px 12px 4px}
    .li{display:flex;gap:9px;padding:6px 12px;align-items:flex-start}
    .li .lic{width:22px;height:22px;border-radius:4px;background:var(--bg-node-hdr);border:1px solid var(--line-2);display:flex;align-items:center;justify-content:center;color:var(--tx-2);flex:0 0 22px}
    .li .lin{font-family:var(--mono);font-size:10px;color:var(--tx);display:flex;align-items:center;gap:6px}
    .li .lid{font-family:var(--sans);font-size:9.5px;color:var(--tx-2);margin-top:2px;line-height:1.45}
    .li .lip{font-family:var(--mono);font-size:8px;color:var(--tx-3);margin-top:3px}
    .li .lip b{color:var(--accent-2);font-weight:500}
    .pn-f{margin-top:auto;padding:10px 12px;border-top:1px solid var(--line);font-family:var(--mono);font-size:8.5px;color:var(--tx-3);line-height:1.55}
    .hi{display:flex;gap:10px;padding:9px 12px;border-bottom:1px solid var(--line);align-items:flex-start}
    .hi.on{background:var(--accent-sunk);box-shadow:inset 2px 0 0 var(--accent)}
    .hi .th{width:40px;height:71px;background:#000;border:1px solid var(--line-2);border-radius:2px;overflow:hidden;position:relative;flex:0 0 40px}
    .hi .hn{font-family:var(--mono);font-size:10px;color:var(--tx)}
    .hi .hm{font-family:var(--mono);font-size:8.5px;color:var(--tx-3);line-height:1.6;margin-top:3px}
    .hi .hm b{color:var(--tx-2);font-weight:500}
    .cvcol{flex:1;display:flex;flex-direction:column;min-width:0;min-height:0}
    .logs{height:220px;flex:0 0 220px;background:var(--bg-sunk);border-top:1px solid var(--line-2);display:flex;flex-direction:column}
    .lg-h{height:32px;flex:0 0 32px;display:flex;align-items:center;gap:6px;padding:0 12px;border-bottom:1px solid var(--line);font-family:var(--mono);font-size:9px}
    .lg-h .t{text-transform:uppercase;letter-spacing:.1em;color:var(--tx-2);margin-right:6px}
    .chipf{padding:2px 7px;border:1px solid var(--line-2);border-radius:3px;color:var(--tx-3);font-size:8.5px}
    .chipf.on{border-color:var(--accent);color:var(--accent-2);background:var(--accent-sunk)}
    .lg-b{flex:1;overflow:hidden;padding:6px 0;font-family:var(--mono);font-size:9.5px;line-height:1.7}
    .ll{display:flex;gap:14px;padding:0 12px;white-space:nowrap}
    .ll .ts{color:var(--tx-3);flex:0 0 96px} .ll .nn{flex:0 0 108px} .ll .ms{color:var(--tx-2)}
    .ghost{position:absolute;opacity:.72;pointer-events:none;box-shadow:0 0 0 1px var(--accent),0 12px 30px rgba(0,0,0,.6)}
    .soon{font-family:var(--mono);font-size:7.5px;letter-spacing:.06em;color:var(--warn);border:1px solid #4a3a12;border-radius:3px;padding:1px 5px}
`;
const RI = {
  tpl:`<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line><line x1="9" y1="21" x2="9" y2="9"></line></svg>`,
  lib:`<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"></rect><rect x="14" y="3" width="7" height="7" rx="1"></rect><rect x="3" y="14" width="7" height="7" rx="1"></rect><line x1="17.5" y1="14" x2="17.5" y2="21"></line><line x1="14" y1="17.5" x2="21" y2="17.5"></line></svg>`,
  hist:`<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"></circle><polyline points="12 7 12 12 15.5 14"></polyline></svg>`,
  logs:`<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 17 10 11 4 5"></polyline><line x1="12" y1="19" x2="20" y2="19"></line></svg>`,
};
const rail = (on, errDot) => `<div class="rail">
    <span class="rt ${on==='tpl'?'on':''}">${RI.tpl}</span>
    <span class="rt ${on==='lib'?'on':''}">${RI.lib}</span>
    <span class="rt ${on==='hist'?'on':''}">${RI.hist}</span>
    <span class="rt ${on==='logs'?'on':''}">${RI.logs}${errDot?'<span class="rd"></span>':''}</span>
    <span class="sp"></span>
    <span class="rt ${on==='set'?'on':''}">${I.gear.replace('width="12" height="12"','width="16" height="16"')}</span></div>`;

const header = ({ running }) => `
  <div class="hdr">
    <div class="brand"><span class="logo"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="6" r="2.4"></circle><circle cx="18" cy="12" r="2.4"></circle><circle cx="6" cy="18" r="2.4"></circle><line x1="8.2" y1="7.2" x2="15.8" y2="10.8"></line><line x1="8.2" y1="16.8" x2="15.8" y2="13.2"></line></svg></span><span class="brand-nm">NodeCine</span></div>
    <span class="proj mono">nodecine-launch-video</span>
    <div class="hdr-mid"></div>
    ${running ? `<span class="btn btn-stop"><svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor"><rect x="5" y="5" width="14" height="14" rx="2"></rect></svg> Dừng Luồng</span>`
              : `<span class="btn btn-pri">${I.play} Chạy Luồng</span>`}
  </div>`;

const edgesSvg = (active, list = EDGES) => `
  <svg width="1440" height="844" style="position:absolute;inset:0;pointer-events:none;overflow:visible">
    <defs><marker id="ah" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto"><polygon points="0 0.6, 6.4 3.5, 0 6.4" fill="currentColor"></polygon></marker></defs>
    ${list.map(e => { const on = active.includes(e.id); const c = on ? '#7c5cff' : '#2f333b';
      return `<path d="${e.d}" fill="none" stroke="${c}" stroke-width="${on?1.7:1.3}" marker-end="url(#ah)" color="${c}"${on?'':' opacity="0.85"'}></path>`; }).join('')}
  </svg>`;
const tools = (zoom) => `
  <div class="tools">
    <div class="mmap" style="width:172px;height:96px">
      ${[[8,40,15,10],[27,38,15,12],[46,28,16,14],[66,54,16,11],[86,38,16,13],[66,76,16,10],[112,12,26,52],[112,70,26,12]]
        .map(([x,y,w,h])=>`<div class="mn" style="left:${x+10}px;top:${y}px;width:${w}px;height:${h}px"></div>`).join('')}
      <div class="vp" style="left:8px;top:8px;width:154px;height:80px"></div></div>
    <div class="tbar"><span class="zoom">${zoom}</span><span class="tbtn">${I.plus}</span><span class="tbtn">${I.minus}</span><span class="tbtn">${I.fit}</span><span class="tbtn">${I.plus}</span></div>
  </div>`;

/* panel thư viện: 5 nhóm, 9 khối */
const LIB = [
  ['Lõi · Nguồn',      [['bolt','Input Trigger','Ô văn bản, không diễn giải.','— → <b>SourceRef</b>'],
                        ['doc','Static Script','Gõ tay lời thoại và danh sách cảnh. Không mạng.','— → <b>DirectorPlan</b> · <b>AudioScript</b>']]],
  ['Lõi · Nhà cung cấp',[['term','Claude Code Provider','Dùng phiên Claude Code đã đăng nhập. Không cần khóa.','— → <b>LLMRef</b>'],
                        ['mic','System TTS Provider','Giọng của hệ điều hành + ffmpeg. Offline.','— → <b>TTSRef</b>'],
                        ['term','Anthropic API Provider <span class="soon">v0.2</span>','Qua khóa API trong Cài đặt.','— → <b>LLMRef</b>'],
                        ['mic','ElevenLabs Provider <span class="soon">v0.2</span>','Giọng đám mây qua khóa API.','— → <b>TTSRef</b>']]],
  ['Lõi · Xử lý',      [['wave','TTS Engine','Đọc lời thoại thành MP3, đo thời lượng.','<b>AudioScript</b> · <b>TTSRef</b> → <b>Voiceover</b>'],
                        ['layers','Timeline Assembler','Chia khung theo trọng số, đè dữ kiện, kiểm định IR.','<b>DirectorPlan</b> · <b>Voiceover</b> · <b>FactSheet?</b> → <b>VideoIR</b>']]],
  ['Lõi · Động cơ',    [['chip','Remotion Engine','React DOM / Chromium. Xem trước và kết xuất.','— → <b>EngineRef</b>'],
                        ['chip','Hyperframes Engine <span class="soon">v0.2</span>','Canvas runtime nhẹ. Chưa sẵn sàng.','— → <b>EngineRef</b>']]],
  ['Lõi · Xuất',       [['screen','Video Output','Trình phát 9:16 ngay trên canvas.','<b>VideoIR</b> · <b>EngineRef</b> → —'],
                        ['down','MP4 Export','Kết xuất theo yêu cầu, bỏ qua mặc định.','<b>VideoIR</b> · <b>EngineRef</b> → —']]],
  ['Gói · GitHub Showcase',[['branch','GitHub Fetcher','Gọi GitHub API lấy sao, README, lệnh cài.','<b>SourceRef</b> → <b>FactSheet</b>'],
                        ['bot','AI Director','Sáng tác lời thoại và 3 cảnh hook / mockup / cta.','<b>FactSheet</b> · <b>LLMRef</b> → <b>DirectorPlan</b> · <b>AudioScript</b>']]],
];
const libPanel = () => `<div class="panel">
    <div class="pn-h">Thư viện khối<span class="x">×</span></div>
    <div class="srch"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"></circle><line x1="16.5" y1="16.5" x2="21" y2="21"></line></svg>Tìm khối…</div>
    ${LIB.map(([g,items])=>`<div class="grp">${g}</div>`+items.map(([ic,n,d,p])=>`<div class="li"><span class="lic">${I[ic]}</span><div><div class="lin">${n}</div><div class="lid">${d}</div><div class="lip">${p}</div></div></div>`).join('')).join('')}
    <div class="pn-f">Kéo thả lên canvas, hoặc nhấp đúp để thả vào giữa vùng đang nhìn.</div></div>`;
const histPanel = () => `<div class="panel">
    <div class="pn-h">Lịch sử chạy<span class="x">×</span></div>
    ${[['#3','21:04:10','11.20s · 336f','8.0s','Remotion',true,'nodecine-launch-video.mp4 · 4.8 MB'],
       ['#2','20:58:41','9.75s · 293f','5.1s','Remotion',false,null],
       ['#1','20:51:07','12.40s · 372f','9.4s','Remotion',false,null]].map(([n,t,d,r,e,on,x])=>`
      <div class="hi ${on?'on':''}"><div class="th">${videoInner(0.16)}</div>
        <div><div class="hn">Lần chạy ${n}</div><div class="hm"><b>${t}</b> · ${e}<br>${d} · chạy ${r}${x?`<br><span style="color:var(--ok)">${I.down} ${x}</span>`:''}</div></div></div>`).join('')}
    <div class="pn-f">Chỉ giữ trong phiên này, tối đa 20 mục. Tải lại trang là mất.</div></div>`;

const LOG_RUN = [
  ['21:04:02.118','Input Trigger','var(--ok)','nhận diện github-url → github.com/anhto611/nodecine'],
  ['21:04:02.131','GitHub Fetcher','var(--ok)','GET /repos/anhto611/nodecine → 200 · 412ms'],
  ['21:04:02.540','GitHub Fetcher','var(--ok)','README 3.9k ký tự · stars=1284 · lang=TypeScript · install=npm i nodecine'],
  ['21:04:02.902','GitHub Fetcher','var(--ok)','hoàn thành 0.8s · hash 9f3a2c'],
  ['21:04:02.903','Claude Code Provider','var(--ok)','probe → claude 2.1.260 · đã đăng nhập · hash không đổi, phía sau dùng lại'],
  ['21:04:02.905','AI Director','var(--ok)','claude -p --output-format json · lời nhắc 1.4k ký tự qua stdin'],
  ['21:04:07.118','AI Director','var(--ok)','kiểm định DirectorPlan ✓ · language=en ✓ · 3 cảnh · hoàn thành 4.2s'],
  ['21:04:07.119','System TTS Provider','var(--ok)','probe → say · ffmpeg 7.1 · 4 giọng · hash không đổi'],
  ['21:04:07.120','TTS Engine','var(--ok)','chọn giọng khớp en → Samantha · say → aiff → ffmpeg → mp3 · speed=1.00'],
  ['21:04:09.702','TTS Engine','var(--ok)','voice_9f3a2c.mp3 · đo được 11.20s · hoàn thành 2.6s'],
  ['21:04:09.703','Assembler','var(--ok)','336 frames = ceil(11.20 × 30) · ≥ 270 ✓ · padTail 0 · phân bổ 84 / 168 / 84'],
  ['21:04:09.705','Remotion Engine','var(--ok)','probe → preview ready · render ready · hash không đổi'],
  ['21:04:09.706','Video Output','var(--ok)','irVersion=1 · engine=remotion · player sẵn sàng 0.3s'],
  ['21:04:09.706','MP4 Export','var(--tx-3)','bỏ qua'],
  ['21:04:10.011','Luồng','var(--accent-2)','hoàn thành 9/10 khối (1 bỏ qua) · 8.0s'],
];
const LOG_EXPORT = [
  ['21:07:12.004','MP4 Export','var(--run)','bắt đầu · h264 · crf 18 · nodecine-launch-video.mp4'],
  ['21:07:12.310','MP4 Export','var(--run)','đóng gói Remotion · dùng lại bundle 9f3a2c'],
  ['21:07:13.880','MP4 Export','var(--run)','khởi chạy Chromium · concurrency 4 · angle'],
  ['21:07:14.102','MP4 Export','var(--run)','rendered 0/336'],
  ['21:07:22.418','MP4 Export','var(--run)','rendered 64/336 · 7.7 fps'],
  ['21:07:29.551','MP4 Export','var(--run)','rendered 120/336 · 8.1 fps'],
  ['21:07:36.204','MP4 Export','var(--run)','rendered 172/336 · 7.8 fps'],
  ['21:07:41.930','MP4 Export','var(--run)','rendered 208/336 · 7.9 fps · còn ~16s'],
];
const logsPanel = (lines, chips) => `<div class="logs">
    <div class="lg-h"><span class="t">Nhật ký</span>
      ${chips.map((c,i)=>`<span class="chipf ${i===0?'on':''}">${c}</span>`).join('')}
      <span class="srch" style="margin:0 0 0 auto;height:22px;width:170px">Tìm trong nhật ký…</span>
      <span class="btn" style="height:22px;padding:0 8px;font-size:8.5px">Sao chép toàn bộ</span>
      <span class="btn" style="height:22px;padding:0 8px;font-size:8.5px">Xóa</span>
      <span style="color:var(--tx-3);font-size:13px;margin-left:4px">×</span></div>
    <div class="lg-b">${lines.map(([t,n,c,m])=>`<div class="ll"><span class="ts">${t}</span><span class="nn" style="color:${c}">${n}</span><span class="ms">${m}</span></div>`).join('')}</div></div>`;

const screen = ({ nodes, edges, hdr, railOn=null, panel='', bottom='', scale=1, zoom='88%', errDot=false, edgeList }) =>
  dcOpen(RAIL_CSS) + `
<div class="shell">
  ${header(hdr)}
  <div class="body">
    ${rail(railOn, errDot)}${panel}
    <div class="cvcol">
      <div class="canvas" style="flex:1;width:auto">
        <div style="position:absolute;inset:0;transform:scale(${scale});transform-origin:0 0">${edgesSvg(edges, edgeList)}${nodes}</div>
        ${tools(zoom)}
      </div>${bottom}
    </div>
  </div>
</div>` + dcClose;

const ALL = EDGES.map(e=>e.id);
const RUN_EDGES = ['e1','e2','e3','e4','e5','e6','e7','e8','e9','e11'];   // e10, e12 vào Export bị bỏ qua
const doneNodes = (exportMode='byp') => [
  mk('input','ok','0.1s',B.input(true),true), mk('fetch','ok','0.8s',B.fetch('done'),true),
  mk('llm','ok','sẵn sàng',B.llm('ready'),true), mk('ttsp','ok','sẵn sàng',B.ttsp(),true),
  mk('direct','ok','4.2s',B.direct('done'),true), mk('tts','ok','2.6s',B.tts('done'),true),
  mk('asm','ok','0.0s',B.asm('done'),true), mk('engine','ok','sẵn sàng',B.engine('ready'),true),
  mk('out','ok','0.3s',outBody('done'),true),
  mk('export', exportMode==='run'?'run':exportMode==='done'?'ok':'byp', exportMode==='done'?'42s':'', B.export(exportMode), exportMode!=='byp') ].join('');

/* ================= màn hình ================= */
writeFileSync('ChuaChay.dc.html', screen({ hdr:{running:false}, edges:[],
  nodes:[ mk('input','idle','',B.input(false)), mk('fetch','idle','',B.fetch('idle')), mk('llm','ok','sẵn sàng',B.llm('ready')),
    mk('ttsp','ok','sẵn sàng',B.ttsp()), mk('direct','idle','',B.direct('idle')),
    mk('tts','idle','',B.tts('idle')), mk('asm','idle','',B.asm('idle')), mk('engine','ok','sẵn sàng',B.engine('ready')),
    mk('out','idle','',outBody('idle')), mk('export','byp','',B.export('byp')) ].join('') }));

writeFileSync('DangChay.dc.html', screen({ hdr:{running:true}, edges:['e1','e2','e3','e4'],
  nodes:[ mk('input','ok','0.1s',B.input(true),true), mk('fetch','ok','0.8s',B.fetch('done'),true), mk('direct','run','',B.direct('run')),
    mk('llm','ok','sẵn sàng',B.llm('ready'),true), mk('ttsp','ok','sẵn sàng',B.ttsp()),
    mk('tts','queue','',B.tts('idle')), mk('asm','queue','',B.asm('idle')), mk('engine','ok','sẵn sàng',B.engine('ready')),
    mk('out','queue','',outBody('run')), mk('export','byp','',B.export('byp')) ].join('') }));

writeFileSync('Main.dc.html', screen({ hdr:{running:false}, edges:RUN_EDGES, nodes:doneNodes('byp') }));

writeFileSync('Loi.dc.html', screen({ hdr:{running:false}, edges:['e1'], errDot:true,
  nodes:[ mk('input','ok','0.1s',B.input(true),true), mk('fetch','err','',B.fetch('err')), mk('direct','block','',B.direct('idle')),
    mk('llm','ok','sẵn sàng',B.llm('ready')), mk('ttsp','ok','sẵn sàng',B.ttsp()),
    mk('tts','block','',B.tts('idle')), mk('asm','block','',B.asm('idle')), mk('engine','ok','sẵn sàng',B.engine('ready')),
    mk('out','block','',outBody('stale')), mk('export','byp','',B.export('byp')) ].join('') }));

const ghost = `<div class="nd ghost" style="left:560px;top:154px;width:196px;height:120px">
    <div class="nd-h"><span class="ic">${I.bot}</span><span class="nd-t">AI Director</span></div>
    <div class="nd-b"><div class="kv"><span class="k">ngôn ngữ</span><span class="v">English</span></div><div class="hint">thả để tạo khối</div></div></div>
  <svg width="18" height="22" viewBox="0 0 18 22" style="position:absolute;left:556px;top:146px"><path d="M2 2 L2 17 L6 13 L9 20 L11.5 19 L8.5 12.5 L14 12.5 Z" fill="#fff" stroke="#000" stroke-width="1.2" stroke-linejoin="round"></path></svg>`;
writeFileSync('ThuVienKhoi.dc.html', screen({ hdr:{running:false}, railOn:'lib', panel:libPanel(), edges:['e1'], edgeList:[EDGES[0]],
  nodes:[ mk('input','idle','',B.input(false)), mk('fetch','idle','',B.fetch('idle')), ghost ].join(''), zoom:'100%' }));

writeFileSync('LichSu.dc.html', screen({ hdr:{running:false}, railOn:'hist', panel:histPanel(), edges:RUN_EDGES, nodes:doneNodes('done'), scale:.8, zoom:'70%' }));

writeFileSync('NhatKy.dc.html', screen({ hdr:{running:false}, railOn:'logs', bottom:logsPanel(LOG_RUN,['Tất cả','GitHub Fetcher','AI Director','TTS Engine','MP4 Export']),
  edges:RUN_EDGES, nodes:doneNodes('byp'), scale:.74, zoom:'65%' }));

/* Kết xuất đang chạy: chỉ Export chạy riêng, dây e8 + e10 sáng */
writeFileSync('KetXuat.dc.html', screen({ hdr:{running:false}, railOn:'logs', bottom:logsPanel(LOG_EXPORT,['MP4 Export','Tất cả']),
  edges:[...RUN_EDGES,'e8','e10'], nodes:doneNodes('run'), scale:.74, zoom:'65%' }));


/* ================= Pha A: đồ thị Kịch Bản Tĩnh, 7 khối, không mạng ================= */
const NA = {
  static: { x:60,   y:200, w:230, h:236, ic:'doc',    t:'Static Script'      },
  ttsp:   { x:330,  y:520, w:190, h:124, ic:'mic',    t:'System TTS Provider'},
  tts:    { x:550,  y:380, w:190, h:150, ic:'wave',   t:'TTS Engine'         },
  asm:    { x:770,  y:200, w:190, h:150, ic:'layers', t:'Timeline Assembler' },
  engine: { x:550,  y:600, w:190, h:124, ic:'chip',   t:'Remotion Engine'    },
  out:    { x:1100, y:60,  w:284, h:584, ic:'screen', t:'Video Output'       },
  export: { x:1100, y:684, w:284, h:136, ic:'down',   t:'MP4 Export'         },
};
const PA = {
  static: { out:[[80,'Kịch bản Phân cảnh'],[112,'Lời thoại']] },
  ttsp:   { out:[[60,'Giọng đọc']] },
  tts:    { in:[[60,''],[92,'']], out:[[76,'Âm thanh']] },
  asm:    { in:[[40,''],[75,''],[110,'Dữ kiện · tùy chọn']], out:[[75,'Bản đặc tả IR']] },
  engine: { out:[[60,'Động cơ']] },
  out:    { in:[[60,'Bản đặc tả IR'],[90,'Động cơ']] },
  export: { in:[[44,'Bản đặc tả IR'],[74,'Động cơ']] },
};
const EA = [
  { id:'a1', d:'M290,280 C400,280 660,240 770,240' },
  { id:'a2', d:'M290,312 C390,312 450,440 550,440' },
  { id:'a3', d:'M520,580 C540,580 530,472 550,472' },
  { id:'a4', d:'M740,456 C770,456 740,275 770,275' },
  { id:'a5', d:'M960,275 C1010,275 1050,120 1100,120' },
  { id:'a6', d:'M960,275 C1035,275 1065,728 1100,728' },
  { id:'a7', d:'M740,660 C900,660 1088,620 1088,420 C1088,200 1070,150 1100,150' },
  { id:'a8', d:'M740,660 C900,660 980,758 1100,758' },
];
const mkA = (key, state, meta, body, on) => {
  const n = NA[key], pp = PA[key];
  return `<div class="nd ${cls(state)}" style="left:${n.x}px;top:${n.y}px;width:${n.w}px;height:${n.h}px">
      <div class="nd-h"><span class="ic">${I[n.ic]}</span><span class="nd-t">${n.t}</span>${badge(state,meta)}</div>
      <div class="nd-b">${body}</div>${ports('in', pp.in, on)}${ports('out', pp.out, on)}</div>`;
};
const staticBody = `
  <div class="kv"><span class="k">ngôn ngữ</span><span class="v">English ${I.chev}</span></div>
  <div class="kv"><span class="k">theme</span><span class="v">core/dark</span></div>
  <div class="fld" style="margin-top:5px;max-height:34px;overflow:hidden;color:var(--tx-2)">Meet NodeCine. Build short videos from a node graph, not a timeline…</div>
  <div style="margin-top:7px;display:flex;flex-direction:column;gap:3px">
    ${[['1','core/title-card','w1','SHIP VIDEO FROM A GRAPH'],['2','core/title-card','w2','Nodes, not timelines'],['3','core/title-card','w1','Star on GitHub']]
      .map(([n,t,w,h])=>`<div class="bul" style="gap:6px"><i>${n}</i><span style="color:var(--tx-3)">${t}</span><span style="color:var(--accent-2)">${w}</span><span style="flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${h}</span></div>`).join('')}
  </div>
  <div class="hint" style="margin-top:6px">${I.plus} thêm cảnh · kéo để đổi thứ tự</div>`;
const asmBodyA = `<div class="kv"><span class="k">tổng</span><span class="v">294 frames</span></div>
  <div class="kv"><span class="k">fps</span><span class="v">30 · 1080×1920</span></div>
  <div style="display:flex;gap:2px;margin-top:8px;height:10px">
    <div style="width:25%;background:var(--accent);border-radius:2px 0 0 2px"></div><div style="width:50%;background:var(--accent-2)"></div><div style="width:25%;background:var(--ok);border-radius:0 2px 2px 0"></div></div>
  <div class="kv" style="margin-top:4px"><span class="k">73 · w1</span><span class="k">147 · w2</span><span class="k">74 · w1</span></div>
  <div class="hint">IR hợp lệ · 5/5 bất biến · không dữ kiện</div>`;
const titleCardVideo = `<div class="vs"><div class="vs-grid"></div>
  <div style="position:relative;flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:0 22px;text-align:center;gap:12px">
    <div style="width:28px;height:3px;background:#a78bfa;border-radius:2px"></div>
    <div style="font-family:var(--mono);font-size:19px;font-weight:700;color:#fff;line-height:1.25;letter-spacing:.02em">NODES,<br>NOT<br>TIMELINES</div>
    <div style="font-family:var(--mono);font-size:8px;color:#8b909b;letter-spacing:.14em;text-transform:uppercase">core/title-card</div></div>
  <div style="position:relative;padding:0 14px 22px;font-family:var(--mono);font-size:6.8px;color:#5a5f6a;text-align:center">nodecine · static script</div></div>`;
const outBodyA = (() => {
  const shell = `<div style="width:${VW}px;height:${VH}px;background:#000;border:1px solid var(--line-2);border-radius:3px;overflow:hidden;position:relative">${titleCardVideo}</div>`;
  return shell + `
    <div style="display:flex;align-items:center;gap:8px;margin-top:9px">
      <span class="pbtn" style="width:24px;height:24px">${I.start}</span>
      <span class="pbtn" style="width:24px;height:24px;background:var(--accent);border-color:var(--accent);color:#fff">${I.pause}</span>
      <div class="scrub" style="flex:1"><div class="fill" style="width:45%"></div><div class="head" style="left:45%"></div></div>
      <div class="cnt" style="font-size:8.5px"><span>132 <em>/ 294</em></span><span><em>4.40 / 9.80s</em></span></div></div>
    <div class="insp" style="margin-top:8px">
      ${[['Cảnh 1','0–73',25],['Cảnh 2','73–220',50],['Cảnh 3','220–294',25]].map(([n,f,w],i)=>`<div class="sc ${i===1?'act':''}" style="flex:${w};padding:5px 6px"><div class="sc-n" style="font-size:8.5px">${n}</div><div class="sc-f" style="font-size:8px">${f}</div></div>`).join('')}</div>
    <div class="kv" style="margin-top:8px;padding-top:7px;border-top:1px solid var(--line)"><span class="k">294 frames · 30fps</span><span class="k">1080×1920</span></div>`;
})();
writeFileSync('PhaA.dc.html', screen({ hdr:{running:false}, edges:['a1','a2','a3','a4','a5','a7'], edgeList:EA,
  nodes:[ mkA('static','ok','0.0s',staticBody,true), mkA('ttsp','ok','sẵn sàng',B.ttsp(),true),
    mkA('tts','ok','1.9s',B.tts('done').replace('11.20 giây','9.80 giây'),true), mkA('asm','ok','0.0s',asmBodyA,true),
    mkA('engine','ok','sẵn sàng',B.engine('ready'),true), mkA('out','ok','0.3s',outBodyA,true),
    mkA('export','byp','',B.export('byp')) ].join('') }));

export { N, P, EDGES, B, outBody, videoInner, mk, badge, cls, ports, VW, VH };
console.log('8 màn hình studio · 10 khối · 12 dây');
