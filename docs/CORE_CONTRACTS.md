# Hợp đồng Lõi (Core Contracts) - v0.1

Tài liệu này định nghĩa phần **khung** của NodeCine: những hợp đồng mà mọi khối, mọi gói bản mẫu và mọi engine đều phải tuân theo, và không chứa bất kỳ chi tiết nào của một bản mẫu cụ thể. Chi tiết của bản mẫu đầu tiên nằm ở `packs/github-showcase.md`.

Nguyên tắc phân tầng: **lõi định nghĩa hình dạng, gói định nghĩa nội dung.** Lõi biết có "cảnh" nhưng không biết cảnh Hook là gì; biết có "dữ kiện" nhưng không biết số sao GitHub là gì. Mọi thứ lõi không biết đều được tra qua registry, cùng một pattern cho engine, nhà cung cấp và kiểu cảnh.

Tài liệu liên quan: Kiến trúc Hệ thống mô tả nơi từng phần thực thi; Đặc tả Bộ Máy Thực Thi mô tả cách đồ thị được chạy.

---

## 1. Hệ Thống Kiểu Cổng & Giao thức Gói Dữ Liệu

### 1.1. Kiểu cổng

Mỗi cổng mang đúng một định danh kiểu. Một dây nối chỉ được phép tạo khi định danh kiểu ở cổng xuất trùng khớp tuyệt đối với định danh kiểu ở cổng nhận. Không có cơ chế ép kiểu ngầm. Lõi định nghĩa chín kiểu; gói bản mẫu không được thêm kiểu cổng mới ở v0.1, chỉ được định nghĩa hình dạng cụ thể của `payload` bên trong các kiểu có sẵn.

| Định danh kiểu | Nhãn hiển thị | Ý nghĩa | Khối lõi phát | Khối lõi nhận |
| --- | --- | --- | --- | --- |
| `SourceRef` | Dữ liệu Nguồn | Chuỗi người dùng nhập, chưa diễn giải | Nhập Liệu | Khối truy xuất của gói |
| `FactSheet` | Dữ kiện | Tập dữ kiện kiểm chứng được, có nguồn gốc | Khối truy xuất của gói | Khối đạo diễn của gói, Đóng Gói Timeline |
| `DirectorPlan` | Kịch bản Phân cảnh | Danh sách cảnh kèm trọng số và props | Kịch Bản Tĩnh, khối đạo diễn của gói | Đóng Gói Timeline |
| `AudioScript` | Lời thoại | Văn bản thuyết minh kèm ngôn ngữ | Kịch Bản Tĩnh, khối đạo diễn của gói | Giọng Đọc |
| `Voiceover` | Âm thanh & Thời lượng | Tệp âm thanh đã đo thời lượng | Giọng Đọc | Đóng Gói Timeline |
| `VideoIR` | Bản đặc tả IR | Bản Đặc Tả Video Trung Gian | Đóng Gói Timeline | Xuất Bản Video, Xuất MP4 |
| `EngineRef` | Động cơ | Tham chiếu tới một Adapter | Động Cơ | Xuất Bản Video, Xuất MP4 |
| `LLMRef` | Mô hình ngôn ngữ | Tham chiếu tới nhà cung cấp mô hình | Nhà Cung Cấp Mô Hình Ngôn Ngữ | Khối đạo diễn của gói |
| `TTSRef` | Giọng đọc | Tham chiếu tới nhà cung cấp giọng | Nhà Cung Cấp Giọng Đọc | Giọng Đọc |

Một cổng xuất được phép nối ra nhiều cổng nhận. Một cổng nhận chỉ được phép có đúng một dây nối tới. Đồ thị bắt buộc không có chu trình. Khối tài nguyên (ba loại phát `EngineRef`, `LLMRef`, `TTSRef`) không có cổng nhận nào.

### 1.2. Gói dữ liệu qua dây nối

- `sourceNodeId`: Định danh chuỗi duy nhất của khối gửi dữ liệu.
- `sourcePort`, `targetPort`: Tên định danh của cổng phát và cổng nhận.
- `payloadType`: Định danh kiểu lấy từ bảng ở mục 1.1, dùng để kiểm tra lại lúc chạy.
- `timestamp`: Mốc thời gian mili-giây lúc phát.
- `payload`: Đối tượng dữ liệu nghiệp vụ, phải tuần tự hóa được thành JSON.
- `contentHash`: Chuỗi băm ổn định tính từ `payload`, cơ sở của cơ chế chạy lại từng phần.

Gói tin chỉ mang dữ liệu thành công. Trạng thái lỗi không đi qua dây nối mà được ghi vào trạng thái của chính khối phát sinh lỗi.

---

## 2. Payload của Các Kiểu Cổng Lõi

### 2.1. `SourceRef`

- `value` (Chuỗi): Nội dung người dùng nhập, đã cắt khoảng trắng hai đầu. Khối Nhập Liệu không diễn giải giá trị; việc nhận diện đó là đường dẫn, mã định danh hay văn bản thô thuộc về khối truy xuất của gói nhận nó.

### 2.2. `FactSheet`

- `facts` (Đối tượng khóa-giá trị): Các dữ kiện kiểm chứng được, khóa do gói định nghĩa. Giá trị là chuỗi, số, `null` hoặc danh sách chuỗi.
- `sourceLabel` (Chuỗi): Nguồn gốc để hiển thị, ví dụ `github.com/owner/name`.
- `fetchedAt` (Chuỗi ISO 8601): Mốc thời gian lấy dữ kiện.
- `mode` (Chuỗi phân loại): `fetched` khi đã gọi nguồn ngoài, `passthrough` khi chỉ đóng gói lại văn bản người dùng.

Quy ước cốt lõi: mọi giá trị trong `facts` có nguồn gốc xác định và **không bao giờ do mô hình ngôn ngữ sinh ra**. Lõi bảo vệ quy ước này bằng cấu trúc: `FactSheet` được nối thẳng vào Khối Đóng Gói Timeline và đè lên props theo `factBindings` (mục 2.3), nên dữ kiện không cần đi qua khối đạo diễn để tới được video.

### 2.3. `DirectorPlan`

- `language` (Chuỗi, mã BCP 47): Ngôn ngữ của toàn bộ chữ trên màn hình và lời thoại.
- `theme` (Chuỗi): Định danh chủ đề thị giác do gói định nghĩa, Adapter dùng để chọn bảng màu và font. Lõi không quy định giá trị.
- `scenes` (Danh sách, ít nhất một phần tử):
  - `sceneType` (Chuỗi): Định danh kiểu cảnh có tiền tố gói, ví dụ `core/title-card` hoặc `github-showcase/hook`. Tra trong scene registry (mục 4).
  - `weight` (Số dương): Trọng số thời lượng tương đối. Đóng Gói Timeline chia tổng số khung hình theo tỷ lệ các trọng số.
  - `props` (Đối tượng): Nội dung hiển thị của cảnh, hình dạng do kiểu cảnh quy định.
  - `factBindings` (Đối tượng, tùy chọn): Ánh xạ `tênProp → khóaTrongFacts`. Đóng Gói Timeline đè `facts[khóa]` lên `props[tênProp]`; dữ kiện luôn thắng. Thiếu khóa trong `facts` thì prop giữ nguyên.

### 2.4. `AudioScript`

- `text` (Chuỗi): Lời thoại thuyết minh.
- `language` (Chuỗi, mã BCP 47): Trùng với `DirectorPlan.language` của cùng lần chạy.

### 2.5. `Voiceover`

- `audioUrl` (Chuỗi): Luôn ở dạng `/api/media/<mã băm>.mp3` tương đối với gốc ứng dụng, theo Kiến trúc Hệ thống mục 6. Không bao giờ là đường dẫn hệ tệp.
- `durationSeconds` (Số, hai chữ số thập phân): Đo lại từ chính tệp đã tạo, không lấy ước lượng của nhà cung cấp.
- `voiceName`, `language`, `speed`: Giọng đã dùng, ngôn ngữ của giọng đó (khác `AudioScript.language` nghĩa là đã dùng giọng dự phòng và phải kèm cảnh báo), hệ số tốc độ đã áp dụng.

---

## 3. Bản Đặc Tả Video Trung Gian (Universal Video IR)

Cấu trúc duy nhất do Khối Đóng Gói Timeline tạo ra, độc lập với engine **và độc lập với gói bản mẫu**. Đây là ranh giới giữa phần dựng nội dung và phần kết xuất.

- `irVersion` (Số nguyên): Phiên bản lược đồ, hiện là `1`. Adapter từ chối nạp phiên bản không hỗ trợ.
- `meta`:
  - `title` (Chuỗi), `language` (Chuỗi BCP 47), `theme` (Chuỗi): Lấy từ `DirectorPlan`.
  - `fps` (Số nguyên): Mặc định 30, do tham số của Khối Đóng Gói Timeline.
  - `width`, `height` (Số nguyên): Mặc định 1080 và 1920.
  - `totalDurationInFrames` (Số nguyên).
- `audioTrack`:
  - `voiceoverUrl` (Chuỗi): Cùng định dạng với `Voiceover.audioUrl`.
  - `durationSeconds` (Số).
  - `padTailFrames` (Số nguyên): Số khung hình sau khi âm thanh đã hết; lớn hơn 0 khi ngưỡng tối thiểu được kích hoạt. Hình vẫn chạy còn tiếng đã hết là hành vi có chủ đích.
- `timeline` (Danh sách, ít nhất một phần tử):
  - `id` (Chuỗi): Duy nhất trong bản đặc tả.
  - `sceneType` (Chuỗi): Sao chép từ `DirectorPlan`.
  - `startFrame`, `durationInFrames` (Số nguyên).
  - `props` (Đối tượng): Đã đè dữ kiện theo `factBindings`.

### 3.1. Bất biến do lõi kiểm định

Lõi có một hàm kiểm định IR chạy ở Khối Đóng Gói Timeline trước khi phát và ở mọi Adapter trước khi nạp. Bản đặc tả không qua được kiểm định thì không bao giờ ra khỏi khối. Bất biến:

1. `timeline[0].startFrame` bằng 0.
2. Với mọi cảnh kế tiếp, `startFrame` bằng `startFrame` cộng `durationInFrames` của cảnh trước; không có khe hở, không chồng lấn.
3. Tổng `durationInFrames` bằng đúng `meta.totalDurationInFrames`.
4. Không cảnh nào có `durationInFrames` bằng 0.
5. Mọi `sceneType` đều có trong scene registry.

Đây là bất biến cốt lõi số 3 của toàn dự án, được kiểm tra bằng mã chứ không bằng quy ước.

---

## 4. Scene Registry: Cách Lõi Không Cần Biết Cảnh Là Gì

Cùng pattern với registry của Adapter và Provider: tầng lõi giữ một bảng rỗng `sceneType → { engineId → renderer }`, các gói tự đăng ký lúc khởi động.

- Mỗi gói bản mẫu khai báo các kiểu cảnh của nó cùng lược đồ `props` (Zod) và một renderer cho mỗi engine nó hỗ trợ. Renderer cho Remotion là một component React; cho Hyperframes là một hàm vẽ Canvas.
- Lõi có sẵn một kiểu cảnh tối thiểu để khung chạy được mà không cần gói nào: `core/title-card` với `props` gồm `headline` (bắt buộc), `subline` và `accentColor` (tùy chọn). Kiểu cảnh này có renderer cho mọi engine mà lõi ship.
- Khối Xuất Bản Video và Khối Xuất MP4, trước khi nạp, tra từng `sceneType` trong `timeline` với `engineId` của tham chiếu đang nối vào. Thiếu renderer nào thì khối chuyển `blocked` với viền vàng và mã lý do `ENGINE_SCENE_UNSUPPORTED` kèm danh sách kiểu cảnh thiếu. Đây là cách một gói chỉ hỗ trợ Remotion vẫn sống chung với một engine khác mà không vỡ.
- Thêm bản mẫu mới không bao giờ đụng tới lược đồ IR, Adapter hay khối lõi: chỉ thêm kiểu cảnh vào registry và khối vào Thư viện.

---

## 5. Khối Lõi (Core Nodes)

Lõi ship đúng những khối cần để dựng được video từ một kịch bản gõ tay, không phụ thuộc mạng, không phụ thuộc mô hình ngôn ngữ.

### 5.1. Nhập Liệu (Input Trigger)

Ô văn bản, phát `SourceRef`. Không diễn giải, không gọi mạng. Ô trống là lỗi kiểm tra liên tục `INPUT_EMPTY`.

### 5.2. Kịch Bản Tĩnh (Static Script)

Khối duy nhất của lõi phát cả `DirectorPlan` lẫn `AudioScript`, dành cho việc dựng video hoàn toàn bằng tay và để kiểm thử khung. Tham số:

- `language` (mặc định `en`), `theme` (mặc định `core/dark`).
- `script` (Chuỗi nhiều dòng): Lời thoại, phát ra `AudioScript`.
- `scenes` (Danh sách chỉnh sửa trực tiếp trên thân khối): mỗi mục gồm `sceneType` chọn từ registry, `weight`, và các trường `props` sinh ra từ lược đồ của kiểu cảnh đã chọn. Mặc định là ba cảnh `core/title-card` trọng số 1, 2, 1.

Không có `factBindings` vì không có nguồn dữ kiện; người dùng gõ thẳng giá trị.

### 5.3. Giọng Đọc (TTS Engine)

Nhận `AudioScript` và `TTSRef`, chọn giọng khớp ngôn ngữ theo quy tắc ở mục 8.2, gọi nhà cung cấp, đo thời lượng từ tệp đã tạo, phát `Voiceover`. Tham số: `voice` (để trống là tự chọn theo ngôn ngữ), `speed`.

### 5.4. Đóng Gói Timeline (Timeline Assembler)

Nhận `DirectorPlan` và `Voiceover` (bắt buộc), `FactSheet` (tùy chọn). Tham số: `fps` (30), `width` (1080), `height` (1920), `minTotalFrames` (270). Hàm thuần, không gọi mạng, thất bại đồng nghĩa lỗi lập trình.

Quy tắc phân bổ thời lượng, tất định:

1. Số khung hình âm thanh bằng `durationSeconds × fps`, làm tròn lên.
2. Tổng số khung hình bằng giá trị lớn hơn giữa số khung hình âm thanh và `minTotalFrames`; phần chênh ghi vào `padTailFrames`.
3. Với mỗi cảnh trừ cảnh cuối: `durationInFrames` bằng phần nguyên (làm tròn xuống) của `tổng × weight / tổng các weight`. Cảnh cuối nhận toàn bộ phần còn lại. Cách này loại bỏ mơ hồ khi làm tròn giá trị nằm đúng giữa hai số nguyên, và đảm bảo tổng luôn khớp tuyệt đối theo cấu trúc chứ không theo may rủi. Trường hợp biên: nếu trọng số quá lệch và tổng khung quá nhỏ khiến phần nguyên của một cảnh bằng 0, cảnh đó nhận 1 khung và cảnh cuối bị trừ 1 khung tương ứng (tổng vẫn giữ nguyên, bất biến 4 ở mục 3.1 được bảo toàn); nếu sau khi mượn mà cảnh cuối cũng về 0, hoặc tổng khung nhỏ hơn số cảnh, khối báo lỗi lập trình thay vì tạo IR sai.
4. `startFrame` tích lũy từ 0.
5. Đè dữ kiện: với mỗi cảnh có `factBindings`, gán `props[tênProp] = facts[khóa]` cho mọi khóa có mặt trong `FactSheet.facts`. Dữ kiện luôn thắng giá trị cùng tên đã có trong `props`.
6. Chạy hàm kiểm định IR ở mục 3.1 trước khi phát.

Ví dụ đối chiếu với trọng số 1, 2, 1 và âm thanh 11.2 giây ở 30 fps: 336 khung, phân bổ 84, 168, 84, bắt đầu 0, 84, 252. Với âm thanh 7.5 giây: 225 khung nhỏ hơn 270 nên tổng là 270, `padTailFrames` 45, phân bổ 67, 135, 68. Phần dư dồn cho cảnh cuối luôn nhỏ hơn số cảnh trừ một, tức nhỏ hơn 2 khung với ba cảnh.

### 5.5. Xuất Bản Video (Video Output)

Nhận `VideoIR` và `EngineRef`. Tra scene registry (mục 4), tra adapter registry theo `engineId`, gọi `mountPlayer()`. Chính là trình phát; không có cổng phát, không có nút xuất. Giao diện chi tiết tại Đặc tả Luồng Trải nghiệm mục 1.4.

### 5.6. Xuất MP4 (MP4 Export)

Nhận `VideoIR` và `EngineRef`, bỏ qua mặc định. Tham số `ExportSettings`:

- `codec`: `h264` mặc định, `h265` tùy chọn.
- `quality`: `high` (CRF 18), `medium` (CRF 23), `low` (CRF 28); giá trị CRF là chi tiết của Adapter.
- `fileName`: Không kèm đường dẫn, mặc định theo tên dự án, ký tự không hợp lệ thay bằng gạch ngang.

Hành vi: khi đang bỏ qua, Chạy Luồng không chạm tới; bấm Kết xuất là chạy riêng khối theo Đặc tả Bộ Máy Thực Thi mục 3; nút bị vô hiệu hóa khi thiếu dây, khi `EngineRef.capabilities.render` không phải `ready`, hoặc khi thiếu renderer cho một `sceneType`. Trong lúc chạy hiện tiến độ và nút Hủy; xong hiện tên tệp, dung lượng, nút Tải xuống; kết quả gắn vào lịch sử chạy. Nhiều khối xuất trên cùng đồ thị là hợp lệ.

### 5.7. Khối tài nguyên: Động Cơ, Nhà Cung Cấp Mô Hình Ngôn Ngữ, Nhà Cung Cấp Giọng Đọc

Mô tả ở mục 6, 7 và 8. Cả ba dùng chung khuôn: không cổng nhận, một cổng phát, `run() = probe()`, tham chiếu là dữ liệu tuần tự hóa được.

---

## 6. Adapter và Khối Động Cơ

### 6.1. Giao diện Adapter

Bốn năng lực, là toàn bộ bề mặt phần còn lại của ứng dụng được biết:

- Khai báo `engineId` và tên hiển thị.
- `probe()`: trả về `capabilities` gồm `preview` và `render`, mỗi trường `ready` hoặc `unavailable` kèm `reason`.
- `mountPlayer(element, ir)`: Gắn trình phát vào một phần tử hiển thị.
- `render(ir, exportSettings, onProgress, signal)`: Kết xuất MP4, có tiến độ và hủy.

Adapter nhận IR generic và tra scene registry để lấy renderer cho từng cảnh; Adapter không biết tên bất kỳ kiểu cảnh nào của gói.

### 6.2. Cấu trúc `EngineRef`

- `engineId`, `displayName`, `adapterVersion`.
- `capabilities`: Kết quả `probe()`.
- `settings`: Tham số riêng của engine. Remotion: `concurrency` (mặc định nửa số lõi), `glBackend` (`angle` hoặc `swiftshader`). Hyperframes: rỗng ở v0.1.

Tham chiếu là dữ liệu, không phải đối tượng: không bao giờ chứa instance Adapter. Khối tiêu thụ tra `engineId` trong adapter registry của lõi để lấy instance. Registry khởi đầu rỗng; các gói `engines/*` tự đăng ký lúc khởi động, nhờ vậy lõi không nhập Remotion hay React. Chữ ký của Khối Động Cơ chỉ phụ thuộc `engineId` và `settings`.

### 6.3. Mức hỗ trợ ở v0.1

- Remotion: xem trước và kết xuất đầy đủ. Ánh xạ: `meta` vào Composition, `voiceoverUrl` vào thẻ Audio, mỗi cảnh vào một Sequence gọi renderer tra từ registry.
- Hyperframes: khung xương, `probe()` khai báo cả hai năng lực `unavailable` với lý do "v0.2". Adapter không ném lỗi. Khối tiêu thụ tự khóa theo khai báo.
- Dự phòng hiệu ứng: khi Adapter gặp hiệu ứng không dựng được, tự thay bằng mờ dần hoặc trượt và phát cảnh báo mức thông tin để giao diện hiện huy hiệu vàng. Định nghĩa sẵn, chưa Adapter nào kích hoạt ở v0.1.

---

## 7. Provider và Khối Nhà Cung Cấp Mô Hình Ngôn Ngữ

### 7.1. Cấu trúc `LLMRef`

- `providerId`: `claude-code` ở v0.1.
- `displayName`, `transport` (`cli` ở v0.1; `api` dành cho v0.2).
- `capabilities`: `installed`, `authenticated`, `structuredOutput`; mỗi trường `ready` hoặc `unavailable` kèm `reason` và, nếu có, `fix` là lệnh người dùng cần chạy. Phiên bản công cụ tìm thấy được ghi ở đây để hiển thị.
- `settings`: `model` (để trống là mặc định của công cụ), `maxTurns` cố định 1.

Đường dẫn tệp thực thi không nằm trong `LLMRef` và không nằm trên khối: đọc từ Cài đặt hoặc tự phát hiện trên `PATH` lúc `probe()`. Nhờ vậy tệp dự án và lịch sử chạy không chứa đường dẫn máy người dùng.

### 7.2. Giao diện Provider mô hình ngôn ngữ

- `probe()` như trên.
- `complete(prompt, outputSchema, signal)`: Gửi lời nhắc, nhận về một đối tượng đã kiểm định theo `outputSchema` (Zod). Với `claude-code`: chạy tệp thực thi ở chế độ in một lần với đầu ra JSON, lời nhắc qua đầu vào chuẩn, đọc trường kết quả, kiểm định; sai cấu trúc hoặc sai ngôn ngữ thì thử lại một lần với chỉ dẫn siết chặt. Lượt gọi tính vào tài khoản Claude Code của người dùng; ứng dụng không lưu thông tin đăng nhập nào. Tiến trình được sinh trong một thư mục tạm rỗng, tắt toàn bộ công cụ và giới hạn một lượt, để mô hình không đọc được mã nguồn hay tệp của người dùng; chi tiết tại Kiến trúc Hệ thống mục 8.

Khối gọi `complete()` là khối đạo diễn của gói; lõi không có khối nào gọi mô hình ngôn ngữ.

---

## 8. Provider và Khối Nhà Cung Cấp Giọng Đọc

### 8.1. Cấu trúc `TTSRef`

- `providerId`: `system-tts` ở v0.1.
- `displayName`, `transport` (`local`).
- `capabilities`: `installed` (bộ tổng hợp của hệ điều hành), `encoder` (ffmpeg).
- `voices`: Danh sách `{id, displayName, language}` lấy từ hệ điều hành lúc `probe()`.
- `settings`: `defaultVoice`, `rate`.

### 8.2. Quy tắc chọn giọng tại Khối Giọng Đọc

Nếu người dùng đã chọn một giọng khớp ngôn ngữ lời thoại, dùng giọng đó; nếu không, dùng giọng đầu tiên khớp ngôn ngữ; nếu không có giọng nào khớp, dùng `defaultVoice` và phát cảnh báo `TTS_VOICE_LANGUAGE_MISMATCH`, không dừng luồng.

Trên macOS: `say` ghi AIFF vào thư mục tệp tạm, ffmpeg chuyển sang MP3, đo thời lượng từ tệp MP3. Hệ điều hành chưa hỗ trợ thì `probe()` báo `installed: unavailable`; ứng dụng không giả vờ có giọng.

---

## 9. Quy tắc An toàn Khi Gọi Tiến trình Con

Áp dụng cho mọi Provider có `transport` là `cli` hoặc `local`, và cho tiến trình kết xuất:

- Tham số truyền dưới dạng mảng đối số, không ghép thành chuỗi cho shell diễn giải.
- Nội dung do người dùng hoặc mô hình sinh ra đi qua đầu vào chuẩn hoặc tệp tạm, không qua đối số.
- Đường dẫn tệp thực thi chỉ lấy từ tự phát hiện trên `PATH` hoặc từ Cài đặt, không bao giờ từ tệp dự án.
- Mỗi lần gọi có thời gian chờ và bị hủy cùng luồng.

---

## 10. Gói Bản Mẫu (Template Pack) Là Gì

Một gói bản mẫu là một thư mục tự đăng ký lúc khởi động, gồm:

- Các **khối** riêng của gói, dùng đúng chín kiểu cổng của lõi. Thường là một khối truy xuất phát `FactSheet` và một khối đạo diễn nhận `FactSheet` cùng `LLMRef`, phát `DirectorPlan` và `AudioScript`.
- Các **kiểu cảnh** kèm lược đồ `props` và renderer cho từng engine hỗ trợ.
- Một hoặc nhiều **đồ thị mẫu** nối sẵn, xuất hiện trong Trình duyệt Bản mẫu.
- Bài kiểm thử riêng, tối thiểu là bài "dữ kiện trong IR bằng đúng dữ kiện trong `FactSheet`".

Gói không được: thêm kiểu cổng, sửa lược đồ IR, nhập trực tiếp một engine thay vì đăng ký renderer, hay giữ trạng thái ngoài các khối của nó. Gói đầu tiên là `github-showcase`, đặc tả tại `packs/github-showcase.md`.
