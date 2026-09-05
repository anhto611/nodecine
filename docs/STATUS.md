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

**Node lõi** — mười bốn loại: Nhập Liệu, Truy Xuất Repo, Kịch Bản Tĩnh, **Stage**, **Blocks**, **Đạo Diễn AI**, Mô Hình Ngôn Ngữ, Giọng Đọc Nguồn, Giọng Đọc, Đóng Gói Timeline, Remotion Engine, Hyperframes Engine, Xuất Bản Video, Xuất MP4.

**Stage và Blocks** (`CORE_CONTRACTS.md` §2.6–2.8, §4, §5.9–5.10) — hai node nguồn mang giao diện dưới dạng dữ liệu: Stage là sân khấu chung của mọi cảnh, Blocks là **danh mục** kiểu cảnh (một node, nhiều block; thân node là danh sách mở từng block), mỗi block có bảng `props`, tài liệu cho mô hình và code `html-gsap`. Project cũ với mỗi block một node tự gộp (schema v6). Đã xong: kiểu cổng `StageDef`/`BlockDef`; **cổng nhiều dây** (`PortDef.multiple`, `RunContext.lists`, chữ ký băm cả danh sách); Đạo Diễn AI và Kịch Bản Tĩnh nhận `stage` + `blocks`; `DirectorPlan` và IR **tự chứa** (mang stage và block, `blockId` thay `sceneType`, `tone`/`fields` theo cảnh, bất biến 5 kiểm tra props theo block); ba bản mẫu viết lại với node Stage/Block mang code chuyển từ các cảnh React cũ (`text-card`, `hook`, `mockup`, `cta`, `quote`; stage `dark`, `developer-dark`, `ink`); thân node sửa được mọi phần. Renderer `html-gsap` là engine Hyperframes (xem bảng Engine); scene registry cũ đã gỡ.

Đạo Diễn AI là node đạo diễn **duy nhất**: đề bài và beat (vai trò, mô tả, số cảnh, block được phép, ràng buộc dữ kiện) là tham số; stage và danh mục block đến trên dây; mô hình chọn block cho từng cảnh và lược đồ đầu ra sinh từ bảng `props` của block. Hai node đạo diễn riêng trước đây đã bị thay bằng tham số của node này (project cũ tự chuyển đổi, schema v3), và slot + `theme` đã thành beat + node Stage (schema v4, `lib/storage.v4.ts`).

Hai node nhà cung cấp theo mẫu Load Checkpoint của ComfyUI: **một node cho mỗi loại cổng**, chọn nhà cung cấp trong node, không phải một node cho mỗi hãng.

**Không còn `extras/`.** Truy Xuất Repo là node lõi `core/github-fetcher` (ruột ở `core/github/`, thao tác máy chủ ở `server/github/`); project cũ tự đổi tên node (schema v5). Người dùng mới cài thấy đủ 14 loại node lõi trong Thư viện; `templates/__tests__/fresh-install.test.ts` ghim đúng tập này.

**Engine**

| Engine | Định dạng vẽ được | Xem trước | Kết xuất tệp |
|---|---|---|---|
| Hyperframes | `html-gsap` | ✅ trình phát HyperFrames (iframe sandbox opaque, `srcdoc`) | ✅ MP4 (H.264) qua `@hyperframes/producer` |
| Remotion | — | ✅ nhưng không có gì để vẽ | ✅ nhưng không có gì để vẽ |

Hyperframes Engine giờ là **thư viện HyperFrames thật** (`@hyperframes/core` runtime, `@hyperframes/player`, `@hyperframes/producer`; Apache-2.0), không còn là bộ canvas tự viết. Một IR thành một trang HTML tự chứa (`engines/hyperframes/document.ts`): gsap và runtime inline, style của stage và block bọc `@scope`, mỗi cảnh một clip `data-start`/`data-duration`, voice-over là `<audio data-start>`, một bootstrap gắn props/fields, chạy script của block với gsap giới hạn trong cảnh, và đăng ký timeline gốc. Cùng chuỗi đó đi vào `srcdoc` của trình phát và vào `index.html` cho producer. Đã kết xuất thật: 1080×1920, 30 fps, 8,7 s, có tiếng, 260 khung trong 11 giây (`engines/hyperframes/render.manual.test.ts`, bật bằng `NODECINE_MANUAL_RENDER=1`). **Chạy trọn chuỗi thật** (`server/__tests__/e2e.manual.test.ts`, bật bằng `NODECINE_E2E=1`): bản mẫu GitHub với `expressjs/express` → GitHub API → Claude Code viết 157 từ lời thoại và chọn block cho 10 cảnh → giọng hệ điều hành 60,6 s → HyperFrames producer ra MP4 60,7 s, 1820 khung, trong 112 giây. Các dịch vụ chạy không cần trình duyệt ở `server/services.server.ts`, làm cùng việc với các API route.

Remotion Engine còn trong Thư viện nhưng chưa đăng ký renderer cho định dạng nào: nối nó vào Xuất Bản Video là node chặn `ENGINE_SCENE_UNSUPPORTED: html-gsap`. Nó sẽ có việc khi có định dạng block `react`; xem `PRD.md` mục 8.

**Nhà cung cấp** — bốn, không cái nào cần khóa API:

| Nhà cung cấp | Loại | Transport | Cần gì |
|---|---|---|---|
| Claude Code | Mô hình ngôn ngữ | `cli` | Công cụ `claude` đã đăng nhập |
| Ollama | Mô hình ngôn ngữ | `api` | Máy chủ ollama cục bộ + model đã kéo |
| Giọng hệ điều hành | Giọng đọc | `local` | macOS (`say`) + ffmpeg |
| Piper | Giọng đọc | `local` | `piper` + mô hình giọng `.onnx` + ffmpeg |

Không cái nào bắt buộc phải có. Thiếu thì node nhà cung cấp vẫn `success` màu vàng, ghi rõ thiếu gì và câu lệnh cài; node tiêu thụ phía sau tự chặn.

**Kiểu cảnh và renderer** — không còn khái niệm này. Giao diện là dữ liệu: ba stage (`dark`, `developer-dark`, `ink`) và năm block (`text-card`, `hook`, `mockup`, `cta`, `quote`) nằm trong ba tệp bản mẫu, và người dùng tạo thêm bằng node Stage/Block. Scene registry, `core/title-card`, các component React và hàm canvas theo kiểu cảnh, `extras/quotes` đã bị gỡ.

## Có hợp đồng, chưa ai dùng

Những chỗ này đã định nghĩa trong tài liệu và có sẵn trong kiểu dữ liệu, nhưng chưa có cài đặt nào kích hoạt. Chúng không phải việc bỏ sót — có mặt sẵn để thứ cần chúng sau này không phải sửa hợp đồng.

- **Két khóa API.** `ProviderRegistration.secretSettings` đã có trong registry và rỗng ở mọi nhà cung cấp. Mã lỗi `KEY_MISSING`, `KEY_INVALID` đã có chuỗi hiển thị nhưng chưa chỗ nào ném. Ô lưu riêng trong localStorage thì mới có trong đặc tả (`EXECUTION_ENGINE.md` §7.1 nói ba khóa) chứ **chưa có trong `lib/storage.ts`** — code mới dùng hai khóa, dự án và giao diện.
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
