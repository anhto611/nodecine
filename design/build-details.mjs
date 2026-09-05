import { writeFileSync } from 'node:fs';
import { dcOpen, dcClose, ICONS as I } from './tokens.mjs';
import { videoInner, B } from './build-studio.mjs';

const BIG = `
    .big .nd-h{height:30px;padding:0 10px;gap:8px}
    .big .nd-t{font-size:11px}
    .big .nd-b{padding:11px}
    .big .fld{font-size:11px;padding:7px 8px}
    .big .kv{font-size:11px;line-height:1.95}
    .big .hint{font-size:10px;margin-top:7px}
    .big .bul{font-size:10px}
    .big .st{font-size:10px}
    .big .p{width:9px;height:9px;left:-5px}
    .big .p.p-out{left:auto;right:-5px}
    .big .plab{font-size:9px}
    .sheet{padding:34px 36px;display:flex;flex-direction:column;gap:26px}
    .h1{font-family:var(--mono);font-size:15px;font-weight:700;letter-spacing:.02em}
    .h2{font-family:var(--mono);font-size:9.5px;text-transform:uppercase;letter-spacing:.12em;color:var(--tx-3)}
    .sub{font-family:var(--sans);font-size:12px;color:var(--tx-2);line-height:1.65;max-width:66ch}
    .rule{height:1px;background:var(--line)}
    .grid3{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:26px}
    .cellnote{font-family:var(--mono);font-size:9px;color:var(--tx-3);margin-top:8px;line-height:1.6}
    .chiprow{display:flex;flex-wrap:wrap;gap:10px}
    .chip{background:var(--bg-node);border:1px solid var(--line-2);border-radius:5px;overflow:hidden;width:190px}
    .chip .nd-h{height:26px} .chip .nd-t{font-size:9px}
    .chip .cap-note{font-family:var(--mono);font-size:8.5px;color:var(--tx-3);padding:6px 8px;
      border-top:1px solid var(--line);line-height:1.5}
    .ptbl{display:grid;grid-template-columns:auto auto 1fr;border:1px solid var(--line);border-radius:5px;overflow:hidden}
    .ptbl>div{padding:8px 12px;border-bottom:1px solid var(--line);font-family:var(--mono);font-size:10px}
    .ptbl>div:nth-child(-n+3){background:var(--bg-node-hdr);color:var(--tx-3);text-transform:uppercase;letter-spacing:.08em;font-size:8.5px}
    .swatch{display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:7px;vertical-align:middle}
    /* callout */
    .co{position:absolute;width:18px;height:18px;border-radius:50%;background:var(--accent);
      color:#fff;font-family:var(--mono);font-size:9.5px;font-weight:700;display:flex;
      align-items:center;justify-content:center;box-shadow:0 0 0 3px var(--bg-app);z-index:9}
    .col{display:flex;flex-direction:column;gap:14px}
    .ci{display:flex;gap:12px;align-items:flex-start}
    .ci .co{position:static;flex:0 0 18px;box-shadow:none;margin-top:1px}
    .ci .t{font-family:var(--mono);font-size:11px;color:var(--tx)}
    .ci .d{font-family:var(--sans);font-size:11px;color:var(--tx-2);line-height:1.6;margin-top:3px}
`;
const sheet = (w, h, inner) => dcOpen(BIG) +
  `<div style="width:${w}px;height:${h}px;background:var(--bg-app);overflow:hidden">${inner}</div>` + dcClose;

/* ============ Video Output node ở tỷ lệ lớn, kèm chú giải ============ */
const S = 1.32, VW = Math.round(252 * S), VH = Math.round(448 * S);
writeFileSync('VideoOutputNode.dc.html', sheet(960, 860, `
  <div style="padding:34px 36px;display:flex;gap:44px">
    <div style="position:relative;flex:0 0 auto">
      <div class="nd n-ok big" style="position:relative;width:${VW + 24}px">
        <div class="nd-h"><span class="ic">${I.screen}</span><span class="nd-t">Video Output</span>
          <span class="st s-ok"><span class="dot"></span>0.3s</span></div>
        <div class="nd-b" style="padding:11px">
          <div style="width:${VW}px;height:${VH}px;background:#000;border:1px solid var(--line-2);
            border-radius:3px;overflow:hidden;position:relative">${videoInner(S)}</div>
          <div style="display:flex;align-items:center;gap:10px;margin-top:12px">
            <span class="pbtn" style="width:30px;height:30px">${I.start}</span>
            <span class="pbtn" style="width:30px;height:30px;background:var(--accent);border-color:var(--accent);color:#fff">${I.pause}</span>
            <div class="scrub" style="flex:1;height:5px">
              <div class="fill" style="width:41%"></div>
              <div class="head" style="left:41%;height:13px;top:-5px"></div>
              <div style="position:absolute;left:80.4%;top:-3px;width:1px;height:9px;background:var(--warn)"></div>
            </div>
            <div class="cnt" style="font-size:10.5px"><span>138 <em>/ 336</em></span><span><em>4.60 / 11.20s</em></span></div>
          </div>
          <div class="insp" style="margin-top:11px;gap:4px">
            ${[['Hook','0 – 84',25],['Feature','84 – 252',50],['CTA','252 – 336',25]].map(([n,f,w],i)=>`
              <div class="sc ${i===1?'act':''}" style="flex:${w};padding:8px 9px">
                <div class="sc-n" style="font-size:9.5px">${n}</div>
                <div class="sc-f" style="font-size:9px;margin-top:3px">${f}</div></div>`).join('')}
          </div>
          <div class="kv" style="margin-top:11px;padding-top:9px;border-top:1px solid var(--line);font-size:10px">
            <span class="k">336 frames · 30fps · đuôi lặng 0f</span><span class="k">1080×1920</span></div>
        </div>
        <div class="p p-in on" style="top:66px"></div>
        <div class="plab" style="top:62px;left:13px">Bản đặc tả IR</div>
        <div class="p p-in on" style="top:96px"></div>
        <div class="plab" style="top:92px;left:13px">Động cơ · <span style="color:var(--accent-2)">Remotion</span></div>
      </div>
      <span class="co" style="left:-9px;top:92px">1</span>
      <span class="co" style="left:-9px;top:190px">2</span>
      <span class="co" style="left:4px;top:${VH + 52}px">3</span>
      <span class="co" style="left:${Math.round(VW * .5)}px;top:${VH + 52}px">4</span>
      <span class="co" style="left:${VW - 30}px;top:${VH + 52}px">5</span>
      <span class="co" style="left:4px;top:${VH + 108}px">6</span>
      <span class="co" style="left:4px;top:${VH + 162}px">7</span>
    </div>
    <div class="col" style="padding-top:8px;max-width:400px">
      <div class="h1">Node Video Output là player</div>
      <div class="sub">Không còn khung xem trước riêng, không có hộp chọn engine, không có node xuất.
        Khung 9:16, node phát, thanh trượt và thanh tra phân cảnh nằm trọn trong thân node, giống
        PreviewImage của ComfyUI. Engine đến từ cổng nhận thứ hai; kết xuất là việc của node MP4 Export.</div>
      <div class="rule"></div>
      ${[
        ['Cổng Động cơ', 'Nhận EngineRef từ một node Engine. Nhãn mờ cạnh cổng hiện tên engine đang nối. Đổi engine = nối dây khác, không node nào phía trước chạy lại.'],
        ['Khung 9:16', 'Remotion Player chạy phía máy khách, không tốn tài nguyên kết xuất. Tỷ lệ cố định 1080×1920, co theo mức thu phóng canvas.'],
        ['Nhảy về đầu · Phát / Tạm dừng', 'Phím Space phát và tạm dừng khi tiêu điểm không nằm trong ô nhập liệu.'],
        ['Thanh trượt theo từng khung', 'Vạch vàng đánh dấu thời điểm âm thanh kết thúc khi ngưỡng 270 khung được kích hoạt (đuôi lặng).'],
        ['Bộ đếm kép', 'Khung hình hiện tại trên tổng số, và giây hiện tại trên tổng số giây.'],
        ['Thanh tra phân cảnh', 'Bề rộng mỗi thẻ tỷ lệ với số khung hình của cảnh. Bấm để nhảy tới khung đầu tiên của cảnh đó.'],
        ['Tóm tắt Bản đặc tả IR', 'Tổng khung, fps, đuôi lặng và độ phân giải, để đối chiếu nhanh với node Assembler. Không có node xuất ở đây.'],
      ].map(([t, d], i) => `<div class="ci"><span class="co">${i + 1}</span>
        <div><div class="t">${t}</div><div class="d">${d}</div></div></div>`).join('')}
    </div>
  </div>`));

/* ============ Giải phẫu 6 node ============ */
const anat = (ic, title, badgeHtml, body, inPorts, outPorts, note, extraHdr, ncls) => `
  <div>
    <div class="nd big ${ncls||''}" style="position:relative;${ncls?'':'border-color:var(--line-2)'}">
      <div class="nd-h"><span class="ic">${I[ic]}</span><span class="nd-t">${title}</span>${extraHdr || ''}${badgeHtml}</div>
      <div class="nd-b">${body}</div>
      ${(inPorts||[]).map(([o,l])=>`<div class="p p-in on" style="top:${o}px"></div><div class="plab" style="top:${o-4}px;left:12px">${l}</div>`).join('')}
      ${(outPorts||[]).map(([o,l])=>`<div class="p p-out on" style="top:${o}px"></div><div class="plab" style="top:${o-4}px;right:12px">${l}</div>`).join('')}
    </div>
    <div class="cellnote">${note}</div>
  </div>`;
const okB = (t) => `<span class="st s-ok"><span class="dot"></span>${t}</span>`;
const bars = [6,11,7,14,9,16,10,13,6,12,8,15,7,10,5,13,9,6,11,7,14,8];

writeFileSync('NodeAnatomy.dc.html', sheet(1240, 1980, `
  <div class="sheet">
    <div><div class="h1">Giải phẫu node: 9 lõi + 2 gói GitHub Showcase</div>
      <div class="sub" style="margin-top:8px">Cổng nhận ở mép trái, cổng phát ở mép phải, nhãn dùng đúng tên
        trong bảng kiểu cổng. Ba node xử lý gọi ra ngoài (Truy Xuất Repo, AI Đạo Diễn, Giọng Đọc) có nút thử lại;
        node tài nguyên có nút Kiểm tra lại; MP4 Export có nút thử lại khi kết xuất hỏng — cùng một thao tác chạy riêng node. Ba node tài nguyên (hai Provider và Engine) cùng một khuôn mẫu như Load Checkpoint;
        Export là node chạy theo yêu cầu (như SaveImage, nhưng bỏ qua mặc định). v0.1 không cần khóa API nào.</div></div>
    <div class="rule"></div>
    <div class="grid3">
      ${anat('bolt','Input Trigger',okB('0.1s'),
        `<div class="fld">github.com/anhto611/nodecine</div><div class="hint">→ nhận diện: github-url</div>`,
        null,[[46,'Dữ liệu Nguồn']],'Thuần giao diện. Không gọi mạng nên không bao giờ lỗi kết nối.')}
      ${anat('doc','Static Script',okB('0.0s'),
        `<div class="kv"><span class="k">ngôn ngữ</span><span class="v">English ${I.chev}</span></div>
         <div class="fld" style="margin-top:6px;color:var(--tx-2)">Meet NodeCine. Build short videos from a node graph…</div>
         <div style="margin-top:7px;display:flex;flex-direction:column;gap:4px">
           <div class="bul"><i>1</i><span style="color:var(--tx-3)">core/title-card</span> <span style="color:var(--accent-2)">w1</span></div>
           <div class="bul"><i>2</i><span style="color:var(--tx-3)">core/title-card</span> <span style="color:var(--accent-2)">w2</span></div>
           <div class="bul"><i>3</i><span style="color:var(--tx-3)">core/title-card</span> <span style="color:var(--accent-2)">w1</span></div></div>`,
        null,[[46,'Kịch bản'],[70,'Lời thoại']],'Node lõi duy nhất phát cả Kịch bản lẫn Lời thoại. Dựng video bằng tay, không mạng. Đồ thị nghiệm thu Pha A.')}
      ${anat('branch','GitHub Fetcher <span class="tag" style="margin-left:6px">gói</span>',okB('0.8s'),
        `<div class="kv"><span class="k">repo</span><span class="v">anhto611/nodecine</span></div>
         <div class="kv"><span class="k">stars</span><span class="v" style="color:var(--warn)">${I.star} 1.284</span></div>
         <div class="kv"><span class="k">install</span><span class="v">npm i nodecine</span></div>
         <div class="hint">chụp 21:04 · làm mới</div>`,
        [[46,'']],[[46,'Dữ kiện']],'Node của gói. Gọi GitHub API ẩn danh, phát FactSheet ra <b>hai</b> dây: tới AI Director và thẳng tới Timeline Assembler.')}
      ${anat('bot','AI Director',okB('4.2s'),
        `<div class="kv"><span class="k">ngôn ngữ</span><span class="v">English ${I.chev}</span></div>
         <div class="kv"><span class="k">model</span><span class="v">claude-opus-5</span></div>
         <div class="kv"><span class="k">theme</span><span class="v">developer-dark</span></div>
         <div style="margin-top:7px;display:flex;flex-direction:column;gap:5px">
           <div class="bul"><i>1</i><span>SHIP VIDEO FROM A REPO</span></div>
           <div class="bul"><i>2</i><span>nodecine · 3 features</span></div>
           <div class="bul"><i>3</i><span>Star on GitHub</span></div></div>`,
        [[40,'Dữ kiện'],[66,'Mô hình ngôn ngữ']],[[40,'Kịch bản'],[62,'Lời thoại']],'Node của gói. Gắn sceneType, weight và factBindings vào từng cảnh. Số sao, lệnh cài đặt không đi qua mô hình.')}
      ${anat('wave','TTS Engine',okB('2.6s'),
        `<div class="kv"><span class="k">giọng</span><span class="v">Rachel · EN</span></div>
         <div class="kv"><span class="k">tốc độ</span><span class="v">1.00x</span></div>
         <div style="margin-top:7px;display:flex;align-items:flex-end;gap:2px;height:22px">
           ${bars.map(h=>`<span style="flex:1;height:${h*1.35}px;background:var(--accent);opacity:.65;border-radius:1px"></span>`).join('')}</div>
         <div class="hint">khớp ngôn ngữ kịch bản: en · 11.20 giây</div>`,
        [[40,'Lời thoại'],[66,'Giọng đọc']],[[46,'Âm thanh & Thời lượng']],'Không có ô chọn ngôn ngữ: giọng tự khớp ngôn ngữ của lời thoại đang vào. Thiếu giọng thì dùng dự phòng kèm huy hiệu vàng.')}
      ${anat('layers','Timeline Assembler',okB('0.0s'),
        `<div class="kv"><span class="k">tổng</span><span class="v">336 frames</span></div>
         <div class="kv"><span class="k">fps</span><span class="v">30 · 1080×1920</span></div>
         <div style="display:flex;gap:2px;margin-top:8px;height:11px">
           <div style="width:25%;background:var(--accent);border-radius:2px 0 0 2px"></div>
           <div style="width:50%;background:var(--accent-2)"></div>
           <div style="width:25%;background:var(--ok);border-radius:0 2px 2px 0"></div></div>
         <div class="kv" style="margin-top:4px"><span class="k">84 · w1</span><span class="k">168 · w2</span><span class="k">84 · w1</span></div>`,
        [[36,'Dữ kiện · tùy chọn'],[62,'Kịch bản'],[88,'Âm thanh']],[[62,'Bản đặc tả IR']],
        'Node lõi, generic: chia theo trọng số, đè dữ kiện theo factBindings, kiểm định 5 bất biến IR. Không biết cảnh là gì.')}
      ${anat('screen','Video Output',okB('0.3s'),
        `<div style="display:flex;gap:10px">
           <div style="width:88px;height:156px;background:#000;border:1px solid var(--line-2);
             border-radius:3px;overflow:hidden;position:relative;flex:0 0 auto">${videoInner(0.35)}</div>
           <div style="flex:1;display:flex;flex-direction:column;gap:6px">
             <div class="kv"><span class="k">engine</span><span class="v" style="color:var(--accent-2)">Remotion</span></div>
             <div style="display:flex;align-items:center;gap:6px">
               <span class="pbtn" style="width:20px;height:20px">${I.start}</span>
               <span class="pbtn" style="width:20px;height:20px;background:var(--accent);border-color:var(--accent);color:#fff">${I.pause}</span>
               <div class="scrub" style="flex:1"><div class="fill" style="width:41%"></div><div class="head" style="left:41%"></div></div></div>
             <div class="insp" style="margin-top:0;gap:2px">
               ${[['H',25],['F',50],['C',25]].map(([n,w],i)=>`<div class="sc ${i===1?'act':''}" style="flex:${w};padding:3px 5px"><div class="sc-n" style="font-size:8px">${n}</div></div>`).join('')}</div>
             <div class="hint" style="margin:0">138 / 336 · 4.60s</div>
           </div>
         </div>`,
        [[46,'Bản đặc tả IR'],[74,'Động cơ']],null,'Chính là player. Hai cổng nhận, không có cổng phát, không có node xuất.')}
      ${anat('term','Claude Code Provider',okB('đã đăng nhập'),
        B.llm('ready'),
        null,[[52,'Mô hình ngôn ngữ']],'Gọi <code>claude -p</code> với phiên đã đăng nhập trên máy. Không có ô nhập khóa. Lượt gọi tính vào tài khoản Claude Code của người dùng.')}
      ${anat('mic','System TTS Provider',okB('sẵn sàng'),
        B.ttsp(),
        null,[[52,'Giọng đọc']],'macOS <code>say</code> → AIFF → ffmpeg → MP3. Offline, không khóa. Hệ điều hành chưa hỗ trợ thì probe() báo và node tiêu thụ tự khóa.')}
      ${anat('chip','Remotion Engine',okB('sẵn sàng'),
        B.engine('ready'),
        null,[[52,'Động cơ']],'Node tài nguyên, không có cổng nhận. Tham số của engine ở đây; tham số của một lần kết xuất thì không.')}
      ${anat('down','MP4 Export',`<span class="st s-byp"><span class="dot"></span>bỏ qua</span>`,
        B.export('byp'),
        [[40,'Bản đặc tả IR'],[70,'Động cơ']],null,'Bỏ qua mặc định: Chạy Luồng không chạm tới. Bấm Kết xuất để chạy riêng node này.','','n-byp')}
    </div>
    <div class="rule"></div>
    <div><div class="h2">Chín trạng thái, bảy huy hiệu (blocked dùng chung với chờ lượt, cancelled dùng chung với cũ)</div>
      <div class="chiprow" style="margin-top:14px">
        ${[['Sẵn sàng','s-idle','<span class="dot"></span>','','Chưa chạy lần nào trong phiên'],
           ['Đang chờ lượt','s-queue','<span class="dot"></span>chờ','','Node phía trước chưa xong'],
           ['Đang chạy','s-run',I.spin,'n-run','Viền xanh dương, vòng xoay'],
           ['Hoàn thành','s-ok','<span class="dot"></span>0.8s','n-ok','Viền xanh lá, kèm thời gian'],
           ['Dùng lại','s-ok','<span class="dot"></span>dùng lại','n-ok','Chữ ký node không đổi'],
           ['Cũ','s-idle','<span class="dot"></span>','n-stale','Viền đứt nét: cấu hình đã đổi, hoặc bị hủy'],
           ['Lỗi','s-err',I.warn,'n-err','Viền đỏ, có nút thử lại riêng'],
           ['Bỏ qua','s-byp','<span class="dot"></span>bỏ qua','n-byp','Chạy Luồng không chạm tới. Ctrl+B']]
          .map(([nm,sc,inner,nc,note])=>`<div class="chip ${nc}">
            <div class="nd-h"><span class="ic">${I.cpu}</span><span class="nd-t">${nm}</span><span class="st ${sc}">${inner}</span></div>
            <div class="cap-note">${note}</div></div>`).join('')}
      </div></div>
    <div class="rule"></div>
    <div><div class="h2">Hệ thống kiểu cổng</div>
      <div class="ptbl" style="margin-top:14px">
        <div>Định danh kiểu</div><div>Nhãn hiển thị</div><div>Đường đi</div>
        ${[['SourceRef','Dữ liệu Nguồn','Nhập Liệu → Truy Xuất Repo'],
           ['FactSheet','Dữ kiện','Node truy xuất của gói → node đạo diễn của gói <b>và</b> → Timeline Assembler'],
           ['DirectorPlan','Kịch bản Phân cảnh','Static Script / node đạo diễn → Timeline Assembler'],
           ['AudioScript','Lời thoại','Static Script / node đạo diễn → TTS Engine'],
           ['Voiceover','Âm thanh & Thời lượng','TTS Engine → Timeline Assembler'],
           ['VideoIR','Bản đặc tả IR','Timeline Assembler → Video Output <b>và</b> → MP4 Export'],
           ['EngineRef','Động cơ','Remotion Engine → Video Output <b>và</b> → MP4 Export'],
           ['LLMRef','Mô hình ngôn ngữ','Claude Code Provider → node đạo diễn của gói'],
           ['TTSRef','Giọng đọc','System TTS Provider → TTS Engine']]
          .map(([a,b,c])=>`<div style="color:var(--accent-2)"><span class="swatch" style="background:var(--accent)"></span>${a}</div>
            <div style="color:var(--tx)">${b}</div><div style="color:var(--tx-2)">${c}</div>`).join('')}
      </div>
      <div class="cellnote" style="margin-top:11px">Dây chỉ nối được khi hai định danh kiểu trùng khớp tuyệt đối.
        Không có ép kiểu ngầm. Một cổng nhận chỉ nhận đúng một dây.</div></div>
  </div>`));

console.log('VideoOutputNode + NodeAnatomy');
