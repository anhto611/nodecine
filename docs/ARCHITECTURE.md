# Kiến trúc Hệ thống NodeCine (System Architecture) - v0.1

Tài liệu này mô tả phần khung lõi; gói bản mẫu chỉ xuất hiện ở cây thư mục. Nó trả lời câu hỏi mà các tài liệu còn lại không trả lời: mã nguồn chạy ở đâu, ranh giới giữa máy khách và máy chủ nằm chỗ nào, và tại sao một sản phẩm tuyên bố Zero-Auth vẫn cần phần máy chủ.

---

## 1. Mô hình Triển khai (Deployment Topology)

NodeCine v0.1 là một ứng dụng Next.js duy nhất, người dùng tự tải mã nguồn về và tự chạy trên máy của mình.

```
Máy của người dùng
├─ Trình duyệt (Chromium)
│   └─ Studio UI: canvas đồ thị, bộ máy thực thi, trình phát trong khối,
│                 (v0.2: kho khóa API trong bộ nhớ cục bộ)
│        │
│        │  HTTP trên localhost
│        ▼
└─ Tiến trình Node của Next.js
    ├─ Điểm cuối truy xuất repo   → GitHub REST API
    ├─ Điểm cuối AI Đạo Diễn      → tiến trình con: Claude Code CLI đã đăng nhập
    ├─ Điểm cuối giọng đọc        → tiến trình con: bộ tổng hợp hệ điều hành + ffmpeg
    ├─ Điểm cuối kết xuất         → Remotion Renderer → headless Chromium
    └─ Phục vụ tệp tạm            → tệp MP3 và MP4 đã tạo
```

Không có thành phần nào do đội ngũ NodeCine vận hành nằm trên đường đi này. "Máy chủ" ở đây luôn là tiến trình chạy trên chính máy người dùng.

### 1.1. Vì sao vẫn cần phần máy chủ

Có đúng ba việc trình duyệt không làm được, và đó là toàn bộ lý do tồn tại của tầng máy chủ:

1. Kết xuất MP4. Remotion kết xuất bằng cách điều khiển một tiến trình headless Chromium chụp từng khung hình rồi ghép qua FFmpeg. Đây là công việc của hệ điều hành, không thể thực hiện trong một tab trình duyệt.
2. Sinh tiến trình con. Ở v0.1 mô hình ngôn ngữ đi qua công cụ dòng lệnh Claude Code đã đăng nhập, giọng đọc đi qua bộ tổng hợp của hệ điều hành và ffmpeg. Trình duyệt không thể sinh tiến trình.
3. Vượt rào chắn nguồn gốc chéo cho GitHub API, và ở v0.2 giữ khóa API của các nhà cung cấp qua mạng không lộ trong mã nguồn trang.

### 1.2. Ranh giới máy khách và máy chủ

| Thành phần | Nơi chạy | Ghi chú |
| --- | --- | --- |
| Canvas đồ thị và giao diện Studio | Máy khách | Không có logic nghiệp vụ |
| Bộ máy thực thi đồ thị | Máy khách | Điều phối thứ tự chạy, giữ trạng thái, quyết định dùng lại kết quả |
| Logic đóng gói Bản Đặc Tả Video Trung Gian | Máy khách | Hàm thuần, không có tác dụng phụ |
| Lệnh gọi GitHub | Máy chủ cục bộ | Lớp chuyển tiếp, không giữ trạng thái |
| Gọi Claude Code CLI, gọi bộ tổng hợp giọng nói | Máy chủ cục bộ | Sinh tiến trình con theo quy tắc an toàn tại Hợp đồng Lõi mục 9 |
| `probe()` của các khối tài nguyên | Máy chủ cục bộ | Kiểm tra tệp thực thi, phiên đăng nhập, ffmpeg |
| Kết xuất MP4, do Khối Xuất MP4 kích hoạt | Máy chủ cục bộ | Tiến trình chạy dài, có báo tiến độ và hủy |
| Remotion Player trong Khối Video Output | Máy khách | Không tiêu tốn tài nguyên kết xuất |

Bộ máy thực thi nằm ở phía máy khách là một quyết định có chủ đích. Nó cho phép trạng thái từng khối phản ánh tức thời lên giao diện mà không cần một kênh đồng bộ ngược từ máy chủ, và giữ cho tầng máy chủ hoàn toàn không có trạng thái, nhờ đó dễ kiểm thử và dễ thay thế.

---

## 2. Cấu trúc Thư mục & Quy tắc Phụ thuộc

```
nodecine/
├─ app/
│  ├─ page.tsx                    Trang Studio duy nhất
│  ├─ layout.tsx
│  └─ api/
│     ├─ packs/[pack]/[op]/route.ts  RPC chung cho gói: chuyển tiếp tới handler mà gói đã đăng ký (Truy Xuất Repo đi qua đây)
│     ├─ director/route.ts        Gọi nhà cung cấp mô hình ngôn ngữ theo LLMRef
│     ├─ tts/route.ts             Gọi nhà cung cấp giọng đọc theo TTSRef
│     ├─ providers/probe/route.ts Kiểm tra sẵn sàng cho các khối tài nguyên
│     ├─ media/[...path]/route.ts Phục vụ tệp trong thư mục tệp tạm, chỉ đọc
│     └─ render/route.ts          Kết xuất MP4 và báo tiến độ
├─ core/                          Tầng lõi, không phụ thuộc React và engine
│  ├─ types/                      Kiểu cổng, lược đồ dữ liệu, Bản đặc tả IR
│  ├─ nodes/                      Chín khối lõi: cổng, tham số, hàm chạy
│  ├─ engine/                     Bộ máy thực thi đồ thị, chữ ký khối, bộ nhớ đệm
│  ├─ assembler/                  Phân bổ khung hình theo trọng số, đè dữ kiện, kiểm định IR
│  ├─ scenes/                     Scene registry rỗng + kiểu cảnh core/title-card (lược đồ props)
│  ├─ packs/handlers.ts           Registry rỗng cho handler máy chủ của gói: (pack, op) → hàm
│  ├─ templates/registry.ts       Registry đồ thị mẫu: templateId → hàm tạo Graph; lõi đăng ký Kịch Bản Tĩnh, gói đăng ký của gói
│  ├─ text/detect-language.ts     Nhận diện ngôn ngữ theo hệ chữ, dùng bởi Kịch Bản Tĩnh
│  ├─ adapters/                   CHỈ giao diện Adapter và registry rỗng; không có lớp cài đặt nào ở đây
│  │  ├─ types.ts                 EngineAdapter, probe / mountPlayer / render
│  │  └─ registry.ts              engineId → factory; các gói engines/ tự đăng ký lúc khởi động
│  └─ providers/                  CHỈ giao diện Provider và registry rỗng
│     ├─ types.ts
│     └─ registry.ts              providerId → factory
├─ engines/                       Cài đặt cụ thể, được phép phụ thuộc React và engine
│  ├─ remotion/
│  │  ├─ adapter.ts               Cài đặt EngineAdapter cho Remotion, đăng ký vào core registry
│  │  ├─ Root.tsx                 Composition generic: tra scene registry cho từng cảnh
│  │  ├─ scenes/TitleCard.tsx     Renderer Remotion cho core/title-card
│  │  └─ fonts/                   JetBrains Mono, đóng gói cục bộ (OFL 1.1), dùng chung với giao diện
│  └─ hyperframes/                Bộ chạy Canvas 2D: xem trước thật, chưa xuất tệp
│     ├─ adapter.ts               Adapter đẳng hình, probe khai báo preview sẵn sàng
│     ├─ player.client.ts         Canvas + thẻ âm thanh + vòng lặp khung hình, có thanh điều khiển riêng
│     ├─ draw.ts, types.ts        Hợp đồng renderer: một hàm vẽ lên canvas, và các tiện ích chung
│     └─ scenes/                  Renderer cho kiểu cảnh của lõi
├─ providers/                     Cài đặt cụ thể của nhà cung cấp, được phép sinh tiến trình
│  ├─ installed.ts                Mô tả nhà cung cấp cho cả hai phía: tên, các trường tham số, mặc định
│  ├─ installed.server.ts         Đăng ký factory, chỉ chạy trên máy chủ
│  ├─ claude-code/index.ts        Gọi CLI đã đăng nhập
│  ├─ piper/index.ts             Giọng máy học chạy cục bộ, chung một đường trên mọi hệ điều hành
│  └─ system-tts/index.ts         macOS say + ffmpeg
├─ packs/                         Gói bản mẫu và toàn bộ dây nối tới chúng
│  ├─ installed.ts                Danh sách gói duy nhất mà ứng dụng đọc
│  ├─ installed.client.ts         Thân khối và renderer cho Studio
│  ├─ installed.remotion.ts       Renderer mà bundle kết xuất cần nạp lại
│  └─ github-showcase/
│     ├─ index.ts                 Đăng ký khối (đẳng hình, chạy cả hai phía)
│     ├─ constants.ts             PACK_ID, phiên bản; không nhập gì
│     ├─ parse-source.ts, facts.ts  Nhận diện link repo, dựng dữ kiện; hàm thuần, có test
│     ├─ nodes/{github-fetcher,ai-director}.ts
│     ├─ server/                  Handler máy chủ (gọi GitHub), đăng ký vào core/packs/handlers
│     ├─ ui/                      Thân khối và metadata thư viện, đăng ký lúc khởi động máy khách
│     ├─ scenes/schemas.ts        Lược đồ props ba kiểu cảnh, đăng ký vào scene registry
│     ├─ remotion/{Hook,Mockup,Cta}.tsx  Renderer Remotion, đăng ký qua registerSceneRenderer; engines/remotion/renderers.ts gọi vào
│     └─ template.ts              Đồ thị mẫu 10 khối, đăng ký vào core/templates/registry
├─ components/                    Thành phần giao diện Studio
├─ locales/                       Từ điển chuỗi hiển thị
└─ docs/
```

Quy ước ngôn ngữ trong kho mã: mã nguồn, chú thích, tên kiểm thử, thông điệp lỗi nội bộ và tệp README ở gốc kho đều bằng tiếng Anh, vì dự án công khai cho cộng đồng toàn cầu. Chuỗi hiển thị cho người dùng không bao giờ nằm trong mã mà đi qua từ điển `locales/`. Bộ tài liệu thiết kế trong `docs/` giữ tiếng Việt.

Quy tắc phụ thuộc bắt buộc, kiểm tra được bằng công cụ phân tích tĩnh:

- `core/` không được phép nhập bất cứ thứ gì từ `engines/`, `providers/`, `packs/`, `app/` hay `components/`. Nó chỉ chứa giao diện Adapter, Provider, kiểu cảnh cùng ba registry rỗng; các lớp cài đặt cụ thể nằm ngoài lõi và tự đăng ký vào registry ở thời điểm khởi động ứng dụng. Nếu quy tắc này bị vi phạm, tuyên bố độc lập engine trở thành lời nói suông và Hyperframes Adapter sẽ không bao giờ cài đặt được.
- `engines/*`, `providers/*` và `packs/*` được nhập giao diện và kiểu từ `core/`, và được nhập thư viện của riêng chúng như Remotion hay React; `core/` không bao giờ nhập ngược lại. Một gói đăng ký renderer cho một engine qua scene registry, không nhập Adapter của engine đó.
- `components/` được nhập từ `core/`, nhưng `core/` không bao giờ nhập ngược lại. Trình phát Remotion là một component do `engines/remotion/` cung cấp qua `mountPlayer()`, tầng giao diện chỉ gọi hàm đó chứ không nhập Remotion trực tiếp.
- Chỉ `app/api/` được phép thực hiện lệnh gọi mạng ra ngoài. Các hàm chạy khối trong `core/nodes/` gọi tới điểm cuối cục bộ của chính ứng dụng, không gọi thẳng nhà cung cấp.

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

Ở v0.1 ứng dụng không giữ bất kỳ thông tin đăng nhập nào:

- Khối Claude Code Provider gọi tệp thực thi `claude` đang có trên máy. Phiên đăng nhập thuộc về công cụ đó, nằm ở nơi công cụ đó tự lưu; NodeCine không đọc, không sao chép, không chuyển tiếp nó. `probe()` chỉ hỏi công cụ "có đăng nhập chưa" và nhận câu trả lời có hoặc không.
- Khối System TTS Provider gọi bộ tổng hợp của hệ điều hành, không có khái niệm đăng nhập.
- GitHub API dùng hạn mức ẩn danh theo địa chỉ IP. Người dùng có thể đặt biến môi trường chứa mã thông báo GitHub để nâng hạn mức; đây là tùy chọn, không bắt buộc.

Khi các khối Nhà Cung Cấp qua API xuất hiện ở v0.2, quy tắc sau áp dụng:

1. Người dùng nhập khóa trong cửa sổ Cài đặt. Khóa được ghi vào bộ nhớ cục bộ của trình duyệt, tách khỏi tài liệu dự án.
2. Khối Nhà Cung Cấp chỉ giữ một định danh trỏ tới khóa, không giữ khóa. Tệp dự án chia sẻ ra ngoài vì thế không bao giờ chứa khóa.
3. Khi một khối cần khóa, bộ máy thực thi đọc khóa ra và gửi kèm trong phần thân yêu cầu tới điểm cuối cục bộ tương ứng. Điểm cuối loại bỏ khóa ngay khi yêu cầu kết thúc, không ghi nhật ký, không ghi ra đĩa.
4. Khóa lấy từ biến môi trường của tiến trình máy chủ được ưu tiên hơn khóa gửi từ máy khách.

Quy tắc ghi nhật ký, áp dụng ngay từ v0.1: mọi thông báo lỗi chuyển ngược về máy khách phải được lọc bỏ chuỗi giống khóa hoặc mã thông báo trước khi gửi, kể cả khi tiến trình con vô tình in chúng ra.

## 5. Bảo vệ Điểm Cuối Chuyển Tiếp

Tầng máy chủ nhận đường dẫn từ máy khách rồi đi gọi ra ngoài, nên nó là một điểm cần phòng vệ ngay cả khi chỉ chạy trên máy cá nhân. Nếu người dùng mở một đồ thị do người khác chia sẻ, đường dẫn trong đồ thị đó là dữ liệu không đáng tin.

- Máy khách không bao giờ gửi đường dẫn: khối Truy Xuất Repo tách cặp tên chủ sở hữu và tên repo ngay trên máy khách, chỉ cặp đó đi qua `POST /api/packs/github-showcase/fetch-repo`. Máy chủ kiểm tra lại cặp này bằng biểu thức chính quy rồi tự dựng mọi đường dẫn gọi ra trên hai máy chủ cố định `api.github.com` và `raw.githubusercontent.com`; vì thế không tồn tại cách nào để một đồ thị chia sẻ khiến máy này gọi tới địa chỉ nội bộ hay dải riêng.
- Điểm cuối RPC của gói (`/api/packs/<pack>/<op>`) chỉ nhận hai đoạn đường dẫn chữ thường và gạch ngang, tra trong registry `core/packs/handlers`; gói chưa đăng ký thì 404. Lỗi `NodeError` được trả về nguyên mã, thông báo và cờ thử lại để khối hiện đúng.
- Điểm cuối kết xuất chỉ nhận Bản Đặc Tả Video Trung Gian đã qua kiểm định lược đồ, và chỉ chấp nhận đường dẫn âm thanh trỏ vào chính thư mục tệp tạm của ứng dụng.
- Các điểm cuối sinh tiến trình con tuân thủ quy tắc tại Hợp đồng Lõi mục 9: đối số dạng mảng, nội dung qua đầu vào chuẩn, đường dẫn tệp thực thi không lấy từ tệp dự án.

---

## 6. Vòng đời Tệp Tạm

Định dạng thống nhất của mọi đường dẫn tệp tạm chảy qua đồ thị: đường dẫn HTTP tương đối với gốc ứng dụng, dạng `/api/media/<mã băm>.<đuôi>`. Máy khách dùng thẳng đường dẫn này cho thẻ âm thanh và trình phát. Máy chủ, khi cần đường dẫn hệ tệp (đo thời lượng, chuyển mã), ánh xạ ngược từ mã băm sang tệp trong thư mục tệp tạm; khi tiến trình kết xuất cần nạp, nó dùng đường dẫn tuyệt đối `http://127.0.0.1:<cổng>/api/media/...` vì headless Chromium nạp qua HTTP như một trình duyệt bình thường. Không nơi nào trong Bản Đặc Tả Video Trung Gian chứa đường dẫn hệ tệp tuyệt đối, nên bản đặc tả có thể chia sẻ mà không lộ cấu trúc thư mục máy người dùng. Điểm cuối media chỉ phục vụ tệp nằm trong thư mục tệp tạm, từ chối mọi đường dẫn chứa thành phần đi lên thư mục cha, và chỉ cho phép đọc.

- Tệp âm thanh và tệp video được ghi vào một thư mục tệp tạm nằm trong thư mục làm việc của dự án, đặt tên theo mã băm nội dung để hai lần chạy giống hệt nhau dùng lại đúng một tệp.
- Thư mục này nằm trong danh sách bỏ qua của hệ thống quản lý phiên bản.
- Ứng dụng dọn các tệp cũ hơn 24 giờ vào lúc khởi động. Ở v0.1 không có tiến trình dọn dẹp chạy nền.

---

## 7. Kết xuất MP4: Trình tự Chi tiết

1. Người dùng bấm Kết xuất trên Khối Xuất MP4; máy khách gửi Bản Đặc Tả Video Trung Gian, định danh engine và tham số kết xuất tới điểm cuối kết xuất.
2. Máy chủ kiểm định lược đồ và số hiệu phiên bản của bản đặc tả, từ chối sớm nếu không khớp.
3. Máy chủ đóng gói mã nguồn Remotion, khởi chạy headless Chromium, và kết xuất Composition với bản đặc tả làm thuộc tính đầu vào.
4. Tiến độ được đẩy ngược về máy khách theo dòng sự kiện, hiển thị dưới dạng phần trăm trên thân Khối Xuất MP4, kèm dòng nhật ký đổ vào Panel Nhật ký.
5. Khi hoàn tất, máy chủ trả về đường dẫn tệp và dung lượng; máy khách kích hoạt tải xuống và hiện nút Tải xuống trên khối.
6. Nếu thất bại, máy chủ trả về mã lỗi kèm phần đuôi nhật ký kết xuất. Bản Đặc Tả Video Trung Gian ở phía máy khách được giữ nguyên để thử lại ngay mà không phải chạy lại luồng.

Điểm cần lưu ý khi cài đặt: bước đóng gói mã nguồn Remotion mất vài giây và có thể dùng lại giữa các lần kết xuất. Nên giữ kết quả đóng gói trong bộ nhớ đệm theo mã băm của mã nguồn để lần kết xuất thứ hai trở đi nhanh hơn đáng kể.

---

## 8. Ghi chú Cài đặt: Cạm bẫy Đã biết

Những điểm dưới đây không đổi thiết kế nhưng sẽ chặn tiến độ nếu không dự trù.

1. **Trình phát Remotion bên trong khối React Flow.** React Flow áp `transform: translate() scale()` lên toàn bộ viewport, nên mọi thao tác kéo trong thân khối (thanh trượt, nút phát) phải nằm trong phần tử mang các lớp `nodrag`, `nopan` và `nowheel` của React Flow; nếu không, kéo thanh trượt sẽ kéo cả canvas và cuộn để tua sẽ thu phóng. Khung phát giữ tỷ lệ 9:16 bằng CSS `aspect-ratio`, kích thước bố cục cố định, để trình phát tự co theo mức thu phóng của canvas mà không phải tính lại. Trình phát được mount vào một React root lồng riêng (adapter không phụ thuộc cây React của Studio); root lồng phải được gỡ **bất đồng bộ** (`setTimeout`) vì cleanup của effect chạy khi React đang render, và phần tử chứa phải đổi `key` theo IR để root mới không dùng chung phần tử với root cũ chưa kịp gỡ.
2. **`@remotion/bundler` và `@remotion/renderer` trong route handler của Next.js.** Hai gói này mang webpack riêng và tệp nhị phân gốc; nếu để Next.js đóng gói chúng sẽ gặp lỗi không tìm thấy module hoặc xung đột nhị phân. Bắt buộc khai báo `serverExternalPackages: ['@remotion/bundler', '@remotion/renderer']` trong `next.config`. Turbopack ở chế độ dev có thể không tương thích; nếu gặp, chạy `next dev --webpack`. Kết quả đóng gói giữ trong bộ nhớ đệm theo mã băm mã nguồn như mục 7.
3. **Claude Code CLI có quyền đọc tệp và dùng công cụ.** Chạy `claude -p` trong thư mục dự án nghĩa là mô hình có thể đọc mã nguồn và gọi công cụ. Provider `claude-code` bắt buộc sinh tiến trình với thư mục làm việc là một thư mục tạm rỗng, tắt toàn bộ công cụ qua tham số dòng lệnh, giới hạn một lượt, và chỉ đọc trường kết quả. Đây là phần bổ sung cho quy tắc an toàn tiến trình con tại Hợp đồng Lõi mục 9.
4. **Giấy phép Remotion.** Remotion là mã nguồn mở có điều kiện: miễn phí cho cá nhân và tổ chức nhỏ, tổ chức lớn hơn cần giấy phép công ty. NodeCine là mã nguồn mở và không phân phối lại Remotion, nhưng người dùng là công ty tự chịu trách nhiệm về giấy phép của họ; ghi rõ trong tệp README của kho mã.
5. **React Flow chỉ chạy phía máy khách.** Trang Studio và mọi thành phần chứa canvas phải là client component; tầng `core/` không được nhập từ chúng, đúng quy tắc mục 2.
6. **Bộ đóng gói Remotion không biết bí danh `@/` của Next.js.** `@remotion/bundler` dùng webpack riêng, không đọc `tsconfig.paths`, nên mọi `import '@/core/...'` bên trong entry của video sẽ lỗi "module not found" lúc kết xuất dù `next dev` chạy bình thường. Adapter phía máy chủ phải truyền `webpackOverride` thêm `resolve.alias['@'] = process.cwd()` khi gọi `bundle()`; kiểm thử kết xuất thật (không chỉ typecheck) là cách duy nhất bắt được lỗi này.
7. **Mã máy chủ của Remotion không được kéo React vào route handler.** `@remotion/renderer` chạy trong Node và không cần React, nhưng nếu route handler nhập gián tiếp một tệp có `import { ... } from 'remotion'` (ví dụ để lấy hằng số `COMPOSITION_ID`), Next.js sẽ báo "Remotion requires React.createContext". Hằng số dùng chung phải nằm trong một mô-đun không nhập `remotion`/`react`; phần đăng ký trình kết xuất cảnh chỉ chạy ở máy khách và bên trong bundle.
8. **Phông chữ của video phải đóng gói cục bộ.** Ba kiểu cảnh và cảnh lõi đều khai JetBrains Mono. Nếu chỉ khai tên phông, máy nào không cài sẽ kết xuất bằng phông monospace mặc định và ra khung hình khác, tức là kết quả không tái lập được. Tệp `woff2` nằm trong `public/fonts` kèm giấy phép OFL 1.1, được phục vụ như tệp âm thanh: trình phát nạp theo đường dẫn tương đối, bản kết xuất không đầu nạp theo `mediaBaseUrl` tuyệt đối. Thành phần video giữ khung đầu bằng `delayRender` cho tới khi phông sẵn sàng, nếu không chữ sẽ nhảy vài khung đầu.
9. **Bản đóng gói Remotion bị nhớ suốt đời tiến trình.** Kết quả `bundle()` được giữ trong một biến cấp mô-đun để không phải dựng lại mỗi lần kết xuất. Ở chế độ phát triển, tiến trình sống lâu hơn nhiều lần sửa mã, nên bản đóng gói cũ vẫn được dùng và video ra đúng như mã lúc khởi động máy chủ, không có dấu hiệu nào báo. Vì thế ở chế độ phát triển bộ nhớ đệm được đánh khóa theo dấu vân tay thời gian sửa và kích thước của mọi tệp trong `engines/remotion`, `packs` và `core/scenes`; ở bản production mã nguồn không đổi nên vẫn dựng một lần.
10. **Trình phát Remotion và cảnh mờ dần từ đen.** Khung 0 của một cảnh mở đầu bằng fade-in là màn đen, nên ảnh đại diện của trình phát sẽ trống. Khối Xuất Bản Video mount trình phát với `initialFrame` lùi vài khung (giới hạn dưới tổng số khung) để khung đầu hiển thị nội dung.
