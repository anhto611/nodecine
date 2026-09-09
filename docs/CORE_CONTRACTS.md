# Hợp đồng Lõi (Core Contracts)

Tài liệu này định nghĩa phần **khung** của NodeCine: những hợp đồng mà mọi node, mọi block và mọi engine đều phải tuân theo, và không chứa bất kỳ chi tiết nào của một bản mẫu cụ thể. Chi tiết của từng bản mẫu nằm ở `docs/templates/`.

Nguyên tắc phân tầng: **lõi định nghĩa hình dạng, gói định nghĩa nội dung.** Lõi biết có "cảnh" nhưng không biết cảnh Hook là gì; biết có "dữ kiện" nhưng không biết số sao GitHub là gì. Mọi thứ lõi không biết đều được tra qua registry, cùng một pattern cho engine, nhà cung cấp và kiểu cảnh.

Tài liệu liên quan: Kiến trúc Hệ thống mô tả nơi từng phần thực thi; Đặc tả Bộ Máy Thực Thi mô tả cách đồ thị được chạy.

---

## 1. Hệ Thống Kiểu Cổng & Giao thức Gói Dữ Liệu

### 1.1. Kiểu cổng

Mỗi cổng mang đúng một định danh kiểu. Một dây nối chỉ được phép tạo khi định danh kiểu ở cổng xuất trùng khớp tuyệt đối với định danh kiểu ở cổng nhận. Không có cơ chế ép kiểu ngầm. Lõi định nghĩa mười hai kiểu; không thứ gì ngoài lõi được thêm kiểu cổng mới, chỉ được định nghĩa hình dạng cụ thể của `payload` bên trong các kiểu có sẵn.

| Định danh kiểu | Nhãn hiển thị | Ý nghĩa | Node lõi phát | Node lõi nhận |
| --- | --- | --- | --- | --- |
| `SourceRef` | Dữ liệu Nguồn | Chuỗi người dùng nhập, chưa diễn giải | Nhập Liệu | Truy Xuất Repo, Biên Kịch |
| `SceneScript` | Kịch bản phân cảnh | Video đã chia cảnh, mỗi cảnh một vai, một trọng số và **nội dung** theo từ vựng cố định — chưa có giao diện (2.11) | Kịch Bản Tĩnh, Biên Kịch, Phân Cảnh, Kho Tư Liệu | Phân Cảnh, Kho Tư Liệu, Đạo Diễn Mỹ Thuật |
| `FactSheet` | Dữ kiện | Tập dữ kiện kiểm chứng được, có nguồn gốc | Truy Xuất Repo | Biên Kịch, Đóng Gói Timeline |
| `ScenePlan` | Kế hoạch dựng | Stage, danh mục block và danh sách cảnh đã dàn (block, props, tone, trọng số) — tự chứa | Đạo Diễn Mỹ Thuật | Đóng Gói Timeline |
| `AudioScript` | Lời thoại | Văn bản thuyết minh kèm ngôn ngữ | Kịch Bản Tĩnh, Biên Kịch | Giọng Đọc |
| `Voiceover` | Âm thanh & Thời lượng | Tệp âm thanh đã đo thời lượng, có thể kèm mốc từng từ | Giọng Đọc, Căn Mốc Từ | Đóng Gói Timeline, Căn Mốc Từ, Phụ Đề |
| `VideoIR` | Bản đặc tả IR | Bản Đặc Tả Video Trung Gian | Đóng Gói Timeline | Xuất Bản Video, Xuất MP4 |
| `EngineRef` | Động cơ | Tham chiếu tới một Adapter | Động Cơ | Xuất Bản Video, Xuất MP4 |
| `LLMRef` | Mô hình ngôn ngữ | Tham chiếu tới nhà cung cấp mô hình | Nhà Cung Cấp Mô Hình Ngôn Ngữ | Biên Kịch |
| `TTSRef` | Giọng đọc | Tham chiếu tới nhà cung cấp giọng | Nhà Cung Cấp Giọng Đọc | Giọng Đọc |
| `CaptionTrack` | Phụ đề | Các dòng phụ đề trên đồng hồ của voice-over, mỗi dòng gồm các từ có mốc | Phụ Đề | Đóng Gói Timeline (tùy chọn) |

Mười một kiểu cổng chia làm hai **loại dây** (`PORT_KIND` trong `core/types/ports.ts`). Dây **luồng** (`SourceRef`, `FactSheet`, `SceneScript`, `ScenePlan`, `AudioScript`, `Voiceover`, `CaptionTrack`, `VideoIR`) là đường đi của nội dung: xong bước này mới sang bước sau. Dây **thành phần** (`LLMRef`, `TTSRef`, `EngineRef`) là một bộ phận cắm vào node dùng nó: mô hình, giọng, động cơ. Bộ máy thực thi không phân biệt hai loại (cả hai đều là phụ thuộc, mục 2 của Bộ Máy Thực Thi); chỉ canvas vẽ khác: dây luồng liền nét, vào từ trái ra bên phải; dây thành phần mảnh, đứt nét, vào cổng ở **cạnh trên** của node dùng và ra từ **cạnh dưới** của node phát, để thành phần "treo" phía trên đường đi chính. Auto-layout xếp node thành phần thành một dải ngay trên node đầu tiên dùng nó.

Một cổng xuất được phép nối ra nhiều cổng nhận. Một cổng nhận mặc định chỉ được phép có đúng một dây nối tới; cổng khai báo `multiple: true` nhận **bao nhiêu dây cũng được**, bắt buộc nghĩa là ít nhất một. Gói của cổng nhiều dây tới node dưới dạng danh sách `lists[tên cổng]` theo thứ tự dây, không phải `inputs[tên cổng]`; chữ ký chạy lại băm cả danh sách nên thêm hoặc bớt dây là node chạy lại. Hiện không node lõi nào khai cổng nhiều dây; bộ máy giữ tính năng cho node gom nhiều thứ cùng loại. Đồ thị bắt buộc không có chu trình. Node thành phần (ba loại phát `EngineRef`, `LLMRef`, `TTSRef`) không có cổng nhận nào.

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

Quy ước cốt lõi: mọi giá trị trong `facts` có nguồn gốc xác định và **không bao giờ do mô hình ngôn ngữ sinh ra**. Lõi bảo vệ quy ước này bằng cấu trúc: `FactSheet` được nối thẳng vào Node Đóng Gói Timeline và đè lên props theo `factBindings` (mục 2.3), nên dữ kiện không cần đi qua node biên kịch để tới được video.

### 2.2b. Dữ kiện dạng danh sách

`facts` nhận cả **danh sách các mục**, mỗi mục là một bản ghi phẳng: `items: [{title, source, image, …}, …]`. Đây là cách một video nói về nhiều thứ khác nhau mà không thứ nào đi qua mô hình.

- Một **beat khai `factList`** là tên khóa chứa danh sách thì chạy **mỗi mục một cảnh**, tối đa bằng `count`; danh sách không có thì beat không sinh cảnh nào và node ghi cảnh báo. Ràng buộc của beat khi đó là **tên trường trong mục**, không phải khóa cấp cao.
- Lúc khai triển, mỗi cảnh mang ràng buộc đã giải sẵn thành đường dẫn `items.<số>.<trường>`; Đóng Gói Timeline đọc đường dẫn đó (`readFactPath`). Dữ kiện là chuỗi rỗng coi như không có, để một trang không có mô tả không xóa trắng prop.
- Prompt đưa **dữ liệu của mục** kèm dòng cảnh, vì mô hình cần biết cảnh nói về cái gì để viết lời đọc; còn chữ trên hình vẫn lấy thẳng từ dữ kiện, không qua mô hình.

### 2.3. `ScenePlan`

Tự chứa: mang theo sân khấu và mọi block mà các cảnh dùng, nên Đóng Gói Timeline, engine và tệp dự án không cần tra registry nào.

- `language` (Chuỗi, mã BCP 47): Ngôn ngữ của toàn bộ chữ trên màn hình và lời thoại.
- `stage` (`StageDef`, mục 2.6): Sân khấu của cả video, chép từ tham số của node Đạo Diễn Mỹ Thuật phát ra plan.
- `blocks` (Danh sách `BlockDef`, mục 2.7, ít nhất một, `id` không trùng): Toàn bộ danh mục block của Đạo Diễn Mỹ Thuật, không chỉ những block được dùng.
- `scenes` (Danh sách, ít nhất một phần tử):
  - `blockId` (Chuỗi): `id` của một block trong `blocks`. Lược đồ từ chối plan có `blockId` không nằm trong danh mục.
  - `weight` (Số dương): Trọng số thời lượng tương đối. Đóng Gói Timeline chia tổng số khung hình theo tỷ lệ các trọng số.
  - `props` (Đối tượng): Nội dung của block, hình dạng do bảng `props` của block quy định.
  - `tone` (Chuỗi, tùy chọn): Tên một tone của `stage`; bỏ trống là bảng màu gốc. Tên không có trong stage bị từ chối.
  - `fields` (Đối tượng, tùy chọn): Giá trị cho `stage.sceneFields`, theo tên.
  - `factBindings` (Đối tượng, tùy chọn): Ánh xạ `tênProp → khóaTrongFacts`. Đóng Gói Timeline đè `facts[khóa]` lên `props[tênProp]`; dữ kiện luôn thắng. Thiếu khóa trong `facts` thì prop giữ nguyên.

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

### 2.6. `StageDef`

Sân khấu — cái vỏ hiển thị bền qua mọi cảnh của một workflow (xem thuật ngữ ở `README.md`). Mỗi workflow một stage.

Stage cũng là nơi quyết định **chỗ phụ đề**: một phần tử `data-slot="captions"` trong markup, CSS của stage đặt vị trí, font, cỡ, màu chữ thường và biến `--caption-on` cho màu từ đang đọc; thuộc tính `data-caption-style="karaoke"` (mặc định, cả dòng hiện và từ đang đọc đổi màu) hay `"reveal"` (từ hiện dần theo nhịp đọc). Ba stage trong bản mẫu khai chỗ này ở vùng an toàn dưới. Không khai thì engine dùng dải mặc định.

- `frame` (`{width, height}`, mặc định 1080×1920): **tỉ lệ** stage được vẽ cho, chọn trong bốn preset (9:16, 16:9, 1:1, 4:5). Hai con số là hệ tọa độ thiết kế mà code stage và block viết theo, không phải số điểm ảnh của tệp: độ phân giải (1080p, 1440p, 2160p) chọn lúc Xuất MP4 và engine phóng khung thiết kế lên khi kết xuất. Kích thước video lấy từ đây qua `plan.stage`, nên không thể có chuyện stage vẽ cho 9:16 mà video đóng gói 16:9. Xem trước, vùng an toàn, kéo thả và prompt sửa bằng lời đều đọc cùng trường này.
- Stage **không phải canvas tự do**: các thành phần lấy từ một danh mục vai trò cố định (`STAGE_ROLES` trong `core/look/stage-elements.ts`), nhận ra nhau qua tên class: `content` (chỗ block, bắt buộc), `captions` (phụ đề karaoke), `kicker` và `source` (trường theo cảnh, director viết), `signature` (chữ ký kênh, chữ cố định), `logo` (ảnh), `rule` (đường kẻ). Mỗi vai trò tối đa một; người dùng thêm từ danh mục rồi chỉnh kiểu (vị trí, kích thước, chữ, ảnh), không thêm phần tử tùy tiện. Thêm vai trò mới là thêm một mục vào danh mục, để director, engine và node Phụ Đề cùng biết. Mô hình sửa bằng lời được dặn giữ đúng các class này.
- Sửa stage không cần viết code, theo ba đường cùng ghi vào `code.source` và các trường trên: **sửa bằng lời** (`POST /api/look/edit`, `nodes/art-director/edit.server.ts`: mô hình trả về code mới và, khi yêu cầu đòi hỏi, cả `tokens`, `tones`, `sceneFields` thay thế trọn vẹn; máy chủ bỏ tone ghi đè khóa không có trong palette, báo trường thêm mới chưa có `data-field`, và tóm tắt "đổi thêm" cho modal); **kéo thả** (`core/look/layout-edit.ts`: khung xem trước đo các phần tử tầng ngoài của stage, kéo thả ghi lại `left/right/top/bottom/width/height` vào đúng rule CSS, giữ cách neo; `core/look/stage-elements.ts`: thêm chữ, khối, ảnh là một phần tử lá cộng một rule, xóa và sửa nội dung chữ); **xem trước có chuyển động** (`buildLookPreview({animate})` chạy script của stage và block trên một timeline lặp, gsap inline).
- Ảnh và logo là **tài nguyên theo mã băm**: tải lên `POST /api/assets` (data URL ảnh, tối đa 2 MB) → `.nodecine/assets/<sha1>.<ext>`, tham chiếu bằng `/api/assets/<tên>`; máy chủ chỉ phục vụ tên hợp lệ. Khi kết xuất, engine chép các ảnh được tham chiếu **cả trong code lẫn trong props của từng cảnh** vào thư mục dự án và viết lại đường dẫn. Workflow chia sẻ sang máy khác sẽ thiếu ảnh nếu không chép kèm thư mục này.
- `transition` (`{ type: cut | fade | slide | zoom, seconds }`, mặc định `fade` 0,4 s): cách cảnh này nhường cảnh sau, **một kiểu cho cả phim**. Engine giữ cảnh trước còn hiện thêm đúng `seconds` sau mốc cắt, cảnh sau bắt đầu đúng mốc cắt và được vẽ đè lên (mờ dần vào, trượt lên, hay phóng nhẹ), nên lời đọc và script của cảnh sau không bị xê dịch; HyperFrames chỉ bật tắt cảnh, phần chuyển là tween opacity/transform trên chính phần tử cảnh ở timeline gốc. Thẻ template và preview dùng cùng kiểu chuyển giữa hai slide. Preview có chuyển động còn vẽ **một dòng phụ đề mẫu** vào đúng chỗ stage dành cho phụ đề (hay dải mặc định), tô từng chữ rải đều trên vòng lặp theo kiểu karaoke hay reveal của slot, để xem trước vị trí và kiểu phụ đề mà không cần lời đọc.
- `name`. Stage không có id: không gì tham chiếu tới nó (mỗi workflow một stage, plan và IR chép nguyên cả stage), nên một định danh chỉ là thứ để hỏi "nó để làm gì".
- `tokens.palette`, `tokens.fonts`: bản đồ tên → giá trị. Renderer phơi ra thành biến CSS `--<tên>` cho code của stage và block dùng chung (`--bg`, `--fg`, `--accent`, `--font-display`, …).
- `tones`: bản đồ tên tone → phần ghi đè bảng màu. Tên tone là giá trị mô hình được viết vào trường `tone` của cảnh.
- `vars` (bản đồ tên → chữ, mặc định rỗng): **giá trị của cả video** — ngày, số tập, tên kênh. Stage vẽ bằng `data-var="tên"`, và mọi cảnh nhận cùng một giá trị; đó là chỗ khác `sceneFields` (mỗi cảnh một giá trị, do mô hình viết). Người dùng gõ, mô hình không bao giờ chạm tới. Đóng Gói Timeline thêm sẵn `date` và `time` theo đồng hồ lúc chạy nếu stage không tự đặt hai khóa đó, nên một bản tin hằng ngày không phải sửa ngày bằng tay; đặt `date` trong `vars` là đè lên. Bản đồ đã giải nằm trong IR ở `vars` (trường thêm, số hiệu IR không đổi), và khung xem trước dùng đúng hàm đó nên góc màn hình trong modal giống hệt bản kết xuất. Vai `stamp` trong danh mục vẽ sẵn một phần tử `data-var="date"`.
- `sceneFields[]`: `{ name, rule, options? }` — trường theo cảnh mà stage tự vẽ (ví dụ `kicker`), kèm quy tắc dạy mô hình cách viết; `options` giới hạn giá trị.
- `code`: xem 2.8.

### 2.7. `BlockDef` và `LookDef`

`BlockDef` là một kiểu cảnh, mang theo dưới dạng dữ liệu; đây là thứ Đạo Diễn Mỹ Thuật dàn cho từng cảnh (5.9). `LookDef` là `StageDef` (2.6) cộng `blocks: BlockDef[]` (ít nhất một, `id` không trùng) — cả giao diện của workflow trong một gói, tham số của node Đạo Diễn Mỹ Thuật. Nó **không đi trên dây**: Đạo Diễn Mỹ Thuật nhận `SceneScript` và phát `ScenePlan`.

- `id` (slug), `name`. Quy tắc đặt id: `<slug của tên lúc tạo>` (`text-card`, `hook`), không tiền tố vì đây là chữ mô hình viết vào `blockId` và beat trỏ tới; trùng trong node thì thêm `-2`; sinh một lần khi tạo, đổi tên sau đó không đổi id, giao diện hiện id mờ cạnh tên.
- `doc.example`: một ví dụ props hợp lệ dạng JSON. `doc.when`: dùng khi nào, không dùng khi nào — nguồn duy nhất cho cả mô hình và người.
- `props`: bản đồ tên → `{ type, content?, hint?, required (mặc định true), max?, min? }`, `type ∈ string | text | number | boolean | color | string[] | image | video | entries`. Prop kiểu `image` nhận **một tài nguyên đã tải lên** (`/api/assets/<băm>.<đuôi>`, Kiến trúc mục 6), engine gán vào `src` của phần tử `<img data-prop="tên">`; giá trị khác dạng đó bị từ chối ngay ở lược đồ. `content` là khóa từ vựng (2.11) đổ vào prop này; bỏ trống thì lấy khóa trùng tên prop nếu có. Prop không ánh xạ được khóa nào thì không bao giờ được điền từ nội dung (chỉ còn đường ràng buộc dữ kiện hay để trống nếu không bắt buộc).
- `code`: xem 2.8.

### 2.8. Code cảnh (`SceneCode`)

Dùng chung cho stage và block: `{ format: 'html-gsap', source }`, `source` tối đa 200 000 ký tự. Quy ước:

- Một đoạn HTML kèm `<style>` nội tuyến. Block được đặt vào phần tử của stage có `data-slot="content"`; stage vẽ trường theo cảnh vào phần tử có `data-field="<tên>"`; block gắn props vào phần tử có `data-prop="<tên>"` (chuỗi và số đổ vào `textContent`, số định dạng theo `en-US`; với `string[]`, phần tử con đầu tiên là mẫu được nhân bản cho mỗi mục). Phần tử có `data-if="<tên>"` bị bỏ khi prop đó rỗng hoặc `null` — cách một block sống được khi dữ kiện ràng buộc chưa có.
- Token của stage phơi ra thành biến CSS: mỗi khóa `palette` là `--<khóa>`, mỗi khóa `fonts` là `--font-<khóa>`; tone của cảnh ghi đè các biến palette tương ứng. Code của block chỉ dùng biến, không mã hóa cứng màu hay phông, để cùng một block đẹp trên mọi stage.
- `<script>` tùy chọn gọi `nodecine.timeline(tl)` với một GSAP timeline có mốc 0 là đầu cảnh. Renderer **tua** timeline theo thời gian tuyệt đối, nên không dùng `repeat: -1` hay bất kỳ thứ gì phụ thuộc đồng hồ thật.
- Không mạng, không tài nguyên ngoài. Renderer chạy code trong iframe có sandbox, không cùng origin với Studio, không cho fetch. Điều này là ràng buộc an toàn, không phải tùy chọn.

---

**Mục danh sách hiện theo giọng đọc** (`core/look/reveal.ts`, học từ cutdown): với mỗi prop `string[]` của cảnh, engine tính mốc lộ của từng mục theo giây từ đầu cảnh. Có mốc từ (Căn Mốc Từ đang bật, phụ đề nối vào Đóng Gói) thì mục lộ đúng lúc giọng đọc tới **từ dài nhất** của nhãn, chỉ dò tiến từ mục trước; không tìm thấy hay không có mốc từ thì rải đều từ giây 0,45 đến cách cuối cảnh 0,6 giây; sau đó ép tăng dần, cách nhau ít nhất 0,28 giây. Script nhận qua `nodecine.stagger("<prop>")` (hàm stagger của gsap, tween đặt ở vị trí 0), `nodecine.at(i, "<prop>")` và `nodecine.duration`. Preview không có lời nên rải đều trên độ dài vòng lặp. Block danh sách trong template và block mô hình viết đều dùng cách này thay cho stagger cố định.

**Chuyển động cả cảnh, số đếm, cụm nhấn.** Script nhận thêm `nodecine.duration` (độ dài cảnh theo giây) để giữ một chuyển động chậm suốt cảnh — ba stage mẫu phóng lớp sáng của nền từ 1 lên 1,18 trong cả cảnh qua biến CSS `--drift` đọc bởi `transform: scale()` trên `.stage::before` (GPU lo, không vẽ lại), không khung nào chết. `nodecine.count("<selector>", vars)` trả về một timeline đếm số trong phần tử từ 0 tới giá trị đang hiện, giữ nguyên cách nhóm hàng nghìn và số lẻ (`stat`, `metric-ring`, sao của `hook` dùng). Một prop chữ chứa `*cụm*` được bind thành `<em class="nc-emph">` màu accent: Biên Kịch được bảo bọc đúng một cụm quan trọng nhất trong `title`; block muốn kiểu khác thì tự style `.nc-emph`.

### 2.10. `CaptionTrack`

Các dòng phụ đề trên đồng hồ của voice-over: `cues` (danh sách `{start, end, words}` giây, mỗi `words` là các từ có mốc). Chỉ có **nói gì, lúc nào**; nằm ở đâu, font gì, màu tô ra sao là của Stage (mục 2.6). Một dòng không bao giờ sống quá lúc dòng sau bắt đầu, nên không có hai dòng chồng nhau. Cách gom từ thành dòng ở `nodes/captions/cues.ts`: theo câu trước, rồi tối ưu tổng chi phí ngắt dòng (dấu câu miễn phí, ngắt sau từ nối hay giữa một con số viết bằng chữ bị phạt nặng); mang từ cutdown, nơi các luật này đã đo trên lời thoại tiếng Việt thật.

### 2.11. `SceneScript` và từ vựng nội dung

Video đã chia cảnh nhưng chưa có giao diện — chặng kịch bản kết thúc ở đây, chặng giao diện bắt đầu từ đây.

- `language` (BCP 47).
- `scenes[]`: `{ role, weight, narration, content, factBindings? }`. `role` là tên beat (hook, quote, cta) — Đạo Diễn Mỹ Thuật dàn cảnh theo vai này; `narration` là lời đọc trên cảnh đó, cảnh dài đúng bằng lời (5.4); `weight` chỉ còn dùng khi không có đoạn lời; `factBindings` là `khóaNộiDung → khóaDữKiện`.
- `content`: một đối tượng chỉ dùng các khóa của **từ vựng nội dung** (`CONTENT_KEYS`), khóa nào cũng tùy chọn, cảnh viết cái nó cần: `kicker` (nhãn 1–3 từ), `title` (tiêu đề ≤ 60 ký tự, cảnh nào cũng có), `body` (1–2 câu), `points` (2–4 dòng ngắn), `number` + `label` (một con số đúng dạng hiển thị và nó là gì), `quote` + `attribution`, `code` (một lệnh), `source` (nội dung lấy từ đâu), và `image` (ảnh của cảnh), `clip` (đoạn phim của cảnh), và `entries`.
- `entries` là **nhiều thứ cùng loại trong một cảnh**: hai mục để so sánh, năm hàng bảng xếp hạng, ba bước hướng dẫn. Mỗi mục dùng lại đúng từ vựng này, **sâu đúng một cấp** (mục chứa mục thì bị lược bỏ, không báo lỗi). Từ vựng không mọc thêm danh từ cho từng thể loại — nó mọc thêm một chiều là sự lặp lại, và mười lăm từ sẵn có đủ mô tả từng mục. Block khai `type: 'entries'` cùng `min`/`max` (bao nhiêu mục nó chứa được) và `of` (khóa nào của mục nó vẽ); mục không có gì block vẽ thì bị bỏ, ít hơn `min` thì block coi như không hiện được cảnh. Trong markup, **phần tử con đầu tiên là khuôn**, nhân bản cho từng mục, và `data-prop` bên trong khuôn đọc mục đó chứ không đọc cảnh.
- `image` và `clip` là các khóa **mô hình không được viết**, kể cả khi nằm trong một mục của `entries`: mô hình không thể biết tên một tài nguyên đã tải lên. `WRITTEN_KEYS` là mười khóa còn lại — lược đồ đầu ra của Biên Kịch và Phân Cảnh, danh sách trong prompt và ô ràng buộc dữ kiện đều chỉ nhận chúng. Ảnh vào cảnh bằng tay (ô chọn ảnh trên node Kịch Bản Tĩnh) hoặc bằng ràng buộc dữ kiện.

Từ vựng là cố định để biên kịch không cần biết block nào tồn tại: mô hình viết theo mười khóa này, block khai prop của nó nhận khóa nào (2.7), và Đạo Diễn Mỹ Thuật ghép hai bên. Thêm khóa là sửa lõi, có chủ ý.

## 3. Bản Đặc Tả Video Trung Gian (Universal Video IR)

Cấu trúc duy nhất do Node Đóng Gói Timeline tạo ra, độc lập với engine **và độc lập với mọi node**. Tự chứa: mang theo stage và các block nó dùng, nên một engine vẽ được IR mà không cần đăng ký gì, và một IR đã lưu phát lại được ở bất kỳ đâu. Đây là ranh giới giữa phần dựng nội dung và phần kết xuất.

- `irVersion` (Số nguyên): Phiên bản lược đồ, hiện là `1`. Adapter từ chối nạp phiên bản không hỗ trợ.
- `meta`:
  - `title` (Chuỗi), `language` (Chuỗi BCP 47): Lấy từ tham số node và `ScenePlan`.
  - `fps` (Số nguyên): Mặc định 30, do tham số của Node Đóng Gói Timeline.
  - `width`, `height` (Số nguyên): Mặc định 1080 và 1920.
  - `totalDurationInFrames` (Số nguyên).
- `stage` (`StageDef`) và `blocks` (Danh sách `BlockDef`): Chép nguyên từ `ScenePlan`.
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
- `captions` (tùy chọn): `cues` của `CaptionTrack` đã đổi sang khung hình: `{startFrame, durationInFrames, words: [{text, startFrame, durationInFrames}]}`; mỗi từ ít nhất một khung, không dòng nào vượt quá tổng khung. Không có `captions` là cùng video đó không phụ đề; số hiệu IR không đổi vì trường này chỉ thêm.

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
- Thêm block hay stage mới không đụng tới lược đồ IR, Adapter hay node lõi, và cũng không đụng tới code: người dùng thêm block ngay trong node Đạo Diễn Mỹ Thuật, hoặc mở một bản mẫu mang sẵn chúng.

---

## 5. Node Lõi (Core Nodes)

Lõi ship đúng những node cần để dựng được video từ một kịch bản gõ tay, không phụ thuộc mạng, không phụ thuộc mô hình ngôn ngữ.

### 5.1. Nhập Liệu (Input Trigger)

Ô văn bản, phát `SourceRef`. Không diễn giải, không gọi mạng. Ô trống là lỗi kiểm tra liên tục `INPUT_EMPTY`.

Tham số thứ hai, `perRun`, không phải của node mà của **hàng đợi**: bật lên thì mỗi dòng trong ô là một lần chạy cả luồng (Bộ Máy Thực Thi mục 10). Node vẫn phát đúng một giá trị mỗi lần chạy như thường; chỗ đọc `perRun` là bộ chạy, đúng chỗ ComfyUI đọc `control_after_generate` của một widget.

### 5.2. Kịch Bản Tĩnh (Static Script)

Node phát `SceneScript` (2.11) và `AudioScript` từ nội dung gõ tay, dành cho việc dựng video không cần mô hình ngôn ngữ và để kiểm thử khung. Không cổng nhận: chặng kịch bản không cần biết giao diện, Đạo Diễn Mỹ Thuật đứng sau sẽ dàn cảnh. Tham số:

- Không còn ô lời thoại chung: `AudioScript.text` là các `narration` ghép lại, `segments` là từng đoạn. Không có tham số ngôn ngữ: người dùng đã viết lời cuối cùng nên ngôn ngữ của văn bản chính là ngôn ngữ của video. Node nhận diện bằng hàm thuần `detectLanguage(text)` của lõi (theo hệ chữ viết; chữ Latinh có dấu riêng của tiếng Việt thì là `vi`, chữ Latinh khác coi là `en`) và điền vào `SceneScript.language` lẫn `AudioScript.language`. Đoán sai thì người dùng chọn giọng tay trên Giọng Đọc.
- `scenes` (Danh sách chỉnh sửa trực tiếp trên thân node): mỗi mục gồm `role`, `weight`, `narration` (lời đọc trên cảnh, một ô riêng) và `content` theo từ vựng (2.11) — thân node hiện một ô cho mỗi khóa đang dùng và một ô chọn để thêm khóa, `points` mỗi dòng một ý. Block, tone và trường stage là việc của Đạo Diễn Mỹ Thuật. Mặc định là ba cảnh `title / how / next`, mỗi cảnh một câu lời.

- **Dán kịch bản** (`nodes/script/split.ts`): một mục gập lại trên đầu thân node nhận cả kịch bản rồi cắt thành cảnh, vì kịch bản viết ra là một khối văn xuôi chứ không phải từng cảnh một. Ba luật cắt do người chọn — dòng trống, mỗi dòng, mỗi câu — vì chỉ người viết mới biết mình đã viết theo lối nào; luật câu cắt nhầm ở chữ viết tắt (`v.v.`, `T.P.`), đó là lý do có ba luật chứ không phải một. Cắt là thuần cơ học: không gọi mô hình, không sửa một chữ nào, chỉ gộp khoảng trắng — số cảnh hiện ngay trên nút để đọc trước khi bấm. Bấm xong thì **thay** danh sách cảnh: mỗi khúc một cảnh, `weight` 1, `content` rỗng, `role` lấy theo cảnh đầu đang có. Đi qua `setParams` nên Ctrl+Z hoàn lại nguyên danh sách cũ.

Cảnh chỉ kiểm tra được khi đã biết dây nối vào, nên việc kiểm tra `blockId`, `props` và `tone` là **preflight** (chặn trước khi chạy với `NODE_PARAMS_INVALID` và câu chỉ dẫn), không phải kiểm tra liên tục. Không có `factBindings` vì không có nguồn dữ kiện; người dùng gõ thẳng giá trị.

### 5.3. Giọng Đọc (TTS Engine)

Nhận `AudioScript` và `TTSRef`, chọn giọng khớp ngôn ngữ theo quy tắc ở mục 8.2, gọi nhà cung cấp, đo thời lượng từ tệp đã tạo, phát `Voiceover`. Tham số: `voice` (để trống là tự chọn theo ngôn ngữ), `speed`.

Khi `AudioScript` có `segments` (từ hai đoạn trở lên), node đọc **từng đoạn một** rồi nối bằng ffmpeg (`services.concatAudio`), chèn 0,35 giây lặng sau mỗi đoạn — hơi thở giữa hai ý và cũng là chỗ cảnh cắt. `Voiceover.segments` ghi đoạn nào bắt đầu ở đâu, dài bao lâu (gồm khoảng lặng), tổng đo lại trên tệp đã nối. Cách này học từ cutdown: cảnh dài đúng bằng lời của nó, không cần căn mốc từ mới khớp, và sửa lời một cảnh chỉ đọc lại cảnh đó (mỗi đoạn là một lần gọi riêng, cùng câu cùng giọng thì nhà cung cấp trả tệp đã có). Mốc từ nhà cung cấp trả theo đoạn được dời theo `start` của đoạn. Một đoạn nhà cung cấp trả lỗi upstream (504, đứt kết nối) được gọi lại đúng một lần sau hai giây; lần hai lỗi thì node lỗi.

### 5.4. Đóng Gói Timeline (Timeline Assembler)

Nhận `ScenePlan` và `Voiceover` (bắt buộc), `FactSheet` và `CaptionTrack` (tùy chọn). Tham số: `fps` (30), `minTotalFrames` (270), `title`. Kích thước khung lấy từ `plan.stage.frame`, không phải tham số ở đây. Hàm thuần, không gọi mạng, thất bại đồng nghĩa lỗi lập trình.

Quy tắc phân bổ thời lượng, tất định:

1. Số khung hình âm thanh bằng `durationSeconds × fps`, làm tròn lên.
2. Tổng số khung hình bằng giá trị lớn hơn giữa số khung hình âm thanh và `minTotalFrames`; phần chênh ghi vào `padTailFrames`.
3. **Cắt theo lời** khi `Voiceover.segments` có đúng một mục cho mỗi cảnh: `durationInFrames` của mỗi cảnh trừ cảnh cuối bằng `durationSeconds` của đoạn nhân `fps`, làm tròn, ít nhất 1; cảnh cuối nhận phần còn lại (kể cả `padTailFrames`); nếu làm tròn dồn khiến cảnh cuối âm thì rút từng khung từ cảnh dài nhất. Không có đoạn lời thì theo trọng số: với mỗi cảnh trừ cảnh cuối, `durationInFrames` bằng phần nguyên (làm tròn xuống) của `tổng × weight / tổng các weight`. Cảnh cuối nhận toàn bộ phần còn lại. Cách này loại bỏ mơ hồ khi làm tròn giá trị nằm đúng giữa hai số nguyên, và đảm bảo tổng luôn khớp tuyệt đối theo cấu trúc chứ không theo may rủi. Trường hợp biên: nếu trọng số quá lệch và tổng khung quá nhỏ khiến phần nguyên của một cảnh bằng 0, cảnh đó nhận 1 khung và cảnh cuối bị trừ 1 khung tương ứng (tổng vẫn giữ nguyên, bất biến 4 ở mục 3.1 được bảo toàn); nếu sau khi mượn mà cảnh cuối cũng về 0, hoặc tổng khung nhỏ hơn số cảnh, node báo lỗi lập trình thay vì tạo IR sai.
4. `startFrame` tích lũy từ 0.
5. Đè dữ kiện: với mỗi cảnh có `factBindings`, gán `props[tênProp] = facts[khóa]` cho mọi khóa có mặt trong `FactSheet.facts`. Dữ kiện luôn thắng giá trị cùng tên đã có trong `props`.
6. Chạy hàm kiểm định IR ở mục 3.1 trước khi phát.

Ví dụ đối chiếu với trọng số 1, 2, 1 và âm thanh 11.2 giây ở 30 fps: 336 khung, phân bổ 84, 168, 84, bắt đầu 0, 84, 252. Với âm thanh 7.5 giây: 225 khung nhỏ hơn 270 nên tổng là 270, `padTailFrames` 45, phân bổ 67, 135, 68. Phần dư dồn cho cảnh cuối luôn nhỏ hơn số cảnh trừ một, tức nhỏ hơn 2 khung với ba cảnh.

### 5.5. Xuất Bản Video (Video Output)

Nhận `VideoIR` và `EngineRef`. Tra renderer theo định dạng code (mục 4), tra adapter registry theo `engineId`, gọi `mountPlayer()`. Chính là trình phát; không có cổng phát, không có node xuất. Giao diện chi tiết tại Đặc tả Luồng Trải nghiệm mục 1.4.

### 5.6. Xuất MP4 (MP4 Export)

Nhận `VideoIR` và `EngineRef`, bỏ qua mặc định. Tham số `ExportSettings`:

- `codec`: `h264` mặc định, `h265` tùy chọn.
- `quality`: `high` (CRF 18), `medium` (CRF 23), `low` (CRF 28); giá trị CRF là chi tiết của Adapter.
- `fileName`: Không kèm đường dẫn, mặc định theo tên dự án, ký tự không hợp lệ thay bằng gạch ngang.

Hành vi: khi đang bỏ qua, Chạy Luồng không chạm tới; bấm Kết xuất là chạy riêng node theo Đặc tả Bộ Máy Thực Thi mục 3; node bị vô hiệu hóa khi thiếu dây, khi `EngineRef.capabilities.render` không phải `ready`, hoặc khi thiếu renderer cho một `sceneType`. Trong lúc chạy hiện tiến độ và nút Hủy; xong hiện tên tệp, dung lượng, node Tải xuống; kết quả gắn vào lịch sử chạy. Nhiều node xuất trên cùng đồ thị là hợp lệ.

Tham số `resolution` (`1080p` mặc định, `1440p`, `2160p`) chọn độ phân giải theo cạnh ngắn của khung: `1080p` đúng bằng hệ tọa độ thiết kế của stage, `2160p` phóng khung 1080×1920 thành 2160×3840. Engine HyperFrames giữ nguyên bố cục theo pixel thiết kế và `transform: scale` gốc composition theo hệ số, nên code stage và block không cần biết độ phân giải.

### 5.7. Node tài nguyên: Động Cơ, Mô Hình Ngôn Ngữ, Giọng Đọc

Có **một node cho mỗi kiểu cổng**, không phải một node cho mỗi nhà cung cấp. Node Mô Hình Ngôn Ngữ phát `LLMRef`, node Giọng Đọc phát `TTSRef`, và nhà cung cấp là tham số chọn trong hộp thả, giống cách Load Checkpoint của ComfyUI chứa mọi checkpoint. Tham số của node là `{providerId, settings}`; lõi không kiểm tra `settings` vì lõi không được biết danh sách nhà cung cấp, việc kiểm định thuộc về chính nhà cung cấp lúc dựng. Thêm một nhà cung cấp là thêm một dòng vào `providers/installed.ts`, không thêm node, không sửa giao diện.

Mô tả ở mục 6, 7 và 8. Cả ba dùng chung khuôn: không cổng nhận, một cổng phát, `run() = probe()`, tham chiếu là dữ liệu tuần tự hóa được.

### 5.8. Biên Kịch (Screenwriter)

Có **một node biên kịch**, trong lõi. Cổng nhận: `LLMRef` bắt buộc, `FactSheet` tùy chọn và `SourceRef` tùy chọn; phát `SceneScript` (2.11) và `AudioScript`. Node **không biết giao diện**: không block, không stage, không tone. Đó là chặng sau (Đạo Diễn Mỹ Thuật, 5.9), nên sửa giao diện không bao giờ chạy lại mô hình. Mọi thứ từng khiến mỗi loại video cần một node biên kịch riêng đều là **tham số** hoặc **dữ liệu trên dây**:

- `prompt` — đề bài người dùng viết. Thứ duy nhất chỉ người dùng nói được.
- `beats` — danh sách **beat**: `{ role, brief, weight, count, factBindings }`. `role` là tên ngắn của một đoạn (hook, quote, cta), cũng là vai Đạo Diễn Mỹ Thuật dàn theo; `brief` nói đoạn đó làm gì; `count` là số cảnh liên tiếp; `factBindings` là `khóaNộiDung → khóaDữKiện`.
- `outputLanguage` (`auto` = ngôn ngữ của đề bài và dữ kiện).

Mô hình viết **lời đọc và nội dung từng cảnh** theo từ vựng cố định (2.11): mỗi beat khai triển thành `count` phần tử, mỗi phần tử là `narration` cộng đối tượng nội dung trừ các khóa đã ràng buộc dữ kiện; ngân sách từ của lời tính theo trọng số (khoảng 13–17 từ cho một đơn vị, tức năm giây). Không còn lời thoại chung cho cả bài: lời cả bài là các đoạn ghép lại. Lược đồ đầu ra không phụ thuộc block nào. Mô hình phải trả về đúng số cảnh, đúng thứ tự; khóa lạ bị bỏ, không bị từ chối.

Ba bất biến do node này giữ:

1. **Khóa đã ràng buộc không bao giờ được hỏi mô hình**, và **dữ kiện đã ràng buộc không bao giờ vào prompt**. Số sao, lệnh cài, đường dẫn đi thẳng từ `FactSheet` tới Đóng Gói Timeline; mô hình không có gì để chép sai.
2. Prompt được dựng từ các nguồn tách bạch: đề bài mang ý đồ, beat mang cấu trúc, từ vựng nội dung mang hình dạng, dữ kiện mang sự thật. Không có gì trong prompt nói về một loại video, một block hay một stage cụ thể.
3. Đổi giao diện không tốn tiền: Đạo Diễn Mỹ Thuật không nằm trong chữ ký của node này, nên sửa màu, font, block hay dàn cảnh chỉ chạy lại Đạo Diễn Mỹ Thuật và Đóng Gói Timeline (hai hàm thuần).

Vòng gọi mô hình (`nodes/screenwriter/loop.ts`): sai cấu trúc thử lại một lần, sai ngôn ngữ thử lại một lần với prompt nghiêm hơn, rồi ném `LLM_SCHEMA_INVALID` hoặc `LLM_LANGUAGE_MISMATCH` kèm nguyên văn câu trả lời để node hiển thị. Chính sách ngôn ngữ ở `core/text/languages.ts`. Beat và lược đồ ở `nodes/screenwriter/beats.ts`, prompt ở `nodes/screenwriter/prompt.ts`.

Hệ quả: một video GitHub showcase là *node này* với bảy beat và ba ràng buộc dữ kiện, rồi một Đạo Diễn Mỹ Thuật `developer-dark` với hai mươi block dàn theo nội dung (chỉ tone ghim theo vai); một video trích dẫn là *node này* với beat `title ×1, quote ×4`, rồi một Đạo Diễn Mỹ Thuật `ink` hai block. Người dùng dựng cả hai từ canvas trống; sự khác nhau nằm trọn trong dữ liệu, và một bản mẫu chia sẻ mang theo cả giao diện vì nó mang theo các node Đạo Diễn Mỹ Thuật.

### 5.9. Đạo Diễn Mỹ Thuật (Art Director)

Node `core/art-director`, chặng giao diện của luồng: nhận `SceneScript` (2.11) từ Biên Kịch hay Kịch Bản Tĩnh, phát `ScenePlan` (2.3) cho Đóng Gói Timeline. Tham số của node **là** giao diện: stage (2.6) cộng danh mục block diễn trên nó, `id` block không trùng, cộng bảng **dàn cảnh** `casting: [{ role, block?, tone? }]`.

**Dàn cảnh** (`nodes/art-director/cast.ts`, hàm thuần, không gọi mô hình): với từng cảnh, (1) nếu vai có block ghim trong `casting` và block đó hiện được cảnh thì dùng; (2) không thì chấm điểm mọi block: block thiếu prop bắt buộc mà nội dung không có (và không ràng buộc dữ kiện) bị loại, còn lại block **làm rơi ít nội dung nhất** thắng (một block *hiện được trọn* cảnh khi mọi khóa nội dung cảnh có đều có prop đón, trừ khóa stage tự vẽ như `kicker`; block hiện được nhưng bỏ rơi khóa nào thì kế hoạch ghi cảnh báo nêu khóa đó), rồi block **điền được nhiều prop nhất**, hòa thì block **ít prop tùy chọn bị bỏ trống nhất** (block sinh ra cho đúng nội dung này), rồi block **ít được dùng nhất** trong lần dàn này (một dãy cảnh giống nhau không dồn hết vào thẻ đầu danh mục), rồi thứ tự danh mục; (3) đổ nội dung vào prop theo ánh xạ `content` (2.7): chuỗi, danh sách ghép chuỗi, con số đọc từ chữ ("4,321" → 4321); chữ dài hơn `max` của prop bị cắt ở ranh giới từ kèm dấu ba chấm và ghi cảnh báo, danh sách dài hơn `max` bị cắt, danh sách ngắn hơn `min` coi như không có; (4) đổi `factBindings` khóa nội dung → khóa dữ kiện thành prop → dữ kiện của block đã chọn; (5) `fields` của stage lấy từ khóa nội dung trùng tên (`kicker`, `source`), tôn trọng `options`; (6) `tone` theo vai trong `casting` nếu stage có tone đó. Block ghim mà không hiện được cảnh thì ghi cảnh báo và rơi về (2). Cảnh không block nào hiện được là lỗi `NODE_PARAMS_INVALID` từ preflight, nêu block gần nhất còn thiếu gì.

**Dàn cảnh bằng mô hình** (`nodes/art-director/cast-ai.ts`): Đạo Diễn Mỹ Thuật có cổng thành phần `llm` (`LLMRef`, tùy chọn). Nối vào, node gửi một prompt cho cả video — mỗi cảnh: vai, lời đọc, nội dung trên màn hình, và **danh sách block hiện được trọn cảnh đó** do quy tắc lọc sẵn (không block nào trọn thì mới đưa các block hiện được một phần, ghi rõ mỗi block làm rơi gì); mỗi block kèm `doc.when` của nó; các tone của stage — và nhận về block (và tone) cho từng cảnh. Thứ tự ưu tiên: bảng dàn cảnh của người dùng, rồi lựa chọn của mô hình, rồi quy tắc; mô hình chọn block ngoài danh sách thì cảnh đó về quy tắc kèm cảnh báo. Trả lời sai dạng thử lại một lần; lỗi lần hai thì cả video dàn theo quy tắc kèm cảnh báo, không chặn luồng. Mô hình còn được trả lời **`none`** cho một cảnh: không phải "không có gì hiện được" — quy tắc đã bắt việc đó — mà "không có cái nào **hợp** với beat này". Một tấm thẻ chứa được con số vẫn có thể là khung sai cho câu mà cả video xoay quanh, và chỉ thứ đọc được beat mới phán được. Cảnh bị trả lời `none` sẽ được **vẽ một block riêng** (`authorBlock`, 5.10), block đó thành lựa chọn của chính cảnh ấy — không phải chọn gì nữa, vì nó được viết cho đúng cảnh này. Cảnh người dùng đã ghim thì `none` không có hiệu lực. Tối đa **ba** block một lần chạy: mô hình xin nhiều hơn thì phần dư dàn theo quy tắc kèm cảnh báo, vì danh mục phình mỗi lần chạy thì không còn là một look. Khi có thể vẽ block, node **vẫn hỏi** cả khi mỗi cảnh chỉ có một ứng viên — "cái duy nhất hợp lại là cái sai" cũng là một quyết định; không nối mô hình thì không có gì để hỏi (mọi cảnh đã ghim hay chỉ một block hợp) và node không gọi.

**Viết block mới** (`nodes/art-director/author.ts`): khi có mô hình nối vào, vai **chưa được ghim trong bảng dàn cảnh** (ghim là người dùng đã quyết, không viết đè), và cảnh **không block nào hiện được trọn** (mọi block đều thiếu chỗ cho ít nhất một khóa nội dung), node không dừng mà nhờ mô hình viết một block cho cảnh đó: prop ánh xạ đúng các khóa nội dung cảnh có (kể cả khóa ràng buộc dữ kiện), dòng `when`, ví dụ, và code theo token của stage, cùng bộ quy tắc với sửa bằng lời cộng một block sẵn có làm mẫu giọng. Block được kiểm như block viết tay: lược đồ, lint (`data-prop` cho mọi prop, không `from()`), và phải hiện được trọn cảnh; sai thì hỏi lại một lần kèm lý do, sai nữa là lỗi `BLOCK_AUTHOR_FAILED`. Hệ quả cho một workflow mới chỉ có `text-card`: cảnh chỉ có tiêu đề và thân dùng `text-card`, cảnh có gạch đầu dòng, con số hay trích dẫn được viết block riêng ngay lần chạy đầu, và node tích lũy bộ block của chính video đó. Block dùng ngay trong lần chạy này và được **ghi vào tham số của node** (`RunContext.patchParams`, Bộ Máy Thực Thi mục 3): workflow hiện chưa lưu, block xuất hiện trong mục blocks như block người dùng thêm, sửa hay bỏ như thường, hoàn tác được. Không nối mô hình thì preflight vẫn chặn như trước. Sửa giao diện vẫn không tốn: câu trả lời của mô hình được máy chủ giữ theo prompt (Bộ Máy Thực Thi mục 3), cùng kịch bản cùng danh mục là cùng câu trả lời, không gọi lại. Đổi tham số là đổi giao diện, lưu workflow là lưu luôn giao diện. Mặc định là stage `Dark` với ba tone `cool/warm/green`, trường `kicker`, và một block `text-card`.

Thân node: tên, tỉ lệ khung, ba mục gập mở (bảng màu, font, tones), mục **blocks** là danh sách mỗi dòng một block với ảnh nhỏ, bấm để mở sửa đúng block đó, có thêm, nhân bản, bỏ; mục **dàn cảnh** liệt kê các vai đọc từ node kịch bản nối vào (beat hay cảnh gõ tay), mỗi vai một ô chọn block ("theo nội dung" hay một block) và một ô chọn tone. Chỗ, dáng và code của stage lẫn block sửa trong modal (2.6).

### 5.10. Vì sao giao diện là một chặng sau kịch bản

Trước đây stage và block là hai node rồi một node, nhưng luôn nối *vào* đạo diễn (node nay là Biên Kịch): mô hình chọn block và viết props của block, nên giao diện phải có trước kịch bản, và sửa một màu là chạy lại mô hình vì node giao diện nằm trong chữ ký của node viết kịch bản. Đảo lại theo đúng quy trình sản xuất: kịch bản → dàn cảnh → dựng. Đạo diễn chỉ viết nội dung theo từ vựng cố định; Đạo Diễn Mỹ Thuật đứng sau dàn block, tone, trường stage bằng quy tắc; cùng một kịch bản đổi Đạo Diễn Mỹ Thuật chỉ cần nối lại dây; sửa giao diện chạy lại hai hàm thuần trong tích tắc. Từ "look" vẫn là tên chung cho bộ giao diện node này giữ; bên trong, *stage* vẫn là cái vỏ và *block* vẫn là kiểu cảnh — `ScenePlan` và IR giữ nguyên `stage` + `blocks`. Không còn cổng nhiều dây trong lõi.

### 5.11. Truy Xuất Repo (GitHub Fetcher)

Node lõi `core/github-fetcher`: nhận `SourceRef`, phát `FactSheet`. Link repo GitHub thì gọi GitHub API ngay trong node (mục 9.1) để lấy tên, mô tả, sao, ngôn ngữ, chủ đề, lệnh cài suy từ README, trích README. Văn bản thường thì đi qua nguyên vẹn (`mode: passthrough`) để đồ thị GitHub vẫn chạy được với một đoạn mô tả gõ tay. Lỗi có mã riêng: `REPO_NOT_FOUND`, `REPO_RATE_LIMITED` (thử lại được), `REPO_NETWORK` (thử lại được). Cả họ ở `nodes/github/`: node, đọc link, gọi GitHub, dựng dữ kiện, thân node, test. Đây là mẫu cho mọi node lấy dữ liệu về sau (RSS, YouTube, …): một thư mục `nodes/<nguồn>/` chứa trọn họ đó, như `comfy_extras/nodes_<chủ đề>.py` của ComfyUI.

### 5.12. Căn Mốc Từ (Transcribe)

Node lõi `core/transcribe`: nhận `Voiceover` và `AudioScript`, phát `Voiceover` có `words`. Là **căn chỉnh cưỡng bức**, không phải nhận dạng: văn bản đã biết, công cụ chỉ trả lời mỗi từ được đọc lúc nào, nên model nhỏ là đủ và chữ không bao giờ sai. Chạy qua `services.alignWords` → `nodes/transcribe/align.server.ts` gọi `stable-ts` bằng Python trong venv `.nodecine/tools/stable-ts` (`npm run setup:align` cài một lần; `NODECINE_ALIGN_PYTHON` ghi đè); lời thoại đi qua stdin, đường dẫn audio dựng lại từ tên băm của `audioUrl`. Kết quả qua `retime` để chữ là chữ của kịch bản, chỉ mượn mốc thời gian. Voice-over đã có `words` (nhà cung cấp trả sẵn, ví dụ ElevenLabs sau này) thì đi qua nguyên vẹn. Tham số: `model` (`small` mặc định, `medium`, `large-v3`). Thiếu công cụ báo `PROVIDER_NOT_INSTALLED` kèm lệnh cài; căn chỉnh hỏng báo `ALIGN_FAILED`.

Đầu ra của bộ căn là một JSON mỗi từ một mục, dài quá trần 8 KB mặc định của `exec` từ khoảng 150 từ trở lên; node đặt trần riêng 8 MB và coi đầu ra bị cắt là lỗi `ALIGN_FAILED` nêu rõ, không đọc JSON cụt.

### 5.13. Phụ Đề (Captions)

Node lõi `core/captions`: nhận `Voiceover` có `words`, phát `CaptionTrack` (mục 2.10). Hàm thuần. Tham số duy nhất: `maxChars` (26), vì số ký tự một dòng chứa được là số đo bề rộng chỗ phụ đề mà stage dành ra. Voice-over không có `words` là lỗi `CAPTIONS_NO_WORDS` kèm hướng dẫn nối qua Căn Mốc Từ. Năm bản mẫu đều mang sẵn cặp Căn Mốc Từ → Phụ Đề **đang bật**, nối vào cổng `captions` tùy chọn của Đóng Gói Timeline; tắt hai node là video không phụ đề và các mục danh sách rải đều thay vì theo lời (quy tắc cổng tùy chọn sau node bị bỏ qua ở Bộ Máy Thực Thi mục 2). Engine HyperFrames đổ các dòng vào chỗ `data-slot="captions"` của stage trong từng cảnh (dòng cắt ngang hai cảnh được vẽ ở cả hai), bật tắt dòng và tô từ trên timeline gốc; stage không khai chỗ thì engine thêm dải mặc định trong vùng an toàn dưới.

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

Node lõi `core/audio-mix`: nhận `Voiceover`, phát `Voiceover` **dài đúng bằng bản gốc**, chỉ khác ở tệp âm thanh. Nhờ vậy `words` và `segments` đi qua nguyên vẹn và mọi mốc thời gian phía sau (cảnh dài bao nhiêu, phụ đề rơi vào đâu) không phải tính lại.

Nhạc là tệp có bản quyền của người dùng nên **không đi qua đồ thị**: người dùng bỏ tệp vào `.nodecine/music` (`NODECINE_MUSIC_DIR` ghi đè), node chỉ giữ **tên tệp**. `GET /api/library/music` liệt kê tên các bản nhạc trên máy này cho ô chọn trong thân node. Tên nhạc được kiểm theo mẫu chặt (chữ, số, khoảng trắng, `. _ ' ( ) -`, đuôi mp3/m4a/aac/wav/ogg/flac) rồi ghép vào thư mục nhạc; bất cứ tên nào có thể đi ra khỏi thư mục đều bị từ chối (mục 9.2). Đồ thị chia sẻ cho người khác mở trên máy trống thì tên nhạc vẫn còn trong ô chọn nhưng lần chạy báo lỗi rõ tên bản nhạc thiếu.

Không chọn bản nhạc nào **không phải lỗi**: giọng đọc đi qua nguyên vẹn, không gọi ffmpeg. Đó là trạng thái các bản mẫu xuất xưởng.

Tham số: `track` (rỗng = không nhạc), `volume` (0..1, mặc định 0.16), `duck` (0..1, mặc định 0.7), `fadeInSeconds` (1), `fadeOutSeconds` (2).

Trộn qua `services.mixAudio` → `nodes/audio/mix.server.ts`: bản nhạc được lặp (`aloop`) rồi cắt đúng độ dài giọng, hạ về `volume`, mờ vào và mờ ra; `sidechaincompress` lấy chính giọng làm tín hiệu điều khiển nên nhạc tự nhỏ lại mỗi khi có người nói và tự đầy lại ở khoảng lặng — đúng cách một bàn trộn phát thanh làm. `amix=duration=first:normalize=0` giữ mix kết thúc cùng giọng và không tự hạ đôi bên. `duck: 0` bỏ hẳn nhánh sidechain, nhạc chạy đều. Công thức nằm ở hàm thuần `mixFilter` để test đọc được mà không cần ffmpeg trên máy. Tệp ra đặt tên băm theo giọng và tham số nên đổi mức nhạc rồi đổi lại là dùng lại tệp cũ.

Trong bản mẫu **Tin AI**, node nằm giữa Giọng Đọc và Đóng Gói Timeline, còn Căn Mốc Từ vẫn lấy giọng **sạch** thẳng từ Giọng Đọc: bộ căn nghe nhạc sẽ căn kém hơn.

### 5.16. Xuất Phụ Đề (Caption Export)

Node lõi `core/caption-export`: nhận `CaptionTrack`, không phát gói nào (`kind: 'sink'`), ghi ra một tệp phụ đề rời để đăng kèm video. Cùng những dòng mà engine đốt vào hình, nhưng ở dạng tệp — YouTube, TikTok và mọi nơi khác đều nhận `.srt` hay `.vtt`.

Chạy **theo luồng**, không phải theo yêu cầu như Xuất MP4: chữ và mốc thời gian đã có sẵn trong tay, việc còn lại chỉ là chép ra, không tốn gì.

Tham số: `format` (`srt` mặc định, `vtt`) và `fileName` **không kèm đuôi** — đuôi do `format` quyết định, nên hai thứ không bao giờ chỏi nhau.

Hai định dạng là một ý tưởng viết hai lần: một cue là một khoảng thời gian và những chữ nói trong đó. Khác nhau ở dấu thập phân (phẩy với chấm), ở việc đánh số (SubRip có, WebVTT không) và ở dòng đầu `WEBVTT`. Hàm `toSubtitles` thuần nên test đọc được đúng thứ trình phát sẽ đọc mà không cần đĩa. Cue dài bằng không được nới thành 40 mili giây: trình phát lặng lẽ bỏ qua cue không có độ dài. Track không có dòng nào là lỗi `CAPTIONS_NO_WORDS`, không ghi ra tệp rỗng.

Tệp ghi qua `services.saveText`, đặt tên theo băm của chính nội dung nên xuất hai lần là một tệp, và tên tệp người dùng gõ chỉ đi trong thuộc tính `download` của thẻ neo. Vì vậy tên **giữ nguyên tiếng Việt**: `core/file-name.ts` chỉ bỏ những ký tự hệ tệp hay HTTP header thực sự từ chối (`< > : " / \ | ? *` và ký tự điều khiển), không ép về ASCII. Xuất MP4 dùng chung luật này.

### 2.12. Clip Trong Cảnh (B-roll)

Một cảnh chiếu được **video**, không chỉ ảnh tĩnh. `BlockField.type` có `video` và từ vựng nội dung có khóa `clip`; như `image`, đây là khóa **mô hình không bao giờ được hỏi** — chỉ người hoặc dữ kiện trỏ vào một tệp máy này đang giữ.

Phần nặng nhất **thư viện lo sẵn**: `executeRenderJob` của `@hyperframes/producer` có hẳn một chặng "extract videos" và tự nối `createVideoFrameInjector` — nó trích khung của clip bằng ffmpeg rồi thay thẻ `<video>` bằng ảnh khung lúc chụp, vì Chrome không chụp được video đang phát một cách xác định. Việc của NodeCine chỉ là **đặt đúng thẻ `<video>` vào trang**.

**Cỡ của thẻ video phải đặt bằng hộp, không bằng con số.** Lúc kết xuất, producer thay thẻ `<video>` bằng ảnh từng khung và đóng **style inline** cỡ riêng lên bản thay thế đó; inline thắng luật theo class, nên một `width: 1920px` trong CSS của block bị bỏ qua và clip ra đúng cỡ gốc của nó, nằm ở góc khung. `inset: 0` với `width/height: 100%` thì sống sót qua lần tráo. Ảnh tĩnh không bị tráo nên vẫn dùng được lối đặt cỡ cố định mà Ken Burns cần.

Đúng ở đây còn nghĩa là mang mốc thời gian của **chính cảnh đó**. Producer đọc `data-start` và `data-duration` ngay trên thẻ video; thiếu thì nó coi clip bắt đầu ở giây 0 và chạy hết độ dài tự nhiên, tức một cảnh b-roll ở phút thứ hai sẽ nhảy lên đầu phim. `timeVideos` (`core/look/markup.ts`, hàm thuần) đóng dấu mốc đó lên mọi `<video>` trong cảnh, bỏ qua thẻ nào tác giả block đã tự ghi mốc. Nó cũng thêm `muted`: tiếng của phim là giọng đọc, tiếng của clip sẽ nói đè lên.

**Clip vào máy thế nào.** Một clip quá lớn để đi qua data URL base64 như một cái logo, nên nó theo lối của nhạc và giọng: người dùng bỏ tệp vào `.nodecine/clips`, ô chọn liệt kê theo tên, và `POST /api/assets/from-library` bảo máy chủ **đọc tệp ngay tại chỗ**, băm rồi chép vào kho tài nguyên. Chỉ cái tên đi qua dây. Cảnh giữ `/api/assets/<băm>.mp4` như mọi tài nguyên khác, nên bản kết xuất chép clip đi kèm y như chép ảnh.

Chưa làm: clip **không hiện trong Ảnh Bìa** (mục 5.18). Phiên chụp một khung không chạy chặng trích khung của producer, nên một bìa lấy nền từ clip sẽ ra khung tĩnh của thẻ video hoặc nền đen. Muốn bìa có b-roll thì phải nối injector vào đường chụp.

### 5.19. Kho Tư Liệu (Stock Media)

Node lõi `core/stock-media`: nhận `SceneScript`, phát `SceneScript` **đã có tư liệu ở mọi cảnh**. Cảnh chỉ được chiếu tệp máy này đang giữ (mục 2.7), nên node không phát ra một cái link: nó tìm, chọn ứng viên đầu tiên lấp được khung, **tải về kho tài nguyên** và đặt tài nguyên đó vào nội dung cảnh. Từ đó trở đi Đạo Diễn Mỹ Thuật và Đóng Gói không phân biệt được đâu là tư liệu kho, đâu là tư liệu người dùng tự chọn.

**Clip trước, ảnh chỉ là dự phòng.** Một tấm ảnh đứng bốn giây đọc ra như khung hình bị treo, dù có trôi Ken Burns khéo tới đâu; Ken Burns là lời xin lỗi cho việc không có cảnh quay, không phải đích đến. Đây là thứ tự cutdown chốt (`downloadClip(...) ?? download(...)`), và các khung ở đây là bản port của khung đó. Tham số `media` quyết cảnh được lấp bằng gì: `auto` thử clip rồi chịu lấy ảnh khi không có clip nào hợp — và một phim khi ấy có thể **nửa clip nửa ảnh**; `clip` và `still` giữ mọi cảnh cùng một loại và **để cảnh trống còn hơn trộn**, vì vài cảnh tĩnh nằm giữa những cảnh động đọc ra như hỏng chứ không như một lựa chọn.

Clip vào `content.clip`, ảnh vào `content.image` — **hai khóa nội dung khác nhau**, nên block nào được dàn là hệ quả tự nhiên của luật phủ nội dung: `still-clip` là block duy nhất có chỗ đặt clip, `still` là block duy nhất có chỗ đặt ảnh. Không cần ghim vai vào block nào, và ghim vào một trong hai là hỏng mọi cảnh nhận cái kia.

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

### 2.13. Bìa (Cover)

Giao diện gồm **ba** thứ, không phải hai: **stage**, **block**, và **bìa**.

Block là một mảnh **đặt vào trong** stage, ở khung của video, tại một ô thời gian, với props lấy từ từ vựng nội dung của cảnh. Bìa thì đứng một mình, ở **khung của riêng nó**, **không có thời gian**, và props do người dùng gõ. Đó là ba khác biệt, và chúng đủ để bìa là một loại riêng chứ không phải một biến thể của block.

```
CoverDef = { id, name, frame, props, defaults?, code }
```

Khác `BlockDef` hai trường: `frame` và `defaults`. Và đó là lý do tồn tại của cả kiểu này — video 16:9 vẫn muốn bìa 9:16, vì bìa là thứ nằm cạnh mọi video dọc khác trong luồng, và một thumbnail 16:9 có hai vạch đen ở đó đọc ra như lỗi.

`defaults` là **giá trị bìa mang sẵn**, chọn ngay tại Đạo Diễn Mỹ Thuật: ảnh nền, chữ mặc định. Bìa là tấm ảnh người ta nhìn để quyết định có bấm vào video hay không, nên nó phải **xong ngay ở chỗ thiết kế**; node Ảnh Bìa chỉ đổi lại cho một lần xuất. Trước đây mọi prop đều để trống chờ bước xuất, nên bìa chưa ai điền vẽ ra **một hình chữ nhật đen** — đó không phải thiết kế, đó là lỗ hổng. `coverProps(cover, override)` gộp: ô trống ở bước xuất nghĩa là "giữ như đã thiết kế", không phải "xoá trắng"; muốn không có gì thì bỏ hẳn prop khỏi bìa. Bản xem trước trong node cũng vẽ qua đúng các giá trị này, nên thiết kế thấy sao thì tệp ra vậy.

Nền của bìa theo thứ tự: **đã chọn trong Đạo Diễn Mỹ Thuật** > **một khung của phim** > không có gì. Bước giữa là thứ làm bìa có nghĩa trên một bản mẫu: tư liệu đổi mỗi lần chạy, nên nền ghim cứng khiến mọi video chung một bìa, còn bắt người dùng mở ra chọn ảnh sau mỗi lần chạy chính là thao tác tay mà node này sinh ra để bỏ đi. `coverGround` (thuần) chọn: prop kiểu ảnh còn trống thì tìm trong các cảnh, đọc kiểu tài nguyên **theo khai báo của block** chứ không đoán theo tên prop — gặp ảnh thì dùng thẳng, gặp clip thì trả về clip để node lấy một khung bằng ffmpeg (`server/video-still.ts`, lấy ở giây thứ nhất vì cảnh mở từ đen và khung 0 thường tối nhất). Đây **không phải** "chụp khung video làm ảnh bìa" — nền tảng nào cũng cho tua chọn thumbnail; đây là cái **nền** để dựng bìa riêng, có tiêu đề, bố cục và khung của riêng nó.

Bìa **mượn tokens** của stage (bảng màu, font) nên nó và video trông cùng một bộ, nhưng **không mượn CSS bố cục**: code của stage đo bằng px cho khung của video, đổ sang khung dọc là đồ đạc rơi sai chỗ.

Bìa nằm trong tham số Đạo Diễn Mỹ Thuật cùng stage và blocks, đi theo `ScenePlan` và IR. **Không có gì dàn bìa** — không cảnh nào "mặc" một cái bìa; nó chỉ đi nhờ tới node Ảnh Bìa, đúng như stage cũng chỉ được mang theo.

**Vẽ bìa ở đâu:** mục *Bìa* trong thân node Đạo Diễn Mỹ Thuật, cùng chỗ với Blocks — danh sách bìa, ô chọn tỉ lệ (`FRAME_PRESETS`), bảng props, và modal sửa code với đủ cả tab Thành phần, tab Code và ô sửa bằng lời. Bìa dùng lại được toàn bộ đồ nghề đó vì nó **block-shaped** một khi đưa cho nó cái stage trần của riêng nó: `core/look/cover.ts` giữ `coverStage` và `coverAsBlock`, và **cả khung xem trước lẫn lúc kết xuất đều đi qua đúng hai hàm ấy** — hai bản khác nhau là thiết kế một đằng, tệp ra một nẻo.

`doc.example` của một bìa không phải tài liệu mà là **thứ khung xem trước vẽ khi chưa ai gõ gì**: mỗi prop tự đại diện cho mình, lấy `hint` nếu có. Để rỗng thì xem trước ra hình đen, mà vẽ bìa trên một hình chữ nhật đen là vẽ mù.

### 5.20. Phân Cảnh (Scene Breakdown)

Node lõi `core/scene-breakdown`: nhận `SceneScript`, phát `SceneScript` **đã có gì đó trên hình ở mọi cảnh**. Cùng hình dạng với Kho Tư Liệu (5.19): một chặng làm giàu kịch bản, đứng giữa chặng kịch bản và Đạo Diễn Mỹ Thuật, không nối thì mọi thứ chạy như không có nó.

**Vì sao là một node riêng.** Ngoài đời, kịch bản viết xong là hết việc của biên kịch; không ai đưa kịch bản có sẵn cho biên kịch khác viết lại. Việc còn lại là *phân cảnh*: đạo diễn hay người dựng đọc từng câu và quyết câu đó lên hình bằng gì, không sửa một chữ lời. Kịch Bản Tĩnh (5.2) thiếu đúng bước ấy — dán vào thì chỉ có lời thoại, nội dung trên hình phải gõ tay từng cảnh và đa số bỏ trống, nên Đạo Diễn Mỹ Thuật không có khóa nào để dàn. Đưa qua Biên Kịch (5.8) là sai vai: Biên Kịch đi từ đề bài ra lời và sẽ viết lại lời. Phân Cảnh đi từ lời ra hình. Khác Đạo Diễn Mỹ Thuật ở chỗ Phân Cảnh quyết *chữ gì* lên hình, Đạo Diễn Mỹ Thuật quyết chữ đó *trông ra sao*.

**Lời thoại không bao giờ đổi, theo cấu trúc chứ không theo kiểm tra.** Mô hình không được hỏi về lời thoại: prompt in lời của từng cảnh làm ngữ cảnh và nói rõ "không trả lại", lược đồ đầu ra chỉ có các khóa nội dung, và node chép `narration`, `role`, `weight`, `factBindings` từ đầu vào sang. Không có `checkVerbatim` vì không có đường nào để lời đi qua mô hình theo chiều ra. Cutdown kiểm sau; ở đây đóng cửa trước.

**Cùng từ vựng với Biên Kịch, không chép.** `CONTENT_GUIDE` (một dòng cho mỗi khóa: title tối đa 60 ký tự, points hai đến bốn dòng, chữ trên hình không lặp lời nguyên câu) nhập thẳng từ `nodes/screenwriter/prompt.ts`, và lược đồ đầu ra là `SceneContentSchema` bỏ hai khóa tệp — cùng cách Biên Kịch dựng `SpokenSceneSchema`. Hai node không thể trôi khỏi nhau về nghĩa của một `title`. Vòng gọi mô hình cũng dùng chung `runScreenwriter`: một lần thử lại cho sai cấu trúc, một lần cho sai ngôn ngữ; ngôn ngữ lấy từ `SceneScript.language`, không hỏi người dùng.

**Đúng số cảnh, đúng thứ tự.** Đầu ra là tuple dài bằng số cảnh, không phải mảng: thiếu một mục là mọi cảnh sau nhận nhầm chữ của cảnh trước, và lược đồ bắt ngay chứ không để mắt thấy.

**Chỉ điền cảnh trống.** Cảnh đã có bất kỳ khóa viết nào (`hasWritten`: một trong `WRITTEN_KEYS` mang giá trị; tệp không tính, tệp không phải chữ) thì giữ nguyên — người dùng gõ tay thắng mô hình, như Kho Tư Liệu giữ ảnh người dùng đã chọn. Cảnh giữ vẫn được in vào prompt để mô hình thấy mạch, đánh dấu *keep* và mô hình trả `{}`. `overwrite` bật thì viết lại tất cả. Dù thế nào, `image` và `clip` của cảnh đi qua nguyên vẹn (mô hình không được viết chúng, 2.11), và khóa đã ràng buộc dữ kiện bị bỏ khỏi câu trả lời để dữ kiện điền sau. Giá trị rỗng (`"title": ""`, `points: []`) coi như không viết.

Tham số: `overwrite` (mặc định tắt) và `density` — `auto` để lời thoại quyết (một ý thì title, liệt kê thì points, so sánh thì entries, con số thì number + label), `sparse` mỗi cảnh một title và tối đa một khóa nữa, `rich` lấy hết những gì lời thoại liệt kê, so sánh hay đếm. Cổng `llm` **bắt buộc**: node này không có việc nào không cần mô hình; tùy chọn nằm ở đồ thị, không nối thì thôi.

Thân node: form tham số, số cảnh đã có gì trên hình sau khi chạy, và một dòng mỗi cảnh (title, hoặc quote, số, ý đầu) để đọc kết quả mà không mở Đạo Diễn Mỹ Thuật.

### 5.17. Nhập Âm Thanh (Audio Input)

Node lõi `core/audio-input`: không có cổng vào, phát `Voiceover` từ **một bản thu người dùng đã có**. Đây là lối vào thứ hai của luồng: trước đó chỉ node Giọng Đọc tạo ra được `Voiceover`, nên ai đã thu sẵn giọng của chính mình thì không có đường nào vào cả.

Đầu ra đúng bằng payload node Giọng Đọc phát, nên Căn Mốc Từ, Nhạc Nền, Phụ Đề và Đóng Gói nhận mà không cần biết khác biệt. Chỉ thiếu `segments`: một tệp là một lần thu liền mạch, không chia đoạn theo cảnh, nên Đóng Gói quay về chia khung theo **trọng số** (mục 5.4). Muốn có mốc từng từ thì nối qua Căn Mốc Từ với lời thoại từ Kịch Bản Tĩnh hay Biên Kịch — bộ căn không cần biết tiếng đó do máy đọc hay do người đọc.

Tham số: `file` (tên tệp trong thư mục giọng) và `language` (mọi ngôn ngữ đầu ra trừ `auto` — không có gì ở đây nghe tệp để đoán).

**Thư viện âm thanh của máy** dùng chung cho cả nhạc nền và bản thu: `.nodecine/music` và `.nodecine/voice` (`NODECINE_MUSIC_DIR`, `NODECINE_VOICE_DIR` ghi đè), `GET /api/library/<music|voice|clips>` liệt kê tên tệp và đường dẫn thư mục; `clips` giữ video của người dùng (mục 2.12). Cùng một luật tên tệp và cùng một cách chặn đường dẫn thoát ra khỏi thư mục (mục 9.2). Lý do giống nhau: bản nhạc có bản quyền hay giọng của chính mình thì ở nguyên chỗ người ta để, chỉ **tên tệp** đi trong đồ thị mà họ có thể chia sẻ.

Lúc chạy, tệp được ffmpeg chuyển sang MP3 vào thư mục media dưới tên **băm từ chính byte của tệp**, nên trình phát, bộ kết xuất và bộ căn đều gặp đúng một định dạng chúng chắc chắn đọc được, và nhập lại cùng một bản thu thì không tốn gì. Băm đọc theo luồng để một bản thu hai tiếng không phải nằm trọn trong bộ nhớ. Chuyển xong mới đổi tên vào chỗ, để lần chạy bị ngắt không bỏ lại một tệp dở mà cái tên nói là đã xong.

### 5.18. Ảnh Bìa (Cover Image)

Node lõi `core/cover-export`: nhận `VideoIR` và `EngineRef` (cần `render`), không phát gói nào, vẽ **một `CoverDef`** (mục 2.13) của giao diện ra PNG.

**Không phải một khung của video.** Nền tảng nào cũng đã cho tua video chọn thumbnail rồi; thứ chúng không làm được là một tấm ảnh **dựng riêng để làm bìa** — khung riêng, chữ riêng, bố cục riêng. Nên node này chọn một bìa và điền props của bìa đó, chứ không có tham số thời gian nào.

Cách vẽ: dựng một **video một khung, một cảnh**, ở khung của bìa, với bìa đóng vai block và một stage trần chỉ mang bảng màu cùng font của stage thật — rồi để đúng bộ chụp của engine lấy khung duy nhất đó. Nhờ vậy không có đường kết xuất thứ hai nào phải nuôi, và bìa vẫn trông cùng bộ với phim mà không thừa hưởng một bố cục đo cho khung khác.

Tham số: `cover` (id, rỗng thì lấy cái đầu tiên), `props` (theo bảng props của chính bìa đó), `fileName`, `resolution`. Bỏ qua mặc định như Xuất MP4.

Chưa làm: **clip không hiện trong bìa** — phiên chụp một khung không chạy chặng trích khung video của producer. Và cỡ chữ tiêu đề chưa tự co theo độ dài như `titleSize` của cutdown, nên tiêu đề rất dài sẽ tràn lên ảnh.

## 6. Adapter và Node Động Cơ

### 6.1. Giao diện Adapter

Bốn năng lực, là toàn bộ bề mặt phần còn lại của ứng dụng được biết:

- Khai báo `engineId` và tên hiển thị.
- `probe()`: trả về `capabilities` gồm `preview` và `render`, mỗi trường `ready` hoặc `unavailable` kèm `reason`.
- `mountPlayer(element, ir)`: Gắn trình phát vào một phần tử hiển thị.
- `render(ir, exportSettings, onProgress, signal)`: Kết xuất MP4, có tiến độ và hủy.
- `capture(ir, {atSeconds, resolution}, signal)` — **tùy chọn**: một khung hình thành PNG (mục 5.18). Engine không làm được thì đơn giản là không khai, và node Ảnh Bìa báo `ENGINE_SCENE_UNSUPPORTED`, thay vì hợp đồng mọc thêm một năng lực không ai báo cáo.

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

Không có tầng "nội dung kèm app" nữa. Mọi node là node lõi (mục 5), giao diện là dữ liệu trong node Đạo Diễn Mỹ Thuật (stage và blocks). Hai thứ cùng hình dạng nhưng khác vai, như trong ComfyUI: **bản mẫu** là đồ thị dựng sẵn ship kèm app, mở ra là một bản nháp mới; **workflow** là tệp của người dùng, lưu, đổi tên, nhập, xóa ở thanh tab và panel Workflow. Cùng lược đồ `TemplateDefinition`, nên một workflow tải xuống và một bản mẫu chia sẻ là cùng một loại tệp.

### 10.1. Bản mẫu (template) là dữ liệu

Một bản mẫu là **một đồ thị đã lưu**: `{ id, name, description?, category, graph }`, trong đó `graph` có đúng hình dạng `lib/storage.ts` ghi khi người dùng lưu dự án. Nó gọi tên node bằng chuỗi và không import gì; giao diện của nó nằm trong tham số của các node Đạo Diễn Mỹ Thuật bên trong đồ thị. Registry ở `core/templates/registry.ts` kiểm định hình dạng lúc đăng ký và trả ra bản sao khi mở.

Registry chỉ chứa **bản mẫu ship kèm** (tệp JSON dưới `templates/`). Workflow của người dùng là một thứ khác và không vào registry: chúng là **tệp trên máy chủ** trong `.nodecine/workflows/<id>.json` (đổi bằng `NODECINE_WORKFLOWS_DIR`), theo mô hình `userdata/workflows` của ComfyUI: một tệp một workflow, cùng hình dạng bản mẫu cộng `schemaVersion` và `updatedAt`, ghi nguyên tử, đọc lại thì tự nâng phiên bản. API: `GET/POST /api/workflows`, `GET/PUT/DELETE /api/workflows/<id>`, `POST /api/workflows/from-video`. `id` là tên tệp và bị lược đồ kiểm định; đường dẫn chỉ được dựng ở `server/workflows.ts`. Id `current` được giữ riêng và không liệt kê.

Một MP4 do NodeCine kết xuất **mang theo workflow** đã tạo ra nó (thẻ `nodecine_workflow` trong metadata định dạng, ghi bằng ffmpeg stream copy, gồm tên, đồ thị và IR), như PNG của ComfyUI mang theo workflow: kéo video vào canvas là dựng lại đồ thị. Thiếu ffmpeg thì video vẫn ra, chỉ không có thẻ.

### 10.2. Bài kiểm tra duy nhất

**Mọi bản mẫu ship kèm phải dựng lại được từ canvas trống** bằng cách kéo node từ Thư viện và gõ tham số. `templates/__tests__` kiểm đúng điều đó: mọi node type có trong Thư viện, mọi tham số qua được lược đồ của chính node, mọi đạo diễn có Stage và chỉ nêu block đã nối, mọi ràng buộc dữ kiện trỏ vào prop có thật của block. Bản mẫu cần thứ gì người dùng không với tới thì không phải bản mẫu — đó là code trá hình.

Không thứ gì bên ngoài lõi được thêm kiểu cổng hay sửa lược đồ IR.
