# Tình Trạng Triển Khai

**Cập nhật 2026-09-05.**

Đây là tài liệu **duy nhất** nói cái gì đã dựng xong. Năm tài liệu còn lại nói *luật*: hợp đồng phải giữ, ranh giới không được vượt, hành vi bắt buộc — những thứ đúng bất kể hôm nay code tới đâu. Khi một tài liệu khác có vẻ khẳng định điều gì về tiến độ và mâu thuẫn với đây, tin tệp này.

Lý do tách: trước đây mỗi lần thêm một provider là phải sửa câu "ở v0.1 giọng đọc đi qua bộ tổng hợp của hệ điều hành" ở bốn chỗ, và thực tế là không sửa hết. Giờ chỉ có một chỗ để sai.

---

## Chạy được ngay

**Bản mẫu** — ba mục mở được trong Trình duyệt Bản mẫu:

| Bản mẫu | Node | Cần mạng | Cần mô hình ngôn ngữ |
|---|---|---|---|
| Kịch Bản Tĩnh | 9 | Không | Không |
| GitHub Repo Showcase | 12 | Có | Có |
| Thẻ Trích Dẫn | 10 | Không | Có |
| Canvas trống | 0 | — | — |

Cả ba là **tệp JSON** dưới `templates/`, cùng hình dạng tệp dự án; `templates/__tests__` xác nhận mỗi bản dựng lại được từ canvas trống bằng node trong Thư viện. Workflow của người dùng tách khỏi bản mẫu: **lưu** (Ctrl+S), **đổi tên**, **nhập** từ JSON hoặc từ MP4 do NodeCine kết xuất (kéo thả vào canvas cũng được), **tải xuống** — tất cả ở thanh tab và panel Workflow, là tệp trong `.nodecine/workflows/` theo mô hình userdata của ComfyUI (`server/workflows.ts`, `app/api/workflows`). Trình duyệt bản mẫu chỉ hiện bản mẫu kèm app. Thanh tab dưới header giữ các workflow đang mở (dấu • khi chưa lưu, Ctrl+S lưu, Ctrl+Shift+S lưu thành, + mở bản nháp mới); panel *Workflow* ở dải trái (phím W) liệt kê tab đang mở và tệp đã lưu với mở/đổi tên/tải/xóa. Các tab tự lưu vào `localStorage` (`nodecine.tabs`). MP4 kết xuất mang theo workflow và IR trong metadata (`server/video-meta.ts`).

**Node lõi** — mười lăm loại: Nhập Liệu, Truy Xuất Repo, Kịch Bản Tĩnh, **Đạo Diễn AI** (viết nội dung cảnh, không biết block), **Look** (chặng giao diện sau kịch bản: dàn block, tone, stage), Mô Hình Ngôn Ngữ, Giọng Đọc Nguồn, Giọng Đọc, **Căn Mốc Từ**, **Phụ Đề**, Đóng Gói Timeline, Remotion Engine, Hyperframes Engine, Xuất Bản Video, Xuất MP4.

**Tỉ lệ là của Look, độ phân giải là của Xuất MP4** (`StageDef.frame` là hệ tọa độ thiết kế theo preset 9:16, 16:9, 1:1, 4:5; `resolution` 1080p/1440p/2160p ở node Xuất MP4 phóng khung bằng `transform: scale` lúc kết xuất): Đóng Gói Timeline lấy kích thước video từ `plan.stage.frame`, không còn tham số `width`/`height`; xem trước, vùng an toàn, kéo thả, prompt sửa bằng lời và trình phát đều đọc cùng trường (`core/look/frame.ts`). Code của ba stage mẫu vẫn đặt vị trí cho khung dọc.

**Stage không cần code**: sửa bằng lời trả về cả palette, font, tone, trường (không chỉ code) kèm dòng "đổi thêm"; kéo thả trên khung xem trước ghi vào CSS của phần tử và giữ cách neo; thêm chữ, khối, ảnh (tải lên `/api/assets`, lưu theo mã băm ở `.nodecine/assets`, engine chép kèm khi kết xuất); xóa phần tử bằng phím Delete; xem trước có chuyển động lặp. Vùng an toàn bật tắt được. Chi tiết ở `CORE_CONTRACTS.md` §2.6.

**Sửa code bằng lời** (`nodes/look/edit.server.ts`, `POST /api/look/edit`): trong modal sửa code của Stage và Block có ô mô tả thay đổi; mô hình ngôn ngữ đang nối trong workflow (hay Claude Code mặc định) nhận luật viết stage/block, tokens, trường, props và code hiện tại, trả về code mới thành bản nháp trong editor kèm tóm tắt; một bộ lint báo lỗi luật (`.from(`, thiếu slot, `!important`, prop không có `data-prop`). Đã chạy thật qua Claude Code: 23 s, đúng luật. Editor là CodeMirror 6. Kéo thả bố cục stage để sau.

**Phụ đề karaoke** (`CORE_CONTRACTS.md` §2.10, §5.12, §5.13): Căn Mốc Từ căn chỉnh cưỡng bức bằng `stable-ts` (venv cục bộ, `npm run setup:align`, model `small` tải ~460 MB lần đầu; đã chạy thật trên giọng Vbee tiếng Việt: 9 từ, 3,2 s), Phụ Đề gom từ thành dòng theo luật của cutdown (chỉ giữ `maxChars`), Đóng Gói Timeline ghi vào IR, Stage quyết định chỗ và dáng qua `data-slot="captions"` (+ `data-caption-style`, `--caption-on`), HyperFrames đổ dòng vào chỗ đó và tô từ đang đọc. Đã render thật và soi khung hình. Ba bản mẫu mang sẵn hai node ở trạng thái bỏ qua. Chưa có: mốc từ trả sẵn từ ElevenLabs (`/with-timestamps`), Remotion.

**Look** (`CORE_CONTRACTS.md` §2.6–2.8, §2.11, §4, §5.9–5.10) — node `core/look`, nhận `SceneScript` từ Đạo Diễn AI hay Kịch Bản Tĩnh, dàn cảnh bằng quy tắc (`nodes/look/cast.ts`) và phát `DirectorPlan`; mang giao diện dưới dạng dữ liệu, gồm cả danh mục block (node Stage và Blocks riêng đã gộp vào): Stage là sân khấu chung của mọi cảnh, Blocks là **danh mục** kiểu cảnh (một node, nhiều block; thân node là danh sách mở từng block), mỗi block có bảng `props`, tài liệu cho mô hình và code `html-gsap`. Đã xong: **giao diện là chặng riêng sau kịch bản** (2026-09-06): từ vựng nội dung `CONTENT_KEYS`, cổng `SceneScript`, prop block khai `content`, bảng `casting` theo vai; Đạo Diễn AI và Kịch Bản Tĩnh không còn nhận Look nên sửa giao diện không chạy lại mô hình; **cổng nhiều dây** vẫn có trong bộ máy (`PortDef.multiple`, `RunContext.lists`) nhưng không node lõi nào dùng; `DirectorPlan` và IR **tự chứa** (mang stage và block, `blockId` thay `sceneType`, `tone`/`fields` theo cảnh, bất biến 5 kiểm tra props theo block); ba bản mẫu viết lại với node Stage/Block mang code chuyển từ các cảnh React cũ (`text-card`, `hook`, `mockup`, `cta`, `quote`; stage `dark`, `developer-dark`, `ink`); thân node sửa được mọi phần. Renderer `html-gsap` là engine Hyperframes (xem bảng Engine); scene registry cũ đã gỡ.

Đạo Diễn AI là node đạo diễn **duy nhất**: đề bài và beat (vai trò, mô tả, số cảnh, block được phép, ràng buộc dữ kiện) là tham số; stage và danh mục block đến trên dây; mô hình chọn block cho từng cảnh và lược đồ đầu ra sinh từ bảng `props` của block. Hai node đạo diễn riêng trước đây đã bị thay bằng tham số của node này, và slot + `theme` đã thành beat + node Stage.

Hai node nhà cung cấp theo mẫu Load Checkpoint của ComfyUI: **một node cho mỗi loại cổng**, chọn nhà cung cấp trong node, không phải một node cho mỗi hãng.

**Bộ máy chạy ở máy chủ** (`server/jobs.ts`, `lib/remote-executor.ts`, `ARCHITECTURE.md` §1.2): bấm Chạy là nộp việc vào hàng đợi, executor theo từng tab giữ kết quả và bộ đệm, trạng thái về qua SSE, tải lại trang hay đóng tab không mất việc, nhiều video xếp hàng chạy lần lượt. Các route theo từng dịch vụ cũ đã gỡ. Việc và lịch sử chạy ghi xuống đĩa (`.nodecine/jobs/<id>.json`, `EXECUTION_ENGINE.md` §7.2): khởi động lại máy chủ vẫn còn lịch sử kèm bản đặc tả và các MP4 đã xuất; việc dở dang lúc tiến trình cũ chết được đánh dấu hủy.

**Mọi node ở `nodes/<họ>/`** (định nghĩa, ruột, thân node, test cạnh nhau; `nodes/index.ts` là danh sách duy nhất), `core/` chỉ còn khung. **Form tham số sinh từ Zod schema** (`nodes/form-body.tsx`, ARCHITECTURE §2) cho bảy node đơn giản; bốn body phức tạp và Provider vẫn viết tay. **Không còn `extras/`.** Truy Xuất Repo là node `core/github-fetcher`, cả họ ở `nodes/github/`, gọi GitHub thẳng như node API của ComfyUI. Người dùng mới cài thấy đủ 15 loại node lõi trong Thư viện; `templates/__tests__/fresh-install.test.ts` ghim đúng tập này.

**Engine**

| Engine | Định dạng vẽ được | Xem trước | Kết xuất tệp |
|---|---|---|---|
| Hyperframes | `html-gsap` | ✅ trình phát HyperFrames (iframe sandbox opaque, `srcdoc`) | ✅ MP4 (H.264) qua `@hyperframes/producer` |
| Remotion | — | ✅ nhưng không có gì để vẽ | ✅ nhưng không có gì để vẽ |

Hyperframes Engine giờ là **thư viện HyperFrames thật** (`@hyperframes/core` runtime, `@hyperframes/player`, `@hyperframes/producer`; Apache-2.0), không còn là bộ canvas tự viết. Một IR thành một trang HTML tự chứa (`engines/hyperframes/document.ts`): gsap và runtime inline, style của stage và block bọc `@scope`, mỗi cảnh một clip `data-start`/`data-duration`, voice-over là `<audio data-start>`, một bootstrap gắn props/fields, chạy script của block với gsap giới hạn trong cảnh, và đăng ký timeline gốc. Cùng chuỗi đó đi vào `srcdoc` của trình phát và vào `index.html` cho producer. Đã kết xuất thật: 1080×1920, 30 fps, 8,7 s, có tiếng, 260 khung trong 11 giây (`engines/hyperframes/render.manual.test.ts`, bật bằng `NODECINE_MANUAL_RENDER=1`). **Chạy trọn chuỗi thật** (`server/__tests__/e2e.manual.test.ts`, bật bằng `NODECINE_E2E=1`): bản mẫu GitHub với `expressjs/express` → GitHub API → Claude Code viết 157 từ lời thoại và chọn block cho 10 cảnh → giọng hệ điều hành 60,6 s → HyperFrames producer ra MP4 60,7 s, 1820 khung, trong 112 giây. Các dịch vụ chạy không cần trình duyệt ở `server/services.server.ts`, làm cùng việc với các API route.

Remotion Engine còn trong Thư viện nhưng chưa đăng ký renderer cho định dạng nào: nối nó vào Xuất Bản Video là node chặn `ENGINE_SCENE_UNSUPPORTED: html-gsap`. Nó sẽ có việc khi có định dạng block `react`; xem `PRD.md` mục 8.

**Nhà cung cấp** — sáu; bốn cục bộ không cần khóa, hai giọng đám mây đọc khóa từ `.env.local`:

| Nhà cung cấp | Loại | Transport | Cần gì |
|---|---|---|---|
| Claude Code | Mô hình ngôn ngữ | `cli` | Công cụ `claude` đã đăng nhập |
| Ollama | Mô hình ngôn ngữ | `api` | Máy chủ ollama cục bộ + model đã kéo |
| Giọng hệ điều hành | Giọng đọc | `local` | macOS (`say`) + ffmpeg |
| Piper | Giọng đọc | `local` | `piper` + mô hình giọng `.onnx` + ffmpeg |
| ElevenLabs | Giọng đọc | `api` | `ELEVENLABS_API_KEY` + ffprobe; 29 ngôn ngữ trên một mô hình, giọng liệt kê là `mul` |
| Vbee | Giọng đọc | `api` | `VBEE_TOKEN` + `VBEE_APP_ID` + ffprobe; giọng Việt theo vùng miền, danh mục lấy từ Vbee lúc probe |

Không cái nào bắt buộc phải có. Thiếu thì node nhà cung cấp vẫn `success` màu vàng, ghi rõ thiếu gì và câu lệnh cài; node tiêu thụ phía sau tự chặn.

**Kiểu cảnh và renderer** — không còn khái niệm này. Giao diện là dữ liệu: ba stage (`dark`, `developer-dark`, `ink`) và năm block (`text-card`, `hook`, `mockup`, `cta`, `quote`) nằm trong ba tệp bản mẫu, và người dùng tạo thêm bằng node Stage/Block. Scene registry, `core/title-card`, các component React và hàm canvas theo kiểu cảnh, `extras/quotes` đã bị gỡ.

## Có hợp đồng, chưa ai dùng

Những chỗ này đã định nghĩa trong tài liệu và có sẵn trong kiểu dữ liệu, nhưng chưa có cài đặt nào kích hoạt. Chúng không phải việc bỏ sót — có mặt sẵn để thứ cần chúng sau này không phải sửa hợp đồng.

- **Két khóa API trong app.** `ProviderRegistration.secretSettings` vẫn rỗng ở mọi nhà cung cấp: ElevenLabs và Vbee lấy khóa từ biến môi trường (`providers/api-shared.ts`, `envFirst`), node báo `KEY_MISSING` / `KEY_INVALID` khi thiếu hay bị từ chối. Chưa có ô nhập khóa trong giao diện và chưa có chỗ lưu riêng phía trình duyệt; khi nào cần thì `secretSettings` là nơi khai báo.
- **Dự phòng hiệu ứng.** Adapter gặp hiệu ứng không dựng được thì tự thay bằng mờ dần và cảnh báo mức thông tin. Chưa Adapter nào kích hoạt.
- **Hai engine cùng phát một lúc.** Bố cục cho phép đặt hai Node Xuất Bản Video cạnh nhau; hiện chỉ một cái phát được tại một thời điểm.
- **Chạy song song.** Bộ máy chạy tuần tự theo thứ tự tô-pô. Đồ thị cỡ mười node và node thắt nằm ở lệnh gọi ra ngoài nên song song chưa đáng đánh đổi độ phức tạp báo tiến độ.
- **Dọn tệp tạm nền.** Chỉ dọn tệp cũ hơn 24 giờ lúc khởi động, không có tiến trình nền.
- **Remotion Engine.** Adapter, bundler, route kết xuất và font vẫn đủ, nhưng không có renderer cho `html-gsap` nên không vẽ được block nào. Giữ cho tới khi có định dạng block `react` (code block là một component React dạng chuỗi, dịch lúc chạy); khi đó Remotion tự khớp theo quy tắc renderer-theo-định-dạng mà không phải sửa hợp đồng.

---

## Cố ý chưa làm

Xem `PRD.md` mục 8. Ghi lại ở đó để tránh vô tình thiết kế chặn đường, không phải hàng đợi công việc.

---

## Nghiệm thu đã qua

- **Pha A — khung lõi.** Xong 2026-09-05. Đồ thị Kịch Bản Tĩnh bảy node chạy từ đầu tới MP4, không mạng, không mô hình ngôn ngữ, không khóa.
- **Pha B — gói github-showcase.** Xong 2026-09-05. Chạy thật từ đường dẫn repo tới MP4 1080×1920: `expressjs/express`, 69.417 sao, `npm install express`, ba cảnh, lời thoại do mô hình viết.

Tiêu chí đầy đủ ở `PRD.md` mục 6 và `templates/github-showcase.md` mục 7.
