# Hợp đồng Lõi (Core Contracts)

Tài liệu này định nghĩa phần **khung** của NodeCine: những hợp đồng mà mọi node, mọi block và mọi engine đều phải tuân theo, và không chứa bất kỳ chi tiết nào của một bản mẫu cụ thể. Chi tiết của bản mẫu đầu tiên nằm ở `extras/github-showcase.md`.

Nguyên tắc phân tầng: **lõi định nghĩa hình dạng, gói định nghĩa nội dung.** Lõi biết có "cảnh" nhưng không biết cảnh Hook là gì; biết có "dữ kiện" nhưng không biết số sao GitHub là gì. Mọi thứ lõi không biết đều được tra qua registry, cùng một pattern cho engine, nhà cung cấp và kiểu cảnh.

Tài liệu liên quan: Kiến trúc Hệ thống mô tả nơi từng phần thực thi; Đặc tả Bộ Máy Thực Thi mô tả cách đồ thị được chạy.

---

## 1. Hệ Thống Kiểu Cổng & Giao thức Gói Dữ Liệu

### 1.1. Kiểu cổng

Mỗi cổng mang đúng một định danh kiểu. Một dây nối chỉ được phép tạo khi định danh kiểu ở cổng xuất trùng khớp tuyệt đối với định danh kiểu ở cổng nhận. Không có cơ chế ép kiểu ngầm. Lõi định nghĩa mười một kiểu; không thứ gì ngoài lõi được thêm kiểu cổng mới, chỉ được định nghĩa hình dạng cụ thể của `payload` bên trong các kiểu có sẵn.

| Định danh kiểu | Nhãn hiển thị | Ý nghĩa | Node lõi phát | Node lõi nhận |
| --- | --- | --- | --- | --- |
| `SourceRef` | Dữ liệu Nguồn | Chuỗi người dùng nhập, chưa diễn giải | Nhập Liệu | Truy Xuất Repo, Đạo Diễn AI |
| `FactSheet` | Dữ kiện | Tập dữ kiện kiểm chứng được, có nguồn gốc | Truy Xuất Repo | Đạo Diễn AI, Đóng Gói Timeline |
| `DirectorPlan` | Kịch bản Phân cảnh | Stage, danh mục block và danh sách cảnh (block, props, tone, trọng số) — tự chứa | Kịch Bản Tĩnh, Đạo Diễn AI | Đóng Gói Timeline |
| `AudioScript` | Lời thoại | Văn bản thuyết minh kèm ngôn ngữ | Kịch Bản Tĩnh, Đạo Diễn AI | Giọng Đọc |
| `Voiceover` | Âm thanh & Thời lượng | Tệp âm thanh đã đo thời lượng | Giọng Đọc | Đóng Gói Timeline |
| `VideoIR` | Bản đặc tả IR | Bản Đặc Tả Video Trung Gian | Đóng Gói Timeline | Xuất Bản Video, Xuất MP4 |
| `EngineRef` | Động cơ | Tham chiếu tới một Adapter | Động Cơ | Xuất Bản Video, Xuất MP4 |
| `LLMRef` | Mô hình ngôn ngữ | Tham chiếu tới nhà cung cấp mô hình | Nhà Cung Cấp Mô Hình Ngôn Ngữ | Đạo Diễn AI |
| `TTSRef` | Giọng đọc | Tham chiếu tới nhà cung cấp giọng | Nhà Cung Cấp Giọng Đọc | Giọng Đọc |
| `StageDef` | Stage | Sân khấu: token thiết kế, tone, trường theo cảnh, markup bao quanh block | Stage | Đạo Diễn AI, Kịch Bản Tĩnh |
| `BlockDef` | Block | Một kiểu cảnh: props mô hình được viết, tài liệu, code vẽ | Block | Đạo Diễn AI, Kịch Bản Tĩnh — cổng `blocks` **nhiều dây** |

Một cổng xuất được phép nối ra nhiều cổng nhận. Một cổng nhận mặc định chỉ được phép có đúng một dây nối tới; cổng khai báo `multiple: true` nhận **bao nhiêu dây cũng được**, bắt buộc nghĩa là ít nhất một. Gói của cổng nhiều dây tới node dưới dạng danh sách `lists[tên cổng]` theo thứ tự dây, không phải `inputs[tên cổng]`; chữ ký chạy lại băm cả danh sách nên thêm hoặc bớt dây là node chạy lại. Cổng nhiều dây hiện có là cổng `blocks` của Đạo Diễn AI và Kịch Bản Tĩnh. Đồ thị bắt buộc không có chu trình. Node tài nguyên (ba loại phát `EngineRef`, `LLMRef`, `TTSRef`) không có cổng nhận nào.

### 1.2. Gói dữ liệu qua dây nối

- `sourceNodeId`: Định danh chuỗi duy nhất của node gửi dữ liệu.
- `sourcePort`, `targetPort`: Tên định danh của cổng phát và cổng nhận.
- `payloadType`: Định danh kiểu lấy từ bảng ở mục 1.1, dùng để kiểm tra lại lúc chạy.
- `timestamp`: Mốc thời gian mili-giây lúc phát.
- `payload`: Đối tượng dữ liệu nghiệp vụ, phải tuần tự hóa được thành JSON.
- `contentHash`: Chuỗi băm ổn định tính từ `payload`, cơ sở của cơ chế chạy lại từng phần.

Gói tin chỉ mang dữ liệu thành công. Trạng thái lỗi không đi qua dây nối mà được ghi vào trạng thái của chính node phát sinh lỗi.

---

## 2. Payload của Các Kiểu Cổng Lõi

### 2.1. `SourceRef`

- `value` (Chuỗi): Nội dung người dùng nhập, đã cắt khoảng trắng hai đầu. Node Nhập Liệu không diễn giải giá trị; việc nhận diện đó là đường dẫn, mã định danh hay văn bản thô thuộc về node truy xuất của gói nhận nó.

### 2.2. `FactSheet`

- `facts` (Đối tượng khóa-giá trị): Các dữ kiện kiểm chứng được, khóa do gói định nghĩa. Giá trị là chuỗi, số, `null` hoặc danh sách chuỗi.
- `sourceLabel` (Chuỗi): Nguồn gốc để hiển thị, ví dụ `github.com/owner/name`.
- `fetchedAt` (Chuỗi ISO 8601): Mốc thời gian lấy dữ kiện.
- `mode` (Chuỗi phân loại): `fetched` khi đã gọi nguồn ngoài, `passthrough` khi chỉ đóng gói lại văn bản người dùng.

Quy ước cốt lõi: mọi giá trị trong `facts` có nguồn gốc xác định và **không bao giờ do mô hình ngôn ngữ sinh ra**. Lõi bảo vệ quy ước này bằng cấu trúc: `FactSheet` được nối thẳng vào Node Đóng Gói Timeline và đè lên props theo `factBindings` (mục 2.3), nên dữ kiện không cần đi qua node đạo diễn để tới được video.

### 2.3. `DirectorPlan`

Tự chứa: mang theo sân khấu và mọi block mà các cảnh dùng, nên Đóng Gói Timeline, engine và tệp dự án không cần tra registry nào.

- `language` (Chuỗi, mã BCP 47): Ngôn ngữ của toàn bộ chữ trên màn hình và lời thoại.
- `stage` (`StageDef`, mục 2.6): Sân khấu của cả video, chép từ dây `stage` của node phát.
- `blocks` (Danh sách `BlockDef`, mục 2.7, ít nhất một, `id` không trùng): Danh mục block đã nối vào node phát — toàn bộ, không chỉ những block được dùng.
- `scenes` (Danh sách, ít nhất một phần tử):
  - `blockId` (Chuỗi): `id` của một block trong `blocks`. Lược đồ từ chối plan có `blockId` không nằm trong danh mục.
  - `weight` (Số dương): Trọng số thời lượng tương đối. Đóng Gói Timeline chia tổng số khung hình theo tỷ lệ các trọng số.
  - `props` (Đối tượng): Nội dung của block, hình dạng do bảng `props` của block quy định.
  - `tone` (Chuỗi, tùy chọn): Tên một tone của `stage`; bỏ trống là bảng màu gốc. Tên không có trong stage bị từ chối.
  - `fields` (Đối tượng, tùy chọn): Giá trị cho `stage.sceneFields`, theo tên.
  - `factBindings` (Đối tượng, tùy chọn): Ánh xạ `tênProp → khóaTrongFacts`. Đóng Gói Timeline đè `facts[khóa]` lên `props[tênProp]`; dữ kiện luôn thắng. Thiếu khóa trong `facts` thì prop giữ nguyên.

### 2.4. `AudioScript`

- `text` (Chuỗi): Lời thoại thuyết minh.
- `language` (Chuỗi, mã BCP 47): Trùng với `DirectorPlan.language` của cùng lần chạy.

### 2.5. `Voiceover`

- `audioUrl` (Chuỗi): Luôn ở dạng `/api/media/<mã băm>.mp3` tương đối với gốc ứng dụng, theo Kiến trúc Hệ thống mục 6. Không bao giờ là đường dẫn hệ tệp.
- `durationSeconds` (Số, hai chữ số thập phân): Đo lại từ chính tệp đã tạo, không lấy ước lượng của nhà cung cấp.
- `voiceName`, `language`, `speed`: Giọng đã dùng, ngôn ngữ của giọng đó (khác `AudioScript.language` nghĩa là đã dùng giọng dự phòng và phải kèm cảnh báo), hệ số tốc độ đã áp dụng.

### 2.6. `StageDef`

Sân khấu — cái vỏ hiển thị bền qua mọi cảnh của một workflow (xem thuật ngữ ở `README.md`). Mỗi workflow một stage.

- `id` (slug), `name`.
- `tokens.palette`, `tokens.fonts`: bản đồ tên → giá trị. Renderer phơi ra thành biến CSS `--<tên>` cho code của stage và block dùng chung (`--bg`, `--fg`, `--accent`, `--font-display`, …).
- `tones`: bản đồ tên tone → phần ghi đè bảng màu. Tên tone là giá trị mô hình được viết vào trường `tone` của cảnh.
- `sceneFields[]`: `{ name, rule, options? }` — trường theo cảnh mà stage tự vẽ (ví dụ `kicker`), kèm quy tắc dạy mô hình cách viết; `options` giới hạn giá trị.
- `code`: xem 2.8.

### 2.7. `BlockDef`

Một kiểu cảnh, mang theo dưới dạng dữ liệu; đây là thứ Đạo Diễn AI chọn cho từng cảnh.

- `id` (slug), `name`.
- `doc.example`: một ví dụ props hợp lệ dạng JSON. `doc.when`: dùng khi nào, không dùng khi nào — nguồn duy nhất cho cả mô hình và người.
- `props`: bản đồ tên → `{ type, hint?, required (mặc định true), max?, min? }`, `type ∈ string | text | number | boolean | color | string[]`. Lược đồ đầu ra của đạo diễn sinh từ đây.
- `code`: xem 2.8.

### 2.8. Code cảnh (`SceneCode`)

Dùng chung cho stage và block: `{ format: 'html-gsap', source }`, `source` tối đa 200 000 ký tự. Quy ước:

- Một đoạn HTML kèm `<style>` nội tuyến. Block được đặt vào phần tử của stage có `data-slot="content"`; stage vẽ trường theo cảnh vào phần tử có `data-field="<tên>"`; block gắn props vào phần tử có `data-prop="<tên>"` (chuỗi và số đổ vào `textContent`, số định dạng theo `en-US`; với `string[]`, phần tử con đầu tiên là mẫu được nhân bản cho mỗi mục). Phần tử có `data-if="<tên>"` bị bỏ khi prop đó rỗng hoặc `null` — cách một block sống được khi dữ kiện ràng buộc chưa có.
- Token của stage phơi ra thành biến CSS: mỗi khóa `palette` là `--<khóa>`, mỗi khóa `fonts` là `--font-<khóa>`; tone của cảnh ghi đè các biến palette tương ứng. Code của block chỉ dùng biến, không mã hóa cứng màu hay phông, để cùng một block đẹp trên mọi stage.
- `<script>` tùy chọn gọi `nodecine.timeline(tl)` với một GSAP timeline có mốc 0 là đầu cảnh. Renderer **tua** timeline theo thời gian tuyệt đối, nên không dùng `repeat: -1` hay bất kỳ thứ gì phụ thuộc đồng hồ thật.
- Không mạng, không tài nguyên ngoài. Renderer chạy code trong iframe có sandbox, không cùng origin với Studio, không cho fetch. Điều này là ràng buộc an toàn, không phải tùy chọn.

---

## 3. Bản Đặc Tả Video Trung Gian (Universal Video IR)

Cấu trúc duy nhất do Node Đóng Gói Timeline tạo ra, độc lập với engine **và độc lập với mọi node**. Tự chứa: mang theo stage và các block nó dùng, nên một engine vẽ được IR mà không cần đăng ký gì, và một IR đã lưu phát lại được ở bất kỳ đâu. Đây là ranh giới giữa phần dựng nội dung và phần kết xuất.

- `irVersion` (Số nguyên): Phiên bản lược đồ, hiện là `1`. Adapter từ chối nạp phiên bản không hỗ trợ.
- `meta`:
  - `title` (Chuỗi), `language` (Chuỗi BCP 47): Lấy từ tham số node và `DirectorPlan`.
  - `fps` (Số nguyên): Mặc định 30, do tham số của Node Đóng Gói Timeline.
  - `width`, `height` (Số nguyên): Mặc định 1080 và 1920.
  - `totalDurationInFrames` (Số nguyên).
- `stage` (`StageDef`) và `blocks` (Danh sách `BlockDef`): Chép nguyên từ `DirectorPlan`.
- `audioTrack`:
  - `voiceoverUrl` (Chuỗi): Cùng định dạng với `Voiceover.audioUrl`.
  - `durationSeconds` (Số).
  - `padTailFrames` (Số nguyên): Số khung hình sau khi âm thanh đã hết; lớn hơn 0 khi ngưỡng tối thiểu được kích hoạt. Hình vẫn chạy còn tiếng đã hết là hành vi có chủ đích.
- `timeline` (Danh sách, ít nhất một phần tử):
  - `id` (Chuỗi): Duy nhất trong bản đặc tả.
  - `blockId` (Chuỗi): Chỉ vào `blocks` của chính IR.
  - `startFrame`, `durationInFrames` (Số nguyên).
  - `props` (Đối tượng): Đã đè dữ kiện theo `factBindings`.
  - `tone`, `fields` (tùy chọn): Chép từ cảnh trong plan.

### 3.1. Bất biến do lõi kiểm định

Lõi có một hàm kiểm định IR chạy ở Node Đóng Gói Timeline trước khi phát và ở mọi Adapter trước khi nạp. Bản đặc tả không qua được kiểm định thì không bao giờ ra khỏi node. Bất biến:

1. `timeline[0].startFrame` bằng 0.
2. Với mọi cảnh kế tiếp, `startFrame` bằng `startFrame` cộng `durationInFrames` của cảnh trước; không có khe hở, không chồng lấn.
3. Tổng `durationInFrames` bằng đúng `meta.totalDurationInFrames`.
4. Không cảnh nào có `durationInFrames` bằng 0.
5. IR tự chứa: mọi `blockId` chỉ vào một block trong `blocks`, `props` của cảnh khớp bảng `props` của block đó, và `tone` (nếu có) là một tone của `stage`.

Đây là bất biến cốt lõi số 3 của toàn dự án, được kiểm tra bằng mã chứ không bằng quy ước.

---

## 4. Renderer Theo Định Dạng Code: Cách Lõi Không Cần Biết Cảnh Là Gì

Lõi không có danh sách kiểu cảnh. Một cảnh là một block, block là dữ liệu trong IR (mục 2.7), và cách vẽ nằm trong `code` của block và stage theo định dạng `html-gsap` (mục 2.8). Thứ duy nhất engine phải đăng ký là **một renderer cho mỗi định dạng code** nó hiểu — `registerCodeRenderer(format, engineId, renderer)` trong `core/look/renderers.ts`, cùng pattern với registry của Adapter và Provider: bảng rỗng ở lõi, engine tự điền lúc khởi động.

- Node Xuất Bản Video và Node Xuất MP4, trước khi nạp, lấy tập `code.format` của stage và các block trong IR và tra với `engineId` đang nối vào. Thiếu renderer cho định dạng nào thì node chuyển `blocked` với viền vàng và mã `ENGINE_SCENE_UNSUPPORTED` kèm tên định dạng. Một engine chỉ hiểu `html-gsap` vẫn sống chung với engine khác mà không vỡ.
- Thêm block hay stage mới không đụng tới lược đồ IR, Adapter hay node lõi, và cũng không đụng tới code: người dùng thêm node Block/Stage trên canvas, hoặc mở một bản mẫu mang sẵn chúng.

---

## 5. Node Lõi (Core Nodes)

Lõi ship đúng những node cần để dựng được video từ một kịch bản gõ tay, không phụ thuộc mạng, không phụ thuộc mô hình ngôn ngữ.

### 5.1. Nhập Liệu (Input Trigger)

Ô văn bản, phát `SourceRef`. Không diễn giải, không gọi mạng. Ô trống là lỗi kiểm tra liên tục `INPUT_EMPTY`.

### 5.2. Kịch Bản Tĩnh (Static Script)

Node phát cả `DirectorPlan` lẫn `AudioScript` từ nội dung gõ tay, dành cho việc dựng video không cần mô hình ngôn ngữ và để kiểm thử khung. Cổng nhận: `stage` (một dây) và `blocks` (nhiều dây) — cùng hai cổng như Đạo Diễn AI, vì cảnh gõ tay cũng phải chỉ vào một block có thật. Tham số:

- `script` (Chuỗi nhiều dòng): Lời thoại, phát ra `AudioScript`. Không có tham số ngôn ngữ: người dùng đã dán lời thoại cuối cùng nên ngôn ngữ của văn bản chính là ngôn ngữ của video. Node nhận diện bằng hàm thuần `detectLanguage(text)` của lõi (theo hệ chữ viết; chữ Latinh có dấu riêng của tiếng Việt thì là `vi`, chữ Latinh khác coi là `en`) và điền vào `DirectorPlan.language` lẫn `AudioScript.language`. Đoán sai thì người dùng chọn giọng tay trên Giọng Đọc.
- `scenes` (Danh sách chỉnh sửa trực tiếp trên thân node): mỗi mục gồm `blockId` chọn trong các block đã nối, `weight`, `tone` chọn trong tone của stage đã nối, các `fields` của stage, và các ô `props` sinh từ bảng `props` của block đã chọn (số nhập là số, danh sách mỗi dòng một mục). Mặc định là ba cảnh `text-card` trọng số 1, 2, 1.

Cảnh chỉ kiểm tra được khi đã biết dây nối vào, nên việc kiểm tra `blockId`, `props` và `tone` là **preflight** (chặn trước khi chạy với `NODE_PARAMS_INVALID` và câu chỉ dẫn), không phải kiểm tra liên tục. Không có `factBindings` vì không có nguồn dữ kiện; người dùng gõ thẳng giá trị.

### 5.3. Giọng Đọc (TTS Engine)

Nhận `AudioScript` và `TTSRef`, chọn giọng khớp ngôn ngữ theo quy tắc ở mục 8.2, gọi nhà cung cấp, đo thời lượng từ tệp đã tạo, phát `Voiceover`. Tham số: `voice` (để trống là tự chọn theo ngôn ngữ), `speed`.

### 5.4. Đóng Gói Timeline (Timeline Assembler)

Nhận `DirectorPlan` và `Voiceover` (bắt buộc), `FactSheet` (tùy chọn). Tham số: `fps` (30), `width` (1080), `height` (1920), `minTotalFrames` (270). Hàm thuần, không gọi mạng, thất bại đồng nghĩa lỗi lập trình.

Quy tắc phân bổ thời lượng, tất định:

1. Số khung hình âm thanh bằng `durationSeconds × fps`, làm tròn lên.
2. Tổng số khung hình bằng giá trị lớn hơn giữa số khung hình âm thanh và `minTotalFrames`; phần chênh ghi vào `padTailFrames`.
3. Với mỗi cảnh trừ cảnh cuối: `durationInFrames` bằng phần nguyên (làm tròn xuống) của `tổng × weight / tổng các weight`. Cảnh cuối nhận toàn bộ phần còn lại. Cách này loại bỏ mơ hồ khi làm tròn giá trị nằm đúng giữa hai số nguyên, và đảm bảo tổng luôn khớp tuyệt đối theo cấu trúc chứ không theo may rủi. Trường hợp biên: nếu trọng số quá lệch và tổng khung quá nhỏ khiến phần nguyên của một cảnh bằng 0, cảnh đó nhận 1 khung và cảnh cuối bị trừ 1 khung tương ứng (tổng vẫn giữ nguyên, bất biến 4 ở mục 3.1 được bảo toàn); nếu sau khi mượn mà cảnh cuối cũng về 0, hoặc tổng khung nhỏ hơn số cảnh, node báo lỗi lập trình thay vì tạo IR sai.
4. `startFrame` tích lũy từ 0.
5. Đè dữ kiện: với mỗi cảnh có `factBindings`, gán `props[tênProp] = facts[khóa]` cho mọi khóa có mặt trong `FactSheet.facts`. Dữ kiện luôn thắng giá trị cùng tên đã có trong `props`.
6. Chạy hàm kiểm định IR ở mục 3.1 trước khi phát.

Ví dụ đối chiếu với trọng số 1, 2, 1 và âm thanh 11.2 giây ở 30 fps: 336 khung, phân bổ 84, 168, 84, bắt đầu 0, 84, 252. Với âm thanh 7.5 giây: 225 khung nhỏ hơn 270 nên tổng là 270, `padTailFrames` 45, phân bổ 67, 135, 68. Phần dư dồn cho cảnh cuối luôn nhỏ hơn số cảnh trừ một, tức nhỏ hơn 2 khung với ba cảnh.

### 5.5. Xuất Bản Video (Video Output)

Nhận `VideoIR` và `EngineRef`. Tra scene registry (mục 4), tra adapter registry theo `engineId`, gọi `mountPlayer()`. Chính là trình phát; không có cổng phát, không có node xuất. Giao diện chi tiết tại Đặc tả Luồng Trải nghiệm mục 1.4.

### 5.6. Xuất MP4 (MP4 Export)

Nhận `VideoIR` và `EngineRef`, bỏ qua mặc định. Tham số `ExportSettings`:

- `codec`: `h264` mặc định, `h265` tùy chọn.
- `quality`: `high` (CRF 18), `medium` (CRF 23), `low` (CRF 28); giá trị CRF là chi tiết của Adapter.
- `fileName`: Không kèm đường dẫn, mặc định theo tên dự án, ký tự không hợp lệ thay bằng gạch ngang.

Hành vi: khi đang bỏ qua, Chạy Luồng không chạm tới; bấm Kết xuất là chạy riêng node theo Đặc tả Bộ Máy Thực Thi mục 3; node bị vô hiệu hóa khi thiếu dây, khi `EngineRef.capabilities.render` không phải `ready`, hoặc khi thiếu renderer cho một `sceneType`. Trong lúc chạy hiện tiến độ và nút Hủy; xong hiện tên tệp, dung lượng, node Tải xuống; kết quả gắn vào lịch sử chạy. Nhiều node xuất trên cùng đồ thị là hợp lệ.

### 5.7. Node tài nguyên: Động Cơ, Mô Hình Ngôn Ngữ, Giọng Đọc

Có **một node cho mỗi kiểu cổng**, không phải một node cho mỗi nhà cung cấp. Node Mô Hình Ngôn Ngữ phát `LLMRef`, node Giọng Đọc phát `TTSRef`, và nhà cung cấp là tham số chọn trong hộp thả, giống cách Load Checkpoint của ComfyUI chứa mọi checkpoint. Tham số của node là `{providerId, settings}`; lõi không kiểm tra `settings` vì lõi không được biết danh sách nhà cung cấp, việc kiểm định thuộc về chính nhà cung cấp lúc dựng. Thêm một nhà cung cấp là thêm một dòng vào `providers/installed.ts`, không thêm node, không sửa giao diện.

Mô tả ở mục 6, 7 và 8. Cả ba dùng chung khuôn: không cổng nhận, một cổng phát, `run() = probe()`, tham chiếu là dữ liệu tuần tự hóa được.

### 5.8. Đạo Diễn AI (AI Director)

Có **một node đạo diễn**, trong lõi. Cổng nhận: `LLMRef` bắt buộc, `stage` bắt buộc (một dây), `blocks` bắt buộc (nhiều dây — mỗi dây một node Block, gộp lại là **danh mục** mô hình được chọn), `FactSheet` tùy chọn và `SourceRef` tùy chọn; phát `DirectorPlan` và `AudioScript`. Mọi thứ từng khiến mỗi loại video cần một node đạo diễn riêng đều là **tham số** hoặc **dữ liệu trên dây**:

- `prompt` — đề bài người dùng viết. Thứ duy nhất chỉ người dùng nói được.
- `beats` — danh sách **beat**: `{ role, brief, weight, count, blocks, factBindings }`. `role` là tên ngắn của một đoạn (hook, quote, cta); `brief` nói đoạn đó làm gì; `count` là số cảnh liên tiếp; `blocks` là các `id` block mô hình được chọn cho đoạn đó (rỗng = mọi block đã nối); `factBindings` là `propKey → factKey`.
- `outputLanguage` (`auto` = ngôn ngữ của đề bài và dữ kiện).

Mô hình **chọn block cho từng cảnh** trong danh sách của beat, chọn `tone` trong tone của stage, viết `fields` theo quy tắc của stage, và viết `props` của block đã chọn. Lược đồ đầu ra **sinh lúc chạy** từ bảng `props` của các block: mỗi beat khai triển thành `count` phần tử, mỗi phần tử là hợp phân biệt theo `block` của các block được phép, với `props` là lược đồ block đó trừ các prop đã ràng buộc. Không block nào có lược đồ đầu ra viết tay. Mô hình phải trả về đúng số cảnh, đúng thứ tự, đúng block trong danh sách; sai thì thử lại một lần. `tone` và `fields` được đọc **khoan dung**: tên stage không có thì bỏ, không thử lại.

Ba bất biến do node này giữ:

1. **Prop đã ràng buộc không bao giờ được hỏi mô hình**, và **dữ kiện đã ràng buộc không bao giờ vào prompt**. Số sao, lệnh cài, đường dẫn đi thẳng từ `FactSheet` tới Đóng Gói Timeline; mô hình không có gì để chép sai.
2. Prompt được dựng từ các nguồn tách bạch: đề bài mang ý đồ, beat mang cấu trúc, block tự nói khi nào dùng nó và viết gì (`doc.when`, `doc.example`, `hint` của từng prop), stage nói tone và trường nó vẽ được, dữ kiện mang sự thật. Không có gì trong prompt nói về một loại video cụ thể.
3. Danh mục phải dùng được trước khi tốn một lần gọi mô hình: preflight chặn `NODE_PARAMS_INVALID` khi hai Block nối vào trùng `id` hoặc một beat nêu `id` không nối.

Vòng gọi mô hình (`core/director/loop.ts`): sai cấu trúc thử lại một lần, sai ngôn ngữ thử lại một lần với prompt nghiêm hơn, rồi ném `LLM_SCHEMA_INVALID` hoặc `LLM_LANGUAGE_MISMATCH` kèm nguyên văn câu trả lời để node hiển thị. Chính sách ngôn ngữ ở `core/text/languages.ts`. Beat và lược đồ ở `core/director/beats.ts`, prompt ở `core/director/prompt.ts`.

Hệ quả: một video GitHub showcase là *node này* + stage `developer-dark` + ba block `hook/mockup/cta` + ba beat với ba ràng buộc dữ kiện; một video trích dẫn là *node này* + stage `ink` + hai block + beat `title ×1, quote ×4`. Người dùng dựng cả hai từ canvas trống; sự khác nhau nằm trọn trong dữ liệu, và một bản mẫu chia sẻ mang theo cả giao diện vì nó mang theo các node Stage/Block.

### 5.9. Stage

Node nguồn, không cổng nhận, phát `StageDef`. Tham số của node **là** định nghĩa (2.6): đổi tham số là đổi sân khấu, lưu workflow là lưu luôn giao diện. Mặc định là stage `dark` với ba tone `cool/warm/green` và trường `kicker`. Người dùng sửa id, tên, token, tone, trường theo cảnh và code ngay trong node.

### 5.10. Block

Node nguồn, không cổng nhận, phát `BlockDef`. Tham số của node là định nghĩa (2.7). Mặc định là block `text-card` với `headline` bắt buộc và `body` tùy chọn. Một workflow có bao nhiêu block cũng được — mỗi block một node — và tất cả nối vào cùng cổng `blocks` của đạo diễn; đó là **danh mục** mô hình được chọn. Một bản mẫu chia sẻ mang theo đủ giao diện vì nó mang theo các node này.

### 5.11. Truy Xuất Repo (GitHub Fetcher)

Node lõi `core/github-fetcher`: nhận `SourceRef`, phát `FactSheet`. Link repo GitHub thì gọi thao tác máy chủ `github-fetch-repo` (mục 9) để lấy tên, mô tả, sao, ngôn ngữ, chủ đề, lệnh cài suy từ README, trích README; trình duyệt không bao giờ gọi GitHub. Văn bản thường thì đi qua nguyên vẹn (`mode: passthrough`) để đồ thị GitHub vẫn chạy được với một đoạn mô tả gõ tay. Lỗi có mã riêng: `REPO_NOT_FOUND`, `REPO_RATE_LIMITED` (thử lại được), `REPO_NETWORK` (thử lại được). Ruột ở `core/github/`, thao tác máy chủ ở `server/github/`, thân node ở `components/nodes/GithubFetcherBody.tsx`. Đây là mẫu cho mọi node lấy dữ liệu về sau (RSS, YouTube, …): một node lõi riêng cho một nguồn, vì mỗi nguồn có đặc thù riêng.

---

## 6. Adapter và Node Động Cơ

### 6.1. Giao diện Adapter

Bốn năng lực, là toàn bộ bề mặt phần còn lại của ứng dụng được biết:

- Khai báo `engineId` và tên hiển thị.
- `probe()`: trả về `capabilities` gồm `preview` và `render`, mỗi trường `ready` hoặc `unavailable` kèm `reason`.
- `mountPlayer(element, ir)`: Gắn trình phát vào một phần tử hiển thị.
- `render(ir, exportSettings, onProgress, signal)`: Kết xuất MP4, có tiến độ và hủy.

Adapter nhận IR generic và tự chứa: stage, block và code của chúng nằm trong IR. Adapter đăng ký renderer cho định dạng code nó chạy được (mục 4) và không biết tên block nào.

### 6.2. Cấu trúc `EngineRef`

- `engineId`, `displayName`, `adapterVersion`.
- `capabilities`: Kết quả `probe()`.
- `settings`: Tham số riêng của engine. Remotion: `glBackend` (`angle` hoặc `swiftshader`). Hyperframes: rỗng.

Tham chiếu là dữ liệu, không phải đối tượng: không bao giờ chứa instance Adapter. Node tiêu thụ tra `engineId` trong adapter registry của lõi để lấy instance. Registry khởi đầu rỗng; các gói `engines/*` tự đăng ký lúc khởi động, nhờ vậy lõi không nhập Remotion hay React. Chữ ký của Node Động Cơ chỉ phụ thuộc `engineId` và `settings`.

### 6.3. Mức hỗ trợ

- **Hyperframes** — engine của định dạng `html-gsap`, dựng trên thư viện HyperFrames (`@hyperframes/core`, `@hyperframes/player`, `@hyperframes/producer`). Một IR thành **một trang HTML tự chứa** (`engines/hyperframes/document.ts`): gsap và runtime HyperFrames inline (không CDN), `@font-face` cho JetBrains Mono đóng gói cục bộ, style của stage bọc `@scope ([data-stage])` và của mỗi block bọc `@scope ([data-block="id"])`, token của stage thành biến CSS trên gốc composition và tone của cảnh ghi đè trên clip của cảnh đó, mỗi cảnh một `div.clip` có `data-start`/`data-duration` tính từ khung hình, voice-over là `<audio data-start="0">`, và một bootstrap chạy trong trang: gắn props (`data-prop`, `data-if`) và fields (`data-field`), chạy script của stage và block với một `gsap` mà chuỗi selector chỉ tìm trong cảnh đó, gom các timeline `nodecine.timeline(tl)` vào timeline gốc tại mốc của cảnh, đăng ký `window.__timelines`. Thứ tự script là hợp đồng: gsap, rồi runtime, rồi trang; runtime sở hữu `window.__timelines`, đăng ký trước nó là mất. Trang khai CSP: chỉ script/style inline, media và font qua http(s), không `connect`, không script ngoài.
  - Xem trước: `<hyperframes-player srcdoc sandbox-origin="opaque">` — iframe không cùng origin với Studio, có thanh tua. Hai script vendor được Studio tải từ `/api/vendor/{gsap.js,hyperframes-runtime.js}` (chỉ đúng hai tệp, đường dẫn do trình phân giải gói quyết định) và inline vào trang.
  - Kết xuất: trang ghi thành một thư mục dự án tạm (`index.html`, `voiceover.mp3`, `fonts/`) dưới thư mục tệp tạm; `@hyperframes/producer` tua từng khung trong Chrome headless, chụp, ghép và trộn tiếng bằng ffmpeg; MP4 ra dưới tên băm như mọi tệp media. Chất lượng: `high → high`, `medium → standard`, `low → draft`.
- **Remotion** — chưa đăng ký renderer cho định dạng nào, nên Xuất Bản Video và Xuất MP4 nối vào nó chặn `ENGINE_SCENE_UNSUPPORTED`. Adapter, bundler và đường kết xuất giữ nguyên để nhận định dạng block `react` sau này.
- Dự phòng hiệu ứng: khi Adapter gặp hiệu ứng không dựng được, tự thay bằng mờ dần hoặc trượt và phát cảnh báo mức thông tin để giao diện hiện huy hiệu vàng.

---

## 7. Provider và Node Nhà Cung Cấp Mô Hình Ngôn Ngữ

### 7.1. Cấu trúc `LLMRef`

- `providerId`: định danh nhà cung cấp đang chọn trên node.
- `displayName`, `transport`: `cli` cho nhà cung cấp chạy bằng tiến trình con, `api` cho nhà cung cấp gọi qua HTTP.
- `capabilities`: `installed`, `authenticated`, `structuredOutput`; mỗi trường `ready` hoặc `unavailable` kèm `reason` và, nếu có, `fix` là lệnh người dùng cần chạy. Phiên bản công cụ tìm thấy được ghi ở đây để hiển thị.
- `settings`: `model` (để trống là mặc định của công cụ), `maxTurns` cố định 1.

Đường dẫn tệp thực thi không nằm trong `LLMRef` và không nằm trên node: đọc từ Cài đặt hoặc tự phát hiện trên `PATH` lúc `probe()`. Nhờ vậy tệp dự án và lịch sử chạy không chứa đường dẫn máy người dùng.

### 7.2. Giao diện Provider mô hình ngôn ngữ

- `probe()` như trên.
- `complete(prompt, outputSchema, signal)`: Gửi lời nhắc, nhận về một đối tượng đã kiểm định theo `outputSchema` (Zod). Với `claude-code`: chạy tệp thực thi ở chế độ in một lần với đầu ra JSON, lời nhắc qua đầu vào chuẩn, đọc trường kết quả, kiểm định; sai cấu trúc hoặc sai ngôn ngữ thì thử lại một lần với chỉ dẫn siết chặt. Lượt gọi tính vào tài khoản Claude Code của người dùng; ứng dụng không lưu thông tin đăng nhập nào. Tiến trình được sinh trong một thư mục tạm rỗng, tắt toàn bộ công cụ và giới hạn một lượt, để mô hình không đọc được mã nguồn hay tệp của người dùng; chi tiết tại Kiến trúc Hệ thống mục 8.

Node gọi `complete()` là node đạo diễn của gói; lõi không có node nào gọi mô hình ngôn ngữ.

---

## 8. Provider và Node Nhà Cung Cấp Giọng Đọc

### 8.1. Cấu trúc `TTSRef`

- `providerId`: định danh nhà cung cấp đang chọn trên node. Hiện có `system-tts` (chỉ macOS) và `piper` (chạy cục bộ trên mọi hệ điều hành).
- `displayName`, `transport` (`local`).
- `capabilities`: `installed` (bộ tổng hợp sẵn sàng, gồm cả việc có mô hình giọng hay chưa với Piper), `encoder` (ffmpeg).
- `voices`: Danh sách `{id, displayName, language}` lấy từ hệ điều hành lúc `probe()`.
- `settings`: `defaultVoice`, `rate`.

### 8.2. Quy tắc chọn giọng tại Node Giọng Đọc

Nếu người dùng đã chọn một giọng khớp ngôn ngữ lời thoại, dùng giọng đó; nếu không, dùng giọng đầu tiên khớp ngôn ngữ; nếu không có giọng nào khớp, dùng `defaultVoice` và phát cảnh báo `TTS_VOICE_LANGUAGE_MISMATCH`, không dừng luồng.

Ví dụ với bộ tổng hợp của hệ điều hành trên macOS: `say` ghi AIFF vào thư mục tệp tạm, ffmpeg chuyển sang MP3, đo thời lượng từ tệp MP3. Hệ điều hành chưa hỗ trợ thì `probe()` báo `installed: unavailable`; ứng dụng không giả vờ có giọng.

---

## 9. Thao Tác Máy Chủ và An Toàn Tiến Trình Con

### 9.1. Thao tác máy chủ (server op)

Node chạy trên máy khách. Khi một node cần mạng hay hệ tệp, nó gọi `services.serverOp(op, input, signal)`; ứng dụng chuyển tiếp tới `POST /api/ops/<op>`; route tra `op` trong `core/server-ops.ts` — một registry phẳng tên → hàm, rỗng ở lõi, ai cần thì đăng ký bằng `registerServerOp(op, fn)`. Tên op mang tiền tố riêng vì không gian tên là phẳng (`github-fetch-repo`). Không có phương thức riêng cho node nào trong `NodeServices`; kiểm thử thay `serverOp` bằng hàm giả.

### 9.2. Tiến trình con

Áp dụng cho mọi Provider có `transport` là `cli` hoặc `local`, và cho tiến trình kết xuất:

- Tham số truyền dưới dạng mảng đối số, không ghép thành chuỗi cho shell diễn giải.
- Nội dung do người dùng hoặc mô hình sinh ra đi qua đầu vào chuẩn hoặc tệp tạm, không qua đối số.
- Đường dẫn tệp thực thi chỉ lấy từ tự phát hiện trên `PATH` hoặc từ Cài đặt, không bao giờ từ tệp dự án.
- Mỗi lần gọi có thời gian chờ và bị hủy cùng luồng.

---

## 10. Bản Mẫu

Không có tầng "nội dung kèm app" nữa. Mọi node là node lõi (mục 5), giao diện là dữ liệu trong node Stage và Block, và bản mẫu là đồ thị. Ba nguồn của bản mẫu đổ vào cùng một registry.

### 10.1. Bản mẫu (template) là dữ liệu

Một bản mẫu là **một đồ thị đã lưu**: `{ id, name, description?, category, graph }`, trong đó `graph` có đúng hình dạng `lib/storage.ts` ghi khi người dùng lưu dự án. Nó gọi tên node bằng chuỗi và không import gì; giao diện của nó nằm trong tham số của các node Stage và Block bên trong đồ thị. Registry ở `core/templates/registry.ts` kiểm định hình dạng lúc đăng ký và trả ra bản sao khi mở.

Ba nguồn đổ vào cùng registry, và registry không phân biệt: tệp JSON dưới `templates/` (ship kèm), bản người dùng lưu từ canvas (*Lưu đồ thị hiện tại*), bản người dùng nhập từ tệp (*Nhập JSON*). Hai nguồn sau lưu ở `localStorage`, tải xuống được thành tệp để chia sẻ.

### 10.2. Bài kiểm tra duy nhất

**Mọi bản mẫu ship kèm phải dựng lại được từ canvas trống** bằng cách kéo node từ Thư viện và gõ tham số. `templates/__tests__` kiểm đúng điều đó: mọi node type có trong Thư viện, mọi tham số qua được lược đồ của chính node, mọi đạo diễn và Kịch Bản Tĩnh có Stage và chỉ nêu block đã nối, mọi ràng buộc dữ kiện trỏ vào prop có thật của block. Bản mẫu cần thứ gì người dùng không với tới thì không phải bản mẫu — đó là code trá hình.

Không thứ gì bên ngoài lõi được thêm kiểu cổng hay sửa lược đồ IR.
