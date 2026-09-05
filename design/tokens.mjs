// Ngôn ngữ thị giác dùng chung cho mọi artboard NodeCine Studio
export const FONTS = `<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="">
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700&amp;family=IBM+Plex+Sans:wght@400;500;600&amp;display=swap">`;

export const CSS = `
    :root{
      --bg-app:#0a0a0b; --bg-canvas:#0c0d10; --bg-panel:#121316;
      --bg-node:#17191d; --bg-node-hdr:#1d2026; --bg-sunk:#0e0f12; --bg-raise:#22252b;
      --line:#23262c; --line-2:#2f333b; --line-3:#3d424c;
      --tx:#e4e6ea; --tx-2:#8b909b; --tx-3:#5a5f6a;
      --accent:#7c5cff; --accent-2:#a78bfa; --accent-sunk:#221a4d;
      --ok:#3fb950; --run:#58a6ff; --err:#f85149; --warn:#d29922;
      --mono:'JetBrains Mono',ui-monospace,SFMono-Regular,Menlo,monospace;
      --sans:'IBM Plex Sans',system-ui,-apple-system,sans-serif;
    }
    *{box-sizing:border-box}
    body{margin:0;background:var(--bg-app);color:var(--tx);
      font-family:var(--sans);-webkit-font-smoothing:antialiased}
    a{color:var(--accent-2);text-decoration:none} a:hover{color:#c4b5fd}
    .mono{font-family:var(--mono)}
    .cap{font-family:var(--mono);text-transform:uppercase;letter-spacing:.08em}
    .shell{width:1440px;height:900px;display:flex;flex-direction:column;
      background:var(--bg-app);overflow:hidden}

    /* ---------- Header 56px ---------- */
    .hdr{height:56px;flex:0 0 56px;border-bottom:1px solid var(--line);
      background:var(--bg-panel);display:flex;align-items:center;
      gap:14px;padding:0 14px}
    .brand{display:flex;align-items:center;gap:9px}
    .logo{width:22px;height:22px;border-radius:4px;background:var(--accent);
      display:flex;align-items:center;justify-content:center;color:#fff}
    .brand-nm{font-family:var(--mono);font-weight:700;font-size:13px;letter-spacing:.02em}
    .proj{font-family:var(--mono);font-size:12px;color:var(--tx-2);
      padding:4px 8px;border:1px solid transparent;border-radius:4px}
    .proj:hover{border-color:var(--line-2)}
    .hdr-mid{flex:1;display:flex;align-items:center;justify-content:center;gap:10px}
    .sel{display:flex;align-items:center;gap:8px;height:30px;padding:0 9px;
      background:var(--bg-sunk);border:1px solid var(--line-2);border-radius:4px;
      font-family:var(--mono);font-size:11px;color:var(--tx)}
    .sel .lbl{color:var(--tx-3)}
    .sel:hover{border-color:var(--line-3)}
    .btn{height:30px;padding:0 11px;border-radius:4px;border:1px solid var(--line-2);
      background:var(--bg-raise);color:var(--tx);font-family:var(--mono);
      font-size:11px;display:flex;align-items:center;gap:7px;letter-spacing:.02em}
    .btn:hover{border-color:var(--line-3)}
    .btn-pri{background:var(--accent);border-color:var(--accent);color:#fff;font-weight:500}
    .btn-stop{background:#2a1416;border-color:#5c2327;color:#ff8b85}
    .btn-off{opacity:.36}
    .btn-ico{width:30px;padding:0;justify-content:center}

    /* ---------- Body: dải trái + canvas chiếm trọn ---------- */
    .body{flex:1;display:flex;min-height:0}
    .canvas{position:relative;overflow:hidden;background:var(--bg-canvas);
      background-image:radial-gradient(var(--line) 1px,transparent 1px);
      background-size:22px 22px;background-position:-1px -1px}

    /* ---------- Node card ---------- */
    .nd{position:absolute;background:var(--bg-node);border:1px solid var(--line-2);
      border-radius:5px;overflow:hidden;box-shadow:0 4px 14px rgba(0,0,0,.45)}
    .nd-h{height:24px;display:flex;align-items:center;gap:5px;padding:0 6px;
      background:var(--bg-node-hdr);border-bottom:1px solid var(--line)}
    .nd-h .ic{color:var(--tx-2);display:flex}
    .nd-t{font-family:var(--mono);font-size:9.5px;font-weight:700;
      text-transform:uppercase;letter-spacing:.07em;color:var(--tx);white-space:nowrap}
    .nd-b{padding:6px}
    .fld{background:var(--bg-sunk);border:1px solid var(--line);border-radius:3px;
      padding:4px 5px;font-family:var(--mono);font-size:9px;color:var(--tx);
      line-height:1.5;word-break:break-all}
    .fld-ph{color:var(--tx-3)}
    .kv{display:flex;justify-content:space-between;gap:6px;
      font-family:var(--mono);font-size:9px;line-height:1.75}
    .kv .k{color:var(--tx-3)} .kv .v{color:var(--tx-2)}
    .hint{font-family:var(--mono);font-size:8.5px;color:var(--tx-3);margin-top:4px}
    .bul{font-family:var(--mono);font-size:8.5px;color:var(--tx-2);line-height:1.6;
      display:flex;gap:4px}
    .bul i{color:var(--accent-2);font-style:normal}

    /* trạng thái node */
    .st{margin-left:auto;display:flex;align-items:center;gap:4px;
      font-family:var(--mono);font-size:8.5px;letter-spacing:.03em}
    .dot{width:5px;height:5px;border-radius:50%;flex:0 0 5px}
    .s-idle .dot{background:var(--tx-3)} .s-idle{color:var(--tx-3)}
    .s-queue .dot{background:var(--tx-3)} .s-queue{color:var(--tx-3)}
    .s-run .dot{background:var(--run)} .s-run{color:var(--run)}
    .s-ok .dot{background:var(--ok)} .s-ok{color:var(--ok)}
    .s-err .dot{background:var(--err)} .s-err{color:var(--err)}
    .nd.n-run{border-color:var(--run);box-shadow:0 0 0 1px rgba(88,166,255,.22),0 4px 16px rgba(0,0,0,.5)}
    .nd.n-ok{border-color:#215c2c}
    .nd.n-err{border-color:var(--err);box-shadow:0 0 0 1px rgba(248,81,73,.2),0 4px 16px rgba(0,0,0,.5)}
    .nd.n-idle{opacity:.9}
    .nd.n-block{opacity:.44}
    .nd.n-stale{border-style:dashed;border-color:var(--line-3);opacity:.72}
    .nd.n-byp{border-style:dashed;border-color:var(--line-3)}
    .nd.n-byp .nd-b{opacity:.62}
    .s-byp{color:var(--tx-3)} .s-byp .dot{background:var(--tx-3)}
    .nd.n-warn{border-color:var(--warn);box-shadow:0 0 0 1px rgba(210,153,34,.22),0 4px 18px rgba(0,0,0,.5)}

    /* cổng */
    .p{position:absolute;width:7px;height:7px;border-radius:50%;
      background:var(--bg-node);border:1.5px solid var(--line-3)}
    .p-in{left:-4px} .p-out{right:-4px}
    .p.on{border-color:var(--accent);background:var(--accent-sunk)}
    .plab{position:absolute;font-family:var(--mono);font-size:8px;
      color:var(--tx-3);white-space:nowrap}

    /* ---------- công cụ canvas ---------- */
    .tools{position:absolute;left:12px;bottom:12px;display:flex;
      flex-direction:column;gap:8px;align-items:flex-start}
    .mmap{width:150px;height:88px;background:rgba(10,10,11,.86);
      border:1px solid var(--line-2);border-radius:4px;position:relative;overflow:hidden}
    .mmap .mn{position:absolute;background:var(--line-3);border-radius:1px}
    .mmap .vp{position:absolute;border:1px solid var(--accent);
      background:rgba(124,92,255,.09);border-radius:2px}
    .tbar{display:flex;background:rgba(10,10,11,.86);border:1px solid var(--line-2);
      border-radius:4px;overflow:hidden}
    .tbtn{width:28px;height:28px;display:flex;align-items:center;justify-content:center;
      color:var(--tx-2);border-right:1px solid var(--line)}
    .tbtn:last-child{border-right:0}
    .tbtn:hover{background:var(--bg-raise);color:var(--tx)}
    .zoom{font-family:var(--mono);font-size:10px;color:var(--tx-3);
      padding:0 9px;display:flex;align-items:center;border-right:1px solid var(--line)}

    /* ---------- Cụm điều khiển trình phát (nằm trong node Video Output) ---------- */
    .pbtn{width:28px;height:28px;border-radius:4px;border:1px solid var(--line-2);
      background:var(--bg-raise);color:var(--tx);display:flex;
      align-items:center;justify-content:center}
    .scrub{flex:1;height:4px;background:var(--bg-sunk);border-radius:2px;
      position:relative;border:1px solid var(--line)}
    .scrub .fill{position:absolute;left:0;top:0;bottom:0;background:var(--accent);
      border-radius:2px}
    .scrub .head{position:absolute;top:-4px;width:2px;height:10px;
      background:#fff;border-radius:1px}
    .cnt{font-family:var(--mono);font-size:9.5px;color:var(--tx-2);
      display:flex;flex-direction:column;align-items:flex-end;line-height:1.45}
    .cnt em{font-style:normal;color:var(--tx-3)}

    /* thanh tra phân cảnh */
    .insp{display:flex;gap:3px;margin-top:11px}
    .sc{background:var(--bg-sunk);border:1px solid var(--line);border-radius:3px;
      padding:6px 7px;min-width:0}
    .sc.act{border-color:var(--accent);background:var(--accent-sunk)}
    .sc-n{font-family:var(--mono);font-size:8px;text-transform:uppercase;
      letter-spacing:.06em;color:var(--tx);white-space:nowrap;overflow:hidden;
      text-overflow:ellipsis}
    .sc-f{font-family:var(--mono);font-size:7.5px;color:var(--tx-3);margin-top:2px}


    /* ---------- nội dung video giả lập ---------- */
    .vs{position:absolute;inset:0;display:flex;flex-direction:column;
      background:linear-gradient(#0b0c10,#08090c)}
    .vs-grid{position:absolute;inset:0;
      background-image:linear-gradient(rgba(124,92,255,.05) 1px,transparent 1px),
      linear-gradient(90deg,rgba(124,92,255,.05) 1px,transparent 1px);
      background-size:20px 20px}
`;

export const ICONS = {
  bolt:`<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>`,
  branch:`<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="6" y1="3" x2="6" y2="15"></line><circle cx="18" cy="6" r="3"></circle><circle cx="6" cy="18" r="3"></circle><path d="M18 9a9 9 0 0 1-9 9"></path></svg>`,
  cpu:`<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="16" height="16" rx="2"></rect><rect x="9" y="9" width="6" height="6"></rect><line x1="9" y1="1" x2="9" y2="4"></line><line x1="15" y1="1" x2="15" y2="4"></line><line x1="9" y1="20" x2="9" y2="23"></line><line x1="15" y1="20" x2="15" y2="23"></line><line x1="20" y1="9" x2="23" y2="9"></line><line x1="20" y1="14" x2="23" y2="14"></line><line x1="1" y1="9" x2="4" y2="9"></line><line x1="1" y1="14" x2="4" y2="14"></line></svg>`,
  wave:`<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="3" y1="10" x2="3" y2="14"></line><line x1="7.5" y1="6" x2="7.5" y2="18"></line><line x1="12" y1="3" x2="12" y2="21"></line><line x1="16.5" y1="7" x2="16.5" y2="17"></line><line x1="21" y1="10" x2="21" y2="14"></line></svg>`,
  layers:`<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"></polygon><polyline points="2 17 12 22 22 17"></polyline><polyline points="2 12 12 17 22 12"></polyline></svg>`,
  screen:`<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"></rect><polygon points="10 7.5 15 10 10 12.5 10 7.5" fill="currentColor" stroke="none"></polygon><line x1="8" y1="21" x2="16" y2="21"></line></svg>`,
  play:`<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><polygon points="6 4 20 12 6 20 6 4"></polygon></svg>`,
  pause:`<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>`,
  start:`<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="19 20 9 12 19 4 19 20" fill="currentColor"></polygon><line x1="5" y1="19" x2="5" y2="5"></line></svg>`,
  chev:`<svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>`,
  gear:`<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1 1.56V21a2 2 0 1 1-4 0v-.09A1.7 1.7 0 0 0 9 19.4a1.7 1.7 0 0 0-1.88.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.7 1.7 0 0 0 .34-1.88 1.7 1.7 0 0 0-1.56-1H3a2 2 0 1 1 0-4h.09A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.34-1.88l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-1.56V3a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 1 1.56 1.7 1.7 0 0 0 1.88-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.34 1.88V9a1.7 1.7 0 0 0 1.56 1H21a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.51 1z"></path></svg>`,
  down:`<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>`,
  plus:`<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>`,
  minus:`<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="5" y1="12" x2="19" y2="12"></line></svg>`,
  fit:`<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 8V5a2 2 0 0 1 2-2h3"></path><path d="M16 3h3a2 2 0 0 1 2 2v3"></path><path d="M21 16v3a2 2 0 0 1-2 2h-3"></path><path d="M8 21H5a2 2 0 0 1-2-2v-3"></path></svg>`,
  star:`<svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor"><polygon points="12 2 15.09 8.6 22 9.6 17 14.5 18.2 21.5 12 18.2 5.8 21.5 7 14.5 2 9.6 8.91 8.6 12 2"></polygon></svg>`,
  warn:`<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>`,
  retry:`<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="1 4 1 10 7 10"></polyline><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path></svg>`,
  bot:`<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="9" width="16" height="11" rx="2"></rect><line x1="12" y1="3" x2="12" y2="9"></line><circle cx="12" cy="3" r="1" fill="currentColor"></circle><line x1="9" y1="14" x2="9" y2="15"></line><line x1="15" y1="14" x2="15" y2="15"></line><line x1="1.5" y1="13" x2="4" y2="13"></line><line x1="20" y1="13" x2="22.5" y2="13"></line></svg>`,
  doc:`<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="8" y1="13" x2="16" y2="13"></line><line x1="8" y1="17" x2="13" y2="17"></line></svg>`,
  term:`<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 17 10 11 4 5"></polyline><line x1="12" y1="19" x2="20" y2="19"></line></svg>`,
  mic:`<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="2" width="6" height="12" rx="3"></rect><path d="M5 10a7 7 0 0 0 14 0"></path><line x1="12" y1="17" x2="12" y2="22"></line><line x1="8" y1="22" x2="16" y2="22"></line></svg>`,
  chip:`<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="5" width="14" height="14" rx="2"></rect><rect x="9.5" y="9.5" width="5" height="5"></rect><line x1="9" y1="2" x2="9" y2="5"></line><line x1="15" y1="2" x2="15" y2="5"></line><line x1="9" y1="19" x2="9" y2="22"></line><line x1="15" y1="19" x2="15" y2="22"></line><line x1="2" y1="9" x2="5" y2="9"></line><line x1="2" y1="15" x2="5" y2="15"></line><line x1="19" y1="9" x2="22" y2="9"></line><line x1="19" y1="15" x2="22" y2="15"></line></svg>`,
  spin:`<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 3a9 9 0 0 1 9 9" opacity=".95"></path><circle cx="12" cy="12" r="9" opacity=".18"></circle></svg>`,
};

export const dcOpen = (css) => `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  ${FONTS}
  <script src="./support.js"></script>
</head>
<body>
<x-dc>
<helmet>
  <style>${CSS}${css || ''}</style>
</helmet>`;

export const dcClose = `</x-dc>
</body>
</html>
`;
