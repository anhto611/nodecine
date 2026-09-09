# Tình Trạng Triển Khai

**Cập nhật 2026-09-09.**

Đây là tài liệu **duy nhất** nói cái gì đã dựng xong. Năm tài liệu còn lại nói *luật*: hợp đồng phải giữ, ranh giới không được vượt, hành vi bắt buộc — những thứ đúng bất kể hôm nay code tới đâu. Khi một tài liệu khác có vẻ khẳng định điều gì về tiến độ và mâu thuẫn với đây, tin tệp này.

Lý do tách: trước đây mỗi lần thêm một provider là phải sửa câu "ở v0.1 giọng đọc đi qua bộ tổng hợp của hệ điều hành" ở bốn chỗ, và thực tế là không sửa hết. Giờ chỉ có một chỗ để sai.

---

## Chạy được ngay

**Bản mẫu** — năm mục mở được trong Trình duyệt Bản mẫu:

| Bản mẫu | Node | Cần mạng | Cần mô hình ngôn ngữ |
|---|---|---|---|
| Kịch Bản Tĩnh | 10 | Không | Không |
| GitHub Repo Showcase | 13 | Có | Có |
| Thẻ Trích Dẫn Truyền Cảm Hứng | 11 | Không | Có |
| Bản Tin AI Đếm Ngược | 14 | Có | Có |
| Ảnh Tĩnh Ngang | 14 | Có | Có |
| Canvas trống | 0 | — | — |

Cả năm là **tệp JSON** dưới `templates/`, cùng hình dạng tệp dự án; `templates/__tests__` xác nhận mỗi bản dựng lại được từ canvas trống bằng node trong Thư viện. Workflow của người dùng tách khỏi bản mẫu: **lưu** (Ctrl+S), **đổi tên**, **nhập** từ JSON hoặc từ MP4 do NodeCine kết xuất (kéo thả vào canvas cũng được), **tải xuống** — tất cả ở thanh tab và panel Workflow, là tệp trong `.nodecine/workflows/` theo mô hình userdata của ComfyUI (`server/workflows.ts`, `app/api/workflows`). Trình duyệt bản mẫu chỉ hiện bản mẫu kèm app. Thanh tab dưới header giữ các workflow đang mở (dấu • khi chưa lưu, Ctrl+S lưu, Ctrl+Shift+S lưu thành, + mở bản nháp mới); panel *Workflow* ở dải trái (phím W) liệt kê tab đang mở và tệp đã lưu với mở/đổi tên/tải/xóa. Các tab tự lưu vào `localStorage` (`nodecine.tabs`). MP4 kết xuất mang theo workflow và IR trong metadata (`server/video-meta.ts`).

**Lời thuộc về cảnh** (2026-09-06, học từ cutdown): biên kịch và kịch bản tĩnh viết `narration` theo cảnh, `AudioScript.segments`; Giọng Đọc đọc từng đoạn rồi nối bằng ffmpeg với 0,35 s lặng (`services.concatAudio`), `Voiceover.segments`; Đóng Gói cắt cảnh theo đoạn, trọng số chỉ còn cho voice-over không chia đoạn. Hết lệch tiếng với hình. **Dàn cảnh bằng mô hình**: Đạo Diễn Mỹ Thuật có cổng `llm` tùy chọn, mô hình chọn trong các block quy tắc đã lọc (user ghim vẫn thắng), câu trả lời cache trên đĩa theo prompt nên sửa giao diện vẫn không tốn. **Viết block mới**: cảnh không block nào hợp thì mô hình viết block, node dùng ngay và tự ghi vào tham số (`RunContext.patchParams`, sự kiện `params`).

**Tư liệu kho** (2026-09-07): node `core/stock-media` tìm tư liệu cho từng cảnh từ Pexels hoặc Pixabay — tham số `media` chọn `chỉ clip`, `chỉ ảnh` hay `clip không có thì ảnh` (thứ tự cutdown chốt), và hai nhánh đầu để cảnh trống còn hơn trộn hai loại trong một phim; vì một tấm ảnh đứng bốn giây đọc ra như khung hình treo. Clip vào `content.clip`, ảnh vào `content.image`, nên luật phủ nội dung tự chọn block, không ghim vai. Bản dựng lấy nhỏ nhất đủ cạnh dài, và lấy clip hợp lệ **đầu tiên** chứ không phải dài nhất — đo được: sắp theo dài nhất tải 32 MB cho một cảnh, đầu tiên là 8,6 MB. Tìm ảnh, lọc theo cạnh dài ≥1200 và tỉ lệ ≤0,9, tải về kho tài nguyên rồi đặt vào `content.image`. Chín **phong cách** chọn vùng ảnh (Phong cảnh, Đường phố, Thiên nhiên, Kiến trúc, Nội thất, Chi tiết đời thường, Phòng tối cinematic, Tự động, Ngẫu nhiên) — port cả bài học của cutdown: không kèm chuỗi từ khoá mẫu, vì mô hình đọc nó thành storyboard và bốn video liên tiếp mở bằng cùng một cảnh núi. Cổng `llm` tùy chọn viết cụm tìm kiếm tiếng Anh từ lời thoại — kho tìm bằng tiếng Anh, lời thoại thì không. Khóa đọc từ biến môi trường, không bao giờ từ đồ thị. **Đã gọi API thật**: ảnh về đúng 2472×1920 nhờ `original?h=1920` thay vì biến thể dựng sẵn 867×1300. Ba hàm tải file từ internet (dựng lại địa chỉ, theo chuyển hướng từng bước, cắt kích thước) gộp vào `server/fetch-media.ts` dùng chung với Truy Xuất Trang.

**Phân Cảnh** (2026-09-09): node `core/scene-breakdown`, `SceneScript` → `SceneScript`, cùng hình dạng Kho Tư Liệu. Lý do: kịch bản có sẵn ngoài đời không đi qua biên kịch lần nữa, chỉ thiếu bước phân cảnh — ai đó đọc từng câu và quyết câu đó lên hình bằng gì. Kịch Bản Tĩnh dán vào chỉ có lời, nội dung trên hình bỏ trống nên Đạo Diễn Mỹ Thuật không có khóa để dàn; đưa qua Biên Kịch thì bị viết lại lời. Node này viết title, points, number... theo đúng `CONTENT_GUIDE` và lược đồ của Biên Kịch (nhập thẳng, không chép), qua cùng vòng `runScreenwriter`. **Lời thoại không đổi theo cấu trúc**: mô hình không được hỏi và không trả lời thoại, node chép từ đầu vào; đầu ra là tuple đúng số cảnh. Chỉ điền cảnh chưa có chữ (`overwrite` để viết lại), giữ `image`/`clip` và khóa đã ràng buộc dữ kiện, giá trị rỗng coi như không viết. Tham số `density` thưa/dày/theo lời. Nằm nhóm Kịch bản trong Thư viện. 12 test (prompt + chạy qua Executor với mô hình giả), chưa gọi mô hình thật. Cùng ngày: Kho Tư Liệu chuyển từ nhóm Kịch bản sang nhóm Giao diện, vì nó không viết chữ nào, chỉ chọn tư liệu. Chi tiết `CORE_CONTRACTS.md` §5.20.

**Bản mẫu Ảnh Tĩnh Ngang** (2026-09-07, dựng theo khung `still-wide` của cutdown): 16:9, mỗi cảnh một tấm ảnh kín khung bo góc 112px có Ken Burns, phụ đề **một dòng** ở đáy (44px, lề 160, `maxChars` 52), viền đen quanh chữ để đọc được trên ảnh bất kỳ. Phụ đề đốt vào hình, không mang node Xuất Phụ Đề. Font **Comfortaa** đóng gói kèm (ba subset, biến thiên 300–700) — cùng face cutdown dùng, đã kiểm subset tiếng Việt trước khi chọn. Không cần mô hình, không cần mạng — Kịch Bản Tĩnh vì ảnh là khóa mô hình không được điền. Có thêm block `still-clip` dùng clip thay ảnh. Đã kết xuất thật và soi khung hình: khung, bo góc, dấu tiếng Việt và dải phụ đề đều đúng. Chi tiết ở `docs/templates/still-wide.md`.

**Clip trong cảnh** (2026-09-07): `BlockField.type` có `video`, từ vựng nội dung có khóa `clip`, Kịch Bản Tĩnh có ô chọn clip cho từng cảnh. Phần nặng do `@hyperframes/producer` lo sẵn — nó có chặng trích khung video và tự nối injector; việc của ta là `timeVideos` đóng mốc của cảnh lên mọi thẻ `<video>`, nếu không clip nhảy lên đầu phim. Clip vào máy qua `.nodecine/clips` + `POST /api/assets/from-library` (chỉ tên đi qua dây, máy chủ đọc tệp tại chỗ). **Đã kết xuất thật và soi khung hình**: dải màu của clip nằm trong MP4, chữ đè lên trên.

**Dán kịch bản, cắt thành cảnh** (2026-09-07): mục gập lại trên đầu Kịch Bản Tĩnh nhận cả kịch bản rồi cắt — dán một khối văn xuôi thay vì gõ từng cảnh một. Ba luật do người chọn (dòng trống, mỗi dòng, mỗi câu) vì luật câu cắt nhầm ở chữ viết tắt. `nodes/script/split.ts` là hàm thuần: không gọi mô hình, không sửa một chữ nào, chỉ gộp khoảng trắng; số cảnh hiện trên nút để đọc trước khi bấm, và Ctrl+Z hoàn lại danh sách cũ. **Đã thử trên trình duyệt**: dán ba đoạn, nút báo 3, danh sách thay đúng, dấu tiếng Việt nguyên vẹn, undo trả lại sáu cảnh cũ. Chưa có: bản cắt bằng mô hình như cutdown (mô hình chia, rồi `checkVerbatim` bắt buộc các cảnh ghép lại đúng từng chữ với bản gốc) — đáng làm khi cần chia theo ý chứ không theo dấu câu.

**Xem trước không đứng hình nữa** (2026-09-08): `/api/assets/[name]` nay trả `206` cho `Range`, có `Accept-Ranges`, `416` cho khoảng vượt file. Trước đó mọi yêu cầu đều được trả `200` kèm nguyên tệp, nên `<video>` phải tải hết mới phát được: một bản xem trước bảy clip 1080p mở bảy lượt tải cùng lúc, chạm trần sáu kết nối của trình duyệt và **đứng lại** — cảnh 1 lặp đi lặp lại, không giọng đọc, phụ đề không chạy, một lúc sau tự bình thường. **Đã đo trên trình duyệt**: trước khi sửa đồng hồ trình phát đứng ở 0,4 giây (đúng chỗ tua ban đầu) suốt hơn 25 giây với ba yêu cầu clip còn treo; sau khi sửa nó chạy đúng thời gian thật ngay từ giây đầu. Đọc header tách ra `server/byte-range.ts` (hàm thuần, 4 test) vì đây là loại lỗi không báo lỗi: sai một dấu là trình duyệt lặng lẽ tải cả tệp.

**Chạy hàng loạt** (2026-09-07, theo mô hình ComfyUI): node Nhập Liệu có ô *mỗi dòng một lần chạy*; bật lên thì dán 5 link là 5 video, nút Chạy Luồng hiện luôn số lần và đếm 2/5 lúc chạy. Tuần tự, một lần hỏng không bỏ dở mẻ, Dừng dừng cả mẻ. `core/engine/batch.ts` là hàm thuần nên đọc được kế hoạch trước khi nộp gì. Mô hình n8n (mọi node chạy một lần cho mỗi mục) bị loại vì `facts.items` đã mang nghĩa *một mục một cảnh*. Chi tiết ở `EXECUTION_ENGINE.md` mục 9.

**Bản mẫu So Sánh Hai Bên** (2026-09-09, dựng theo một video tham chiếu dạng giảng bài): dọc 9:16, stage trắng ba dải — hai thẻ so sánh ở trên, phụ đề karaoke chạy ở giữa, nhân vật đứng dưới; hai block `hero-question` (câu hỏi mở/chốt) và `compare-cards` (hai thẻ, dùng `entries`). Thẻ **đổi theo từng cảnh**, đó là thứ mà trước hôm nay không làm được. Dàn cảnh tự chọn đúng: cảnh chỉ có tiêu đề ra hero, cảnh có hai mục ra compare, không cần bảng dàn cảnh. Không cần mạng, không cần khoá — chạy được bằng giọng hệ thống. Ban đầu ship **không kèm ảnh** vì bản mẫu không mang được tệp; **2026-09-09 chiều**: mang được rồi — `AssetUrlSchema` nhận thêm SVG nhúng (`data:image/svg+xml;base64`, ≤ 64 KB), nên hai tranh *Website* / *Web App* nằm ngay trong `entries` của ba cảnh so sánh, và **nhân vật là của stage**: một hình vẽ SVG inline ở dải dưới, có hai cánh tay (`arm-point`, `arm-think`) mà stage chọn bằng `:has()` theo lớp của block đang lên (`hero` → suy nghĩ có bong bóng "?", `compare` → chỉ gậy), cảnh so sánh lẻ lật gương qua `nodecine.index`; cảnh nào mang ảnh nhân vật riêng thì hình vẽ ẩn. Bên phải có màu riêng `accent2`. Tranh là vector phẳng tự vẽ (nguồn ở `templates/assets/compare-explainer/`, test giữ JSON và nguồn khớp byte), không phải tranh vẽ tay như video tham chiếu — thay bằng cách tải ảnh khác vào ô của mỗi mục hoặc sửa SVG trong stage. **Kịch Bản Tĩnh không còn trong danh mục bản mẫu** — đồ thị đó nay là đồ thị mở máy (`lib/first-run.json`).

**Mô hình được quyền chê** (2026-09-09): dàn cảnh bằng mô hình nay nhận thêm câu trả lời `none` — "không có block nào *hợp* beat này", khác với "không có gì hiện được" mà quy tắc vốn đã bắt. Cảnh đó được vẽ một block riêng và dùng luôn, tối đa ba block một lần chạy để danh mục không phình mỗi video. Cảnh người dùng ghim thì `none` vô hiệu. Khi vẽ được block thì node hỏi cả lúc mỗi cảnh chỉ có một ứng viên, vì "cái duy nhất hợp lại là cái sai" cũng là một quyết định. Bản mẫu Ảnh Tĩnh Ngang trước nay có Mô Hình Ngôn Ngữ nhưng **chưa nối vào node mỹ thuật** — toàn bộ khả năng tự vẽ nằm im, đó là lý do nó chưa bao giờ tự sửa cảnh hỏng; nay đã nối. 5 test cho luồng `none`.

**Nhiều thứ trong một cảnh** (2026-09-09): từ vựng nội dung thêm `entries` — một danh sách các mục, mỗi mục dùng lại chính từ vựng đó, sâu một cấp. Hai mục là một cảnh so sánh, năm mục là bảng xếp hạng, ba mục là các bước. Trần cũ là *một ảnh, một tiêu đề mỗi cảnh*, nên khung so sánh có vẽ ra cũng không có gì đổ vào — kể cả khi do AI vẽ, vì block AI viết cũng khai props theo cùng từ vựng đó. Block khai `min`/`max` và `of` (đọc khóa nào của mục); bộ đổ dữ liệu nhân bản phần tử con đầu tiên làm khuôn cho từng mục và ràng buộc `data-prop` bên trong khuôn theo mục chứ không theo cảnh. Mô hình được viết `entries` cho phần chữ, nhưng **không** được điền `image`/`clip` trong mục — luật cũ, một cấp sâu hơn. **Đã kết xuất thật bằng producer**: một khung 1080×1920 hai thẻ cạnh nhau, mỗi thẻ đúng nhãn và câu của riêng nó, dấu tiếng Việt nguyên vẹn. 7 test cho luật.

**Bìa tự có nền** (2026-09-08): `CoverDef.defaults` — nền và chữ chọn **một lần** ngay tại Đạo Diễn Mỹ Thuật, node Ảnh Bìa chỉ đổi lại cho một lần xuất (ô trống = giữ như đã thiết kế). Chưa chọn gì thì lấy nền từ **chính phim đó**: ảnh của cảnh đầu, hoặc một khung của clip cảnh đầu trích bằng ffmpeg (`server/video-still.ts`, đặt tên theo clip + giây nên hai lần hỏi là một tệp). Nhờ vậy mỗi video có bìa của riêng nó mà không ai phải mở picker sau mỗi lần chạy. **Đã chạy thật**: trích từ clip 1080p của người dùng ra JPG 1920×1080, 89 KB, soi bằng mắt — đúng khung núi lúc hoàng hôn. Bìa của bản mẫu Ảnh Tĩnh Ngang cũng có nền gradient riêng nên chưa chọn gì vẫn là một thiết kế, không phải hình chữ nhật đen. 8 test cho `coverProps`/`coverGround`.

**Bìa là cấp thứ ba của giao diện** (2026-09-07): `CoverDef` ngang hàng với stage và block — khác `BlockDef` đúng một trường `frame`, và đó là lý do nó tồn tại: video 16:9 vẫn cần bìa 9:16. Nằm trong tham số Đạo Diễn Mỹ Thuật, đi theo `ScenePlan` và IR, không có gì dàn nó. Node `core/cover-export` **không còn chụp khung video** — nền tảng nào cũng cho tua chọn thumbnail rồi — mà dựng một video một khung một cảnh ở khung của bìa, bìa đóng vai block trên một stage trần mang tokens của stage thật, rồi để bộ chụp của engine lấy khung đó. Adapter có `capture` **tùy chọn**; Remotion không khai nên node tự chặn. **Đã kết xuất thật và soi**: bìa dọc 1080×1920 từ phim 16:9, ảnh kín khung, một tiêu đề Comfortaa 58px canh giữa với viền đen như thumbnail của cutdown, đủ dấu tiếng Việt. Chưa có: clip trong bìa, và cỡ chữ tự co theo độ dài tiêu đề.

**Nhập âm thanh** (2026-09-07): node `core/audio-input` đưa bản thu có sẵn vào làm giọng đọc — lối vào thứ hai của luồng, trước đó chỉ Giọng Đọc tạo được `Voiceover`. Tệp nằm ở `.nodecine/voice`, chuyển sang MP3 theo băm nội dung lúc chạy. Không có `segments` nên Đóng Gói chia cảnh theo trọng số; nối qua Căn Mốc Từ vẫn có mốc từng từ. Thư viện âm thanh của máy giờ dùng chung cho nhạc và giọng: `GET /api/audio/<music|voice>`, một luật tên tệp, một cách chặn đường dẫn.

**Xuất phụ đề** (2026-09-07): node `core/caption-export` biến `CaptionTrack` thành tệp `.srt` hay `.vtt` để đăng kèm video — chạy theo luồng vì chữ và mốc đã có sẵn. Nhân đó sửa một lỗi cũ: tên tệp người dùng gõ bị `[^\w.-]` băm nát, `phụ đề của tôi` ra `ph-c-a-t-i`; giờ `core/file-name.ts` chỉ bỏ ký tự hệ tệp thật sự từ chối, và **Xuất MP4 vốn cũng dính lỗi này** nay dùng chung luật đó.

**Nhạc nền có hạ nhạc khi nói** (2026-09-07): node `core/audio-mix` đặt một bản nhạc dưới giọng đọc, lặp đúng độ dài giọng, mờ vào mờ ra, và `sidechaincompress` tự hạ nhạc mỗi khi có người nói. Nhạc là tệp có bản quyền nên không đi qua đồ thị: người dùng bỏ vào `.nodecine/music`, node chỉ giữ tên tệp, `GET /api/music` liệt kê cho ô chọn. Không chọn nhạc thì giọng đi qua nguyên vẹn. Bản mẫu Tin AI có sẵn node ở giữa Giọng Đọc và Đóng Gói, còn Căn Mốc Từ vẫn nghe giọng sạch.

**Chuyển cảnh, nền trôi, số đếm, cụm nhấn** (2026-09-07): `StageDef.transition` (cut/fade/slide/zoom, mặc định fade 0,4 s) do engine chồng cảnh và tween trên timeline gốc; ba stage mẫu phóng nền chậm suốt cảnh qua `nodecine.duration`; `nodecine.count` đếm số (stat, metric-ring, hook); `*cụm*` trong prop chữ thành `.nc-emph` màu accent, Biên Kịch được nhắc bọc một cụm trong title. **Mục danh sách hiện theo giọng đọc** (2026-09-07, học từ cutdown `shared/reveal.ts`): `core/look/reveal.ts` tính mốc lộ từng mục từ mốc từ (hay rải đều), engine và preview đưa vào script qua `nodecine.stagger/at/duration`; sáu block danh sách của template GitHub đã đổi. Preview có chuyển động thật (sửa CSP thiếu `unsafe-eval`).

**Giá trị của cả video** (2026-09-07): `StageDef.vars` (tên → chữ) vẽ bằng `data-var`, giống nhau ở mọi cảnh; `date` và `time` tự có theo đồng hồ lúc chạy nếu stage không đặt; mục "giá trị của video" trong node, vai `stamp` trong danh mục, `core/look/vars.ts` dùng chung cho Đóng Gói và mọi khung xem trước.

**Dữ kiện dạng danh sách** (2026-09-07): `facts.items` là danh sách các mục, beat khai `factList` chạy mỗi mục một cảnh, ràng buộc giải thành đường dẫn `items.<i>.<trường>` cho Đóng Gói đọc; prompt đưa dữ liệu mục kèm dòng cảnh. Bản mẫu Bản Tin AI nay dán năm đường dẫn, Truy Xuất Trang đọc cả năm và mỗi tin là một cảnh với tít, mô tả, tên miền và ảnh của chính trang đó.

**Truy Xuất Trang** (2026-09-07): node `core/web-fetcher` biến một link thành dữ kiện (`title`, `body`, `source`, `url`, `siteName`, `publishedAt`, `image`), tải ảnh `og:image` về làm tài nguyên, tùy chọn chụp ảnh trang bằng puppeteer; địa chỉ được dựng lại và chặn host nội bộ. Ràng buộc dữ kiện giờ nhận cả khóa `image`. Đã thử thật trên the-decoder.com và news.ycombinator.com.

**Ảnh theo cảnh** (2026-09-07): prop kiểu `image` + khóa nội dung `image`, bind vào `src` của `<img data-prop>`, engine chép ảnh trong props cảnh vào bản kết xuất, Kịch Bản Tĩnh có ô chọn ảnh cho từng cảnh, Biên Kịch không bao giờ được hỏi khóa này.

**Năm bản mẫu**: GitHub Showcase, Thẻ Trích Dẫn, **Ảnh Tĩnh Ngang**, **So Sánh Hai Bên**, và **Bản Tin AI Đếm Ngược** (`templates/ai-news.json`, dựng theo một video tham chiếu: stage tin tức tối, ba block hook/item/outro, đếm ngược #5→#1, tone theo loại tin, phụ đề karaoke).

**Node lõi** — hai mươi hai loại: Nhập Liệu, Truy Xuất Repo, **Truy Xuất Trang**, Kịch Bản Tĩnh, **Biên Kịch** (viết nội dung cảnh, không biết block), **Phân Cảnh** (kịch bản có sẵn → nội dung trên hình, lời không đổi), **Kho Tư Liệu**, **Đạo Diễn Mỹ Thuật** (chặng giao diện sau kịch bản: dàn block, tone, stage), Mô Hình Ngôn Ngữ, Giọng Đọc Nguồn, Giọng Đọc, **Nhập Âm Thanh**, **Căn Mốc Từ**, **Phụ Đề**, **Xuất Phụ Đề**, **Nhạc Nền**, Đóng Gói Timeline, Remotion Engine, Hyperframes Engine, Xuất Bản Video, Xuất MP4, **Ảnh Bìa**.

**Tỉ lệ là của Đạo Diễn Mỹ Thuật, độ phân giải là của Xuất MP4** (`StageDef.frame` là hệ tọa độ thiết kế theo preset 9:16, 16:9, 1:1, 4:5; `resolution` 1080p/1440p/2160p ở node Xuất MP4 phóng khung bằng `transform: scale` lúc kết xuất): Đóng Gói Timeline lấy kích thước video từ `plan.stage.frame`, không nhận tham số `width`/`height`; xem trước, vùng an toàn, kéo thả, prompt sửa bằng lời và trình phát đều đọc cùng trường (`core/look/frame.ts`). Code của ba stage mẫu vẫn đặt vị trí cho khung dọc.

**Stage không cần code**: sửa bằng lời trả về cả palette, font, tone, trường (không chỉ code) kèm dòng "đổi thêm"; kéo thả trên khung xem trước ghi vào CSS của phần tử và giữ cách neo; thêm chữ, khối, ảnh (tải lên `/api/assets`, lưu theo mã băm ở `.nodecine/assets`, engine chép kèm khi kết xuất); xóa phần tử bằng phím Delete; xem trước có chuyển động lặp. Vùng an toàn bật tắt được. Chi tiết ở `CORE_CONTRACTS.md` §2.6.

**Sửa code bằng lời** (`nodes/art-director/edit.server.ts`, `POST /api/look/edit`): trong modal sửa code của Stage và Block có ô mô tả thay đổi; mô hình ngôn ngữ đang nối trong workflow (hay Claude Code mặc định) nhận luật viết stage/block, tokens, trường, props và code hiện tại, trả về code mới thành bản nháp trong editor kèm tóm tắt; một bộ lint báo lỗi luật (`.from(`, thiếu slot, `!important`, prop không có `data-prop`). Đã chạy thật qua Claude Code: 23 s, đúng luật. Editor là CodeMirror 6. Kéo thả bố cục stage để sau.

**Phụ đề karaoke** (`CORE_CONTRACTS.md` §2.10, §5.12, §5.13): Căn Mốc Từ căn chỉnh cưỡng bức bằng `stable-ts` (venv cục bộ, `npm run setup:align`, model `small` tải ~460 MB lần đầu; đã chạy thật trên giọng Vbee tiếng Việt: 9 từ, 3,2 s), Phụ Đề gom từ thành dòng theo luật của cutdown (chỉ giữ `maxChars`), Đóng Gói Timeline ghi vào IR, Stage quyết định chỗ và dáng qua `data-slot="captions"` (+ `data-caption-style`, `--caption-on`), HyperFrames đổ dòng vào chỗ đó và tô từ đang đọc. Đã render thật và soi khung hình. Năm bản mẫu đều mang sẵn hai node ở trạng thái bật sẵn. Chưa có: mốc từ trả sẵn từ ElevenLabs (`/with-timestamps`), Remotion.

**Đạo Diễn Mỹ Thuật** (`CORE_CONTRACTS.md` §2.6–2.8, §2.11, §4, §5.9–5.10) — node `core/art-director`, nhận `SceneScript` từ Biên Kịch hay Kịch Bản Tĩnh, dàn cảnh bằng quy tắc (`nodes/art-director/cast.ts`) và phát `ScenePlan`; mang giao diện dưới dạng dữ liệu, gồm cả danh mục block: Stage là sân khấu chung của mọi cảnh, Blocks là **danh mục** kiểu cảnh (một node, nhiều block; thân node là danh sách mở từng block), mỗi block có bảng `props`, tài liệu cho mô hình và code `html-gsap`. Đã xong: **giao diện là chặng riêng sau kịch bản** (2026-09-06): từ vựng nội dung `CONTENT_KEYS`, cổng `SceneScript`, prop block khai `content`, bảng `casting` theo vai; Biên Kịch và Kịch Bản Tĩnh chỉ viết nội dung, không nhận giao diện làm đầu vào, nên sửa giao diện không chạy lại mô hình; **cổng nhiều dây** vẫn có trong bộ máy (`PortDef.multiple`, `RunContext.lists`) nhưng không node lõi nào dùng; `ScenePlan` và IR **tự chứa** (mang stage và block, `blockId` thay `sceneType`, `tone`/`fields` theo cảnh, bất biến 5 kiểm tra props theo block); mỗi bản mẫu mang stage và danh mục block của riêng nó trong tham số node (`text-card`, `hook`, `mockup`, `cta`, `quote`; stage `dark`, `developer-dark`, `ink`, `ai-news`); thân node sửa được mọi phần. Renderer `html-gsap` là engine Hyperframes (xem bảng Engine).

Biên Kịch là node biên kịch **duy nhất**: đề bài và beat (vai trò, mô tả, số cảnh, block được phép, ràng buộc dữ kiện) là tham số; stage và danh mục block đến trên dây; mô hình chọn block cho từng cảnh và lược đồ đầu ra sinh từ bảng `props` của block.

Hai node nhà cung cấp theo mẫu Load Checkpoint của ComfyUI: **một node cho mỗi loại cổng**, chọn nhà cung cấp trong node, không phải một node cho mỗi hãng.

**Bộ máy chạy ở máy chủ** (`server/jobs.ts`, `lib/remote-executor.ts`, `ARCHITECTURE.md` §1.2): bấm Chạy là nộp việc vào hàng đợi, executor theo từng tab giữ kết quả và bộ đệm, trạng thái về qua SSE, tải lại trang hay đóng tab không mất việc, nhiều video xếp hàng chạy lần lượt. Việc và lịch sử chạy ghi xuống đĩa (`.nodecine/jobs/<id>.json`, `EXECUTION_ENGINE.md` §7.2): khởi động lại máy chủ vẫn còn lịch sử kèm bản đặc tả và các MP4 đã xuất; việc dở dang lúc tiến trình cũ chết được đánh dấu hủy.

**Mọi node ở `nodes/<họ>/`** (định nghĩa, ruột, thân node, test cạnh nhau; `nodes/index.ts` là danh sách duy nhất), `core/` chỉ còn khung. **Form tham số sinh từ Zod schema** (`nodes/form-body.tsx`, ARCHITECTURE §2) cho chín node đơn giản; các body phức tạp và Provider vẫn viết tay. Truy Xuất Repo là node `core/github-fetcher`, cả họ ở `nodes/github/`, gọi GitHub thẳng như node API của ComfyUI. Người dùng mới cài thấy đủ 21 loại node trong Thư viện; `templates/__tests__/fresh-install.test.ts` ghim đúng tập này. Thư viện xếp node theo **sáu nhóm**, là trục phân loại duy nhất: năm chặng của luồng đúng thứ tự làm một video (Nguồn → Kịch bản → Giao diện → Âm thanh → Đóng gói & Xuất), rồi Tài nguyên — bốn node `kind: 'resource'` nối vào từ bên cạnh chứ không nằm dọc luồng. `LibraryGroup` là kiểu đóng nên gõ sai tên nhóm là lỗi biên dịch, và node thiếu khai báo rơi vào nhóm Khác.

**Engine**

| Engine | Định dạng vẽ được | Xem trước | Kết xuất tệp |
|---|---|---|---|
| Hyperframes | `html-gsap` | ✅ trình phát HyperFrames (iframe sandbox opaque, `srcdoc`) | ✅ MP4 (H.264) qua `@hyperframes/producer` |
| Remotion | — | ✅ nhưng không có gì để vẽ | ✅ nhưng không có gì để vẽ |

Hyperframes Engine dựng trên **thư viện HyperFrames** (`@hyperframes/core` runtime, `@hyperframes/player`, `@hyperframes/producer`; Apache-2.0). Một IR thành một trang HTML tự chứa (`engines/hyperframes/document.ts`): gsap và runtime inline, style của stage và block bọc `@scope`, mỗi cảnh một clip `data-start`/`data-duration`, voice-over là `<audio data-start>`, một bootstrap gắn props/fields, chạy script của block với gsap giới hạn trong cảnh, và đăng ký timeline gốc. Cùng chuỗi đó đi vào `srcdoc` của trình phát và vào `index.html` cho producer. Đã kết xuất thật: 1080×1920, 30 fps, 8,7 s, có tiếng, 260 khung trong 11 giây (`engines/hyperframes/render.manual.test.ts`, bật bằng `NODECINE_MANUAL_RENDER=1`). **Chạy trọn chuỗi thật** (`server/__tests__/e2e.manual.test.ts`, bật bằng `NODECINE_E2E=1`): bản mẫu GitHub với `expressjs/express` → GitHub API → Claude Code viết 157 từ lời thoại và chọn block cho 10 cảnh → giọng hệ điều hành 60,6 s → HyperFrames producer ra MP4 60,7 s, 1820 khung, trong 112 giây. Các dịch vụ chạy không cần trình duyệt ở `server/services.server.ts`, làm cùng việc với các API route.

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

**Giao diện là dữ liệu.** Stage và block sống trong tham số của node Đạo Diễn Mỹ Thuật, tức trong tệp bản mẫu hay workflow, không phải trong code: mỗi bản mẫu mang stage và danh mục block của nó, và người dùng thêm block mới ngay trong node. Không có kiểu cảnh nào ghi cứng trong app.

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
