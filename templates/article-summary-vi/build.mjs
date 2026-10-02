import { readFile, writeFile } from 'node:fs/promises';

// Keep the self-contained workflow JSON in sync with its three scene designs.
const file = new URL('./workflow.json', import.meta.url);
const workflow = JSON.parse(await readFile(file, 'utf8'));
// The composition node is the one that carries the file map, and the only node whose params have
// `files`: find it by that shape so this script, living outside the capsule, never names its type.
const composition = workflow.graph.nodes.find((node) => node.params && 'files' in node.params);
if (!composition) throw new Error('No node in this template carries a files map; a node id may have changed.');
const files = composition.params.files;

const scenes = {
  hook: {
    role: 'hook',
    description: 'Editorial opening: the most important source-supported angle, with context and attribution.',
    heading: 'VẤN ĐỀ HÔM NAY',
    markup: `<div class="orbit orbit-one"></div><div class="orbit orbit-two"></div>
      <div class="mast"><span class="brand-mark">N<span></span></span><span>BÀI VIẾT / TÓM TẮT</span><span class="edition">01 / MỞ ĐẦU</span></div>
      <div class="hook-copy"><div class="eyebrow"><i></i> VẤN ĐỀ HÔM NAY</div><h1 class="title"></h1><div class="accent-rule"></div><p class="detail"></p></div>
      <div class="paper-stage"><div class="paper-back"></div><div class="paper"><div class="paper-top"><span>THE ARTICLE</span><span>● ● ●</span></div><div class="paper-line long"></div><div class="paper-line mid"></div><div class="paper-highlight"></div><div class="paper-line short"></div><div class="paper-line mid"></div><div class="paper-line long"></div><div class="paper-index">01<span> / THE STORY</span></div></div><div class="scan-chip">ĐÃ CHỌN Ý CHÍNH <b>↗</b></div></div>
      <div class="foot"><span class="source"></span><span class="foot-bars"><b></b><b></b><b></b><b></b><b></b></span></div>`,
    css: `.hook-copy{position:absolute;top:290px;left:86px;right:86px;z-index:3}.hook-copy .title{margin:38px 0 0;font-size:100px;line-height:1.04;letter-spacing:-.055em;max-height:440px;overflow:hidden}.hook-copy .detail{margin:30px 0 0;max-width:830px;font-size:39px;line-height:1.35;color:#c4d5e9;max-height:160px;overflow:hidden}.accent-rule{width:165px;height:9px;margin-top:45px;border-radius:9px;background:#66e4f5}.paper-stage{position:absolute;left:128px;top:1050px;width:850px;height:650px;z-index:2}.paper-back{position:absolute;left:95px;top:30px;width:620px;height:530px;background:#1a3656;border:1px solid #426c89;border-radius:30px;transform:rotate(11deg)}.paper{position:absolute;left:80px;top:24px;width:620px;height:530px;padding:42px 46px;background:#eaf3f5;color:#14243b;border-radius:24px;box-shadow:0 45px 100px #030a18aa;transform:rotate(-6deg)}.paper-top{display:flex;justify-content:space-between;font-size:20px;font-weight:850;letter-spacing:.12em;margin-bottom:72px}.paper-top span:last-child{color:#39adbd}.paper-line{height:14px;background:#c5d5d9;border-radius:10px;margin:21px 0}.paper-line.long{width:100%}.paper-line.mid{width:76%}.paper-line.short{width:55%}.paper-highlight{width:88%;height:44px;background:#a5ebed;border-radius:8px;margin:20px 0}.paper-index{position:absolute;bottom:38px;font-size:40px;font-weight:900;color:#2a8291}.paper-index span{font-size:17px;letter-spacing:.12em}.scan-chip{position:absolute;right:0;bottom:100px;padding:22px 27px;background:#59e0e8;color:#102640;border-radius:12px;font-size:20px;font-weight:900;letter-spacing:.08em;box-shadow:0 20px 50px #04142799}.scan-chip b{margin-left:20px;font-size:30px}.orbit{position:absolute;border:1px solid #2d6680;border-radius:50%;opacity:.45}.orbit-one{width:830px;height:830px;left:500px;top:750px}.orbit-two{width:1140px;height:1140px;left:340px;top:580px}`,
    motion: `tl.fromTo(q('.eyebrow'),{y:26,opacity:0},{y:0,opacity:1,duration:.45,ease:'power2.out'},0)
      .fromTo(q('.title'),{y:80,opacity:0},{y:0,opacity:1,duration:.75,ease:'power3.out'},.14)
      .fromTo(q('.accent-rule'),{scaleX:0,transformOrigin:'left center'},{scaleX:1,duration:.55,ease:'power2.out'},.55)
      .fromTo(q('.detail'),{y:35,opacity:0},{y:0,opacity:1,duration:.55,ease:'power2.out'},.68)
      .fromTo(q('.paper-stage'),{y:120,rotation:4,opacity:0},{y:0,rotation:0,opacity:1,duration:.9,ease:'power3.out'},.35)
      .fromTo(q('.scan-chip'),{x:80,opacity:0},{x:0,opacity:1,duration:.5,ease:'power2.out'},1.1);`,
  },
  point: {
    role: 'feature',
    description: 'One source-supported finding explained clearly, with its short source label.',
    heading: 'MỘT LUẬN ĐIỂM',
    markup: `<div class="grid-lines"></div><div class="mast"><span class="brand-mark">N<span></span></span><span>ĐỌC NHANH / HIỂU SÂU</span><span class="edition">02 / NỘI DUNG</span></div>
      <div class="point-top"><span class="section-chip">ĐIỂM ĐÁNG CHÚ Ý</span><span class="plus">✳</span></div>
      <div class="point-number"><span class="number-value">01</span><span> / INSIGHT</span></div>
      <div class="point-card"><div class="card-ribbon"><span>KEY POINT</span><span>↗</span></div><h1 class="title"></h1><div class="divider"></div><p class="detail"></p><div class="card-corner">◢</div></div>
      <div class="point-aside"><span class="aside-line"></span><span>GÓC NHÌN TỪ BÀI VIẾT</span></div>
      <div class="foot"><span class="source"></span><span class="foot-bars"><b></b><b></b><b></b><b></b><b></b></span></div>`,
    css: `.grid-lines{position:absolute;inset:0;background-image:linear-gradient(#ffffff08 1px,transparent 1px),linear-gradient(90deg,#ffffff08 1px,transparent 1px);background-size:90px 90px;mask-image:linear-gradient(transparent 10%,#000 80%)}.point-top{position:absolute;left:86px;right:86px;top:292px;display:flex;align-items:center;justify-content:space-between}.section-chip{border:1px solid #65dce9;color:#72e4ed;border-radius:999px;padding:15px 25px;font-size:23px;font-weight:850;letter-spacing:.1em}.plus{font-size:54px;color:#67e4ef}.point-number{position:absolute;top:385px;left:78px;font-size:340px;line-height:1;font-weight:900;letter-spacing:-.12em;color:#294c66}.point-number span{font-size:22px;letter-spacing:.12em;color:#75a7b9;vertical-align:middle;margin-left:30px}.point-card{position:absolute;left:76px;right:76px;top:690px;min-height:750px;padding:65px 65px 80px;background:#f0f5f2;color:#11283c;border-radius:32px;box-shadow:0 50px 110px #0311219c;overflow:hidden}.card-ribbon{display:flex;justify-content:space-between;align-items:center;color:#206c7a;font-size:21px;font-weight:900;letter-spacing:.15em}.card-ribbon span:last-child{font-size:40px}.point-card .title{margin:50px 0 0;font-size:84px;line-height:1.08;letter-spacing:-.05em;max-height:370px;overflow:hidden}.divider{width:100%;height:3px;background:#a8c5c8;margin:50px 0 38px}.point-card .detail{margin:0;font-size:40px;line-height:1.36;color:#355368;max-height:220px;overflow:hidden}.card-corner{position:absolute;right:0;bottom:-20px;font-size:130px;color:#4fc7cb}.point-aside{position:absolute;left:90px;top:1535px;display:flex;align-items:center;gap:22px;color:#a8c7d8;font-size:22px;font-weight:750;letter-spacing:.16em}.aside-line{width:120px;height:3px;background:#5edce6}`,
    motion: `tl.fromTo(q('.point-number'),{y:70,opacity:0},{y:0,opacity:1,duration:.7,ease:'power3.out'},0)
      .fromTo(q('.point-card'),{y:130,opacity:0},{y:0,opacity:1,duration:.8,ease:'power3.out'},.2)
      .fromTo(q('.card-ribbon'),{y:20,opacity:0},{y:0,opacity:1,duration:.45},.6)
      .fromTo(q('.title'),{y:45,opacity:0},{y:0,opacity:1,duration:.65,ease:'power3.out'},.72)
      .fromTo(q('.divider'),{scaleX:0,transformOrigin:'left center'},{scaleX:1,duration:.6},1.1)
      .fromTo(q('.detail'),{y:30,opacity:0},{y:0,opacity:1,duration:.55},1.24);`,
  },
  close: {
    role: 'outro',
    description: 'Final source-supported takeaway; concise synthesis without an invented call to action.',
    heading: 'ĐIỀU CẦN NHỚ',
    markup: `<div class="halo"></div><div class="halo inner"></div><div class="mast"><span class="brand-mark">N<span></span></span><span>Ý CHÍNH / KẾT LẠI</span><span class="edition">03 / TỔNG KẾT</span></div>
      <div class="close-symbol">✳</div><div class="close-content"><div class="close-label"><span class="label-dot"></span> ĐIỀU CẦN NHỚ <span class="label-line"></span></div><h1 class="title"></h1><p class="detail"></p><div class="close-rule"></div><div class="close-note">ĐỌC NGUỒN GỐC ĐỂ HIỂU ĐẦY ĐỦ BỐI CẢNH <span>↗</span></div></div>
      <div class="source-panel"><span>NGUỒN BÀI VIẾT</span><strong class="source"></strong><span class="source-arrow">↗</span></div>
      <div class="foot"><span>NODECINE / TÓM TẮT BÀI VIẾT</span><span class="foot-bars"><b></b><b></b><b></b><b></b><b></b></span></div>`,
    css: `.halo{position:absolute;width:900px;height:900px;left:90px;top:330px;border:2px solid #b393563e;border-radius:50%;box-shadow:0 0 180px #e1ab4422,inset 0 0 150px #e1ab4416}.halo.inner{width:650px;height:650px;left:215px;top:455px;border-color:#e0bc7142}.close-symbol{position:absolute;right:118px;top:250px;font-size:150px;color:#f5cb70;line-height:1}.close-content{position:absolute;left:86px;right:86px;top:540px;text-align:center}.close-label{display:flex;align-items:center;justify-content:center;gap:20px;color:#f4ce79;font-size:24px;font-weight:850;letter-spacing:.14em}.label-dot{width:13px;height:13px;border-radius:50%;background:#f4ce79}.label-line{width:75px;height:2px;background:#f4ce79}.close-content .title{margin:80px 0 0;font-size:100px;line-height:1.08;letter-spacing:-.055em;max-height:450px;overflow:hidden}.close-content .detail{margin:60px auto 0;max-width:770px;color:#d5d9e2;font-size:42px;line-height:1.38;max-height:230px;overflow:hidden}.close-rule{height:4px;width:125px;margin:70px auto 40px;background:#f2c667}.close-note{font-size:20px;letter-spacing:.1em;color:#aeb9c9;font-weight:760}.close-note span{color:#f0c870;font-size:30px;margin-left:10px}.source-panel{position:absolute;bottom:238px;left:86px;right:86px;display:flex;align-items:center;gap:28px;padding:33px 36px;border:1px solid #737b8d;background:#ffffff0c;border-radius:17px}.source-panel span:first-child{font-size:17px;color:#f1c571;letter-spacing:.13em;font-weight:800}.source-panel .source{font-size:26px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex:1;text-align:right}.source-arrow{font-size:36px;color:#f1c571}`,
    motion: `tl.fromTo(q('.halo'),{scale:.82,opacity:0},{scale:1,opacity:1,duration:1.2,ease:'power2.out'},0)
      .fromTo(q('.close-symbol'),{scale:.5,rotation:-70,opacity:0},{scale:1,rotation:0,opacity:1,duration:.8,ease:'back.out(1.5)'},.1)
      .fromTo(q('.close-label'),{y:30,opacity:0},{y:0,opacity:1,duration:.5},.3)
      .fromTo(q('.title'),{y:80,opacity:0},{y:0,opacity:1,duration:.8,ease:'power3.out'},.52)
      .fromTo(q('.detail'),{y:40,opacity:0},{y:0,opacity:1,duration:.6},1.02)
      .fromTo(q('.source-panel'),{y:65,opacity:0},{y:0,opacity:1,duration:.6},1.3);`,
  },
};

const commonCss = `*{box-sizing:border-box}#root{position:absolute;inset:0;width:1080px;height:1920px;overflow:hidden;color:#f4f8fb;background:radial-gradient(circle at 85% 25%,#1d3d59 0,#0c1b2c 52%,#081220 100%);font-family:var(--font-body,Inter,Arial,sans-serif)}.mast{position:absolute;top:91px;left:86px;right:86px;display:flex;align-items:center;gap:21px;color:#b8d6e3;font-size:19px;font-weight:850;letter-spacing:.13em;z-index:5}.brand-mark{display:flex;align-items:center;justify-content:center;width:63px;height:63px;border-radius:17px;background:#62dce7;color:#0b2638;font-size:37px;font-weight:1000;letter-spacing:-.1em}.brand-mark span{width:7px;height:7px;border-radius:50%;background:#0b2638;margin-top:22px}.edition{margin-left:auto;color:#84a5b8;font-size:17px}.foot{position:absolute;bottom:84px;left:86px;right:86px;display:flex;align-items:center;justify-content:space-between;padding-top:23px;border-top:1px solid #718ca078;color:#abc0d0;font-size:21px;font-weight:800;letter-spacing:.08em;z-index:5}.foot .source{max-width:720px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.foot-bars{display:flex;align-items:end;gap:6px;height:28px}.foot-bars b{display:block;width:6px;background:#6fdce7;border-radius:3px}.foot-bars b:nth-child(1){height:12px}.foot-bars b:nth-child(2){height:24px}.foot-bars b:nth-child(3){height:17px}.foot-bars b:nth-child(4){height:28px}.foot-bars b:nth-child(5){height:15px}.eyebrow{display:flex;align-items:center;gap:16px;color:#6ce6ef;font-size:25px;font-weight:850;letter-spacing:.14em}.eyebrow i{display:block;width:16px;height:16px;border-radius:50%;background:#6ce6ef}`;

scenes.point.css += '.point-number .number-value{font-size:340px;letter-spacing:-.12em;color:#294c66;vertical-align:baseline;margin-left:0}';

function block(kind, scene) {
  const id = `summary-${kind === 'point' ? 'point' : kind}`;
  const variables = [
    { id: 'title', type: 'string', label: 'Short, source-supported headline', labels: { vi: 'Tiêu đề ngắn có căn cứ từ nguồn' }, default: scene.heading, sample: kind === 'hook' ? 'Một bài viết, ba điều cần biết' : kind === 'point' ? 'Điều quan trọng nằm ở bối cảnh' : 'Hiểu đúng trước khi chia sẻ', maxLength: 40, required: true },
    { id: 'detail', type: 'string', label: 'One clear explanatory sentence grounded in the source', labels: { vi: 'Một câu giải thích dựa trên bài gốc' }, default: 'Ý chính được giải thích ngắn gọn từ bài viết.', sample: kind === 'hook' ? 'Tách ý chính khỏi chi tiết để nắm nội dung trong vài giây.' : kind === 'point' ? 'Đọc phần giải thích đi kèm để hiểu luận điểm trong bài gốc.' : 'Bản tóm tắt giúp nắm ý chính; bài gốc cung cấp đầy đủ ngữ cảnh.', maxLength: kind === 'point' ? 108 : 94, required: true },
    { id: 'source', type: 'string', label: 'Short name or domain of the source article', labels: { vi: 'Tên ngắn hoặc tên miền của nguồn' }, default: 'BÀI VIẾT GỐC', sample: 'BÀI VIẾT GỐC', maxLength: 48, required: true },
    ...(kind === 'point' ? [{ id: 'number', type: 'string', label: 'Two-digit sequence number of this key point', labels: { vi: 'Số thứ tự luận điểm, gồm hai chữ số' }, default: '01', sample: '01', maxLength: 2, required: true }] : []),
    { id: 'seconds', type: 'number', label: 'Length in seconds (the Assemble node gives it)', default: 4 },
  ];
  const setup = `var number=root.querySelector('.number-value');if(number)number.textContent=String(v.number==null?'01':v.number).padStart(2,'0');\n  root.querySelectorAll('.title,.detail').forEach(function(el){var floor=el.classList.contains('title')?62:29;while(el.scrollHeight>el.clientHeight+2&&parseFloat(getComputedStyle(el).fontSize)>floor){el.style.fontSize=(parseFloat(getComputedStyle(el).fontSize)-2)+'px'}});`;
  return `<!doctype html>\n<html lang="vi" data-composition-id="${id}" data-composition-duration="4" data-role="${scene.role}" data-composition-variables='${JSON.stringify(variables)}'>\n<head><meta charset="UTF-8" /><meta name="description" content="${scene.description}" /></head>\n<body><template>\n<style>${commonCss}${scene.css}</style>\n<div id="root" data-composition-id="${id}" data-duration="4" data-width="1080" data-height="1920">${scene.markup}</div>\n<script>(function(){\n  var root=document.getElementById('root');\n  var q=function(s){return root.querySelector(s)};\n  var v=window.__hyperframes&&window.__hyperframes.getVariables?window.__hyperframes.getVariables():{};\n  ['title','detail','source'].forEach(function(key){root.querySelectorAll('.'+key).forEach(function(el){el.textContent=String(v[key]==null?${JSON.stringify(Object.fromEntries(variables.map(x => [x.id, x.default])))}[key]:v[key])})});\n  ${setup}\n  var duration=Math.max(2,Number(v.seconds)||Number(root.dataset.duration)||4);\n  var tl=gsap.timeline({paused:true});\n  ${scene.motion}\n  tl.set({},{},duration);\n  tl.seek(0);\n  window.__timelines=window.__timelines||{};window.__timelines['${id}']=tl;\n})();</script>\n</template></body></html>`;
}

for (const [kind, scene] of Object.entries(scenes)) files[`compositions/summary-${kind}.html`] = block(kind, scene);
files['storyboard-guide.md'] = `---\nfirst: hook\nlast: outro\nrepeat: 2\n---\nTạo video tóm tắt bài viết bằng tiếng Việt, dọc 9:16, khoảng 30–45 giây.\nChỉ dùng thông tin có trong Research và các URL người dùng cung cấp. Không tự bịa số liệu, trích dẫn hay kết luận.\nMở bằng ý chính đáng chú ý; mỗi cảnh tiếp theo trình bày một luận điểm; kết thúc bằng điều người xem nên nhớ.\nMỗi cảnh có title tối đa 40 ký tự, detail là một câu ngắn bổ sung ý nghĩa (không lặp lại title), source là tên hoặc tên miền của bài gốc tối đa 48 ký tự. Không đặt nhãn nguồn nếu không xác định được bài gốc.\nLời đọc giải thích ngắn gọn, dễ hiểu và giữ nguyên sắc thái của bài gốc. Nếu nguồn thiếu bằng chứng cho một ý, bỏ ý đó. Không gọi một bài viết là nghiên cứu khoa học nếu nó không phải.`;
files['storyboard-guide.md'] += '\nVới các cảnh summary-point, điền number theo thứ tự luận điểm: 01, 02, 03...';
await writeFile(file, `${JSON.stringify(workflow, null, 2)}\n`);
