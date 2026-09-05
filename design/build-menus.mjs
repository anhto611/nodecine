import { writeFileSync } from 'node:fs';
import { dcOpen, dcClose, ICONS as I } from './tokens.mjs';
import { B, outBody } from './build-studio.mjs';

const CSS2 = `
    .h1{font-family:var(--mono);font-size:13px;font-weight:700;letter-spacing:.02em}
    .cap2{font-family:var(--mono);font-size:9px;color:var(--tx-3);line-height:1.62}
    .modal{background:var(--bg-panel);border:1px solid var(--line-3);border-radius:9px;
      box-shadow:0 30px 80px rgba(0,0,0,.8);overflow:hidden;display:flex;flex-direction:column}
    .mo-h{height:52px;flex:0 0 52px;display:flex;align-items:center;gap:12px;
      padding:0 18px;border-bottom:1px solid var(--line)}
    .srch{margin-left:auto;width:250px;height:30px;background:var(--bg-sunk);
      border:1px solid var(--line-2);border-radius:4px;display:flex;align-items:center;
      gap:8px;padding:0 10px;font-family:var(--mono);font-size:11px;color:var(--tx-3)}
    .mo-b{flex:1;display:flex;min-height:0}
    .side{width:206px;flex:0 0 206px;border-right:1px solid var(--line);padding:12px 10px;
      display:flex;flex-direction:column;gap:2px}
    .cat{display:flex;align-items:center;gap:9px;padding:7px 10px;border-radius:4px;
      font-family:var(--mono);font-size:11px;color:var(--tx-2)}
    .cat .n{margin-left:auto;font-size:9px;color:var(--tx-3)}
    .cat.on{background:var(--accent-sunk);color:var(--tx)}
    .cat.on .n{color:var(--accent-2)}
    .gridwrap{flex:1;padding:16px 18px;overflow:hidden}
    .cards{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px}
    .card{background:var(--bg-node);border:1px solid var(--line-2);border-radius:6px;
      overflow:hidden;display:flex;flex-direction:column}
    .card.on{border-color:var(--accent);box-shadow:0 0 0 1px rgba(124,92,255,.32)}
    .thumb{height:152px;background:#08090c;border-bottom:1px solid var(--line);
      display:flex;align-items:center;justify-content:center;position:relative;overflow:hidden}
    .ph{width:86px;height:152px;background:#0b0c10;border-left:1px solid #23262c;
      border-right:1px solid #23262c;position:relative;overflow:hidden;
      display:flex;flex-direction:column;align-items:center}
    .card-b{padding:11px 12px;display:flex;flex-direction:column;gap:5px}
    .card-t{font-family:var(--mono);font-size:11px;color:var(--tx);display:flex;
      align-items:center;gap:7px}
    .card-d{font-family:var(--sans);font-size:11px;color:var(--tx-2);line-height:1.55}
    .card-m{font-family:var(--mono);font-size:8.5px;color:var(--tx-3);
      display:flex;gap:9px;margin-top:2px}
    .mo-f{flex:0 0 auto;border-top:1px solid var(--line);padding:13px 18px;
      display:flex;align-items:center;gap:10px}
    .menu{background:var(--bg-node);border:1px solid var(--line-3);border-radius:6px;
      box-shadow:0 18px 50px rgba(0,0,0,.72);overflow:hidden}
    .mit{display:flex;align-items:flex-start;gap:10px;padding:10px 13px;
      font-family:var(--mono);font-size:11.5px;color:var(--tx)}
    .mit.sel{background:var(--accent-sunk)}
    .mgrp{font-family:var(--mono);font-size:8px;text-transform:uppercase;
      letter-spacing:.13em;color:var(--tx-3);padding:12px 13px 6px}
    .note{background:var(--bg-sunk);border:1px solid var(--line);border-radius:5px;
      padding:12px 13px;display:flex;gap:11px}
    .note .nt{font-size:11.5px;color:var(--tx-2);line-height:1.68}
    .field{display:flex;flex-direction:column;gap:8px}
    .flab{font-family:var(--mono);font-size:9px;text-transform:uppercase;
      letter-spacing:.11em;color:var(--tx-3)}
    .inp{background:var(--bg-sunk);border:1px solid var(--line-2);border-radius:4px;
      height:36px;display:flex;align-items:center;padding:0 12px;gap:9px;
      font-family:var(--mono);font-size:11.5px;color:var(--tx)}
    .inp.ph2{color:var(--tx-3)}
    .dlg{background:var(--bg-panel);border:1px solid var(--line-3);border-radius:8px;
      box-shadow:0 26px 74px rgba(0,0,0,.78);overflow:hidden;width:660px}
    .dlg-h{height:48px;display:flex;align-items:center;padding:0 19px;gap:11px;
      border-bottom:1px solid var(--line)}
    .dlg-b{padding:21px 19px;display:flex;flex-direction:column;gap:21px}
    .dlg-f{border-top:1px solid var(--line);padding:14px 19px;display:flex;align-items:center;gap:10px}
`;
const wrap = (w, h, inner) => dcOpen(CSS2) +
  `<div style="width:${w}px;height:${h}px;background:var(--bg-app);overflow:hidden">${inner}</div>` + dcClose;

/* ---------- ảnh thu nhỏ trong thẻ bản mẫu (khung dọc 9:16) ---------- */
const bar = (w, c, h = 3) => `<div style="width:${w}%;height:${h}px;background:${c};border-radius:1px"></div>`;
const THUMB = {
  github: `<div style="padding:12px 8px 0;width:100%;display:flex;flex-direction:column;align-items:center;gap:4px">
      <div style="font-family:var(--mono);font-size:4px;color:#a78bfa;letter-spacing:.2em">CORE FEATURES</div>
      <div style="font-family:var(--mono);font-size:8px;color:#fff;font-weight:700">nodecine</div>
      <div style="width:66px;background:#0e1015;border:1px solid #2b2f38;border-radius:2px;
        margin-top:5px;padding:4px 4px;display:flex;flex-direction:column;gap:2.5px">
        ${bar(70, '#3fb950', 2)}${bar(50, '#39404d', 2)}${bar(60, '#39404d', 2)}${bar(44, '#39404d', 2)}
      </div>
      <div style="margin-top:auto;padding-bottom:9px;display:flex;gap:3px;align-items:center">
        <span style="color:#d29922;display:flex">${I.star}</span>
        <span style="font-family:var(--mono);font-size:4.5px;color:#d29922">1.284</span></div>
    </div>`,
  phone: `<div style="padding:16px 0 0;display:flex;flex-direction:column;align-items:center;gap:6px;width:100%">
      <div style="width:38px;height:66px;border:1.5px solid #39404d;border-radius:6px;
        background:#111318"></div>${bar(56, '#2f333b')}${bar(40, '#23262c')}</div>`,
  list: `<div style="padding:18px 12px 0;display:flex;flex-direction:column;gap:5px;width:100%">
      ${bar(72, '#39404d')}${bar(90, '#23262c')}${bar(84, '#23262c')}${bar(60, '#23262c')}
      <div style="height:6px"></div>${bar(52, '#2f333b')}${bar(78, '#23262c')}</div>`,
  reddit: `<div style="padding:14px 10px 0;display:flex;flex-direction:column;gap:4px;width:100%">
      <div style="width:100%;height:32px;background:#15171c;border-radius:3px"></div>
      ${bar(88, '#23262c')}${bar(76, '#23262c')}${bar(90, '#23262c')}${bar(52, '#23262c')}
      <div style="margin-top:auto;padding-bottom:10px;width:100%;height:22px;background:#15171c;border-radius:3px"></div></div>`,
  facts: `<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;
      height:100%;gap:7px"><div style="font-family:var(--mono);font-size:22px;color:#39404d;font-weight:700">42</div>
      ${bar(60, '#23262c')}</div>`,
  quote: `<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;
      height:100%;gap:8px;padding:0 12px"><div style="font-family:var(--mono);font-size:26px;
      color:#2f333b;line-height:.7">&#8220;</div>${bar(80, '#23262c')}${bar(64, '#23262c')}${bar(72, '#23262c')}</div>`,
  sale: `<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;
      height:100%;gap:8px"><div style="width:40px;height:40px;border-radius:50%;
      border:2px solid #39404d;display:flex;align-items:center;justify-content:center;
      font-family:var(--mono);font-size:11px;color:#39404d">%</div>${bar(58, '#23262c')}</div>`,
  vs: `<div style="display:flex;height:100%;width:100%">
      <div style="flex:1;background:#111318;border-right:1px solid #23262c"></div>
      <div style="flex:1;background:#0e0f13"></div></div>`,
  bars: `<div style="display:flex;align-items:flex-end;gap:4px;height:100%;padding:0 14px 22px">
      ${[18, 34, 26, 46, 30].map(h => `<span style="flex:1;height:${h}px;background:#2f333b;border-radius:1px"></span>`).join('')}</div>`,
  title: `<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;gap:7px;padding:0 10px">
      <div style="width:18px;height:2px;background:#a78bfa"></div>
      <div style="font-family:var(--mono);font-size:7.5px;color:#fff;font-weight:700;text-align:center;line-height:1.3">NODES,<br>NOT<br>TIMELINES</div>
      ${bar(60, '#23262c', 2)}</div>`,
  line: `<svg width="86" height="152" viewBox="0 0 86 152"><polyline points="8,104 22,88 34,96 48,66 60,78 78,44"
      fill="none" stroke="#2f333b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></polyline></svg>`,
};

/* Chỉ những bản mẫu thật sự mở được. Không liệt kê thứ chưa dựng. */
const TPL = [
  ['title', 'Kịch Bản Tĩnh', 'Gõ tay lời thoại và cảnh. Đồ thị lõi bảy node, không mạng.', '7 node · 9:16'],
  ['github', 'GitHub Repo Showcase', 'Biến link repo thành video dọc 9:16 phong cách terminal.', '10 node · 9:16'],
  ['quote', 'Thẻ Trích Dẫn Truyền Cảm Hứng', 'Biến một chủ đề thành loạt thẻ trích dẫn dọc 9:16. Không cần mạng.', '8 node · 9:16'],
];

const RAIL_MINI = (on) => `<div style="position:absolute;left:0;top:0;bottom:0;width:44px;background:var(--bg-panel);border-right:1px solid var(--line);display:flex;flex-direction:column;align-items:center;padding:8px 0;gap:4px">
    ${[['tpl','<rect x="3" y="3" width="18" height="18" rx="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line><line x1="9" y1="21" x2="9" y2="9"></line>'],
       ['lib','<rect x="3" y="3" width="7" height="7" rx="1"></rect><rect x="14" y="3" width="7" height="7" rx="1"></rect><rect x="3" y="14" width="7" height="7" rx="1"></rect><line x1="17.5" y1="14" x2="17.5" y2="21"></line><line x1="14" y1="17.5" x2="21" y2="17.5"></line>'],
       ['hist','<circle cx="12" cy="12" r="9"></circle><polyline points="12 7 12 12 15.5 14"></polyline>'],
       ['logs','<polyline points="4 17 10 11 4 5"></polyline><line x1="12" y1="19" x2="20" y2="19"></line>']]
      .map(([k,d])=>`<span style="width:36px;height:36px;display:flex;align-items:center;justify-content:center;border-radius:4px;color:${on===k?'var(--accent-2)':'var(--tx-3)'};background:${on===k?'var(--accent-sunk)':'transparent'};position:relative">${on===k?'<span style="position:absolute;left:-4px;top:8px;bottom:8px;width:2px;background:var(--accent);border-radius:1px"></span>':''}<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${d}</svg></span>`).join('')}
    <span style="flex:1"></span>
    <span style="width:36px;height:36px;display:flex;align-items:center;justify-content:center;border-radius:4px;color:${on==='set'?'var(--accent-2)':'var(--tx-3)'};background:${on==='set'?'var(--accent-sunk)':'transparent'};position:relative">${on==='set'?'<span style="position:absolute;left:-4px;top:8px;bottom:8px;width:2px;background:var(--accent);border-radius:1px"></span>':''}${I.gear.replace('width="12" height="12"','width="16" height="16"')}</span>
  </div>`;
writeFileSync('TemplateBrowser.dc.html', wrap(1200, 800, `
  <div style="width:1200px;height:800px;background:rgba(6,6,8,.66);position:relative;
    display:flex;align-items:center;justify-content:center">${RAIL_MINI('tpl')}
    <div class="modal" style="width:1128px;height:716px">
      <div class="mo-h">
        <span style="color:var(--accent-2);display:flex"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"></rect><rect x="14" y="3" width="7" height="7" rx="1"></rect><rect x="3" y="14" width="7" height="7" rx="1"></rect><rect x="14" y="14" width="7" height="7" rx="1"></rect></svg></span>
        <span class="h1">Bản mẫu</span>
        <span class="cap2">Chọn một đồ thị đã nối dây sẵn</span>
        <span class="srch"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"></circle><line x1="16.5" y1="16.5" x2="21" y2="21"></line></svg>Tìm bản mẫu…</span>
        <span style="color:var(--tx-3);font-family:var(--mono);font-size:17px;margin-left:4px">×</span>
      </div>
      <div class="mo-b">
        <div class="side">
          ${[['Tất cả', 3, 1], ['Lõi', 1, 0], ['Tech &amp; Product', 1, 0], ['Faceless Content', 1, 0]]
            .map(([n, c, on]) => `<div class="cat ${on ? 'on' : ''}">
              <span style="display:flex;opacity:.75">${I.screen}</span><span>${n}</span><span class="n">${c}</span></div>`).join('')}
          <div style="height:1px;background:var(--line);margin:9px 2px"></div>
          <div class="cat"><span style="display:flex;opacity:.75">${I.plus}</span><span>Canvas trống</span></div>
        </div>
        <div class="gridwrap">
          <div class="cards">
            ${TPL.map(([th, nm, desc, meta], i) => `
              <div class="card ${i === 0 ? 'on' : ''}">
                <div class="thumb"><div class="ph">${THUMB[th]}</div></div>
                <div class="card-b">
                  <div class="card-t">${nm}</div>
                  <div class="card-d">${desc}</div>
                  <div class="card-m"><span>${meta}</span><span>30 fps</span></div>
                </div>
              </div>`).join('')}
          </div>
        </div>
      </div>
      <div class="mo-f">
        <span class="cap2">Mở bản mẫu sẽ thay toàn bộ đồ thị hiện tại.</span>
        <span style="margin-left:auto"></span>
        <span class="btn">Hủy</span>
        <span class="btn btn-pri">Mở Kịch Bản Tĩnh</span>
      </div>
    </div>
  </div>`));

/* ============ Engine là node: Remotion sẵn sàng, Hyperframes chưa ============ */
const nd = (x,y,w,h,ic,title,badgeHtml,body,pin,pout,ncls) => `
  <div class="nd ${ncls||''}" style="left:${x}px;top:${y}px;width:${w}px;height:${h}px">
    <div class="nd-h"><span class="ic">${I[ic]}</span><span class="nd-t">${title}</span>${badgeHtml}</div>
    <div class="nd-b">${body}</div>
    ${(pin||[]).map(([o,l])=>`<div class="p p-in on" style="top:${o-3.5}px"></div><div class="plab" style="top:${o-4}px;left:11px">${l}</div>`).join('')}
    ${(pout||[]).map(([o,l])=>`<div class="p p-out on" style="top:${o-3.5}px"></div><div class="plab" style="top:${o-4}px;right:11px">${l}</div>`).join('')}
  </div>`;
writeFileSync('EngineNode.dc.html', wrap(1180, 820, `
  <div class="canvas" style="width:1180px;height:820px;position:relative">
    <svg width="1180" height="820" style="position:absolute;inset:0;pointer-events:none">
      <defs><marker id="ah2" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto"><polygon points="0 0.6, 6.4 3.5, 0 6.4" fill="currentColor"></polygon></marker></defs>
      <path d="M266,140 C330,140 340,120 400,120" fill="none" stroke="#2f333b" stroke-width="1.3" opacity=".5" marker-end="url(#ah2)" color="#2f333b"></path>
      <path d="M266,362 C360,362 360,150 460,150" fill="none" stroke="#d29922" stroke-width="1.7" marker-end="url(#ah2)" color="#d29922"></path>
      <path d="M266,362 C360,362 380,758 460,758" fill="none" stroke="#d29922" stroke-width="1.7" marker-end="url(#ah2)" color="#d29922"></path>
      <path d="M400,120 C430,120 430,120 460,120" fill="none" stroke="#7c5cff" stroke-width="1.7" marker-end="url(#ah2)" color="#7c5cff"></path>
      <path d="M400,120 C440,120 420,728 460,728" fill="none" stroke="#7c5cff" stroke-width="1.7" marker-end="url(#ah2)" color="#7c5cff"></path>
    </svg>
    <div style="position:absolute;left:40px;top:40px;font-family:var(--mono);font-size:9px;color:var(--tx-3);letter-spacing:.1em;text-transform:uppercase">Node Động Cơ · dây vàng = engine chưa sẵn sàng</div>
    ${nd(70,80,196,124,'chip','Remotion Engine',`<span class="st s-ok"><span class="dot"></span>sẵn sàng</span>`,B.engine('ready'),null,[[60,'Động cơ']],'n-ok')}
    <div style="position:absolute;left:70px;top:214px;width:196px;font-family:var(--mono);font-size:8.5px;color:var(--tx-3);line-height:1.6">Dây mờ: đã bị thay khi người dùng nối engine mới vào Video Output.</div>
    ${nd(70,302,196,124,'chip','Hyperframes Engine',`<span class="st" style="color:var(--warn)"><span class="dot" style="background:var(--warn)"></span>v0.2</span>`,B.engine('notready'),null,[[60,'Động cơ']],'n-warn')}
    <div style="position:absolute;left:70px;top:436px;width:196px;font-family:var(--mono);font-size:8.5px;color:var(--tx-3);line-height:1.6">Trạng thái do Adapter tự khai báo qua probe(). Không node nào mã hóa cứng tên engine.</div>
    <div class="nd" style="position:absolute;left:300px;top:60px;width:100px;height:0;opacity:0"></div>
    <div style="position:absolute;left:330px;top:100px;font-family:var(--mono);font-size:8.5px;color:var(--tx-3);transform:rotate(-90deg);transform-origin:left top;white-space:nowrap">← từ Assembler (VideoIR)</div>
    ${nd(460,60,284,584,'screen','Video Output',`<span class="st s-idle"><span class="dot"></span></span>`,outBody('notready'),[[60,'Bản đặc tả IR'],[90,'Động cơ · <span style="color:var(--warn)">Hyperframes</span>']],null,'n-warn')}
    ${nd(460,684,284,124,'down','MP4 Export',`<span class="st s-byp"><span class="dot"></span>bỏ qua</span>`,B.export('off'),[[44,'Bản đặc tả IR'],[74,'Động cơ · <span style="color:var(--warn)">Hyperframes</span>']],null,'n-byp')}
    <div style="position:absolute;left:800px;top:60px;width:330px;display:flex;flex-direction:column;gap:14px">
      <div class="h1">Engine là node, không phải cài đặt</div>
      <div class="cap2" style="font-size:11px;color:var(--tx-2);line-height:1.7">Giống Load Checkpoint của ComfyUI: node tài nguyên không có cổng nhận, phát <b style="color:var(--accent-2)">EngineRef</b> cho mọi node cần. Tham số của engine (song song, backend) ở đây. Tham số của một lần kết xuất (codec, chất lượng, tên tệp) ở node MP4 Export.</div>
      <div class="note"><span style="color:var(--warn);flex:0 0 auto;margin-top:2px">${I.warn}</span>
        <span class="nt">Nối Hyperframes vào: Video Output chuyển viền vàng kèm lớp phủ, MP4 Export khóa nút Kết xuất kèm lý do. Năm node đầu luồng <b style="color:var(--tx)">không chạy lại</b> — chỉ chữ ký của hai node nhận EngineRef đổi.</span></div>
      <div class="note"><span style="color:var(--accent-2);flex:0 0 auto;margin-top:2px">${I.plus}</span>
        <span class="nt">So sánh hai engine (v0.2): hai node Engine, hai node Video Output, cùng một Bản đặc tả IR. Không cần thêm giao diện nào — chỉ thêm node.</span></div>
      <div class="note"><span style="color:var(--tx-2);flex:0 0 auto;margin-top:2px">${I.down}</span>
        <span class="nt">Không còn Engine Switcher lẫn node Xuất MP4 trên header. Header chỉ còn: Bản mẫu · Chạy Luồng · Cài đặt.</span></div>
    </div>
  </div>`));

/* ============ Settings: v0.1 không có khóa ============ */
const row = (lab, val, ok, hint) => `
  <div class="field"><span class="flab">${lab}</span>
    <div class="inp" style="justify-content:space-between"><span>${val}</span>
      <span style="color:${ok?'var(--ok)':'var(--tx-3)'};display:flex;align-items:center;gap:5px;font-size:10px">
        <span class="dot" style="width:5px;height:5px;border-radius:50%;background:${ok?'var(--ok)':'var(--tx-3)'}"></span>${ok?'tự phát hiện':'mặc định'}</span></div>
    ${hint?`<span class="cap2">${hint}</span>`:''}</div>`;
writeFileSync('Settings.dc.html', wrap(840, 720, `
  <div style="width:840px;height:720px;background:rgba(6,6,8,.62);position:relative;display:flex;align-items:center;justify-content:center">${RAIL_MINI('set')}
    <div class="dlg">
      <div class="dlg-h"><span style="color:var(--tx-2);display:flex">${I.gear}</span><span class="h1">Cài đặt</span>
        <span style="margin-left:auto;color:var(--tx-3);font-family:var(--mono);font-size:16px">×</span></div>
      <div class="dlg-b">
        <div class="note"><span style="color:var(--ok);flex:0 0 auto;margin-top:2px">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path><polyline points="9 12 11 14 15 10"></polyline></svg></span>
          <span class="nt"><b style="color:var(--tx)">v0.1 không cần khóa API nào.</b> Mô hình ngôn ngữ đi qua Claude Code đã đăng nhập trên máy, giọng đọc đi qua bộ tổng hợp của macOS, kết xuất chạy cục bộ. Khi có Provider qua API ở v0.2, khóa sẽ được giữ ở đây và node chỉ trỏ tới nó.</span></div>
        ${row('Claude Code — tệp thực thi','~/.local/bin/claude · 2.1.260',true,'Ghi đè nếu tự phát hiện sai. Trạng thái đăng nhập xem trên node Claude Code Provider.')}
        ${row('ffmpeg — tệp thực thi','/opt/homebrew/bin/ffmpeg · 7.1',true,'Dùng để chuyển AIFF sang MP3 và đo thời lượng.')}
        <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px">
          ${row('Thư mục tệp tạm','./.nodecine/tmp',false,'Dọn tệp cũ hơn 24 giờ lúc khởi động.')}
          <div class="field"><span class="flab">Ngôn ngữ giao diện</span>
            <div class="inp" style="justify-content:space-between"><span>Tiếng Việt</span>${I.chev}</div>
            <span class="cap2">Mặc định: English. Độc lập với ngôn ngữ của video (chọn trên node AI Director).</span></div>
        </div>
      </div>
      <div class="dlg-f"><span class="cap2">Mọi thứ lưu trong trình duyệt này. Không tài khoản, không máy chủ tập trung.</span>
        <span style="margin-left:auto"></span><span class="btn">Đóng</span><span class="btn btn-pri">Lưu</span></div>
    </div>
  </div>`));

console.log('TemplateBrowser + EngineNode + Settings');
