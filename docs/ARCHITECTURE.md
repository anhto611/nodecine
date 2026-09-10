# Kiến trúc Hệ thống NodeCine (System Architecture)

Tài liệu này mô tả phần khung lõi; nội dung kèm app và bản mẫu chỉ xuất hiện ở cây thư mục. Nó trả lời câu hỏi mà các tài liệu còn lại không trả lời: mã nguồn chạy ở đâu, ranh giới giữa máy khách và máy chủ nằm chỗ nào, và tại sao một sản phẩm tuyên bố Zero-Auth vẫn cần phần máy chủ.

---

## 1. Mô hình Triển khai (Deployment Topology)

NodeCine v0.1 là một ứng dụng Next.js duy nhất, người dùng tự tải mã nguồn về và tự chạy trên máy của mình.

```
Máy của người dùng
├─ Trình duyệt (Chromium)
│   └─ Studio UI: canvas đồ thị, bộ máy thực thi, trình phát trong node,
│                 (kho khóa API, khi có nhà cung cấp cần khóa)
│        │
│        │  HTTP trên localhost
│        ▼
└─ Tiến trình Node của Next.js
    ├─ Điểm cuối truy xuất repo   → GitHub REST API
    ├─ Điểm cuối Biên Kịch      → tiến trình con: Claude Code CLI đã đăng nhập
    ├─ Điểm cuối giọng đọc        → tiến trình con: bộ tổng hợp hệ điều hành + ffmpeg
    ├─ Điểm cuối kết xuất         → Remotion Renderer → headless Chromium
    └─ Phục vụ tệp tạm            → tệp MP3 và MP4 đã tạo
```

Không có thành phần nào do đội ngũ NodeCine vận hành nằm trên đường đi này. "Máy chủ" ở đây luôn là tiến trình chạy trên chính máy người dùng.

### 1.1. Vì sao vẫn cần phần máy chủ

Có đúng ba việc trình duyệt không làm được, và đó là toàn bộ lý do tồn tại của tầng máy chủ:

1. Kết xuất MP4. Remotion kết xuất bằng cách điều khiển một tiến trình headless Chromium chụp từng khung hình rồi ghép qua FFmpeg. Đây là công việc của hệ điều hành, không thể thực hiện trong một tab trình duyệt.
2. Sinh tiến trình con. Nhà cung cấp có `transport` là `cli` hoặc `local` chạy tệp thực thi trên máy, và trình duyệt không sinh được tiến trình. Danh sách nhà cung cấp hiện có ở `STATUS.md`.
3. Vượt rào chắn nguồn gốc chéo cho GitHub API, và giữ khóa API của nhà cung cấp qua mạng không lộ trong mã nguồn trang.

### 1.2. Ranh giới máy khách và máy chủ

| Thành phần | Nơi chạy | Ghi chú |
| --- | --- | --- |
| Canvas đồ thị và giao diện Studio | Máy khách | Không có logic nghiệp vụ |
| Bộ máy thực thi đồ thị | Máy chủ cục bộ, sau một hàng đợi | Một executor cho mỗi workflow đang mở, giữ trạng thái và bộ đệm chữ ký giữa các lần chạy; việc chạy tuần tự (`server/jobs.ts`) |
| Logic đóng gói Bản Đặc Tả Video Trung Gian | Máy chủ cục bộ | Hàm thuần, chạy trong executor |
| Lệnh gọi GitHub | Máy chủ cục bộ | Thao tác máy chủ, gọi từ node trong executor |
| Gọi Claude Code CLI, gọi bộ tổng hợp giọng nói | Máy chủ cục bộ | Sinh tiến trình con theo quy tắc an toàn tại Hợp đồng Lõi mục 9 |
| `probe()` của các node tài nguyên | Máy chủ cục bộ | Kiểm tra tệp thực thi, phiên đăng nhập, ffmpeg |
| Kết xuất MP4, do Node Xuất MP4 kích hoạt | Máy chủ cục bộ | Tiến trình chạy dài, có báo tiến độ và hủy |
| Trình phát trong Node Xuất Bản Video | Máy khách | Nhận IR từ trạng thái node đã mirror; không tiêu tốn tài nguyên kết xuất |
| Trạng thái node, nhật ký, tiến độ | Máy chủ → máy khách qua SSE `/api/jobs/events` | Trình duyệt chỉ mirror; đóng tab không dừng việc |

Bộ máy thực thi nằm ở máy chủ, theo mô hình hàng đợi `/prompt` của ComfyUI, nên đóng tab không mất việc. Mỗi node cần mạng hay tiến trình con vẫn tách đôi: ruột thuần ở lõi để test được, phần gọi ra ngoài ở `server/`. `POST /api/jobs` nộp việc (`run`, `node`, `probe`) kèm đồ thị và khóa của tab; đồ thị không chạy được bị từ chối ngay với danh sách lỗi; một executor cho mỗi khóa giữ kết quả và bộ đệm chữ ký nên lần chạy sau vẫn dùng lại được; `GET /api/jobs/events?key=` là luồng SSE phát trạng thái node, bước chạy, nhật ký và trạng thái việc; `GET/POST /api/executors/<khóa>` đọc lại trạng thái kèm lịch sử chạy (tải lại trang là thấy kết quả cũ) và đưa các sửa đổi cần tới executor ngay (đồ thị, vô hiệu, bỏ qua, hủy). Việc và lịch sử chạy là tệp trên đĩa (`.nodecine/jobs/`, ghi tạm rồi đổi tên như `job.json` của cutdown), đọc lại khi máy chủ khởi động, nên lịch sử sống lâu hơn tiến trình. Trình duyệt giữ một `RemoteExecutor` (`lib/remote-executor.ts`) mang đúng bề mặt executor cho store và các thân node, nên giao diện không phải biết việc chạy ở đâu. `server/services.server.ts` là NodeServices duy nhất: không có route riêng cho từng dịch vụ.

---

## 2. Cấu trúc Thư mục & Quy tắc Phụ thuộc

```
nodecine/
├─ app/
│  ├─ page.tsx                    Trang Studio duy nhất
│  ├─ layout.tsx
│  └─ api/
│     ├─ jobs/route.ts            Hàng đợi việc: nộp (run / node / probe) và liệt kê, như /prompt của ComfyUI
│     ├─ jobs/[id]/route.ts       Một việc: đọc, hủy
│     ├─ jobs/events/route.ts     SSE theo khóa workflow: trạng thái node, bước chạy, nhật ký, trạng thái việc
│     ├─ executors/[key]/route.ts Executor của một workflow: đọc trạng thái, đẩy đồ thị, vô hiệu, bỏ qua, hủy
│     ├─ media/[...path]/route.ts Phục vụ tệp trong thư mục tệp tạm, chỉ đọc
│     ├─ vendor/[name]/route.ts   Script vendor các engine đăng ký qua server/vendor.ts (HyperFrames: gsap và runtime), đọc từ node_modules
│     ├─ workflows/               Tệp workflow của người dùng: danh sách, lưu, đọc, đổi tên, xóa, và đọc workflow từ MP4
├─ core/                          Tầng lõi, không phụ thuộc React và engine
│  ├─ types/                      Kiểu cổng, lược đồ dữ liệu, Bản đặc tả IR
│  ├─ nodes/definition.ts         Hợp đồng node (NodeDefinition, PortDef, RunContext) và registry node rỗng; các node ở nodes/
│  ├─ engine/                     Bộ máy thực thi đồ thị, chữ ký node, bộ nhớ đệm
│  ├─ templates/registry.ts       Registry bản mẫu: kiểm định JSON, trả bản sao đồ thị; rỗng ở lõi
│  ├─ text/                       Nhận diện ngôn ngữ theo hệ chữ; chính sách ngôn ngữ đầu ra
│  ├─ adapters/                   CHỈ giao diện Adapter và registry rỗng; không có lớp cài đặt nào ở đây
│  │  ├─ types.ts                 EngineAdapter, probe / mountPlayer / render
│  │  └─ registry.ts              engineId → factory; capsule engine tự đăng ký lúc khởi động (`register` trong manifest); `previewEngine()` cho khung xem trước
│  └─ providers/                  CHỈ giao diện Provider và registry rỗng
│     ├─ types.ts
│     └─ registry.ts              providerId → factory
├─ providers/                     Mỗi nhà cung cấp là một capsule, cùng luật với node
│  ├─ .generated/                 descriptors (cho trình duyệt), server, locales; sinh tự động, không sửa tay
│  ├─ installed.ts                Kiểu ProviderDescriptor và các hàm tra cứu; danh sách lấy từ .generated
│  ├─ api-shared.ts               Phần dùng chung của các nhà cung cấp gọi HTTP
│  ├─ claude-code/                provider.manifest.json, settings.ts (Zod, an toàn cho trình duyệt),
│  │                              locales.ts, index.ts (gọi CLI đã đăng nhập, chỉ máy chủ)
│  ├─ piper/                      Giọng máy học chạy cục bộ, chung một đường trên mọi hệ điều hành
│  └─ system-tts/                 macOS say + ffmpeg
├─ server/                        Phần chỉ chạy trên máy chủ, không React
│  ├─ register.ts                 Đăng ký node, nhà cung cấp, engine một lần cho mọi route
│  ├─ jobs.ts                     Hàng đợi việc và các executor theo khóa; phát sự kiện cho SSE
│  ├─ services.server.ts          NodeServices duy nhất: nhà cung cấp và engine gọi thẳng; MP4 được đóng dấu workflow
│  ├─ workflows.ts                Kho tệp workflow .nodecine/workflows, ghi nguyên tử, tự nâng phiên bản khi đọc
│  ├─ video-meta.ts               Thẻ nodecine_workflow trong MP4: ghi bằng ffmpeg stream copy, đọc bằng ffprobe
│  ├─ paths.ts                    Thư mục tệp tạm và tên tệp media băm
├─ templates/                     Bản mẫu = đồ thị JSON, cùng hình dạng tệp dự án; index.ts đăng ký cả ba
├─ nodes/                         Mỗi node là một capsule tự chứa, đúng một thư mục cho đúng một node
│  ├─ .generated/                 Registry server/client sinh tự động; không sửa tay
│  ├─ index.ts                    Chỉ re-export registry server đã sinh
│  ├─ index.client.ts             Chỉ re-export body, metadata và overlay đã sinh
│  ├─ kit.tsx                     BodyProps và useParams dùng chung cho thân node
│  ├─ form.ts                     Đọc paramsSchema (Zod) thành danh sách trường: enum, chuỗi, số có biên, boolean; thuần, có test
│  ├─ form-body.tsx               FormBody: form tham số sinh từ schema (nhãn `node.<tên trường>`, nhãn giá trị `node.<trường>.<giá trị>` nếu có); body chỉ viết tay phần đặc thù
│  ├─ illustrator/               Ví dụ capsule: node.manifest.json, node.ts, body.tsx và các helper/test chỉ node này dùng
│  ├─ hyperframes-engine/         Engine là capsule: node.ts phát EngineRef; adapter, markup.ts (dựng trang, xem trước), document.ts, player.client.ts, register.server.ts (producer, vendor); manifest khai `register.server/client`
│  ├─ remotion-engine/            Engine Remotion cùng dạng: Root/Video/entry cho bundler, adapter, player, register
│  ├─ audio-input/                Một node, không ghép chung với audio-mix
│  ├─ audio-mix/                  Một node, không ghép chung với audio-input
│  ├─ captions/                   Một node tạo CaptionTrack
│  ├─ caption-export/             Một node xuất tệp phụ đề
│  ├─ video-output/               Một node xem trước video
│  ├─ mp4-export/                 Một node kết xuất MP4
│  └─ …/                          Mọi thư mục còn lại giữ cùng contract một-capsule
├─ scripts/
│  ├─ discover-nodes.mjs          Quét node.manifest.json và sinh static imports cho Next.js
│  ├─ discover-providers.mjs      Quét provider.manifest.json và sinh descriptors / server / locales
│  └─ check-node-boundaries.mjs   Chặn core→node, core→provider, node→node và provider→provider
├─ components/                    Thành phần giao diện Studio (canvas, dải, panel, thẻ node); thân node nằm ở nodes/
├─ locales/                       Từ điển chuỗi hiển thị
└─ docs/
```

Quy ước ngôn ngữ trong kho mã: mã nguồn, chú thích, tên kiểm thử, thông điệp lỗi nội bộ và tệp README ở gốc kho đều bằng tiếng Anh, vì dự án công khai cho cộng đồng toàn cầu. Chuỗi hiển thị cho người dùng không bao giờ nằm trong mã mà đi qua từ điển `locales/`. Bộ tài liệu thiết kế trong `docs/` giữ tiếng Việt.

Quy tắc phụ thuộc bắt buộc, kiểm tra được bằng công cụ phân tích tĩnh:

- `core/` không được phép nhập bất cứ thứ gì từ `nodes/`, `providers/`, `server/`, `templates/`, `app/` hay `components/`. Nó chỉ chứa giao diện Adapter, Provider cùng các registry rỗng (engine, nhà cung cấp, renderer theo định dạng, bản mẫu); các lớp cài đặt cụ thể nằm ngoài lõi và tự đăng ký vào registry ở thời điểm khởi động ứng dụng. Nếu quy tắc này bị vi phạm, tuyên bố độc lập engine trở thành lời nói suông và Hyperframes Adapter sẽ không bao giờ cài đặt được.
- Capsule engine (`nodes/hyperframes-engine/`, `nodes/remotion-engine/`), `providers/*` và `server/*` được nhập giao diện và kiểu từ `core/`, và được nhập thư viện của riêng chúng như Remotion hay React; `core/` không bao giờ nhập ngược lại. Một engine đăng ký renderer cho định dạng code nó chạy được; không gì nhập Adapter của engine khác. `templates/` chỉ chứa JSON và một tệp đăng ký; nó không import node nào.
- Mỗi `nodes/<tên>/` bắt buộc có đúng một `node.manifest.json`, một `node.ts` và một `body.tsx`; manifest khai ID, export định nghĩa, export body, icon/nhóm, `translations` (bắt buộc: `locales.ts` của capsule giữ mọi chuỗi kể cả tên `node.<id>` và mô tả `node.desc.<id>`), feature, service server, thư viện tệp, đăng ký engine và overlay tùy chọn. `scripts/discover-nodes.mjs` sinh registry trước dev, test, typecheck và build; không còn danh sách node viết tay. `NodeServices.invoke()` là cổng service tổng quát nên core không biết tên nghiệp vụ của bất kỳ node nào.
- Một capsule không được import capsule khác, **kể cả trong test**; test chạy nhiều node cùng nhau đặt ở `nodes/__tests__/`, test đặt nhiều nhà cung cấp cạnh nhau đặt ở `providers/__tests__/`. Logic dùng chung phải chuyển vào `core/`, `server/` hoặc `components/node-runtime/` theo môi trường chạy. Thư mục tệp người dùng (`music`, `voice`, `clips`) do capsule đọc nó khai trong manifest (`libraries`), `server/paths.ts` là registry rỗng. `npm run nodes:check` thực thi ranh giới này và cũng cấm `core/` import `nodes/`.
- **Nhà cung cấp là capsule, cùng một khuôn.** Mỗi `providers/<tên>/` có đúng một `provider.manifest.json` khai id, loại (`tts` hay `llm`), tên hàm đăng ký, lược đồ tham số, widget và `translations`. Lược đồ nằm ở `settings.ts` — Zod thuần, không nhập gì của Node — nên trình duyệt vẽ form từ **đúng lược đồ máy chủ dùng để kiểm định**; `index.ts` sinh tiến trình và chỉ máy chủ nạp. Tham số mặc định không được viết tay ở đâu cả: registry tính bằng `defaultSettingsOf(settingsSchema)`. Chuỗi hiển thị của nhà cung cấp nằm trong `locales.ts` của chính nó, theo khóa `provider.<id>` và `provider.<id>.note`. Trước đây cùng một nhà cung cấp được mô tả ở ba nơi và không gì bắt ba nơi đó khớp nhau.
- **Đồ thị đã lưu có đường đi tới hiện tại.** Ba thứ có thể lỗi thời và mỗi thứ có cách riêng. Hình dạng tài liệu quanh đồ thị là `schemaVersion`, đi từng bậc qua các bước đăng ký trong `nodes/migrations.ts` — đây là tệp duy nhất được phép nêu tên loại node đã chết cạnh loại còn sống, vì đó chính là định nghĩa của di trú. Tham số của một loại node là `NodeDefinition.version` so với `version` đóng dấu trên node đã lưu, và capsule tự viết `migrate` của mình. Loại node biến mất thì không suy ra được từ đâu cả nên phải khai: `nodes/retired.json` nói cái gì thay thế nó, hoặc nói thẳng là không có gì. `core/engine/migrate.ts` giữ cơ chế và không biết tên nào. Mọi cửa một đồ thị đi vào đều chạy qua đó: đọc tệp, nhập tệp, mở bản mẫu, và các tab khôi phục từ trình duyệt. Node đóng dấu phiên bản lúc **ghi**, không phải lúc đọc, nên mở một tệp không bao giờ là một lần sửa. `core/__tests__/fixtures/` giữ tệp thật của từng định dạng cũ; một bước di trú hỏng làm đỏ bộ test.
- **Nửa giao diện của node cũng được test.** Một tệp test tên `.test.tsx` chạy trong jsdom và được dọn sau mỗi lần, `.test.ts` chạy trong Node như cũ; `vitest.config.ts` chọn theo tên tệp nên không có cấu hình riêng cho từng thư mục. Thân node đọc và ghi tham số qua store, nên một test dựng graph bằng `useStudio.setState` rồi `render` thân node đó — không cần máy chủ, không cần executor. `nodes/__tests__/form-body.test.tsx` giữ phần khung sinh form, `nodes/input/__tests__/body.test.tsx` là mẫu cho thân node của một capsule, `components/node-runtime/__tests__/` giữ thân dùng chung của hai node Nhà Cung Cấp.
- **Mã lỗi thuộc về nơi ném nó.** `core/errors.ts` chỉ giữ mã mà lõi, bộ máy và tầng nhà cung cấp ném ra. Một thất bại của riêng một node nằm ở `nodes/<tên>/errors.ts`, khai trong manifest bằng trường `errors`, và câu chữ hiển thị nằm trong `locales.ts` của chính capsule đó. Test `nodes/__tests__/errors.test.ts` kiểm mỗi mã có đúng một chủ và có câu chữ ở mọi ngôn ngữ.
- **Thân node sinh từ schema** như `INPUT_TYPES` của ComfyUI và `properties[]` của n8n: một node khai tham số một lần bằng Zod, `FormBody` (`nodes/form-body.tsx`) đọc schema đó bằng `core/schema-form.ts` và vẽ select cho enum, ô số có biên cho số, ô chữ cho chuỗi, checkbox cho boolean; nhãn theo tên trường trong từ điển. Thân node chỉ viết tay phần schema không nói được (xem trước, danh sách beat, trình phát, dòng trạng thái) và nhúng `FormBody` cho phần còn lại, có thể chọn tập trường, thay widget hay tự vẽ một trường tại đúng vị trí của nó. Nhập Liệu, Phụ Đề, Căn Mốc Từ, Đóng Gói Timeline, tốc độ Giọng Đọc, Xuất MP4, Remotion Engine dùng cách này, và hai node Nhà Cung Cấp cũng vậy — chúng vẽ tham số của nhà cung cấp đang chọn bằng chính `SchemaControl` của form; Họa Sĩ, Biên Kịch, Kịch Bản Tĩnh, Xuất Bản Video viết tay.
- `components/` được nhập từ `core/` và `nodes/index.client`, nhưng `core/` không bao giờ nhập ngược lại. Trình phát Remotion là một component do `nodes/remotion-engine/` cung cấp qua `mountPlayer()`, tầng giao diện chỉ gọi hàm đó chứ không nhập Remotion trực tiếp.
- Lệnh gọi mạng ra ngoài chỉ nằm trong `nodes/*` và `providers/*`, tức là trong executor ở máy chủ; `core/` và `components/` không gọi mạng.

---

## 3. Lựa chọn Thư viện Nền tảng

| Nhu cầu | Lựa chọn | Lý do |
| --- | --- | --- |
| Canvas đồ thị | React Flow | Có sẵn kéo trượt, phóng to, bản đồ thu nhỏ, cổng và dây nối tùy biến. Tự viết lại là lãng phí nhiều tuần cho phần không phải giá trị cốt lõi |
| Kiểm định lược đồ | Zod | Dùng chung một định nghĩa cho cả kiểm định kết quả mô hình ngôn ngữ, kiểm định Bản đặc tả IR và suy ra kiểu tĩnh |
| Quản lý trạng thái | Zustand | Trạng thái đồ thị cần được đọc từ ngoài cây component bởi bộ máy thực thi |
| Kết xuất video | Remotion | Đã chốt trong Tài liệu Yêu cầu Sản phẩm |

---

## 4. Thông tin Đăng nhập và Khóa API

Ứng dụng không giữ thông tin đăng nhập của nhà cung cấp nào:

- Node Claude Code Provider gọi tệp thực thi `claude` đang có trên máy. Phiên đăng nhập thuộc về công cụ đó, nằm ở nơi công cụ đó tự lưu; NodeCine không đọc, không sao chép, không chuyển tiếp nó. `probe()` chỉ hỏi công cụ "có đăng nhập chưa" và nhận câu trả lời có hoặc không.
- Node System TTS Provider gọi bộ tổng hợp của hệ điều hành, không có khái niệm đăng nhập.
- GitHub API dùng hạn mức ẩn danh theo địa chỉ IP. Người dùng có thể đặt biến môi trường chứa mã thông báo GitHub để nâng hạn mức; đây là tùy chọn, không bắt buộc.

Hai giọng đọc đám mây (ElevenLabs, Vbee) cần khóa, và quy tắc đang áp dụng là:

1. Khóa là hạ tầng của máy chạy, như đường dẫn tệp thực thi: đọc từ biến môi trường của tiến trình máy chủ (`ELEVENLABS_API_KEY`, `VBEE_TOKEN`, `VBEE_APP_ID`, đặt trong `.env.local`; đúng tên các dịch vụ tự dùng, không tiền tố). Không có ô nhập khóa trong giao diện, không lưu ở trình duyệt.
2. Node Nhà Cung Cấp chỉ giữ tên nhà cung cấp và các tùy chọn thường (mô hình, tốc độ). Tệp workflow chia sẻ ra ngoài vì thế không bao giờ chứa khóa; `secretSettings` trong registry vẫn rỗng và chỉ dùng tới khi có nhà cung cấp buộc phải mang khóa trong tùy chọn.
3. `probe()` báo `KEY_MISSING` khi thiếu và `KEY_INVALID` khi dịch vụ từ chối, kèm câu hướng dẫn đặt biến; node tiêu thụ phía sau tự chặn. Lời thoại đi trong thân yêu cầu, không bao giờ trong URL.

Quy tắc ghi nhật ký, áp dụng luôn: mọi thông báo lỗi chuyển ngược về máy khách phải được lọc bỏ chuỗi giống khóa hoặc mã thông báo trước khi gửi, kể cả khi tiến trình con vô tình in chúng ra.

## 5. Bảo vệ Điểm Cuối Chuyển Tiếp

Tầng máy chủ nhận đường dẫn từ máy khách rồi đi gọi ra ngoài, nên nó là một điểm cần phòng vệ ngay cả khi chỉ chạy trên máy cá nhân. Nếu người dùng mở một đồ thị do người khác chia sẻ, đường dẫn trong đồ thị đó là dữ liệu không đáng tin.

- Node Truy Xuất Repo dựng URL từ cặp owner/name đã kiểm định bằng lược đồ, chỉ tới `api.github.com` và `raw.githubusercontent.com`; token (nếu có) đọc từ biến môi trường, không từ tệp dự án.
- Executor chỉ kết xuất Bản Đặc Tả Video Trung Gian đã qua kiểm định, và chỉ đọc âm thanh từ chính thư mục tệp tạm của ứng dụng.
- Mọi tiến trình con tuân thủ quy tắc tại Hợp đồng Lõi mục 9: đối số dạng mảng, nội dung qua đầu vào chuẩn, đường dẫn tệp thực thi không lấy từ tệp dự án.

---

## 6. Vòng đời Tệp Tạm

Định dạng thống nhất của mọi đường dẫn tệp tạm chảy qua đồ thị: đường dẫn HTTP tương đối với gốc ứng dụng, dạng `/api/media/<mã băm>.<đuôi>`. Máy khách dùng thẳng đường dẫn này cho thẻ âm thanh và trình phát. Máy chủ, khi cần đường dẫn hệ tệp (đo thời lượng, chuyển mã), ánh xạ ngược từ mã băm sang tệp trong thư mục tệp tạm; khi tiến trình kết xuất cần nạp, nó dùng đường dẫn tuyệt đối `http://127.0.0.1:<cổng>/api/media/...` vì headless Chromium nạp qua HTTP như một trình duyệt bình thường. Không nơi nào trong Bản Đặc Tả Video Trung Gian chứa đường dẫn hệ tệp tuyệt đối, nên bản đặc tả có thể chia sẻ mà không lộ cấu trúc thư mục máy người dùng. Điểm cuối media chỉ phục vụ tệp nằm trong thư mục tệp tạm, từ chối mọi đường dẫn chứa thành phần đi lên thư mục cha, và chỉ cho phép đọc.

- Tệp âm thanh và tệp video được ghi vào một thư mục tệp tạm nằm trong thư mục làm việc của dự án, đặt tên theo mã băm nội dung để hai lần chạy giống hệt nhau dùng lại đúng một tệp.
- Thư mục này nằm trong danh sách bỏ qua của hệ thống quản lý phiên bản.
- Ứng dụng dọn các tệp cũ hơn 24 giờ vào lúc khởi động.

---

## 7. Kết xuất MP4: Trình tự Chi tiết

1. Người dùng bấm Kết xuất trên Node Xuất MP4; máy khách gửi Bản Đặc Tả Video Trung Gian, định danh engine và tham số kết xuất tới điểm cuối kết xuất.
2. Máy chủ kiểm định lược đồ và số hiệu phiên bản của bản đặc tả, từ chối sớm nếu không khớp.
3. Máy chủ đóng gói mã nguồn Remotion, khởi chạy headless Chromium, và kết xuất Composition với bản đặc tả làm thuộc tính đầu vào.
4. Tiến độ được đẩy ngược về máy khách theo dòng sự kiện, hiển thị dưới dạng phần trăm trên thân Node Xuất MP4, kèm dòng nhật ký đổ vào Panel Nhật ký.
5. Khi hoàn tất, máy chủ trả về đường dẫn tệp và dung lượng; máy khách kích hoạt tải xuống và hiện node Tải xuống trên node.
6. Nếu thất bại, máy chủ trả về mã lỗi kèm phần đuôi nhật ký kết xuất. Bản Đặc Tả Video Trung Gian ở phía máy khách được giữ nguyên để thử lại ngay mà không phải chạy lại luồng.

Điểm cần lưu ý khi cài đặt: bước đóng gói mã nguồn Remotion mất vài giây và có thể dùng lại giữa các lần kết xuất. Nên giữ kết quả đóng gói trong bộ nhớ đệm theo mã băm của mã nguồn để lần kết xuất thứ hai trở đi nhanh hơn đáng kể.

---

## 8. Ghi chú Cài đặt: Cạm bẫy Đã biết

Những điểm dưới đây không đổi thiết kế nhưng sẽ chặn tiến độ nếu không dự trù.

0. **Font trong khung xem trước.** Khung xem trước là iframe `sandbox="allow-scripts"`, tức origin rỗng, nên mọi tệp font nó nạp là request khác origin và trình duyệt chặn nếu không có `Access-Control-Allow-Origin`. Header đó khai trong `next.config.mjs` cho `/fonts/:file*`. Thiếu nó thì xem trước rơi về font hệ thống và không còn khớp bản kết xuất — nhìn ra như lỗi thiết kế chứ không ai đoán là chính sách.

0b. **Chunk của trình phát ở chế độ dev.** Next dựng chunk theo yêu cầu, nên lần mount đầu tiên ngay sau khi khởi động lại máy chủ có thể xin chunk của `@hyperframes/player` khi nó chưa được ghi xong và nhận 404. Trước đây lời hứa `import()` được nhớ lại **ở trạng thái thất bại**, nên một lần lỡ làm hỏng mọi lần mount sau đó cho tới khi tải lại trang bằng tay. Nay lỗi tải chunk được thử lại một lần sau 0,8 giây và thất bại thì quên đi, không nhớ.

1. **Trình phát Remotion bên trong node React Flow.** React Flow áp `transform: translate() scale()` lên toàn bộ viewport, nên mọi thao tác kéo trong thân node (thanh trượt, node phát) phải nằm trong phần tử mang các lớp `nodrag`, `nopan` và `nowheel` của React Flow; nếu không, kéo thanh trượt sẽ kéo cả canvas và cuộn để tua sẽ thu phóng. Khung phát giữ tỷ lệ 9:16 bằng CSS `aspect-ratio`, kích thước bố cục cố định, để trình phát tự co theo mức thu phóng của canvas mà không phải tính lại. Trình phát được mount vào một React root lồng riêng (adapter không phụ thuộc cây React của Studio); root lồng phải được gỡ **bất đồng bộ** (`setTimeout`) vì cleanup của effect chạy khi React đang render, và phần tử chứa phải đổi `key` theo IR để root mới không dùng chung phần tử với root cũ chưa kịp gỡ.
2. **`@remotion/bundler` và `@remotion/renderer` trong route handler của Next.js.** Hai gói này mang webpack riêng và tệp nhị phân gốc; nếu để Next.js đóng gói chúng sẽ gặp lỗi không tìm thấy module hoặc xung đột nhị phân. Bắt buộc khai báo `serverExternalPackages: ['@remotion/bundler', '@remotion/renderer']` trong `next.config`. Turbopack ở chế độ dev có thể không tương thích; nếu gặp, chạy `next dev --webpack`. Kết quả đóng gói giữ trong bộ nhớ đệm theo mã băm mã nguồn như mục 7.
3. **Claude Code CLI có quyền đọc tệp và dùng công cụ.** Chạy `claude -p` trong thư mục dự án nghĩa là mô hình có thể đọc mã nguồn và gọi công cụ. Provider `claude-code` bắt buộc sinh tiến trình với thư mục làm việc là một thư mục tạm rỗng, tắt toàn bộ công cụ qua tham số dòng lệnh, giới hạn một lượt, và chỉ đọc trường kết quả. Đây là phần bổ sung cho quy tắc an toàn tiến trình con tại Hợp đồng Lõi mục 9.
4. **Giấy phép Remotion.** Remotion là mã nguồn mở có điều kiện: miễn phí cho cá nhân và tổ chức nhỏ, tổ chức lớn hơn cần giấy phép công ty. NodeCine là mã nguồn mở và không phân phối lại Remotion, nhưng người dùng là công ty tự chịu trách nhiệm về giấy phép của họ; ghi rõ trong tệp README của kho mã.
5. **React Flow chỉ chạy phía máy khách.** Trang Studio và mọi thành phần chứa canvas phải là client component; tầng `core/` không được nhập từ chúng, đúng quy tắc mục 2.
6. **Bộ đóng gói Remotion không biết bí danh `@/` của Next.js.** `@remotion/bundler` dùng webpack riêng, không đọc `tsconfig.paths`, nên mọi `import '@/core/...'` bên trong entry của video sẽ lỗi "module not found" lúc kết xuất dù `next dev` chạy bình thường. Adapter phía máy chủ phải truyền `webpackOverride` thêm `resolve.alias['@'] = process.cwd()` khi gọi `bundle()`; kiểm thử kết xuất thật (không chỉ typecheck) là cách duy nhất bắt được lỗi này.
7. **Mã máy chủ của Remotion không được kéo React vào route handler.** `@remotion/renderer` chạy trong Node và không cần React, nhưng nếu route handler nhập gián tiếp một tệp có `import { ... } from 'remotion'` (ví dụ để lấy hằng số `COMPOSITION_ID`), Next.js sẽ báo "Remotion requires React.createContext". Hằng số dùng chung phải nằm trong một mô-đun không nhập `remotion`/`react`; phần đăng ký trình kết xuất cảnh chỉ chạy ở máy khách và bên trong bundle.
8. **Phông chữ của video phải đóng gói cục bộ.** Tờ CSS phong cách chỉ được gọi Comfortaa, JetBrains Mono hay system stack. Nếu chỉ khai tên phông, máy nào không cài sẽ kết xuất bằng phông monospace mặc định và ra khung hình khác, tức là kết quả không tái lập được. Tệp `woff2` nằm trong `public/fonts` kèm giấy phép OFL 1.1, được phục vụ như tệp âm thanh: trình phát nạp theo đường dẫn tương đối, bản kết xuất không đầu nạp theo `mediaBaseUrl` tuyệt đối. Thành phần video giữ khung đầu bằng `delayRender` cho tới khi phông sẵn sàng, nếu không chữ sẽ nhảy vài khung đầu.
9. **Bản đóng gói Remotion bị nhớ suốt đời tiến trình.** Kết quả `bundle()` được giữ trong một biến cấp mô-đun để không phải dựng lại mỗi lần kết xuất. Ở chế độ phát triển, tiến trình sống lâu hơn nhiều lần sửa mã, nên bản đóng gói cũ vẫn được dùng và video ra đúng như mã lúc khởi động máy chủ, không có dấu hiệu nào báo. Vì thế ở chế độ phát triển bộ nhớ đệm được đánh khóa theo dấu vân tay thời gian sửa và kích thước của mọi tệp trong `nodes/remotion-engine`; ở bản production mã nguồn không đổi nên vẫn dựng một lần.
10. **Trình phát Remotion và cảnh mờ dần từ đen.** Khung 0 của một cảnh mở đầu bằng fade-in là màn đen, nên ảnh đại diện của trình phát sẽ trống. Node Xuất Bản Video mount trình phát với `initialFrame` lùi vài khung (giới hạn dưới tổng số khung) để khung đầu hiển thị nội dung.
