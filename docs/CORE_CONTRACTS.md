# Hợp đồng Lõi (Core Contracts)

Tài liệu này định nghĩa phần **khung** của NodeCine: những hợp đồng mà mọi node, mọi cảnh và mọi engine đều phải tuân theo, và không chứa bất kỳ chi tiết nào của một bản mẫu cụ thể. Chi tiết của từng bản mẫu nằm ở `docs/templates/`.

Ba tầng (Kiến trúc mục 2): `core/` lo node chạy thế nào, `contracts/` giữ các hợp đồng video mà tài liệu này mô tả, `nodes/` là các node. Mọi tệp nhắc tới ở đây mà không có tiền tố `core/` đều nằm ở `contracts/` trừ khi ghi khác.

Nguyên tắc phân tầng: **lõi định nghĩa hình dạng, gói định nghĩa nội dung.** Lõi biết có "cảnh" nhưng không biết cảnh Hook là gì; biết có "dữ kiện" nhưng không biết số sao GitHub là gì. Mọi thứ lõi không biết đều được tra qua registry, cùng một pattern cho engine, nhà cung cấp và kiểu cảnh.

Tài liệu liên quan: Kiến trúc Hệ thống mô tả nơi từng phần thực thi; Đặc tả Bộ Máy Thực Thi mô tả cách đồ thị được chạy.

---

## 1. Hệ Thống Kiểu Cổng & Giao thức Gói Dữ Liệu

### 1.1. Kiểu cổng

Mỗi cổng mang đúng một định danh kiểu. Một dây nối chỉ được phép tạo khi định danh kiểu ở cổng xuất trùng khớp tuyệt đối với định danh kiểu ở cổng nhận. Không có cơ chế ép kiểu ngầm. Lõi (`core/types/ports.ts`) chỉ giữ registry kiểu cổng rỗng và không biết tên kiểu nào. Các kiểu cổng video, nhãn và schema của chúng nằm ở `contracts/ports.ts` và đăng ký vào lõi lúc khởi động; executor kiểm gói trên dây bằng schema đã đăng ký. Node không tự thêm kiểu cổng: kiểu mới là một dòng trong `contracts/ports.ts`.

| Định danh kiểu | Nhãn hiển thị | Ý nghĩa | Node lõi phát | Node lõi nhận |
| --- | --- | --- | --- | --- |
| `SourceRef` | Dữ liệu Nguồn | Chuỗi người dùng nhập, chưa diễn giải | Nhập Liệu | Truy Xuất Repo, Biên Kịch |
| `SceneScript` | Kịch bản phân cảnh | Video đã chia cảnh, mỗi cảnh một vai, một trọng số và **nội dung** theo từ vựng cố định — chưa có giao diện (2.11) | Kịch Bản Tĩnh, Biên Kịch, Phân Cảnh, Kho Tư Liệu | Phân Cảnh, Kho Tư Liệu, Họa Sĩ |
| `FactSheet` | Dữ kiện | Tập dữ kiện kiểm chứng được, có nguồn gốc | Truy Xuất Repo | Biên Kịch, Đóng Gói Timeline |
| `ScenePlan` | Kế hoạch dựng | Phong cách chung, tỉ lệ khung, giá trị của cả video và danh sách cảnh — **mỗi cảnh một bức vẽ** (`source`) — tự chứa | Họa Sĩ | Đóng Gói Timeline |
| `AudioScript` | Lời thoại | Văn bản thuyết minh kèm ngôn ngữ | Kịch Bản Tĩnh, Biên Kịch | Giọng Đọc |
| `Voiceover` | Âm thanh & Thời lượng | Tệp âm thanh đã đo thời lượng, có thể kèm mốc từng từ | Giọng Đọc, Căn Mốc Từ | Đóng Gói Timeline, Căn Mốc Từ, Phụ Đề |
| `VideoIR` | Bản đặc tả IR | Bản Đặc Tả Video Trung Gian | Đóng Gói Timeline | Xuất Bản Video, Xuất MP4 |
| `EngineRef` | Động cơ | Tham chiếu tới một Adapter | Động Cơ | Xuất Bản Video, Xuất MP4 |
| `LLMRef` | Mô hình ngôn ngữ | Tham chiếu tới nhà cung cấp mô hình | Nhà Cung Cấp Mô Hình Ngôn Ngữ | Biên Kịch, Họa Sĩ, Phân Cảnh, Kho Tư Liệu (tùy chọn) |
| `TTSRef` | Giọng đọc | Tham chiếu tới nhà cung cấp giọng | Nhà Cung Cấp Giọng Đọc | Giọng Đọc |
| `CaptionTrack` | Phụ đề | Các dòng phụ đề trên đồng hồ của voice-over, mỗi dòng gồm các từ có mốc | Phụ Đề | Đóng Gói Timeline (tùy chọn) |
| `LayerSpec` | Lớp | Một tệp hay một bức vẽ chạy bên các cảnh trên rãnh riêng, dưới hoặc trên chúng (2.14) | Lớp | Đóng Gói Timeline (tùy chọn, nhiều dây) |
| `AudioTrackSpec` | Track âm thanh | Nhạc hay tiếng nền trên track âm thanh riêng, bên cạnh giọng (2.15) | Nhạc Nền, Nhập Âm Thanh | Đóng Gói Timeline (tùy chọn, nhiều dây) |

Mười ba kiểu cổng chia làm hai **loại dây** (`PORT_KIND` trong `core/types/ports.ts`). Dây **luồng** (`SourceRef`, `FactSheet`, `SceneScript`, `ScenePlan`, `AudioScript`, `Voiceover`, `CaptionTrack`, `LayerSpec`, `AudioTrackSpec`, `VideoIR`) là đường đi của nội dung: xong bước này mới sang bước sau. Dây **thành phần** (`LLMRef`, `TTSRef`, `EngineRef`) là một bộ phận cắm vào node dùng nó: mô hình, giọng, động cơ. Bộ máy thực thi không phân biệt hai loại (cả hai đều là phụ thuộc, mục 2 của Bộ Máy Thực Thi); chỉ canvas vẽ khác: dây luồng liền nét, vào từ trái ra bên phải; dây thành phần mảnh, đứt nét, vào cổng ở **cạnh trên** của node dùng và ra từ **cạnh dưới** của node phát, để thành phần "treo" phía trên đường đi chính. Auto-layout xếp node thành phần thành một dải ngay trên node đầu tiên dùng nó.

Một cổng xuất được phép nối ra nhiều cổng nhận. Một cổng nhận mặc định chỉ được phép có đúng một dây nối tới; cổng khai báo `multiple: true` nhận **bao nhiêu dây cũng được**, bắt buộc nghĩa là ít nhất một. Gói của cổng nhiều dây tới node dưới dạng danh sách `lists[tên cổng]` theo thứ tự dây, không phải `inputs[tên cổng]`; chữ ký chạy lại băm cả danh sách nên thêm hoặc bớt dây là node chạy lại. Hiện không node lõi nào khai cổng nhiều dây; bộ máy giữ tính năng cho node gom nhiều thứ cùng loại. Đồ thị bắt buộc không có chu trình. Node thành phần (ba loại phát `EngineRef`, `LLMRef`, `TTSRef`) không có cổng nhận nào.

### 1.2. Gói dữ liệu qua dây nối

- `sourceNodeId`: Định danh chuỗi duy nhất của node gửi dữ liệu.
- `sourcePort`, `targetPort`: Tên định danh của cổng phát và cổng nhận.
- `payloadType`: Định danh kiểu lấy từ bảng ở mục 1.1, dùng để kiểm tra lại lúc chạy.
- `timestamp`: Mốc thời gian mili-giây lúc phát.
- `payload`: Đối tượng dữ liệu nghiệp vụ, phải tuần tự hóa được thành JSON.
- `contentHash`: Chuỗi băm ổn định tính từ `payload`, cơ sở của cơ chế chạy lại từng phần.

Gói tin chỉ mang dữ liệu thành công. Trạng thái lỗi không đi qua dây nối mà được ghi vào trạng thái của chính node phát sinh lỗi.

### 1.3. Phần một node cần: mô hình, giọng, động cơ

Từ 2026-09-12, **không còn node tài nguyên**. Mô hình ngôn ngữ, giọng đọc và động cơ là **thiết lập của chính node cần chúng**, và node tự dò khi chạy (`contracts/resources.ts`: `resolveLLM`, `resolveTTS`, `resolveEngine`). Đồ thị chỉ còn một loại dây: nội dung chảy từ bước này sang bước kia.

Vì sao bỏ: bốn node và hơn chục sợi dây phải dựng trước khi vẽ được một khung hình, và lý do một node không chạy được lại hiện trên một node khác. Nay node nào thiếu phần của nó thì chính nó báo, kèm đúng mã lỗi và cách sửa mà trước đây Bộ Máy Thực Thi kiểm trên dây.

- Tham số: `llmProvider` + `llmSettings`, `ttsProvider` + `ttsSettings`, `engineId` + `engineSettings`.
- Kiểm năng lực chuyển vào lúc dò: model phải `installed` và `authenticated`, giọng phải `installed` và `encoder`, động cơ phải `preview` (node xem) hoặc `render` (node xuất).
- Node phía dưới bị chặn với `kind: 'upstream'` mang theo mã lỗi **và cách sửa** của node hỏng, nên nguyên nhân vẫn đi hết dây chuyền.
- Đồ thị cũ được **gộp lúc mở**: `registerResourceFold` trong `nodes/migrations.ts` khai bốn kiểu node đã mất và thiết lập của chúng rơi về đâu; `migrateGraph` gộp xong thì xóa node và mọi dây của chúng.
- Node chỉ dò khi nó chạy. Node dùng lại kết quả cũ thì không dò, nên đổi một thiết lập ở máy khác giữa hai lần chạy chỉ lộ ra khi node thật sự chạy lại.

### 1.4. Luồng, và node chỉ nằm trên canvas

**Luồng** là những node có dây cắm vào hoặc đi ra (`flowNodes`). Node không có sợi dây nào **không được chạy**: nó không thuộc bộ phim, nên không thể hỏng sau một lần chạy nó chưa từng tham gia. Cả đồ thị không có sợi dây nào thì chạy hết, vì lúc đó không có luồng nào để đứng ngoài.

**Nút Chạy sáng khi có một node không có cổng vào nào và đã nối đầu ra đi đâu đó** (`canRun`) — hôm nay là Nhập Liệu và Kịch Bản Tĩnh. Không gì khác bắt đầu được một bộ phim.

**Cổng bắt buộc còn trống, hay tham số node tự thấy không hợp lệ, là cảnh báo**, hiện ngay trên thẻ node. Khi lần chạy tới node đó thì chính nó dừng lại và nói lý do tại chỗ. Đây là chỗ đổi so với trước: một node đang nối dở từng khóa nút Chạy của cả luồng, kèm một dãy mã lỗi trên đầu canvas.

Vẫn là **lỗi** và vẫn từ chối chạy: đồ thị có vòng lặp, node không rõ kiểu, dây nối sai kiểu, và một cổng đơn bị cắm hai dây. Đó là đồ thị hỏng, không phải đồ thị làm dở.

### 1.5. Ghim kết quả

Một node mang `pinned = { outputs, at }` thì **đóng băng**: Bộ Máy Thực Thi trả lại đúng các payload đã lưu, không chạy `run`, không đọc đầu vào, không bị chặn khi node phía trên lỗi, và **không rã ra khi chạy ép** (Shift+Chạy). Ghim khác bộ nhớ đệm chữ ký ở đúng chỗ đó: đệm là tối ưu, ghim là một quyết định.

Lý do nó tồn tại: workflow trước đây chỉ lưu **lời dặn** (một câu mô tả phong cách) chứ không lưu **kết quả** (tờ CSS sinh ra từ câu đó), nên mỗi lần chạy là một lần suy ra lại, và hai video cùng workflow ra hai bộ bố cục khác nhau. Ghim là cách một kết quả đã duyệt trở thành tài sản của workflow, đồng thời dồn phần gọi mô hình đắt đỏ về một lần thay vì mỗi video một lần.

Luật:

- Chỉ ghim được thứ đã chạy ra: `pinNode` lấy `outputs` của lần chạy gần nhất, bỏ qua cổng không có gì, và không tạo ghim rỗng (`core/engine/graph.ts`).
- Payload được kiểm lại theo lược đồ của kiểu cổng lúc trả về. Ghim mà bản dựng hôm nay không đọc được là lỗi `NODE_OUTPUT_INVALID` kèm hướng dẫn bỏ ghim, chứ không âm thầm đẩy hình sai xuống dưới.
- Ghim đi cùng đồ thị xuống đĩa (`pinned` trong lược đồ node ở `core/templates/registry.ts`), nên nó là một phần của workflow chứ không phải trạng thái của một phiên.
- Payload đóng băng nên `contentHash` không đổi, nên mọi node phía dưới dùng lại kết quả cũ thay vì chạy lại.

---

## 2. Payload của Các Kiểu Cổng Lõi

### 2.1. `SourceRef`

- `value` (Chuỗi): Nội dung người dùng nhập, đã cắt khoảng trắng hai đầu. Node Nhập Liệu không diễn giải giá trị; việc nhận diện đó là đường dẫn, mã định danh hay văn bản thô thuộc về node truy xuất của gói nhận nó.

### 2.2. `FactSheet`

- `facts` (Đối tượng khóa-giá trị): Các dữ kiện kiểm chứng được, khóa do gói định nghĩa. Giá trị là chuỗi, số, `null` hoặc danh sách chuỗi.
- `sourceLabel` (Chuỗi): Nguồn gốc để hiển thị, ví dụ `github.com/owner/name`.
- `fetchedAt` (Chuỗi ISO 8601): Mốc thời gian lấy dữ kiện.
- `mode` (Chuỗi phân loại): `fetched` khi đã gọi nguồn ngoài, `passthrough` khi chỉ đóng gói lại văn bản người dùng.

Quy ước cốt lõi: mọi giá trị trong `facts` có nguồn gốc xác định và **không bao giờ do mô hình ngôn ngữ sinh ra**. Lõi bảo vệ quy ước này bằng cấu trúc: `FactSheet` được nối thẳng vào Node Đóng Gói Timeline và điền các phần tử `data-fact` theo `factBindings` (mục 2.3), nên dữ kiện không cần đi qua node biên kịch để tới được video.

### 2.2b. Dữ kiện dạng danh sách

`facts` nhận cả **danh sách các mục**, mỗi mục là một bản ghi phẳng: `items: [{title, source, image, …}, …]`. Đây là cách một video nói về nhiều thứ khác nhau mà không thứ nào đi qua mô hình.

- Một **beat khai `factList`** là tên khóa chứa danh sách thì chạy **mỗi mục một cảnh**, tối đa bằng `count`; danh sách không có thì beat không sinh cảnh nào và node ghi cảnh báo. Ràng buộc của beat khi đó là **tên trường trong mục**, không phải khóa cấp cao.
- Lúc khai triển, mỗi cảnh mang ràng buộc đã giải sẵn thành đường dẫn `items.<số>.<trường>`; Đóng Gói Timeline đọc đường dẫn đó (`readFactPath`). Dữ kiện là chuỗi rỗng coi như không có, để một trang không có mô tả không xóa trắng nội dung đã vẽ.
- Prompt đưa **dữ liệu của mục** kèm dòng cảnh, vì mô hình cần biết cảnh nói về cái gì để viết lời đọc; còn chữ trên hình vẫn lấy thẳng từ dữ kiện, không qua mô hình.

### 2.3. `ScenePlan`

Tự chứa: mỗi cảnh mang **bức vẽ của chính nó** và cả plan mang phong cách chung, nên Đóng Gói Timeline, engine và tệp dự án không cần tra registry nào. Họa Sĩ vẽ thẳng từng cảnh (5.9).

- `language` (Chuỗi, mã BCP 47): Ngôn ngữ của toàn bộ chữ trên màn hình và lời thoại.
- `frame` (`{width, height}`, mặc định 1080×1920): **tỉ lệ** các cảnh được vẽ cho, chọn trong bốn preset (9:16, 16:9, 1:1, 4:5). Hai con số là hệ tọa độ thiết kế mà code cảnh viết theo, không phải số điểm ảnh của tệp: độ phân giải chọn lúc Xuất MP4 (5.6).
- `style` (`{ name, css }`, mục 2.6): Phong cách chung của mọi cảnh trong lần chạy này.
- `transition` (`{ type, seconds }`, mặc định `fade` 0,4 s, mục 2.6): Cách cảnh này nhường cảnh sau, cho cả phim; `type` là một tên trong registry chuyển cảnh.
- `vars` (bản đồ tên → chữ hoặc ảnh, mặc định rỗng, mục 2.6): Giá trị của cả video.
- `scenes` (Danh sách, ít nhất một phần tử):
  - `weight` (Số dương): Trọng số thời lượng tương đối, chỉ dùng khi không có đoạn lời (5.4).
  - `source` (Chuỗi, tối đa 200 000 ký tự): Bức vẽ của cảnh — một đoạn HTML theo 2.8, nội dung đã viết thẳng vào markup.
  - `factBindings` (Đối tượng, tùy chọn): `khóaNộiDung → khóaTrongFacts`, chép từ `SceneScript`. Trong `source`, phần tử hiện khóa đó mang `data-fact="<khóaTrongFacts>"`; Đóng Gói Timeline giải giá trị và engine đổ vào (2.8). Dữ kiện luôn thắng chữ đã vẽ.
  - `stage` (bản đồ tự do, tùy chọn, 2.14): cảnh muốn các lớp xuyên phim ở đâu.
  - `format` (Chuỗi, tùy chọn): định dạng code của `source`, `html-gsap` khi vắng; thành `format` của đoạn trong IR.
  - `transitionAfter` (`{ type, seconds }`, tùy chọn): cách **riêng** cảnh này nhường cảnh sau, đè mặc định của phim tại đúng ranh giới đó; bỏ qua ở cảnh cuối. Thành `transitions.at[]` trong IR.

### 2.4. `AudioScript`

- `text` (Chuỗi): Lời thoại thuyết minh, cả bài.
- `language` (Chuỗi, mã BCP 47): Trùng với `ScenePlan.language` của cùng lần chạy.
- `segments` (tùy chọn, danh sách chuỗi): lời thoại **theo từng cảnh**, đúng thứ tự cảnh; `text` là các đoạn này ghép bằng xuống dòng. Biên Kịch và Kịch Bản Tĩnh luôn phát kèm; Giọng Đọc đọc từng đoạn và Đóng Gói cắt cảnh theo đoạn (5.3, 5.4).

### 2.5. `Voiceover`

- `audioUrl` (Chuỗi): Luôn ở dạng `/api/media/<mã băm>.mp3` tương đối với gốc ứng dụng, theo Kiến trúc Hệ thống mục 6. Không bao giờ là đường dẫn hệ tệp.
- `durationSeconds` (Số, hai chữ số thập phân): Đo lại từ chính tệp đã tạo, không lấy ước lượng của nhà cung cấp.
- `voiceName`, `language`, `speed`: Giọng đã dùng, ngôn ngữ của giọng đó (khác `AudioScript.language` nghĩa là đã dùng giọng dự phòng và phải kèm cảnh báo), hệ số tốc độ đã áp dụng.
- `words` (tùy chọn, danh sách `{text, start, end}` giây tính từ đầu tệp): mốc từng từ, do nhà cung cấp trả về hoặc do node Căn Mốc Từ căn chỉnh. Không có nghĩa là chưa ai đo.
- `segments` (tùy chọn, danh sách `{start, durationSeconds}`): mỗi đoạn lời một mục, đúng thứ tự, đo trên tệp thật, đã gồm khoảng lặng sau đoạn. Có khi `AudioScript` đến có `segments`.

### 2.6. Phong cách, chuyển cảnh và giá trị của cả video

Ba thứ **chung cho mọi cảnh** của một lần chạy nằm ở gốc `ScenePlan` và được chép nguyên sang IR. Mỗi cảnh vẽ trọn khung của nó; một tờ CSS chung làm chúng trông là cùng một phim.

- `style` = `{ name, css, captions? }`. Tờ CSS định nghĩa trên `.nc-scene` (gốc của mọi cảnh) các biến `--bg --fg --accent --muted --line --font-display --font-body`, nền và font chữ mặc định, và một bộ class dùng chung (tiêu đề, đoạn, thẻ, nhãn, con số, mục danh sách…) mà các cảnh dựng lên từ đó. Engine đặt nó trong `@scope ([data-composition-id])` **sau** CSS phụ đề mặc định. `captions = { left, right, bottom, size }` (px của khung) là **chỗ ngồi của dải phụ đề, dưới dạng số**: tờ CSS được đổi mặt chữ, màu, bóng và `--caption-on` của `.nc-captions-default` nhưng **không được dời nó** (không `top/bottom/left/right/inset/position/transform/margin`), vì lớp trải dài và bố cục từng cảnh phải tránh đúng dải đó và không đọc được một quy tắc CSS. Phim vẽ trước khi có thoả thuận này thì `captions` vắng và engine dùng mặc định của bản dựng (2.8, 2.10). Không `:root` (scope không tới), không `!important`, không `@import`. Font đóng gói: Comfortaa và JetBrains Mono (`public/fonts`); ngoài ra là system stack.
- `transition` = `{ type, seconds }` (mặc định `fade` 0,4 s): cách cảnh này nhường cảnh sau, mặc định cho cả phim; một cảnh đè riêng bằng `transitionAfter` (2.3). `type` là **một tên trong registry chuyển cảnh** (`contracts/visual/transitions.ts`, mục 4): rỗng trong lõi, engine tự lấp lúc khởi động, node xuất hỏi trước khi nạp và chặn bằng `ENGINE_TRANSITION_UNSUPPORTED` kèm danh sách tên engine đó có. Bốn tên `cut`, `fade`, `slide`, `zoom` mọi engine bắt buộc có (`REQUIRED_TRANSITIONS`), để IR bản 2 di trú lên vẫn chạy ở mọi engine; HyperFrames đăng ký thêm catalog của nó (`nodes/hyperframes-engine/transitions.ts`: `slide-left`, `slide-right`, `push-up`, `push-left`, `wipe-left`, `wipe-up`, `iris`, `blur`, `flip`), Remotion mới có bốn tên bắt buộc. Engine giữ cảnh trước còn hiện thêm đúng `seconds` sau mốc cắt, cảnh sau bắt đầu đúng mốc cắt và được vẽ đè lên, nên `cut` là 0 chồng lấn. IR không đổi độ dài cảnh vì chuyển cảnh: đó là chuyện của engine.
- `vars` (bản đồ tên → chữ **hoặc ảnh**, mặc định rỗng): **giá trị của cả video** — số tập, tên kênh, và **nhân vật hay logo** (`AssetUrlSchema`: ảnh tải lên theo mã băm, hay SVG nhúng). Cảnh vẽ bằng `data-var="<tên>"`: chữ đổ vào `textContent`, ảnh vào `src` của `<img>`; thiếu giá trị thì phần tử bị bỏ. Đóng Gói Timeline thêm `date` và `time` của lần chạy theo ngôn ngữ video, trừ khi plan tự đặt.

Ảnh và logo là **tài nguyên theo mã băm**: tải lên `POST /api/assets` (data URL ảnh, tối đa 2 MB) → `.nodecine/assets/<sha1>.<ext>`, tham chiếu bằng `/api/assets/<tên>`; máy chủ chỉ phục vụ tên hợp lệ. Khi kết xuất, engine chép mọi ảnh được tham chiếu **ở bất cứ đâu trong IR** (`source` của cảnh, `style.css`, `vars`) vào thư mục dự án và viết lại đường dẫn. Một SVG nhỏ (≤ 64 KB) có thể đi thẳng trong đồ thị dưới dạng data URL, để bản mẫu là một tệp.

Vùng an toàn (`contracts/visual/safe-zones.ts`): với khung dọc, cột nút bên phải, khối phụ đề dưới đáy, thanh trên và lề trái (72/168/260/680 px); khung ngang 96 px bốn bên. Một định nghĩa cho ba chỗ dùng — luật trong prompt, lint, và lớp kẻ trên khung xem trước.

### 2.7. Tài nguyên của cảnh

Ảnh và clip phải là asset mà máy đang giữ hoặc SVG nhỏ nhúng trực tiếp. `AssetUrlSchema` kiểm tra địa chỉ trước khi dữ liệu vào `SceneScript`; Họa Sĩ chỉ chép những địa chỉ được đưa trong nội dung và không được tự tạo URL. Từ vựng nội dung (2.11) là hợp đồng giữa chặng kịch bản và chặng hình.

### 2.8. Code cảnh

Mỗi cảnh là một đoạn HTML (`source`, tối đa 200 000 ký tự) theo định dạng duy nhất `html-gsap` (`SCENE_FORMAT`). Quy ước:

- **Markup**, kèm `<style>` (chỉ những gì riêng cảnh này — engine bọc trong `@scope ([data-scene="<id>"])`) và `<script>` tùy chọn. Không `<html>`, `<head>`, `<body>` (kiểm định IR từ chối, 3.1). Cảnh vẽ **trọn khung** của nó: gốc `.nc-scene` đã có nền và font từ `style.css` (2.6); cảnh dùng class và biến của tờ CSS chung, đặt vị trí bằng px trên hệ tọa độ `frame`, giữ nội dung trong vùng an toàn.
- **Chữ viết thẳng vào markup**: tiêu đề, ý, con số của cảnh nằm trong HTML, không có `data-prop` và không có bước đổ props. Chỉ hai thứ được đổ lúc chạy: `data-var="<tên>"` nhận giá trị của cả video (2.6) và `data-fact="<khóa>"` nhận dữ kiện đã giải cho cảnh (2.3, 5.4) — chữ vào `textContent` (số định dạng `en-US`), `<img>`/`<video>` nhận `src`, thiếu giá trị thì phần tử bị bỏ (`BIND_SCRIPT`, `contracts/visual/markup.ts`).
- Ảnh và clip: `<img src>` / `<video src>` trỏ vào tài nguyên đã tải lên; `timeVideos` (2.12) gắn mốc cảnh lên mọi thẻ video. `<em class="nc-emph">` là cụm nhấn màu accent.
- **Phụ đề**: cảnh nào có phần tử `data-slot="captions"` thì dòng phụ đề đổ vào đó, CSS của cảnh đặt vị trí và dáng (`data-caption-style="karaoke"` mặc định hay `"reveal"`, biến `--caption-on` cho từ đang đọc). Cảnh không khai slot nhận **dải mặc định** `.nc-captions-default`, đặt theo `style.captions` (2.8); tờ CSS phong cách đổi dáng nó được, dời chỗ thì không.
- `<script>` gọi `nodecine.timeline(tl)` với một GSAP timeline có mốc 0 là đầu cảnh; `gsap` nhận vào đã **scope vào cảnh** (chuỗi selector chỉ tìm trong cảnh, `SCOPED_GSAP`). Chỉ `fromTo`, không `from` (lệch khi tua). Renderer **tua** timeline theo thời gian tuyệt đối, nên không `repeat: -1` hay bất cứ gì phụ thuộc đồng hồ thật.
- **Không có gì sổ ra trong thân node.** Thân node là một dòng cho mỗi thứ, còn chỗ sửa là một hộp thoại: 220px đủ cho một dòng, không đủ cho một biểu mẫu, và một danh sách mở hết ra là một cột dài hơn màn hình. Một capsule khai `overlay` trong manifest, cửa sổ giữ đúng một `overlay = { nodeId, data }`, và hộp thoại nào nhận ra `data` của mình thì hiện. Bốn chỗ đang dùng: cảnh của Kịch Bản Tĩnh, dán kịch bản, nhịp của Biên Kịch, và vật của Bộ Dựng.

- Tên các móc (`nc-scene`, `data-slot="captions"`, `.nc-captions-default`, `data-var`, `data-fact`, `asset:`, `.nc-emph`, bảy biến của phong cách, API của `nodecine`) là hằng trong `contracts/visual/contract.ts`: Họa Sĩ viết theo đó, engine thực hiện, không bên nào định nghĩa lại.
- Script nhận `nodecine.root`, `nodecine.index` (số thứ tự cảnh, từ 0), `nodecine.duration` (giây), `nodecine.words` (từ giọng đọc nói trong cảnh, mốc từ đầu cảnh, rỗng khi chưa căn mốc) và hai trợ giúp (`SCENE_HELPERS`): `nodecine.when("cụm chữ")` — giây giọng đọc tới cụm đó (dò từ dài nhất, tiến dần), không có mốc thì rải các cụm được hỏi đều trên cảnh, để một ý **hiện đúng lúc được nói**; `nodecine.count(selector, vars)` — con số đếm từ 0 lên đúng giá trị đang hiện, giữ nguyên dấu nhóm. Khung xem trước chạy cùng script với `index` 0 và `words` rỗng.
- Không mạng, không tài nguyên ngoài. Renderer chạy code trong iframe có sandbox, không cùng origin với Studio, CSP `default-src 'none'`. Đây là ràng buộc an toàn, không phải tùy chọn.

---

### 2.10. `CaptionTrack`

Các dòng phụ đề trên đồng hồ của voice-over: `cues` (danh sách `{start, end, words}` giây, mỗi `words` là các từ có mốc). Chỉ có **nói gì, lúc nào**; nằm ở đâu, font gì, màu tô ra sao là của cảnh hay của tờ CSS phong cách (mục 2.6, 2.8). Một dòng không bao giờ sống quá lúc dòng sau bắt đầu, nên không có hai dòng chồng nhau. Cách gom từ thành dòng ở `core/captions/cues.ts`: theo câu trước, rồi tối ưu tổng chi phí ngắt dòng (dấu câu miễn phí, ngắt sau từ nối hay giữa một con số viết bằng chữ bị phạt nặng); mang từ cutdown, nơi các luật này đã đo trên lời thoại tiếng Việt thật.

### 2.11. `SceneScript` và từ vựng nội dung

Video đã chia cảnh nhưng chưa có giao diện — chặng kịch bản kết thúc ở đây, chặng giao diện bắt đầu từ đây.

- `language` (BCP 47).
- `scenes[]`: `{ role, weight, narration, content, factBindings? }`. `role` là tên beat (hook, quote, cta); `narration` là lời đọc trên cảnh đó, cảnh dài đúng bằng lời (5.4); `weight` chỉ còn dùng khi không có đoạn lời; `factBindings` là `khóaNộiDung → khóaDữKiện`.
- `content`: một đối tượng chỉ dùng các khóa của **từ vựng nội dung** (`CONTENT_KEYS`), khóa nào cũng tùy chọn, cảnh viết cái nó cần: `kicker` (nhãn 1–3 từ), `title` (tiêu đề ≤ 60 ký tự, cảnh nào cũng có), `body` (1–2 câu), `points` (2–4 dòng ngắn), `number` + `label` (một con số đúng dạng hiển thị và nó là gì), `quote` + `attribution`, `code` (một lệnh), `source` (nội dung lấy từ đâu), và `image` (ảnh của cảnh), `clip` (đoạn phim của cảnh), và `entries`.
- `entries` là **nhiều thứ cùng loại trong một cảnh**: hai mục để so sánh, năm hàng bảng xếp hạng, ba bước hướng dẫn. Mỗi mục dùng lại đúng từ vựng này, **sâu đúng một cấp** (mục chứa mục thì bị lược bỏ, không báo lỗi). Từ vựng không mọc thêm danh từ cho từng thể loại — nó mọc thêm một chiều là sự lặp lại, và mười lăm từ sẵn có đủ mô tả từng mục. Họa Sĩ nhận từng mục trong prompt cảnh và dàn chúng giống nhau (5.9).
- `image` và `clip` là các khóa **mô hình không được viết**, kể cả khi nằm trong một mục của `entries`: mô hình không thể biết tên một tài nguyên đã tải lên. `WRITTEN_KEYS` là mười khóa còn lại — lược đồ đầu ra của Biên Kịch và Phân Cảnh, danh sách trong prompt và ô ràng buộc dữ kiện đều chỉ nhận chúng. Ảnh vào cảnh bằng tay (ô chọn ảnh trên node Kịch Bản Tĩnh), bằng ràng buộc dữ kiện, hoặc là SVG nhúng mà bản mẫu mang sẵn (2.7).

Từ vựng là cố định để biên kịch không cần biết giao diện: mô hình viết theo mười khóa này, và Họa Sĩ đọc đúng mười khóa đó để vẽ (5.9). Thêm khóa là sửa lõi, có chủ ý.

## 3. Bản Đặc Tả Video Trung Gian (Universal Video IR)

Cấu trúc duy nhất do Node Đóng Gói Timeline tạo ra, độc lập với engine **và độc lập với mọi node**. Tự chứa: mỗi cảnh mang bức vẽ của nó và IR mang phong cách chung, nên một engine vẽ được IR mà không cần đăng ký gì, và một IR đã lưu phát lại được ở bất kỳ đâu. Đây là ranh giới giữa phần dựng nội dung và phần kết xuất.

- `irVersion` (Số nguyên): Phiên bản lược đồ, hiện là `3` (`contracts/types/ir-v3.ts`). Lược đồ đầy đủ và ngữ nghĩa ở `docs/IR_V3.md` mục 4 và 5; dưới đây là bộ khung. Điểm đọc nào có thể gặp IR bản 2 đã lưu (lịch sử việc, thẻ trong MP4, trình phát) gọi `migrateIR` (`contracts/types/migrate-ir.ts`) trước; Adapter từ chối nạp phiên bản không hỗ trợ với `IR_VERSION_UNSUPPORTED`.
- `meta`:
  - `title` (Chuỗi), `language` (Chuỗi BCP 47): Lấy từ tham số node và `ScenePlan`.
  - `fps` (Số nguyên): Mặc định 30, do tham số của Node Đóng Gói Timeline.
  - `width`, `height` (Số nguyên): Từ `plan.frame`.
  - `totalDurationInFrames` (Số nguyên): **Đồng hồ của phim, có thẩm quyền**; Đóng Gói Timeline suy nó theo 5.4.
- `style`, `vars`: Chép nguyên từ `ScenePlan` (2.6); `vars` đã thêm `date` và `time` của lần chạy.
- `tracks` (Danh sách rãnh, xếp chồng theo thứ tự mảng): mỗi rãnh `{ id, clips[] }`; các đoạn trong một rãnh không chồng lấn, được phép có khe hở. Một đoạn là:
  - đoạn mã `{ id, kind: 'code', startFrame, durationInFrames, format, source, facts? }`: cảnh theo nghĩa cũ, `format` hiện luôn `html-gsap`, `source` là bức vẽ (2.8), `facts` là dữ kiện đã giải theo `factBindings`;
  - đoạn media `{ id, kind: 'media', startFrame, durationInFrames, url, offsetSeconds, fit, loop, gain }`: một tệp phát thẳng, cho footage và nền chạy suốt phim.
- `beats` (Danh sách, ít nhất một): cách kịch bản nhìn phim — `{ index, startFrame, durationInFrames, clipId, stage? }`, liền nhau từ khung 0 tới hết, mỗi nhịp trỏ tới một đoạn mã. Phụ đề đổ vào khe `captions` của đoạn đó. `stage` là bản đồ tự do lõi không đọc.
- `audio` (Danh sách, có thể rỗng): `{ id, role: voice | music | ambient, url, startFrame, durationInFrames, gain, duck?, analysisUrl? }`. Tối đa một track `voice`; `words`, `when` và `captions` lấy mốc từ nó. Phim không có `audio` là phim không tiếng, hợp lệ. Cái từng gọi là `padTailFrames` là hiệu giữa đồng hồ và cuối track giọng (`padTailFramesOf`).
- `transitions`: `{ default: { name, seconds }, at?: [{ afterClipId, name, seconds }] }`. Bốn tên `cut`, `fade`, `slide`, `zoom` mọi engine bắt buộc có.
- `captions` (tùy chọn): `cues` của `CaptionTrack` đã đổi sang khung hình: `{startFrame, durationInFrames, words: [{text, startFrame, durationInFrames}]}`; mỗi từ ít nhất một khung, không dòng nào vượt quá tổng khung. Chỉ có khi có track `voice`. Không có `captions` là cùng video đó không phụ đề.

### 3.1. Bất biến do lõi kiểm định

Lõi có một hàm kiểm định IR chạy ở Node Đóng Gói Timeline trước khi phát và ở mọi Adapter trước khi nạp. Bản đặc tả không qua được kiểm định thì không bao giờ ra khỏi node. Bất biến:

1. Có ít nhất một đoạn trên một rãnh nào đó.
2. Trong một rãnh, các đoạn theo thứ tự `startFrame` và không chồng lấn.
3. Không đoạn nào và không track âm thanh nào kết thúc sau `meta.totalDurationInFrames`.
4. `beats[0].startFrame` bằng 0; mỗi nhịp bắt đầu đúng nơi nhịp trước kết thúc; tổng `durationInFrames` của các nhịp bằng đúng `meta.totalDurationInFrames`.
5. Mỗi nhịp trỏ tới một đoạn mã có thật và nằm trọn trong đoạn đó.
6. IR tự chứa: mọi đoạn mã mang một `source` không rỗng, và là một **đoạn** (không `<html>`, `<head>`, `<body>`).
7. Tối đa một track `voice`; có `captions` thì phải có track `voice`; không dòng phụ đề nào vượt quá đồng hồ.
8. Mỗi `duck.by` và mỗi `transitions.at[].afterClipId` trỏ tới một id có thật (và một đoạn nhịp, với chuyển cảnh).
9. Mọi `id` của rãnh, đoạn và track âm thanh là duy nhất trong bản đặc tả.

Một rãnh trống là hợp lệ nhưng vô nghĩa: kiểm định cảnh báo, không từ chối. Lược đồ đã chặn đoạn 0 khung.

Đây là bất biến cốt lõi số 3 của toàn dự án, được kiểm tra bằng mã chứ không bằng quy ước.

---

## 4. Renderer Theo Định Dạng Code: Cách Lõi Không Cần Biết Cảnh Là Gì

Lõi không có danh sách kiểu cảnh. Một cảnh là một bức vẽ trong IR (mục 2.8); mỗi đoạn mã mang `format` của nó, và lõi biết ba (`SCENE_FORMATS` trong `contracts/visual/contract.ts`): `html-gsap` là mảnh HTML kèm script gsap; `html-three` là mảnh HTML có `THREE` trong tầm với, tự vẽ mỗi khung qua `nodecine.frame`; `lottie` là JSON của bản hoạt hình, lõi bọc thành cảnh và lottie-web tua theo khung (`lottieScene`). Thư viện chỉ được nhúng vào trang khi có đoạn dùng tới (`nodes/hyperframes-engine/libs.ts`); three không có bản classic nên `scripts/vendor-three.mjs` đóng gói từ ES module lúc `nodes:prepare`. Thứ duy nhất engine phải đăng ký là **một renderer cho mỗi định dạng code** nó hiểu — `registerCodeRenderer(format, engineId, renderer)` (`contracts/visual/renderers.ts`) — và **một cách vẽ cho mỗi tên chuyển cảnh** — `registerTransition(name, engineId, impl)` (`contracts/visual/transitions.ts`) — cùng pattern với registry engine và nhà cung cấp. Từ 2026-09-10 tối engine là **một capsule như mọi node** (`nodes/hyperframes-engine/`, `nodes/remotion-engine/`): manifest khai `register.server` và `register.client`, registry sinh gọi chúng lúc khởi động; adapter có thêm năng lực tuỳ chọn `previewScene(options)` trả về trang một cảnh, và Studio vẽ storyboard qua `previewEngine()` chứ không tự dựng trang.

Vì `html-gsap` là định dạng của lõi và hai engine cùng vẽ nó, **bộ máy cảnh** nằm trong lõi (`contracts/visual/scene-markup.ts`): tách mảnh thành markup, style, script; đặt phụ đề vào khe; đóng dấu thời gian cho `<video>` trong cảnh; các tờ CSS nền và font; `BIND_SCRIPT` đổ giá trị vào `data-var`/`data-fact`; và `SCENE_MOUNT` — hàm `mountScene(gsap, root, scene, data, unwrap)` chạy script của cảnh với gsap khoanh vùng và đối tượng `nodecine` (`timeline`, `root`, `index`, `duration`, `words`, `when`, `count`, `beats`, `beat`, `audio`), trả về các timeline cảnh đã đăng ký. Catalog chuyển cảnh viết bằng gsap cũng là của lõi (`contracts/visual/gsap-transitions.ts`). Mỗi engine giữ phần của riêng nó: HyperFrames dựng **trang** (`document.ts`: một `.clip` mỗi đoạn, `data-track-index`, bootstrap gọi `mountScene` rồi ghép timeline chủ, catalog nhúng vào trang) và bản xem trước cảnh (`markup.ts`); Remotion dựng **composition** (`Video.tsx`: một `AbsoluteFill` mỗi rãnh, một `Sequence` mỗi đoạn, `scene-runtime.ts` gắn markup vào một `div` **ngoài tầm quản lý của React** — `mountSceneInto`, không phải `dangerouslySetInnerHTML`, vì React 19 so prop đó theo định danh object chứ không theo chuỗi bên trong, nên một component dựng object tại chỗ sẽ ghi đè lại markup mỗi lần render, tức mỗi khung, xoá sạch style gsap vừa viết và bỏ timeline lại với những node đã rời tài liệu — rồi chạy `mountScene`, và mỗi khung `seek` timeline chủ của cảnh tới giây hiện tại; chuyển cảnh là style theo tiến độ từ catalog riêng `transitions.ts`, cùng mười ba tên).

- Cả hai engine vẽ được cả ba định dạng: HyperFrames nhúng thư viện vào trang, Remotion nạp `lottie-web` và `three` vào `window` khi phim có đoạn dùng tới (`loadFormatLibs`). `nodecine.frame(fn)` là hợp đồng chung cho cảnh tự vẽ từng khung: lõi treo `fn` lên một timeline dài bằng cảnh, nên nó chạy khi tua, ở trang cũng như lúc kết xuất, và không bao giờ theo đồng hồ thật.
- Node Xuất Bản Video và Node Xuất MP4, trước khi nạp, hỏi `unsupportedFilmBlock(engine, ir)`: tra **`format` của từng đoạn mã trong IR** (không phải hằng số) với `engineId` đang nối vào, rồi tra từng tên chuyển cảnh phim dùng trong registry chuyển cảnh cùng mẫu (`registerTransition(name, engineId, impl)`). Thiếu renderer thì node chuyển `blocked` với viền vàng và mã `ENGINE_SCENE_UNSUPPORTED` kèm tên định dạng; thiếu chuyển cảnh thì `ENGINE_TRANSITION_UNSUPPORTED` kèm danh sách tên engine có. Cả hai engine có `html-gsap` và mười ba tên chuyển cảnh; khác nhau ở chỗ Remotion chưa lặp được đoạn media video (IR không mang độ dài tệp) và ghi đè hình bằng style theo khung thay vì tween.
- Một kiểu cảnh mới không đụng tới lược đồ IR, Adapter hay node lõi, và cũng không đụng tới code: Họa Sĩ vẽ cảnh cho từng kịch bản, không ai phải thêm tay.

---

## 5. Node Lõi (Core Nodes)

Lõi ship đúng những node cần để dựng được video từ một kịch bản gõ tay, không phụ thuộc mạng, không phụ thuộc mô hình ngôn ngữ.

### 5.1. Nhập Liệu (Input Trigger)

Ô văn bản, phát `SourceRef`. Không diễn giải, không gọi mạng. Ô trống là lỗi kiểm tra liên tục `INPUT_EMPTY`.

### 5.2. Kịch Bản Tĩnh (Static Script)

Node phát `SceneScript` (2.11) và `AudioScript` từ nội dung gõ tay, dành cho việc dựng video không cần mô hình ngôn ngữ và để kiểm thử khung. Không cổng nhận: chặng kịch bản không cần biết giao diện, Họa Sĩ đứng sau sẽ vẽ. Tham số:

- Không còn ô lời thoại chung: `AudioScript.text` là các `narration` ghép lại, `segments` là từng đoạn. Không có tham số ngôn ngữ: người dùng đã viết lời cuối cùng nên ngôn ngữ của văn bản chính là ngôn ngữ của video. Node nhận diện bằng hàm thuần `detectLanguage(text)` của lõi (theo hệ chữ viết; chữ Latinh có dấu riêng của tiếng Việt thì là `vi`, chữ Latinh khác coi là `en`) và điền vào `SceneScript.language` lẫn `AudioScript.language`. Đoán sai thì người dùng chọn giọng tay trên Giọng Đọc.
- `scenes`: mỗi mục gồm `role`, `weight`, `narration` (lời đọc trên cảnh) và `content` theo từ vựng (2.11). Thân node chỉ hiện **mỗi cảnh một dòng** (vai, chip cho từng khóa nội dung, chữ đầu của lời — `nodes/script/summary.ts`, thuần); sửa trong **hộp thoại cảnh** (`SceneEditorDialog`, mở qua `sceneEditor` trong store), nơi có một ô cho mỗi khóa đang dùng, một ô chọn để thêm khóa, `points` mỗi dòng một ý, và các mục của `entries` dàn ngang. Lý do: hai mục có ảnh không nhét được vào 220px của node, và hai mươi cảnh mở hết là một cột dài hơn màn hình. Vẽ là việc của Họa Sĩ. Mặc định là ba cảnh `title / how / next`, mỗi cảnh một câu lời.

- **Dán kịch bản** (`nodes/script/split.ts`): một nút trên thân node mở hộp thoại nhận cả kịch bản rồi cắt thành cảnh, vì kịch bản viết ra là một khối văn xuôi chứ không phải từng cảnh một. Ba luật cắt do người chọn — dòng trống, mỗi dòng, mỗi câu — vì chỉ người viết mới biết mình đã viết theo lối nào; luật câu cắt nhầm ở chữ viết tắt (`v.v.`, `T.P.`), đó là lý do có ba luật chứ không phải một. Cắt là thuần cơ học: không gọi mô hình, không sửa một chữ nào, chỉ gộp khoảng trắng — số cảnh hiện ngay trên nút để đọc trước khi bấm. Bấm xong thì **thay** danh sách cảnh: mỗi khúc một cảnh, `weight` 1, `content` rỗng, `role` lấy theo cảnh đầu đang có. Đi qua `setParams` nên Ctrl+Z hoàn lại nguyên danh sách cũ.

Không có `factBindings` vì không có nguồn dữ kiện; người dùng gõ thẳng giá trị.

Từ 2026-09-11, hộp sửa cảnh có thêm hai ô: **nhường cảnh sau bằng** (mặc định của phim, hay một tên trong registry chuyển cảnh cùng số giây; mờ ở cảnh cuối) thành `transitionAfter`, và **stage** (một JSON object, chỉ lưu khi phân tích được) thành `stage`; cả hai đi nguyên qua Họa Sĩ vào plan và IR (2.3, 2.14).

### 5.3. Giọng Đọc (TTS Engine)

Nhận `AudioScript` và `TTSRef`, chọn giọng khớp ngôn ngữ theo quy tắc ở mục 8.2, gọi nhà cung cấp, đo thời lượng từ tệp đã tạo, phát `Voiceover`. Tham số: `voice` (để trống là tự chọn theo ngôn ngữ), `speed`.

Khi `AudioScript` có `segments` (từ hai đoạn trở lên), node đọc **từng đoạn một** rồi nối bằng ffmpeg (`services.concatAudio`), chèn 0,35 giây lặng sau mỗi đoạn — hơi thở giữa hai ý và cũng là chỗ cảnh cắt. `Voiceover.segments` ghi đoạn nào bắt đầu ở đâu, dài bao lâu (gồm khoảng lặng), tổng đo lại trên tệp đã nối. Cách này học từ cutdown: cảnh dài đúng bằng lời của nó, không cần căn mốc từ mới khớp, và sửa lời một cảnh chỉ đọc lại cảnh đó (mỗi đoạn là một lần gọi riêng, cùng câu cùng giọng thì nhà cung cấp trả tệp đã có). Mốc từ nhà cung cấp trả theo đoạn được dời theo `start` của đoạn. Một đoạn nhà cung cấp trả lỗi upstream (504, đứt kết nối) được gọi lại đúng một lần sau hai giây; lần hai lỗi thì node lỗi.

### 5.4. Đóng Gói Timeline (Timeline Assembler)

Nhận `ScenePlan` (bắt buộc); `Voiceover`, `FactSheet`, `CaptionTrack` (tùy chọn), `LayerSpec` (cổng `layers`, nhiều dây) và `AudioTrackSpec` (cổng `audio`, nhiều dây). Tham số: `fps` (30), `minTotalFrames` (270), `title`, `durationSeconds` (tùy chọn). Kích thước khung lấy từ `plan.frame`, không phải tham số ở đây. Hàm thuần, không gọi mạng; ngoài `NO_CLOCK`, thất bại đồng nghĩa lỗi lập trình.

Đồng hồ của phim, theo thứ tự thẩm quyền (`clockOf`, `docs/IR_V3.md` 5.3): có `Voiceover` thì theo quy tắc 1 và 2 dưới đây, và `durationSeconds` nếu có bị bỏ qua kèm một dòng nhật ký; không có giọng thì bằng `durationSeconds × fps` làm tròn lên, **đúng bằng**, không đệm tới `minTotalFrames` — một logo sting ba giây xin ba giây thì được ba giây; không có cả hai thì bằng âm thanh dài nhất nối vào `audio` (một video ca nhạc dài bằng bản nhạc); không có gì cả thì node lỗi `NO_CLOCK` kèm cách sửa. Tham số đứng trước âm thanh vì nhạc nền hầu như luôn dài hơn phim nó nằm dưới. Phim không giọng phát `audio` rỗng; `CaptionTrack` nối vào mà không có giọng bị bỏ với cảnh báo `CAPTIONS_WITHOUT_VOICE`, vì phụ đề là dòng của giọng (bất biến 7).

Quy tắc phân bổ thời lượng, tất định:

1. Số khung hình âm thanh bằng `durationSeconds × fps`, làm tròn lên.
2. Tổng số khung hình bằng giá trị lớn hơn giữa số khung hình âm thanh và `minTotalFrames`; phần chênh là đuôi lặng (`padTailFramesOf`), track giọng không bao giờ dài hơn phim.
3. **Cắt theo lời** khi `Voiceover.segments` có đúng một mục cho mỗi cảnh: `durationInFrames` của mỗi cảnh trừ cảnh cuối bằng `durationSeconds` của đoạn nhân `fps`, làm tròn, ít nhất 1; cảnh cuối nhận phần còn lại (kể cả đuôi lặng); nếu làm tròn dồn khiến cảnh cuối âm thì rút từng khung từ cảnh dài nhất. Không có đoạn lời, hay không có giọng, thì theo trọng số: với mỗi cảnh trừ cảnh cuối, `durationInFrames` bằng phần nguyên (làm tròn xuống) của `tổng × weight / tổng các weight`. Cảnh cuối nhận toàn bộ phần còn lại. Cách này loại bỏ mơ hồ khi làm tròn giá trị nằm đúng giữa hai số nguyên, và đảm bảo tổng luôn khớp tuyệt đối theo cấu trúc chứ không theo may rủi. Trường hợp biên: nếu trọng số quá lệch và tổng khung quá nhỏ khiến phần nguyên của một cảnh bằng 0, cảnh đó nhận 1 khung và cảnh cuối bị trừ 1 khung tương ứng (tổng vẫn giữ nguyên, bất biến 4 ở mục 3.1 được bảo toàn); nếu sau khi mượn mà cảnh cuối cũng về 0, hoặc tổng khung nhỏ hơn số cảnh, node báo lỗi lập trình thay vì tạo IR sai.
4. `startFrame` tích lũy từ 0.
5. Giải dữ kiện: với mỗi cảnh có `factBindings`, `facts[khóa]` của đoạn mã tương ứng bằng `facts[khóa]` cho mọi khóa có mặt trong `FactSheet.facts` và nói được điều gì (chuỗi rỗng bị bỏ qua); engine đổ vào phần tử `data-fact` của cảnh (2.8). Dữ kiện luôn thắng chữ đã vẽ. Plan có ràng buộc mà không dây `facts` thì cảnh báo `FACTS_NOT_CONNECTED`.
6. Rãnh: các lớp nối vào `layers`, theo thứ tự dây, được đánh số `layer-<n>` chung cho cả hai vị trí; mỗi lớp thành một rãnh một đoạn, kẹp vào phim (`layerTrack`): bắt đầu ở `startSeconds`, dài `durationSeconds` hoặc tới hết phim. Rãnh xếp: các lớp `under` theo thứ tự dây, rồi `scenes`, rồi các lớp `over`, dây cuối trên cùng. Lớp bắt đầu sau khi phim hết là lỗi `LAYER_OUTSIDE_FILM`, không phải bỏ qua. `stage` của mỗi cảnh trong plan chép sang `beats[i].stage`.
7. Cắt theo nhịp: tham số `snapToBeat` (mặc định tắt). Bật, và có một `AudioTrackSpec` mang `beatSeconds` (do Phân Tích Âm Thanh đo, 5.21), thì mỗi **mốc cắt** giữa hai cảnh dời tới nhịp gần nhất trong vòng nửa giây (`snapToBeats`); mốc đầu và cuối phim không phải mốc cắt nên không dời, không cảnh nào bị bóp về 0, và tổng khung giữ nguyên theo cấu trúc nên bất biến 4 vẫn đúng dù nhạc thế nào.
8. Track âm thanh: các `AudioTrackSpec` nối vào `audio`, theo thứ tự dây, thành `audio[]` sau track giọng, đặt tên `<role>-<n>` (`music-1`, `ambient-2`), kẹp vào phim (`audioTrackOf`): bắt đầu ở `startSeconds`, dài `playSeconds`, hoặc hết phim nếu `loop`, hoặc hết tệp; `duckTo` thành `duck: { by: 'voice', to }` **chỉ khi có giọng** (bất biến 8). Bắt đầu sau khi phim hết là `AUDIO_OUTSIDE_FILM`.
9. Chạy hàm kiểm định IR ở mục 3.1 trước khi phát.

Ví dụ đối chiếu với trọng số 1, 2, 1 và âm thanh 11.2 giây ở 30 fps: 336 khung, phân bổ 84, 168, 84, bắt đầu 0, 84, 252. Với âm thanh 7.5 giây: 225 khung nhỏ hơn 270 nên tổng là 270, đuôi lặng 45, phân bổ 67, 135, 68. Không giọng và `durationSeconds` 3: 90 khung, phân bổ 22, 45, 23, `audio` rỗng. Phần dư dồn cho cảnh cuối luôn nhỏ hơn số cảnh trừ một, tức nhỏ hơn 2 khung với ba cảnh.

### 5.5. Xuất Bản Video (Video Output)

Nhận `VideoIR` và `EngineRef`. Tra renderer theo định dạng code (mục 4), tra adapter registry theo `engineId`, gọi `mountPlayer()`. Chính là trình phát; không có cổng phát, không có node xuất. Giao diện chi tiết tại Đặc tả Luồng Trải nghiệm mục 1.4.

### 5.6. Xuất MP4 (MP4 Export)

Nhận `VideoIR` và `EngineRef`, bỏ qua mặc định. Tham số `ExportSettings`:

- `codec`: `h264` mặc định, `h265` tùy chọn.
- `quality`: `high` (CRF 18), `medium` (CRF 23), `low` (CRF 28); giá trị CRF là chi tiết của Adapter.
- `fileName`: Không kèm đường dẫn, mặc định theo tên dự án, ký tự không hợp lệ thay bằng gạch ngang.

Hành vi: khi đang bỏ qua, Chạy Luồng không chạm tới; bấm Kết xuất là chạy riêng node theo Đặc tả Bộ Máy Thực Thi mục 3; node bị vô hiệu hóa khi thiếu dây, khi `EngineRef.capabilities.render` không phải `ready`, hoặc khi thiếu renderer cho một `sceneType`. Trong lúc chạy hiện tiến độ và nút Hủy; xong hiện tên tệp, dung lượng, node Tải xuống; kết quả gắn vào lịch sử chạy. Nhiều node xuất trên cùng đồ thị là hợp lệ.

Tham số `resolution` (`1080p` mặc định, `1440p`, `2160p`) chọn độ phân giải theo cạnh ngắn của khung: `1080p` đúng bằng hệ tọa độ thiết kế của plan, `2160p` phóng khung 1080×1920 thành 2160×3840. Engine HyperFrames giữ nguyên bố cục theo pixel thiết kế và `transform: scale` gốc composition theo hệ số, nên code cảnh không cần biết độ phân giải.

### 5.7. Node tài nguyên: Động Cơ, Mô Hình Ngôn Ngữ, Giọng Đọc

Có **một node cho mỗi kiểu cổng**, không phải một node cho mỗi nhà cung cấp. Node Mô Hình Ngôn Ngữ phát `LLMRef`, node Giọng Đọc phát `TTSRef`, và nhà cung cấp là tham số chọn trong hộp thả, giống cách Load Checkpoint của ComfyUI chứa mọi checkpoint. Tham số của node là `{providerId, settings}`; lõi không kiểm tra `settings` vì lõi không được biết danh sách nhà cung cấp, việc kiểm định thuộc về chính nhà cung cấp lúc dựng. Thêm một nhà cung cấp là thêm một dòng vào `providers/installed.ts`, không thêm node, không sửa giao diện.

Mô tả ở mục 6, 7 và 8. Cả ba dùng chung khuôn: không cổng nhận, một cổng phát, `run() = probe()`, tham chiếu là dữ liệu tuần tự hóa được.

### 5.8. Biên Kịch (Screenwriter)

Có **một node biên kịch**, trong lõi. Cổng nhận: `FactSheet`, `SourceRef` và `PlateSheet`, cả ba tùy chọn; phát `SceneScript` (2.11) và `AudioScript`. Node **không biết giao diện**. Đó là chặng sau (Họa Sĩ, 5.9), nên sửa giao diện không bao giờ chạy lại mô hình. Mọi thứ từng khiến mỗi loại video cần một node biên kịch riêng đều là **tham số** hoặc **dữ liệu trên dây**:

- `prompt` — đề bài người dùng viết. Thứ duy nhất chỉ người dùng nói được.
- `beats` — danh sách **beat**: `{ role, brief, weight, count, factBindings }`. `role` là tên ngắn của một đoạn (hook, quote, cta), cũng là vai một bố cục được gán theo; `brief` nói đoạn đó làm gì; `count` là số cảnh liên tiếp; `factBindings` là `khóaNộiDung → khóaDữKiện`.
- `outputLanguage` (`auto` = ngôn ngữ của đề bài và dữ kiện).

Mô hình viết **lời đọc và nội dung từng cảnh** theo từ vựng cố định (2.11): mỗi beat khai triển thành `count` phần tử, mỗi phần tử là `narration` cộng đối tượng nội dung trừ các khóa đã ràng buộc dữ kiện; ngân sách từ của lời tính theo trọng số (khoảng 13–17 từ cho một đơn vị, tức năm giây). Không còn lời thoại chung cho cả bài: lời cả bài là các đoạn ghép lại. Lược đồ đầu ra là từ vựng nội dung, không phụ thuộc giao diện. Mô hình phải trả về đúng số cảnh, đúng thứ tự; khóa lạ bị bỏ, không bị từ chối.

**Danh mục bố cục trên cổng nhận** (5.23): có `PlateSheet` nối vào thì prompt in ra đúng những bố cục phim đang có, mỗi bố cục là một danh sách khóa kèm ngân sách ký tự, và mỗi cảnh phải viết đúng một bố cục — đủ khóa của nó, không thừa khóa nào. Từ vựng in ra cũng thu về những khóa mà một bố cục nào đó thật sự vẽ. Đây là luật chép nguyên của cutdown: *thứ mô hình nhìn thấy là thứ nó viết ra được*, nên in một hình dạng không ai vẽ là mời một cảnh mà Dựng Cảnh sẽ từ chối, sau khi nửa đắt nhất của lần chạy đã trả tiền rồi. Không có dây nào thì node viết như cũ, cả từ vựng đều mở. Cảnh nào viết ra hình dạng ngoài danh mục thì node ghi cảnh báo kèm số thứ tự cảnh; chặn thật vẫn là việc của Dựng Cảnh.

Ba bất biến do node này giữ:

1. **Khóa đã ràng buộc không bao giờ được hỏi mô hình**, và **dữ kiện đã ràng buộc không bao giờ vào prompt**. Số sao, lệnh cài, đường dẫn đi thẳng từ `FactSheet` tới Đóng Gói Timeline; mô hình không có gì để chép sai.
2. Prompt được dựng từ các nguồn tách bạch: đề bài mang ý đồ, beat mang cấu trúc, từ vựng nội dung mang hình dạng, dữ kiện mang sự thật. Không có gì trong prompt nói về một loại video hay một giao diện cụ thể.
3. Đổi giao diện không chạy lại Biên Kịch: Họa Sĩ không nằm trong chữ ký của node này, nên sửa mô tả phong cách chỉ chạy lại Họa Sĩ và Đóng Gói Timeline.

Vòng gọi mô hình (`contracts/ai/structured-completion.ts`): sai cấu trúc thử lại một lần, sai ngôn ngữ thử lại một lần với prompt nghiêm hơn, rồi ném `LLM_SCHEMA_INVALID` hoặc `LLM_LANGUAGE_MISMATCH` kèm nguyên văn câu trả lời để node hiển thị. Chính sách ngôn ngữ ở `core/text/languages.ts`. Beat và lược đồ ở `nodes/screenwriter/beats.ts`, prompt ở `nodes/screenwriter/prompt.ts`.

Hệ quả: một video GitHub showcase là *node này* với bảy beat và ba ràng buộc dữ kiện, rồi một Họa Sĩ với mô tả "phong cách lập trình viên nền tối"; một video trích dẫn là *node này* với beat `title ×1, quote ×4`, rồi một Họa Sĩ với mô tả "thẻ trích dẫn trên nền mực". Người dùng dựng cả hai từ canvas trống; sự khác nhau nằm trọn trong chữ, và một bản mẫu chia sẻ mang theo giao diện dưới dạng một câu mô tả.

### 5.9. Họa Sĩ (Illustrator) — đã gỡ 13/9

Node `core/illustrator` vẽ một tờ phong cách rồi vẽ **từng cảnh** của phim, mỗi lần chạy. Nó bị gỡ ngày 13/9 vì ba node đã làm hết việc của nó, rẻ hơn và ổn định hơn: Bối Cảnh (5.22) vẽ phong cách với các vật xuyên phim, Vẽ Bố Cục (5.23) vẽ một bố cục cho mỗi *hình dạng* nội dung thay vì mỗi cảnh, Dựng Cảnh (5.24) đổ chữ vào mà không gọi mô hình. Đầu vào và đầu ra của cả chuỗi giống hệt nó: `SceneScript` vào, `ScenePlan` ra.

Đồ thị đã lưu tự đi lên: một node Họa Sĩ (hay Đạo Diễn Mỹ Thuật cũ hơn) thành một Bối Cảnh mang mô tả phong cách, tỉ lệ, nền và vật xuyên phim của nó; một Vẽ Bố Cục; và một Dựng Cảnh giữ nguyên định danh cũ, nên mọi dây đọc `plan` không phải đổi.

**Thứ mất đi, nói rõ:** Họa Sĩ là nơi duy nhất viết `stage` cho từng cảnh, vì quyết định đặt chiếc điện thoại ở đâu trong cảnh này và chừa chỗ cho nó trong bố cục là cùng một quyết định. Một bố cục dùng lại cho nhiều cảnh không quyết được điều đó. Bù lại: Vẽ Bố Cục nhận danh sách lớp và được cho biết **lằn** phải chừa, nên bố cục nào cũng để trống chỗ đó; và vật xuyên phim được yêu cầu **tự chọn đường đi** khi không cảnh nào chỉ chỗ, thay vì đứng yên.

### 5.10. Vì sao giao diện là một chặng sau kịch bản

Quy trình là kịch bản → hình → dựng. Biên kịch chỉ viết nội dung theo từ vựng cố định (2.11); Họa Sĩ đứng sau đọc từng cảnh và vẽ nó. Đổi giao diện là chạy lại Họa Sĩ, không chạy lại Biên Kịch.

Mỗi cảnh là một bức vẽ trọn khung với chữ viết thẳng vào. Không có bước chọn khuôn hay ánh xạ trường; phần dùng chung duy nhất là tờ CSS của cả video.

### 5.11. Truy Xuất Repo (GitHub Fetcher)

Node lõi `core/github-fetcher`: nhận `SourceRef`, phát `FactSheet`. Link repo GitHub thì gọi GitHub API ngay trong node (mục 9.1) để lấy tên, mô tả, sao, ngôn ngữ, chủ đề, lệnh cài suy từ README, trích README. Văn bản thường thì đi qua nguyên vẹn (`mode: passthrough`) để đồ thị GitHub vẫn chạy được với một đoạn mô tả gõ tay. Lỗi có mã riêng: `REPO_NOT_FOUND`, `REPO_RATE_LIMITED` (thử lại được), `REPO_NETWORK` (thử lại được). Cả họ ở `nodes/github/`: node, đọc link, gọi GitHub, dựng dữ kiện, thân node, test. Đây là mẫu cho mọi node lấy dữ liệu về sau (RSS, YouTube, …): một thư mục `nodes/<nguồn>/` chứa trọn họ đó, như `comfy_extras/nodes_<chủ đề>.py` của ComfyUI.

### 5.12. Căn Mốc Từ (Transcribe)

Node lõi `core/transcribe`: nhận `Voiceover` và `AudioScript`, phát `Voiceover` có `words`. Là **căn chỉnh cưỡng bức**, không phải nhận dạng: văn bản đã biết, công cụ chỉ trả lời mỗi từ được đọc lúc nào, nên model nhỏ là đủ và chữ không bao giờ sai. Chạy qua `services.alignWords` → `nodes/transcribe/align.server.ts` gọi `stable-ts` bằng Python trong venv `.nodecine/tools/stable-ts` (`npm run setup:align` cài một lần; `NODECINE_ALIGN_PYTHON` ghi đè); lời thoại đi qua stdin, đường dẫn audio dựng lại từ tên băm của `audioUrl`. Kết quả qua `retime` để chữ là chữ của kịch bản, chỉ mượn mốc thời gian. Voice-over đã có `words` (nhà cung cấp trả sẵn, ví dụ ElevenLabs sau này) thì đi qua nguyên vẹn. Tham số: `model` (`small` mặc định, `medium`, `large-v3`). Thiếu công cụ báo `PROVIDER_NOT_INSTALLED` kèm lệnh cài; căn chỉnh hỏng báo `ALIGN_FAILED`.

Đầu ra của bộ căn là một JSON mỗi từ một mục, dài quá trần 8 KB mặc định của `exec` từ khoảng 150 từ trở lên; node đặt trần riêng 8 MB và coi đầu ra bị cắt là lỗi `ALIGN_FAILED` nêu rõ, không đọc JSON cụt.

Từ 2026-09-11 cổng `script` là **tùy chọn**, và đó là hai chế độ chứ không phải một. Có kịch bản thì **căn**: chữ là của mình, mô hình chỉ nói từng từ được đọc lúc nào, nên lời thoại không bao giờ trả về sai chính tả. Không có kịch bản thì **nhận dạng**: một bản thu người dùng đưa vào thì không ai trong ứng dụng biết trong đó nói gì, nên mô hình phải nghe ra chữ rồi mới đặt mốc được. Script Python chọn nhánh theo việc stdin có chữ hay không; nghe không ra chữ nào là `TRANSCRIBE_NO_WORDS`. Nhờ vế thứ hai, gắn phụ đề lên một bản thu có sẵn mới đi được từ đầu tới cuối.

### 5.13. Phụ Đề (Captions)

Node lõi `core/captions`: nhận `Voiceover` có `words`, phát `CaptionTrack` (mục 2.10). Hàm thuần. Tham số duy nhất: `maxChars` (26), vì số ký tự một dòng chứa được là số đo bề rộng dải phụ đề. Voice-over không có `words` là lỗi `CAPTIONS_NO_WORDS` kèm hướng dẫn nối qua Căn Mốc Từ. Năm bản mẫu đều mang sẵn cặp Căn Mốc Từ → Phụ Đề **đang bật**, nối vào cổng `captions` tùy chọn của Đóng Gói Timeline; tắt hai node là video không phụ đề và các mục danh sách rải đều thay vì theo lời (quy tắc cổng tùy chọn sau node bị bỏ qua ở Bộ Máy Thực Thi mục 2). Engine HyperFrames đổ các dòng vào chỗ `data-slot="captions"` của từng cảnh (dòng cắt ngang hai cảnh được vẽ ở cả hai), bật tắt dòng và tô từ trên timeline gốc; cảnh không khai chỗ thì engine thêm dải mặc định `.nc-captions-default` trong vùng an toàn dưới, tờ CSS phong cách có thể viết đè (2.8).

---

### 5.14. Truy Xuất Trang (Web Fetcher)

Node lõi `core/web-fetcher`: nhận `SourceRef`, đọc **mọi đường dẫn trong đó**, mỗi dòng một trang, tối đa `maxPages`; phát `FactSheet`. Giá trị không phải địa chỉ web thì đi thẳng qua dưới dạng chữ, y như Truy Xuất Repo, nên đồ thị không vỡ khi người dùng gõ một chủ đề.

Dữ kiện trả về: `items` là danh sách các trang đã đọc (mục 2.2b) và `count` là số trang; trang đầu còn nằm ở cấp cao nên đồ thị chỉ có một link đọc y như cũ. Mỗi mục đặt tên **trùng từ vựng nội dung** ở chỗ nào trùng được (`title`, `body`, `source`, `image`), để một beat ràng buộc thẳng bằng tên; `url`, `siteName`, `publishedAt` là ba trường còn lại. Một link chết chỉ là cảnh báo, chỉ khi mọi link đều hỏng node mới lỗi; ảnh chụp không ra cũng chỉ là cảnh báo, trang vẫn giữ tiêu đề và ảnh của chính nó. `image` là **tài nguyên đã tải về máy** (`/api/assets/<băm>`), không phải link ngoài: ảnh trang tự khai (`og:image`) được tải xuống và giữ lại, vì cảnh chỉ được hiện ảnh máy này đang giữ (mục 2.7).

Tham số: `screenshot` (mặc định tắt), `width`, `height`. Bật thì node mở trang trong trình duyệt không giao diện mà bộ kết xuất vẫn dùng, chụp một ảnh, giữ làm tài nguyên và ưu tiên nó hơn `og:image`. Chụp tốn một lần khởi động trình duyệt nên là một lựa chọn, không mặc định.

An toàn (mục 9.2), vì đồ thị là tệp người ta chia sẻ còn lần gọi thì chạy trên máy người mở:

- Địa chỉ được **phân tích rồi dựng lại** từ các phần, không đi nguyên văn ra mạng; chỉ `http` và `https`; bỏ phần neo; từ chối địa chỉ có tên đăng nhập và mật khẩu.
- Từ chối host của chính máy hay mạng nội bộ: `localhost`, `*.local`, `*.internal`, dải 10/8, 127/8, 172.16/12, 192.168/16, 169.254/16 (gồm cả địa chỉ metadata của máy chủ đám mây), multicast, và IPv6 loopback hay unique-local. Đây là chặn theo **tên host**, không phải theo IP sau khi phân giải, nên một tên miền công cộng trỏ về nội bộ vẫn lọt: giới hạn đã biết.
- Chuyển hướng đi từng bước, mỗi bước kiểm lại như trên, tối đa ba lần.
- Trang cắt ở 2 MB, ảnh cắt ở 2 MB và phải đúng kiểu ảnh; đọc theo luồng nên phản hồi vô tận không làm đầy bộ nhớ.
- Đọc thẻ meta bằng biểu thức trên phần `<head>`, không dựng DOM, không chạy script của trang.

Mã lỗi: `PAGE_URL_INVALID`, `PAGE_NOT_FOUND`, `PAGE_NETWORK` (thử lại được), `PAGE_TOO_BIG`, `SHOT_FAILED` (thử lại được). Ảnh trang lấy hụt không làm hỏng lần chạy, chỉ ghi cảnh báo.

### 5.15. Nhạc Nền (Music Bed)

Node lõi `core/audio-mix`: nhận `Voiceover` (tùy chọn), phát hai đầu ra. `voiceover` là bản trộn **dài đúng bằng bản gốc**, chỉ khác ở tệp âm thanh, nhờ vậy `words` và `segments` đi qua nguyên vẹn và mọi mốc thời gian phía sau (cảnh dài bao nhiêu, phụ đề rơi vào đâu) không phải tính lại. `track` là chính bản nhạc dưới dạng `AudioTrackSpec` (2.15): vai `music`, `gain` = `volume`, lặp, fade theo hai tham số, `duckTo` = `volume × (1 − duck)`; nối vào cổng `audio` của Đóng Gói thì engine phát nhạc bên cạnh giọng, và phim không có giọng vẫn có nhạc. Bản nhạc vào kho media qua `audio-mix/import` (`importLibraryAudio('music', …)` trong `server/audio.ts`, băm theo byte, chuyển MP3).

Nhạc là tệp có bản quyền của người dùng nên **không đi qua đồ thị**: người dùng bỏ tệp vào `.nodecine/music` (`NODECINE_MUSIC_DIR` ghi đè), node chỉ giữ **tên tệp**. `GET /api/library/music` liệt kê tên các bản nhạc trên máy này cho ô chọn trong thân node. Tên nhạc được kiểm theo mẫu chặt (chữ, số, khoảng trắng, `. _ ' ( ) -`, đuôi mp3/m4a/aac/wav/ogg/flac) rồi ghép vào thư mục nhạc; bất cứ tên nào có thể đi ra khỏi thư mục đều bị từ chối (mục 9.2). Đồ thị chia sẻ cho người khác mở trên máy trống thì tên nhạc vẫn còn trong ô chọn nhưng lần chạy báo lỗi rõ tên bản nhạc thiếu.

Không chọn bản nhạc nào **không phải lỗi**: giọng đọc đi qua nguyên vẹn, không gọi ffmpeg. Đó là trạng thái các bản mẫu xuất xưởng.

Tham số: `track` (rỗng = không nhạc), `volume` (0..1, mặc định 0.16), `duck` (0..1, mặc định 0.7), `fadeInSeconds` (1), `fadeOutSeconds` (2).

Trộn qua service extension `audio-mix/mix` → `nodes/audio-mix/server.ts`: bản nhạc được lặp (`aloop`) rồi cắt đúng độ dài giọng, hạ về `volume`, mờ vào và mờ ra; `sidechaincompress` lấy chính giọng làm tín hiệu điều khiển nên nhạc tự nhỏ lại mỗi khi có người nói và tự đầy lại ở khoảng lặng — đúng cách một bàn trộn phát thanh làm. `amix=duration=first:normalize=0` giữ mix kết thúc cùng giọng và không tự hạ đôi bên. `duck: 0` bỏ hẳn nhánh sidechain, nhạc chạy đều. Công thức nằm ở hàm thuần `mixFilter` để test đọc được mà không cần ffmpeg trên máy. Tệp ra đặt tên băm theo giọng và tham số nên đổi mức nhạc rồi đổi lại là dùng lại tệp cũ.

Trong bản mẫu **Tin AI**, node nằm giữa Giọng Đọc và Đóng Gói Timeline, còn Căn Mốc Từ vẫn lấy giọng **sạch** thẳng từ Giọng Đọc: bộ căn nghe nhạc sẽ căn kém hơn.

### 5.16. Xuất Phụ Đề (Caption Export)

Node lõi `core/caption-export`: nhận `CaptionTrack`, không phát gói nào (`kind: 'sink'`), ghi ra một tệp phụ đề rời để đăng kèm video. Cùng những dòng mà engine đốt vào hình, nhưng ở dạng tệp — YouTube, TikTok và mọi nơi khác đều nhận `.srt` hay `.vtt`.

Chạy **theo luồng**, không phải theo yêu cầu như Xuất MP4: chữ và mốc thời gian đã có sẵn trong tay, việc còn lại chỉ là chép ra, không tốn gì.

Tham số: `format` (`srt` mặc định, `vtt`) và `fileName` **không kèm đuôi** — đuôi do `format` quyết định, nên hai thứ không bao giờ chỏi nhau.

Hai định dạng là một ý tưởng viết hai lần: một cue là một khoảng thời gian và những chữ nói trong đó. Khác nhau ở dấu thập phân (phẩy với chấm), ở việc đánh số (SubRip có, WebVTT không) và ở dòng đầu `WEBVTT`. Hàm `toSubtitles` thuần nên test đọc được đúng thứ trình phát sẽ đọc mà không cần đĩa. Cue dài bằng không được nới thành 40 mili giây: trình phát lặng lẽ bỏ qua cue không có độ dài. Track không có dòng nào là lỗi `CAPTIONS_NO_WORDS`, không ghi ra tệp rỗng.

Tệp ghi qua `services.saveText`, đặt tên theo băm của chính nội dung nên xuất hai lần là một tệp, và tên tệp người dùng gõ chỉ đi trong thuộc tính `download` của thẻ neo. Vì vậy tên **giữ nguyên tiếng Việt**: `core/file-name.ts` chỉ bỏ những ký tự hệ tệp hay HTTP header thực sự từ chối (`< > : " / \ | ? *` và ký tự điều khiển), không ép về ASCII. Xuất MP4 dùng chung luật này.

### 2.12. Clip Trong Cảnh (B-roll)

Một cảnh chiếu được **video**, không chỉ ảnh tĩnh. Từ vựng nội dung có khóa `clip`; như `image`, đây là khóa **mô hình không bao giờ được hỏi** — chỉ người hoặc dữ kiện trỏ vào một tệp máy này đang giữ. Họa Sĩ nhận `src` của nó và đặt vào `<video src>` của bức vẽ (2.8).

Phần nặng nhất **thư viện lo sẵn**: `executeRenderJob` của `@hyperframes/producer` có hẳn một chặng "extract videos" và tự nối `createVideoFrameInjector` — nó trích khung của clip bằng ffmpeg rồi thay thẻ `<video>` bằng ảnh khung lúc chụp, vì Chrome không chụp được video đang phát một cách xác định. Việc của NodeCine chỉ là **đặt đúng thẻ `<video>` vào trang**.

**Cỡ của thẻ video phải đặt bằng hộp, không bằng con số.** Lúc kết xuất, producer thay thẻ `<video>` bằng ảnh từng khung và đóng **style inline** cỡ riêng lên bản thay thế đó; inline thắng luật theo class, nên một `width: 1920px` trong CSS của cảnh bị bỏ qua và clip ra đúng cỡ gốc của nó, nằm ở góc khung. `inset: 0` với `width/height: 100%` thì sống sót qua lần tráo. Ảnh tĩnh không bị tráo nên vẫn dùng được lối đặt cỡ cố định mà Ken Burns cần.

Đúng ở đây còn nghĩa là mang mốc thời gian của **chính cảnh đó**. Producer đọc `data-start` và `data-duration` ngay trên thẻ video; thiếu thì nó coi clip bắt đầu ở giây 0 và chạy hết độ dài tự nhiên, tức một cảnh b-roll ở phút thứ hai sẽ nhảy lên đầu phim. `timeVideos` (`contracts/visual/markup.ts`, hàm thuần) đóng dấu mốc đó lên mọi `<video>` trong cảnh, bỏ qua thẻ nào cảnh đã tự ghi mốc. Nó cũng thêm `muted`: tiếng của phim là giọng đọc, tiếng của clip sẽ nói đè lên.

**Clip vào máy thế nào.** Một clip quá lớn để đi qua data URL base64 như một cái logo, nên nó theo lối của nhạc và giọng: người dùng bỏ tệp vào `.nodecine/clips`, ô chọn liệt kê theo tên, và `POST /api/assets/from-library` bảo máy chủ **đọc tệp ngay tại chỗ**, băm rồi chép vào kho tài nguyên. Chỉ cái tên đi qua dây. Cảnh giữ `/api/assets/<băm>.mp4` như mọi tài nguyên khác, nên bản kết xuất chép clip đi kèm y như chép ảnh.


### 5.19. Kho Tư Liệu (Stock Media)

Node lõi `core/stock-media`: nhận `SceneScript`, phát `SceneScript` **đã có tư liệu ở mọi cảnh**. Cảnh chỉ được chiếu tệp máy này đang giữ (mục 2.7), nên node không phát ra một cái link: nó tìm, chọn ứng viên đầu tiên lấp được khung, **tải về kho tài nguyên** và đặt tài nguyên đó vào nội dung cảnh. Từ đó trở đi Họa Sĩ và Đóng Gói không phân biệt được đâu là tư liệu kho, đâu là tư liệu người dùng tự chọn.

**Clip trước, ảnh chỉ là dự phòng.** Một tấm ảnh đứng bốn giây đọc ra như khung hình bị treo, dù có trôi Ken Burns khéo tới đâu; Ken Burns là lời xin lỗi cho việc không có cảnh quay, không phải đích đến. Đây là thứ tự cutdown chốt (`downloadClip(...) ?? download(...)`), và các khung ở đây là bản port của khung đó. Tham số `media` quyết cảnh được lấp bằng gì: `auto` thử clip rồi chịu lấy ảnh khi không có clip nào hợp — và một phim khi ấy có thể **nửa clip nửa ảnh**; `clip` và `still` giữ mọi cảnh cùng một loại và **để cảnh trống còn hơn trộn**, vì vài cảnh tĩnh nằm giữa những cảnh động đọc ra như hỏng chứ không như một lựa chọn.

Clip vào `content.clip`, ảnh vào `content.image` — **hai khóa nội dung khác nhau**, và Họa Sĩ vẽ cảnh theo cái nó nhận: `<video>` kín khung cho clip, `<img>` với Ken Burns cho ảnh (5.9).

**Phong cách** (`style`) chọn *vùng* ảnh: Phong cảnh, Đường phố, Thiên nhiên, Kiến trúc, Nội thất, Chi tiết đời thường, Phòng tối cinematic — cộng *Tự động* (mô hình chọn một nhóm cho cả video) và *Ngẫu nhiên* (mỗi cảnh một nhóm). Đây là **vùng để mô hình chọn bên trong**, không phải danh sách để nó đi theo, và đó là bài học đắt của cutdown: bản đầu mỗi phong cách mang thêm một chuỗi từ khoá "tham khảo" in vào prompt, đo trên bốn lần chạy `landscape` liên tiếp thì cả bốn đều đi núi → hồ → biển → đồng cỏ → hoàng hôn đúng thứ tự chuỗi đó, trên bốn kịch bản khác hẳn nhau — mô hình đọc "tham khảo" thành "storyboard". Và vì truy vấn giống nhau, kho trả về cùng một tấm: 3/4 video mở bằng cùng một cảnh núi mù sương. Trường ấy đã bỏ; chỉ còn `hint` mô tả vùng.

Ba luật đi kèm mọi phong cách, và chúng mới là thứ giữ hai video khỏi giống nhau: ảnh chỉ tạo không khí, **không** minh hoạ lời đọc; không tìm người đang diễn lại cảm xúc hay hành động lời đọc nhắc tới; mỗi truy vấn neo vào **một vật cụ thể** (vách đá, đường ray, đèn bàn, rèm cửa) chứ không phải tên chung của nhóm — kho tìm theo từ khoá và trả lời tất định, nên truy vấn chung chung ra đúng tấm ảnh mọi người khác cũng lấy. Cộng thêm: đổi địa điểm, giờ trong ngày và khoảng cách máy quay giữa các cảnh, và đừng đi theo thứ tự liệt kê trong mô tả nhóm.

Danh sách nhóm in vào prompt **sinh từ chính bảng** (`STOCK_GROUPS`), vì trước đây nó viết tay ở ba chỗ và thêm một phong cách mà quên một chỗ thì không lỗi nào được ném — "Ngẫu nhiên" chỉ xoay trong các nhóm cũ.

Phong cách chỉ có tác dụng khi có mô hình: nó lái mô hình chứ không lái kho. Không nối mô hình thì node ghi cảnh báo nói rõ phong cách đang bị bỏ qua.

Cổng `llm` **tùy chọn**, và nó là thứ làm node dùng được với ngôn ngữ mà kho ảnh không đánh chỉ mục: kho tìm bằng tiếng Anh, còn lời thoại thì không. Có mô hình, nó viết một cụm tiếng Anh hai đến bốn từ cho mỗi cảnh từ lời thoại. Không có, chính lời thoại là cụm tìm kiếm — đúng với video tiếng Anh, kém với mọi thứ khác, và thân node nói thẳng điều đó chứ không giả vờ.

Luật chọn ảnh (chép từ cutdown, và mỗi con số có lý do):

- **Cạnh dài từ 1200px.** Thấp hơn là đang phóng ảnh lên, và phóng lên thấy rõ trên điện thoại. Đo trên cạnh dài chứ không phải chiều cao, để một sàn đúng cho cả khung dọc lẫn ngang.
- **Cạnh ngắn / cạnh dài ≤ 0,9.** Đúng hướng hoặc gần đúng: với khung dọc, ảnh 3:4 vẫn lấp đầy sau khi cắt còn ảnh ngang thì không.
- **Clip phải dài hơn cảnh**, không thì nó chạy lại giữa cảnh: cùng chiếc rèm lay lại từ đầu, cùng chiếc xe chạy qua lần nữa. Không lỗi nào được ném, chỉ mắt thấy. Node này chạy **trước** Giọng Đọc nên chưa biết cảnh dài bao nhiêu — đúng ca mà cutdown để sàn tuyệt đối `MIN_CLIP_SEC = 4`, và ở đây cũng vậy.
- **Chọn bản dựng: nhỏ nhất trong số những bản có cạnh dài đủ khung.** Pexels trả cùng một clip ở 5–7 cỡ, 240×426 tới 2160×3840. Lấy bản to nhất là tải 15,5 MB cho một cảnh năm giây rồi co xuống; lấy bản đầu danh sách thì có clip chỉ 338×640 đứng đầu, phóng lên 1080 là vỡ.
- **Lấy clip hợp lệ ĐẦU TIÊN, không phải dài nhất.** Đo được: sắp theo dài nhất chọn phải clip 30 giây và tải 32 MB cho một cảnh năm giây; ứng viên hợp lệ đầu tiên là 8,6 MB. Dài hơn mức sàn không mua thêm gì, mà thứ tự kho trả về chính là thứ tự liên quan.
- Trần tải riêng cho clip: **40 MB**, so với 4 MB của ảnh.
- **Pexels: không dùng biến thể dựng sẵn nào.** `large2x` nghe như bản to nhưng là `w=940&h=650&dpr=2`, nên ảnh dọc về 867×1300 — thiếu 620px so với khung 1920, phóng lên là nhoè mà không cửa nào báo. Đường đúng là `original?h=<cạnh dài>`: đo thật trên một ảnh 3040×2361 ra 2472×1920, 262 KB.
- **Pixabay: đo lại kích thước thay vì tin kho.** `largeImageURL` chỉ 1280px cạnh dài, lọt sàn cho khung ngang nhưng không đủ cho khung dọc.
- **Một video không dùng lại một tấm ảnh.** Trang ảnh đã dùng bị loại trước khi thử, nên trang kết quả xin 30 tấm chứ không 15.
- Tấm hợp lệ đầu tiên vẫn có thể tải hỏng; node thử tối đa bốn ứng viên trước khi bỏ cảnh đó không ảnh.

Khóa API đọc từ **biến môi trường**, không bao giờ từ đồ thị (mục 9.1): `PEXELS_API_KEY` hoặc `PIXABAY_API_KEY` trong `.env.local`. Một workflow chia sẻ cho người khác không được mang theo khóa của người viết. Thiếu khóa là lỗi `STOCK_KEY_MISSING` nói rõ tên biến. Địa chỉ ảnh do kho trả về là địa chỉ **bên thứ ba chọn**, nên nó đi qua đúng bộ luật của `server/fetch-media.ts`: dựng lại địa chỉ, chặn host nội bộ, theo chuyển hướng từng bước, cắt ở 4 MB — cùng bộ luật Truy Xuất Trang dùng, để hai chỗ không trôi khỏi nhau.

### 2.13. Thumbnail — chưa triển khai

IR hiện không mang thumbnail độc lập. Khi triển khai, Họa Sĩ sẽ vẽ nó như một cảnh không có thời gian.

### 2.14. `LayerSpec`

Một lớp của phim (`LayerSpecSchema`, `docs/IR_V3.md` mục 10 bước 4): một thứ chạy **bên** các cảnh trên rãnh riêng, do node Lớp phát và Đóng Gói Timeline nhận bao nhiêu cũng được. Hai dạng, phân biệt bằng `kind`:

- `media`: `url` là tài nguyên máy này đang giữ (2.7) — clip lấy từ thư mục clips hay ảnh tải lên; `fit` (`cover` | `contain`), `loop`, `offsetSeconds` (giây vào trong tệp), `gain` (0 là câm, mặc định), `sourceSeconds` (độ dài thật của tệp, do node Lớp đo bằng ffprobe: engine không lặp được thứ nó không biết dài bao nhiêu — Remotion bọc clip trong `Loop` đúng số khung một lượt).
- `code`: `source` là một đoạn HTML như của cảnh (2.8) — hoặc JSON Lottie khi `format` là `lottie`; script của nó thấy `nodecine.beats` và, nếu nó là đoạn nhịp, `nodecine.beat`. `loop` chỉ có nghĩa với định dạng **tự có độ dài** như Lottie, khi đoạn dài hơn bản hoạt hình: bật thì quay vòng, tắt thì giữ khung cuối. Điểm ra của một lớp Lottie là loại trừ, nên tua đúng tới độ dài của nó vẽ ra con số không — đó là cách một lớp mười ba giây tắt ngóm ở giây thứ hai. Đồng hồ của đoạn là đồng hồ duy nhất được phép dời bản hoạt hình: runtime của HyperFrames tự tìm mọi Lottie đã đăng ký rồi tua theo đồng hồ phim, không kẹp, nên `lottieScene` thay `setCurrentRawFrameValue` của bản hoạt hình bằng một hàm luôn vẽ lại khung mà cảnh vừa xin — ai tua cũng vậy.

Cả hai mang `placement` (`under` | `over` các cảnh), `startSeconds` và `durationSeconds` tùy chọn (không có là tới hết phim). Lớp không biết phim dài bao nhiêu; Đóng Gói kẹp nó vào phim. Đây là cách gameplay lặp dưới một câu chuyện, một bản ghi màn hình được các cảnh chú thích, một logo góc màn hình, hay một chiếc điện thoại xuyên phim đi vào IR mà không cần bọc trong một cảnh.

`stage` (`StageSchema`, bản đồ tự do) đi kèm: mỗi cảnh của `SceneScript` và `ScenePlan` có thể mang `stage`, Đóng Gói chép nó sang nhịp tương ứng, và lớp xuyên phim đọc `nodecine.beats[i].stage` để biết cảnh đó muốn nó ở đâu. Lõi không đọc nội dung `stage`.

**Quy ước cho một mục `stage`, vì lõi không kiểm được:** `{ x, y, scale, rot }` với `x`, `y` là **tâm** của vật, tính bằng px của khung thiết kế kể từ góc trên trái — không phải độ dời so với bất cứ đâu; `scale` 1 là cỡ lớp đã vẽ; `rot` là độ, chiều kim đồng hồ. Hai phía phải theo cùng quy ước này: người vẽ cảnh (Họa Sĩ, hoặc tay người) ghi theo nó, và script của lớp đặt vật đúng vào điểm đó. Đây đúng là chỗ `stage` tự do trả giá: ngày 2026-09-11 Họa Sĩ ghi toạ độ tuyệt đối còn script của một lớp đọc chúng như độ dời của gsap, nên chiếc điện thoại bay ra khỏi khung và chỉ còn một góc — không có lỗi nào báo, vì cả hai cách đọc đều hợp lệ với lược đồ.

### 2.14b. Nền cảnh khi có lớp chạy dưới

Cảnh phủ kín khung và tờ phong cách cho `.nc-scene` một nền đặc, nên một lớp đặt **dưới** các cảnh sẽ bị che hoàn toàn. Vì vậy khi rãnh nhịp có rãnh nào có đoạn nằm dưới nó (`hasTracksUnderBeats`), engine đánh dấu các đoạn nhịp bằng `data-beat` và thêm một luật không thuộc layer nào: `.nc-scene[data-beat] { background: transparent }` (`TRANSPARENT_GROUND_CSS`). Chỉ cảnh mất nền; bức vẽ của một lớp giữ nguyên nền nó tự sơn. Phim không có gì nằm dưới thì không có dấu và không có luật, nên trang ra giống hệt như trước.

Họa Sĩ có tham số `ground` (`solid` | `transparent`) để vẽ ngay từ đầu cho hợp: `transparent` thì mô hình được dặn không vẽ nền toàn khung, đặt chữ trên panel mờ và chừa khung cho hình bên dưới.

### 2.15. `AudioTrackSpec`

Một âm thanh bên cạnh giọng (`AudioTrackSpecSchema`, `docs/IR_V3.md` mục 5.3): `url` là tệp media đã đo (`durationSeconds`), `role` là `music` hay `ambient`, `gain`, `startSeconds`, `playSeconds` (tùy chọn, không có là hết phim nếu `loop`, hết tệp nếu không), `offsetSeconds`, `loop`, `fadeInSeconds`, `fadeOutSeconds`, `duckTo` (mức hạ xuống khi giọng nói), `analysisUrl` (JSON độ lớn và dải tần theo khung, do Phân Tích Âm Thanh viết, 5.21) và `beatSeconds` (các mốc nhịp, giây). Nhạc Nền phát nó ở đầu ra `track` bên cạnh bản trộn; Nhập Âm Thanh phát bản thu của mình ở đầu ra `track` với vai `ambient`. Đóng Gói Timeline nhận bao nhiêu cũng được ở cổng `audio` và kẹp từng track vào phim (5.4 quy tắc 7).

Fade và duck là dữ liệu mà engine vẽ: HyperFrames đặt keyframe `volume` trên timeline chủ, Remotion tính `volume` theo khung. Với `duck`, cả hai lấy **cửa sổ giọng nói** từ lõi (`speechWindowsOf`: các dòng phụ đề gộp qua khoảng lặng dưới một phần ba giây, hoặc trọn track giọng khi không có phụ đề) và hạ track xuống `duck.to` một phần tư giây trước từ đầu, trả lại mức cũ bốn phần mười giây sau từ cuối. Nhạc Nền vẫn trộn sẵn có sidechain ở đầu ra `voiceover` cho ai muốn một tệp.

## 6. Kiểu Dựng: Loại Phim Này Là Loại Gì

Tới 2026-09-11, thứ duy nhất nói cho mô hình biết nó đang làm loại phim gì là một câu về màu và kiểu chữ. Nên phim nào cũng ra một hình dạng — một tiêu đề, một dòng chữ phụ, cả hai mờ dần hiện lên đúng lúc giọng đọc tới — và mười ba workflow dựng cho mười ba thể loại chỉ khác nhau ở thứ nằm sau chữ. Đo trên mười ba phim đó: 46 cảnh, 353 tween, 116 tween gắn vào `nodecine.when()`, `nodecine.count()` dùng đúng 2 lần, và tên class mô hình vẽ ra gần như trùng nhau. Thể loại chưa bao giờ nằm trong dữ liệu; nó nằm trong đầu người viết lời nhắc.

**Kiểu dựng** (`FilmForm`, `contracts/forms/registry.ts`) là gói hướng dẫn và mặc định đưa thể loại vào dữ liệu:

- `script.guidance` — Biên Kịch phải viết thế nào cho loại phim này; `script.keys` giới hạn từ vựng nội dung, để một phim toàn số lớn không được đưa cho từ `body` rồi trả về một đoạn văn không biết đặt đâu.
- `draw.guidance` — Họa Sĩ dựng khung thế nào: thứ gì nằm đâu, chiếm bao nhiêu, mắt dừng ở đâu.
- `draw.motion` — **cái gì chuyển động và vì sao**. Danh sách này **thay** từ vựng mặc định (`DEFAULT_MOTION`: điểm nào giọng nhắc tới thì hiện ra, và có gì đó trôi bên dưới cho khung không chết). Đúng chỗ này là lý do mọi phim từng giống nhau, nên đúng chỗ này là nơi hai loại phim tách ra. Để rỗng thì giữ mặc định.
- `spanning` — phim này có một thứ xuyên suốt hay không, và nó nằm trên hay dưới các cảnh (5.9b).
- `transition` — cảnh nhường cảnh sau thế nào, khi node chưa được bảo khác.

Kiểu dựng là **dữ liệu**, giống bản mẫu: một tệp JSON trong `forms/`, đăng ký lúc khởi động ở cả hai phía (`registerForms()` trong `server/register.ts` và `lib/bootstrap.client.ts`). Thêm một loại phim là thêm một tệp và một dòng; không chỗ nào khác trong repo học tên nó.

**Kiểu dựng không bao giờ đi vào IR.** Nó định hình câu hỏi đặt cho mô hình rồi hết nhiệm vụ. Lõi vẫn không biết có bao nhiêu kiểu cảnh (mục 4), và engine không bao giờ nghe thấy tên một kiểu dựng.

**Nó đi theo dây.** Biên Kịch có tham số `form`, viết theo nó và ghi tên nó vào `SceneScript.form`. Họa Sĩ đọc từ đó, và có tham số `form` của riêng mình để đè lên khi cần — chọn hai lần là hai cơ hội để hai bên lệch nhau, nên mặc định của Họa Sĩ là đi theo kịch bản. Tên kiểu dựng mà bản này không có thì node dừng với `NODE_PARAMS_INVALID`: im lặng vẽ lại hình dạng cũ mà không nói gì là tệ hơn.

Sáu kiểu dựng bản này mang theo: `explainer` (giữ nguyên cách cũ), `kinetic-type` (chữ chiếm trọn khung, từng từ nảy theo lời, khung đứng yên giữa các từ), `data-story` (mỗi cảnh một con số lớn đếm lên, cột mọc dần), `device-demo` (thiết bị giữ phim, cảnh chỉ là nhãn bên cạnh, kèm `spanning`), `music-cuts` (không lời, mọi thứ bám `nodecine.audio`, cắt thẳng), `footage-frame` (hình chạy dưới, cảnh chỉ là một dải chữ ở một phần ba dưới).

### 6.1. Tư Thế: Khung Này Xếp Ra Sao

Kiểu dựng nói phim thuộc loại gì; **tư thế** nói một cảnh của loại đó xếp thế nào. Một tư thế là hình học viết tay: ô chữ của cảnh, và chỗ đứng của từng vật xuyên phim trong lúc cảnh đó lên hình.

Vì sao phải viết tay. Hỏi mô hình cả hai câu "trông thế nào" và "nằm ở đâu" thì có ngày nó viết tít đè lên dải phụ đề — đã xảy ra, ngày 13/9. Tách ra thì mỗi bên chỉ trả lời câu nó trả lời được: **tư thế nói chỗ, bố cục nói dáng**. Số do người đo một lần thì không sai được, và mô hình chỉ được vẽ trong ô đã đo.

- Tư thế nằm trong tệp kiểu dựng, vài cái, có tên như cỡ máy quay: `text-top-tilt-right`, `text-bottom-tilt-right`.
- Cảnh nào tự khai tư thế thì giữ; còn lại **xoay vòng** theo thứ tự tệp khai, nên hai cảnh liền nhau không xếp giống nhau.
- Một bố cục trả lời cho **một cặp: hình dạng nội dung và tư thế**. Cùng ba khóa mà đặt trong ô trên đỉnh khung hay dưới chân khung là hai bản vẽ khác nhau, nên chữ ký của bố cục mang cả tư thế.
- Ô chữ của tư thế đi thẳng vào lời dặn vẽ bố cục: vẽ trong ô này, không đâu khác. Có ô rồi thì không cần dặn tránh gì nữa — ô đã sạch từ lúc người viết đo nó.
- `stage` của tư thế trở thành `stage` của cảnh, nên vật xuyên phim đổi chỗ qua từng cảnh **không tốn một lượt gọi mô hình nào**. Cảnh tự khai `stage` thì đè lên tư thế.

Phim không có tư thế thì mọi thứ chạy như cũ: bố cục tự quyết bố trí trong cả khung.

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

Node gọi `complete()` là node biên kịch của gói; lõi không có node nào gọi mô hình ngôn ngữ.

---

## 8. Provider và Node Nhà Cung Cấp Giọng Đọc

### 8.1. Cấu trúc `TTSRef`

- `providerId`: định danh nhà cung cấp đang chọn trên node. Hiện có `system-tts` (chỉ macOS), `piper` (cục bộ, mọi hệ điều hành), `elevenlabs` và `vbee` (đám mây, khóa từ biến môi trường).
- `displayName`, `transport` (`local` cho bộ tổng hợp trên máy, `api` cho dịch vụ đám mây).
- `capabilities`: `installed` (bộ tổng hợp sẵn sàng, gồm cả việc có mô hình giọng hay chưa với Piper), `encoder` (ffmpeg).
- `voices`: Danh sách `{id, displayName, language}` lấy lúc `probe()` từ hệ điều hành, thư mục mô hình, hay danh mục của dịch vụ. `language` là BCP 47; giá trị `mul` nghĩa là giọng nói được mọi ngôn ngữ (ElevenLabs chạy một mô hình đa ngữ), và Node Giọng Đọc coi `mul` là khớp với mọi lời thoại.
- `settings`: `defaultVoice`, `rate`.

### 8.2. Quy tắc chọn giọng tại Node Giọng Đọc

Nếu người dùng đã chọn một giọng, dùng giọng đó, kể cả khi nó không khớp ngôn ngữ lời thoại (khi đó phát cảnh báo `TTS_VOICE_LANGUAGE_MISMATCH`, không dừng luồng: lựa chọn rõ ràng là của người dùng); nếu không chọn, dùng giọng đầu tiên khớp ngôn ngữ; nếu không có giọng nào khớp, dùng `defaultVoice` và phát cùng cảnh báo. Trên giao diện, node liệt kê giọng khớp ngôn ngữ lên đầu và mọi giọng khác theo nhóm ngôn ngữ; khi chưa có lời thoại, ngôn ngữ lấy từ cài đặt của director rồi tới ngôn ngữ giao diện.

Ví dụ với bộ tổng hợp của hệ điều hành trên macOS: `say` ghi AIFF vào thư mục tệp tạm, ffmpeg chuyển sang MP3, đo thời lượng từ tệp MP3. Hệ điều hành chưa hỗ trợ thì `probe()` báo `installed: unavailable`; ứng dụng không giả vờ có giọng.

---

## 9. Gọi Ra Ngoài và An Toàn Tiến Trình Con

### 9.1. Node gọi ra ngoài

Node chạy trong executor ở máy chủ (ARCHITECTURE §1.2), nên một node cần mạng hay hệ tệp **gọi thẳng**, như node API của ComfyUI: Truy Xuất Repo gọi GitHub từ `nodes/github/fetch-repo.ts` ngay trong `run()`. Không còn tầng "thao tác máy chủ" hay registry trung gian. Điều còn giữ là ba luật: URL dựng lại ở phía gọi từ dữ liệu đã kiểm định (owner/name) và chỉ tới máy chủ cố định; mọi lệnh gọi có thời gian chờ và bị hủy cùng luồng; lỗi ra dưới dạng `NodeError` có mã trong bảng của Bộ Máy Thực Thi. Để test không chạm mạng, node để lệnh gọi sau một điểm thay được (`github.fetchRepo`), còn bản thân hàm gọi nhận `fetch` qua tham số.

### 9.2. Tiến trình con

Áp dụng cho mọi Provider có `transport` là `cli` hoặc `local`, và cho tiến trình kết xuất:

- Tham số truyền dưới dạng mảng đối số, không ghép thành chuỗi cho shell diễn giải.
- Nội dung do người dùng hoặc mô hình sinh ra đi qua đầu vào chuẩn hoặc tệp tạm, không qua đối số.
- Đường dẫn tệp thực thi chỉ lấy từ tự phát hiện trên `PATH` hoặc từ Cài đặt, không bao giờ từ tệp dự án.
- Mỗi lần gọi có thời gian chờ và bị hủy cùng luồng.

---

## 10. Bản Mẫu

Không có tầng "nội dung kèm app" nữa. Mọi node là node lõi (mục 5), giao diện do Họa Sĩ vẽ lúc chạy từ một câu mô tả. Hai thứ cùng hình dạng nhưng khác vai, như trong ComfyUI: **bản mẫu** là đồ thị dựng sẵn ship kèm app, mở ra là một bản nháp mới; **workflow** là tệp của người dùng, lưu, đổi tên, nhập, xóa ở thanh tab và panel Workflow. Cùng lược đồ `TemplateDefinition`, nên một workflow tải xuống và một bản mẫu chia sẻ là cùng một loại tệp.

### 10.1. Bản mẫu (template) là dữ liệu

Một bản mẫu là **một đồ thị đã lưu**: `{ id, name, description?, category, graph }`, trong đó `graph` có đúng hình dạng `lib/storage.ts` ghi khi người dùng lưu dự án. Nó gọi tên node bằng chuỗi và không import gì; giao diện của nó là câu mô tả trong node Họa Sĩ bên trong đồ thị. Registry ở `core/templates/registry.ts` kiểm định hình dạng lúc đăng ký và trả ra bản sao khi mở.

Registry chỉ chứa **bản mẫu ship kèm** (tệp JSON dưới `templates/`). Workflow của người dùng là một thứ khác và không vào registry: chúng là **tệp trên máy chủ** trong `.nodecine/workflows/<id>.json` (đổi bằng `NODECINE_WORKFLOWS_DIR`), theo mô hình `userdata/workflows` của ComfyUI: một tệp một workflow, cùng hình dạng bản mẫu cộng `schemaVersion` và `updatedAt`, ghi nguyên tử, đọc lại thì tự nâng phiên bản. API: `GET/POST /api/workflows`, `GET/PUT/DELETE /api/workflows/<id>`, `POST /api/workflows/from-video`. `id` là tên tệp và bị lược đồ kiểm định; đường dẫn chỉ được dựng ở `server/workflows.ts`. Id `current` được giữ riêng và không liệt kê.

Một MP4 do NodeCine kết xuất **mang theo workflow** đã tạo ra nó (thẻ `nodecine_workflow` trong metadata định dạng, ghi bằng ffmpeg stream copy, gồm tên, đồ thị và IR), như PNG của ComfyUI mang theo workflow: kéo video vào canvas là dựng lại đồ thị. Thiếu ffmpeg thì video vẫn ra, chỉ không có thẻ.

### 10.2. Bài kiểm tra duy nhất

**Mọi bản mẫu ship kèm phải dựng lại được từ canvas trống** bằng cách kéo node từ Thư viện và gõ tham số. `templates/__tests__` kiểm đúng điều đó: mọi node type có trong Thư viện, mọi tham số qua được lược đồ của chính node, mọi node phát `SceneScript` có một Họa Sĩ đứng sau và Họa Sĩ có mô hình nối vào. Bản mẫu cần thứ gì người dùng không với tới thì không phải bản mẫu — đó là code trá hình.

Không thứ gì bên ngoài lõi được thêm kiểu cổng hay sửa lược đồ IR.

### 5.20. Lớp (Layer)

Node lõi `core/layer`: không có đầu vào, phát một `LayerSpec` (2.14). Tham số: `kind` (`media` | `code`), `url` (chọn clip từ thư mục clips qua `POST /api/assets/from-library`, hay tải ảnh lên — chỉ mã băm đi qua dây), `source` (bức vẽ khi là code), `format` (một trong ba định dạng, mục 4), `placement`, `fit`, `loop`, `offsetSeconds`, `gain`, `startSeconds`, `durationSeconds` (tùy chọn). Node đo tệp media bằng service `layer/measure` (ffprobe) để `sourceSeconds` đi được vào IR; ngoài ra không quyết gì, chỉ gói tham số thành một đặc tả; Đóng Gói Timeline mới biết phim dài bao nhiêu và đặt lớp vào rãnh (5.4 quy tắc 6). Thiếu tệp hay thiếu bức vẽ là `INPUT_EMPTY`.

Nhiều node Lớp nối vào cùng cổng `layers`; thứ tự dây là thứ tự chồng. Một bức vẽ xuyên phim muốn đi theo cảnh đọc `nodecine.beats`, và cảnh nói mình muốn gì bằng `stage` (2.14). Chưa có ô sửa `stage` trong Kịch Bản Tĩnh; giá trị đặt trong đồ thị hoặc do Họa Sĩ phát khi mô tả phong cách yêu cầu.

### 5.21. Phân Tích Âm Thanh (Audio Analysis)

Node lõi `core/audio-analysis`: nhận `AudioTrackSpec`, phát cùng track kèm `analysisUrl` (2.15). Service `audio-analysis/analyze` giải mã tệp bằng ffmpeg ra PCM 16 kHz mono, lõi (`contracts/audio/analysis.ts`) tính mỗi khung hình một hàng `[level, bass, mid, high]` bằng FFT 512 điểm cửa sổ Hann — bass 20–250 Hz, mid 250–2000, high 2000–8000 — chuẩn hóa theo đỉnh của chính tệp, và ghi JSON `{ version, fps, sampleRate, bands, frames }` vào kho media dưới mã băm của tệp và nhịp khung; cùng tệp cùng nhịp thì không giải mã lại. Node còn dò **nhịp** từ chính phân tích đó (`detectBeats`): thông lượng dải thấp và dải giữa, làm trơn ba khung để bỏ dao động theo pha cửa sổ, lấy đỉnh cục bộ đứng trên trung bình lân cận và trên một ngưỡng tuyệt đối, cách nhau ít nhất 0,16 s. Không có mô hình tempo: một cú cắt cần đúng lúc trống rơi, không cần một lưới đều, nên bản nhạc đổi nhịp hay dừng lại vẫn ra đúng mốc. Kết quả về `beatSeconds` của track, và Đóng Gói dùng nó khi bật `snapToBeat` (5.4). Tham số: `fps` (30, nên khớp Đóng Gói).

Engine nhúng JSON vào trang (HyperFrames đọc qua `fetch` ở trình phát và từ đĩa khi kết xuất vì CSP của trang cấm `connect-src`; Remotion `fetch` từ gốc media) và cảnh đọc `nodecine.audio('<id track>')` → `{ at(t), bands(frame) }`, `at(t)` là dải tần ở giây `t` của cảnh; `null` khi không có phân tích.

#### 5.9b. Thứ xuyên phim, do Họa Sĩ vẽ

Tham số `spanning` không rỗng thì Họa Sĩ vẽ thêm **một** thứ ở trên screen suốt cả phim và không phải cảnh: chiếc điện thoại các cảnh nói về, một linh vật, khung chú thích quanh bản ghi màn hình, một thế giới máy quay bay xuyên qua. Nó được vẽ **một lần**, trước các cảnh, và ra ở cổng `layer` dưới dạng `LayerSpec` (2.14) để nối vào cổng `layers` của Đóng Gói.

Vì sao đặt ở Họa Sĩ chứ không ở node Lớp: một thứ vẽ bên cạnh các cảnh chỉ chạy được khi hai bên thoả thuận — về chỗ nó đứng, về phần khung nó chiếm, về việc cảnh có được sơn nền hay không. Chỉ kẻ vẽ cả hai mới bắt được chúng thoả thuận. Ngày 2026-09-11 cho thấy điều ngược lại: lớp do người gõ tay, cảnh do mô hình vẽ, và các cảnh viết chữ thẳng lên mặt điện thoại.

Ba giao kèo mà Họa Sĩ tự giữ:

- **Khoá cố định.** Cảnh nói chỗ nó muốn bằng `stage.spanning = { x, y, scale, rot }` (2.14), và script của lớp đọc đúng khoá đó. Một từ cố định, không thương lượng, vì một cái tên do hai câu trả lời của mô hình tự đặt sẽ có ngày viết khác nhau.
- **Kích thước đi cả hai chiều.** Mô hình vẽ xong khai `width` và `height` — cỡ tự nhiên của nó, tức `scale: 1` nghĩa là gì. Lời nhắc vẽ cảnh mang đúng hai số đó, kèm luật: hình chữ nhật nó chiếm ở chỗ cảnh vừa chọn **không phải của cảnh**, không chữ nào, thẻ nào, ảnh nào được lấn vào.
- **Nền tự tắt.** `spanningPlacement` là `under` thì nó chính là nền của phim, nên Họa Sĩ tự yêu cầu phong cách và các cảnh không sơn nền nữa; người dùng không phải biết và không phải nhớ bật tham số `ground`.

**Một cảnh hỏng không kéo cả phim.** Mô hình vẽ trượt một cảnh sau hai lần hỏi thì cảnh đó nhận một bức vẽ thay thế dựng từ chính nội dung của nó bằng các class của tờ phong cách, đứng yên, và nhật ký ghi rõ cảnh nào đã thay — mười hai phút vẽ không bị vứt vì một lần gọi quá hạn. Trượt **tất cả** các cảnh thì node dừng hẳn: một phim toàn bức thay thế là dấu hiệu mô hình không trả lời, và dựng nó ra là che đi chuyện đó.

Lớp do mô hình vẽ phải đọc `nodecine.beats` khi phim có nhiều hơn một cảnh; không đọc thì bị từ chối và hỏi lại, vì một thứ không theo nhịp phim thì chỉ là hình dán. Node Lớp vẫn nguyên vẹn cho những thứ không cần mô hình: một tệp clip, một bản ghi màn hình, hay một bức vẽ người dùng muốn tự kiểm soát.

### 5.22. Bối Cảnh (Set)

Node lõi `core/set`: nhận tùy chọn `SceneScript` (chỉ để đọc form và biết phim có mấy cảnh); phát **hai cổng** — `style: StyleSheet` và `cast: CastSheet`.

Đây là mọi thứ của một phim **không đổi**: tờ CSS chung cho mọi cảnh, và những vật nằm lại trên màn hình khi cảnh đi qua. Trước 12/9 chúng là hai node, và việc tách làm hai là cái sai: cả hai đều vẽ một lần, cả hai đều ghim, cả hai thuộc về kênh chứ không thuộc về video, và một cái thiếu cái kia là nửa câu trả lời — một vật được vẽ theo phong cách và khung của phim, nên tờ CSS luôn phải có trước.

Hai cổng ra chứ không một gói chung, để phía sau không đổi gì: Họa Sĩ và Vẽ Bố Cục nhận phong cách, Họa Sĩ và Đóng Gói nhận bộ dựng.

- `style.captions = { left, right, bottom, size }` là **chỗ ngồi của dải phụ đề dưới dạng số**. Tờ CSS được đổi mặt chữ, màu, bóng của `.nc-captions-default` nhưng **không được dời nó**, vì lớp trải dài và bố cục từng cảnh phải tránh đúng dải đó và không đọc được một quy tắc CSS.
- Mỗi vật có **một cái tên**, và tên đó là khóa cảnh viết dưới `stage`, cũng là khóa được nướng vào script của chính vật lúc vẽ. Hai vật trùng tên là lỗi tham số.
- `width` và `height` bằng 0 thì node tự vẽ và tự báo kích thước; cả hai lớn hơn 0 thì bố cục thuộc về nơi khác (một node Lớp, một tệp) và node chỉ báo cho các cảnh biết có vật đó.
- Có vật nằm **dưới** cảnh thì nền cảnh tự chuyển trong suốt, không ai phải nhớ.
- Ghim node này (mục 1.4) là giữ nguyên cái nhìn của cả kênh: mọi video sau không hỏi mô hình gì ở đây.

### 5.23. Vẽ Bố Cục (Plate Maker)

Node lõi `core/plates`: nhận `SceneScript`, `StyleSheet` và tùy chọn một `PlateSheet` đã có; phát `PlateSheet` = `{ plates: [{ id, keys, source, budget? }] }`.

Một **bố cục** là bố cục của cả một cảnh, với một khe mang tên cho mỗi khóa nội dung nó vẽ. Node hỏi mô hình **một lượt cho mỗi hình dạng nội dung chưa có**, không phải mỗi cảnh: một kịch bản mười cảnh dùng ba hình dạng chỉ tốn ba lượt, và danh mục đã ghim thì không tốn lượt nào.

- **Chữ ký là bộ khóa nội dung.** `signatureOf` (`contracts/visual/plates.ts`) đọc cảnh ra danh sách khóa theo thứ tự của từ vựng, nên hai cảnh cùng hình dạng dùng chung một bố cục.
- Bố cục thiếu khe cho một khóa, hay có hai khe cho một khóa, thì bị trả lại kèm lý do; hỏi lại một lần rồi dừng.
- `budget` là số ký tự mỗi khe chịu được, do mô hình khai. Chưa ai đọc nó; chỗ sẽ đọc là Biên Kịch.

### 5.24. Dựng Cảnh (Scene Builder)

Node lõi `core/compose`: nhận `SceneScript`, `StyleSheet`, `PlateSheet`; phát `ScenePlan` như Họa Sĩ, nên Đóng Gói và engine không đổi gì. **Không gọi mô hình.**

Đổ nội dung từng cảnh vào khe của bố cục khớp chữ ký. Thuần: cùng kịch bản và cùng danh mục thì ra cùng khung hình, từng byte. Hình dạng nào chưa ai vẽ thì dừng ngay tại đây kèm tên hình dạng đó, chứ không ra một cảnh trống.

