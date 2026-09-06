# GitHub Repo Showcase

Bản mẫu đầu tiên có mô hình ngôn ngữ, và là bằng chứng rằng khung lõi chạy được với dữ liệu thật. Mọi thứ của nó là node lõi: Truy Xuất Repo lấy dữ kiện, Biên Kịch viết, một một node Đạo Diễn Mỹ Thuật (stage và hai mươi block) mang giao diện; tham số ghi trong `templates/github-showcase.json`. Đồ thị 12 node cho ra video khoảng một phút, mười cảnh: hook, tổng quan, ba tính năng, cài đặt, con số, hai cảnh đối tượng, kêu gọi.

Thứ tự triển khai: gói này thuộc **Pha B**, chỉ bắt đầu sau khi Pha A (khung lõi với Kịch Bản Tĩnh) đã qua nghiệm thu. Xem Tài liệu Yêu cầu Sản phẩm mục 4.8.

---

## 1. Đồ Thị Mẫu

Mười node, mười hai dây. Sáu node lõi, hai node của gói (Truy Xuất Repo, Biên Kịch), hai node tài nguyên nhà cung cấp.

```
Node Nhập Liệu (lõi)
     │ SourceRef
     ▼
Node Truy Xuất Repo (gói) ──── FactSheet ────────────────┐
     │ FactSheet                                         │
     ▼                                                   │
Node Biên Kịch (gói) ◄── LLMRef ── Claude Code Provider│
     │ ScenePlan ─────────────────────────────────────┤
     │ AudioScript                                       │
     ▼                                                   ▼
Node Giọng Đọc (lõi) ◄── TTSRef ── System TTS Provider   │
     │ Voiceover ─────────────────────────► Node Đóng Gói Timeline (lõi)
                                                         │ VideoIR
                                             ┌───────────┴───────────┐
                                             ▼                       ▼
                                   Node Xuất Bản Video        Node Xuất MP4 (bỏ qua mặc định)
                                             ▲                       ▲
                                             └──── EngineRef ────────┘
                                                       │
                                             Node Remotion Engine
```

Dây `FactSheet` từ Truy Xuất Repo chạy thẳng tới Đóng Gói Timeline là điểm quan trọng nhất của gói: số sao, lệnh cài đặt và đường dẫn repo tới video mà không đi qua mô hình ngôn ngữ, nhờ cơ chế `factBindings` của lõi.

Bố cục mặc định trên canvas: năm node xử lý xếp hình quạt bên trái để hai dây rẽ nhánh của `FactSheet` không cắt qua node nào; Claude Code Provider phía trên Truy Xuất Repo, System TTS Provider phía dưới Biên Kịch, để dây tham chiếu ngắn; Remotion Engine nằm thấp ở giữa; Xuất Bản Video đứng cao và Xuất MP4 đứng thấp ở cột cuối, hai dây engine chạy song song dọc mép trái cột đó. Sau khi nạp, hệ thống tự căn giữa, mức thu phóng khoảng 85% đến 90% trên màn hình 1440 pixel.

---

## 2. Node Truy Xuất Repo (GitHub Fetcher)

Nhận `SourceRef`, phát `FactSheet`. Node duy nhất của gói gọi ra mạng.

### 2.1. Nhận diện nguồn

Giá trị được coi là đường dẫn repo khi khớp mẫu GitHub gồm tên chủ sở hữu và tên repo: `https://github.com/owner/name` (chấp nhận `www.`, `.git`, dấu gạch cuối, đuôi `/tree/...`, `/blob/...`, tham số truy vấn), `github.com/owner/name`, hoặc đúng chuỗi `owner/name` không kèm gì khác. Mọi trường hợp còn lại là văn bản thô, khi đó node **đi qua** (passthrough): không gọi mạng, đóng gói văn bản vào `facts.readmeExcerpt` và để trống các dữ kiện khác. Không có tham số nào ép node đi qua với một đường dẫn hỏng, vì như thế sẽ đưa chính đường dẫn đó vào `readmeExcerpt`.

### 2.2. Các khóa trong `facts`

| Khóa | Kiểu | Nguồn | Ở chế độ đi qua |
| --- | --- | --- | --- |
| `owner`, `name` | Chuỗi | GitHub API | Rỗng |
| `url` | Chuỗi `github.com/owner/name` | Dựng từ owner và name | Rỗng |
| `description` | Chuỗi | GitHub API | Rỗng |
| `stars` | Số nguyên hoặc `null` | GitHub API | `null` |
| `topics` | Danh sách chuỗi | GitHub API | Rỗng |
| `primaryLanguage` | Chuỗi | GitHub API | Rỗng |
| `readmeExcerpt` | Chuỗi, tối đa 4000 ký tự, đã lọc mã đánh dấu | README | Nguyên văn văn bản người dùng |
| `installCommand` | Chuỗi | Suy luận, mục 2.3 | Rỗng |

`FactSheet.sourceLabel` là `url`, `fetchedAt` là mốc truy xuất, `mode` là `fetched` hoặc `passthrough`.

### 2.3. Suy luận lệnh cài đặt

Xét theo thứ tự, lấy kết quả khớp đầu tiên: tệp khai báo gói Node có tên đã công bố; tệp khai báo dự án Python; tệp khai báo module Go; tệp khai báo gói Rust; không khớp nhưng có `url` thì `git clone https://github.com/<owner>/<name>`; không có `url` thì rỗng. Quy tắc dự phòng nằm ở đây, không ở Đóng Gói Timeline, để lõi chỉ sao chép nguyên văn.

### 2.4. Mạng và hạn mức

Gọi GitHub REST API ẩn danh, hạn mức theo địa chỉ IP; đặt `GITHUB_TOKEN` trong `.env` để nâng hạn mức. Mỗi lần truy xuất tốn tối đa ba lượt API (thông tin repo, README thô, cây tệp gốc); các tệp khai báo gói lấy qua `raw.githubusercontent.com`, không tính vào hạn mức. Node tách cặp owner/name trên máy khách và chỉ gửi cặp đó lên máy chủ qua kênh RPC của gói (Hợp đồng Lõi mục 10). Máy chủ chỉ chấp nhận miền GitHub và tự dựng lại đường dẫn từ cặp owner và name đã tách, theo Kiến trúc Hệ thống mục 5. Thời gian chờ 10 giây, tự thử lại 2 lần với lỗi tạm thời, không thử lại với `REPO_NOT_FOUND` và `REPO_RATE_LIMITED`.

---

## 3. Biên Kịch — là node lõi, cấu hình bằng dữ liệu

Không có node biên kịch riêng cho GitHub. Bản mẫu dùng `core/screenwriter` (Hợp đồng Lõi §5.8) với stage `developer-dark`, một node Blocks nối vào cổng `blocks`, và ba beat với ba ràng buộc dữ kiện:

| Slot | Kiểu cảnh | Trọng số | Ràng buộc |
|---|---|---|---|
| 1 | `github-showcase/hook` | 1 | `stars ← stars` |
| 2 | `github-showcase/mockup` | 2 | `installCommand ← installCommand`, `repoName ← name` |
| 3 | `github-showcase/cta` | 1 | `brandName ← url` |

Đề bài nằm trong JSON, người dùng sửa tự do. Vì `stars`, `installCommand`, `url` là dữ kiện đã ràng buộc, node lõi tự loại chúng khỏi prompt và khỏi lược đồ đầu ra — bất biến "dữ kiện không đi qua mô hình" giờ do lõi giữ, không do file này giữ.

## 4. Stage và Block

Giao diện là một node Đạo Diễn Mỹ Thuật (stage cộng hai mươi block) trong JSON của bản mẫu, không có code nào ngoài đồ thị. Stage `developer-dark`: nền tối, JetBrains Mono, bốn tone `violet/green/amber/pink` đổi màu nhấn theo cảnh, trường `kicker`. Mỗi block có bảng `props` (mô hình viết những prop không ràng buộc), `doc.when` để mô hình biết khi nào dùng, và code HTML/GSAP; props ràng buộc từ dữ kiện khai `required: false` để bản kế hoạch hợp lệ trước khi Đóng Gói Timeline đè vào.

- `hook`: `headline`, `subline`, `badgeText`, và `stars` (đè từ dữ kiện). Tiêu đề in hoa, nhãn xu hướng, huy hiệu sao; không có `stars` thì huy hiệu biến mất nhờ `data-if`.
- `mockup`: `headline`, `featureHighlights` (đúng ba dòng), `installCommand` và `repoName` (đè từ dữ kiện). Cửa sổ terminal với lệnh cài và ba dòng tính năng.
- `cta`: `headline`, `callToActionText`, `buttonText`, `brandName` (đè từ dữ kiện). Thẻ kết với nút kêu gọi.
- `text-card`: `headline`, `body`. Một ý trên màn hình, dùng cho tổng quan và đối tượng.
- `feature`: `title`, `detail`. Một tính năng một cảnh, ba cảnh liền nhau lấy từ README.
- `stat`: `number` (đè từ `stars`), `label`, `caption`. Con số lớn làm bằng chứng; mô hình không bao giờ tự bịa số vì prop đã ràng buộc.

## 5. Các Kịch Bản Sử Dụng

### Kịch bản 1: Sản Xuất Nhanh Từ Bản Mẫu

1. Người dùng mở studio; đồ thị mẫu mười node đã nối sẵn, tự căn giữa. Ba node tài nguyên tự probe và báo sẵn sàng. Xuất MP4 ở trạng thái bỏ qua. Không phải dán khóa nào.
2. Dán đường dẫn repo vào Node Nhập Liệu, bấm Chạy Luồng.
3. Nhập Liệu phát `SourceRef`; Truy Xuất Repo gọi GitHub, phát `FactSheet` ra hai dây; Biên Kịch gọi Claude Code qua nhà cung cấp, tạo ba cảnh; Giọng Đọc tạo MP3 qua `say` và đo thời lượng, ví dụ 11.2 giây; Đóng Gói Timeline chia 336 khung thành 84, 168, 84, đè dữ kiện theo `factBindings`, kiểm định IR; Xuất Bản Video nạp qua Remotion và phát ngay trong node. Xuất MP4 không chạy.
4. Người dùng bấm Phát trên node. Số sao ở cảnh Hook đúng bằng số sao thật.
5. Bấm Kết xuất trên Node Xuất MP4: chỉ node này chạy, tiến độ trên thân node, nhật ký vào Panel Nhật ký, xong thì tải về.

### Kịch bản 2: Đổi Engine bằng cách Thay Node

1. Kéo một Node Động Cơ khác từ Thư viện, ví dụ Remotion; thân node hiện `capabilities` mà Adapter của nó khai báo.
2. Nối dây "Động cơ" của nó vào Xuất Bản Video; dây cũ bị thay vì một cổng nhận chỉ giữ một dây.
3. Chỉ chữ ký của các node nhận `EngineRef` đổi; không node nào khác chạy lại. Node nào cần một khả năng mà engine mới khai là `unavailable` thì tự chặn, viền vàng, nêu đúng lý do Adapter đưa ra; kết quả cũ vẫn nằm dưới lớp phủ. Nếu Xuất MP4 nối sang một engine không kết xuất được, nút Kết xuất bị khóa kèm lý do.
4. Nối lại Hyperframes Engine, khung phát khôi phục tức thì.

### Kịch bản 3: Tinh Chỉnh Tham Số Cục Bộ

1. Kéo tốc độ đọc trên Node Giọng Đọc từ 1.0x lên 1.15x; node đó và mọi node phía sau chuyển sang trạng thái cũ.
2. Bấm Chạy Luồng. Nhập Liệu, Truy Xuất Repo và Biên Kịch không đổi chữ ký nên dùng lại, hiện huy hiệu "Dùng lại"; ba node tài nguyên probe lại nhưng kết quả không đổi. Không có lệnh gọi nào tới GitHub hay mô hình ngôn ngữ.
3. Giọng Đọc chạy lại, kéo theo Đóng Gói Timeline và Xuất Bản Video.

### Kịch bản 3b: Đổi Ngôn Ngữ của Video

1. Trên Node Biên Kịch đặt `outputLanguage` là Tiếng Việt; node đó và phía sau chuyển sang cũ.
2. Bấm Chạy Luồng. Nhập Liệu, Truy Xuất Repo và ba node tài nguyên dùng lại; Biên Kịch chạy lại, sinh lời thoại và tiêu đề tiếng Việt, thử lại một lần nếu mô hình sai ngôn ngữ.
3. Giọng Đọc nhận `language` là `vi`, tự chọn giọng tiếng Việt; không có thì dùng giọng dự phòng kèm huy hiệu vàng.
4. Video mới có chữ và tiếng tiếng Việt. Ngôn ngữ giao diện không đổi.

---

## 6. Lỗi Riêng

Bổ sung vào bảng mã lỗi của lõi; cùng quy tắc hiển thị.

| Mã | Node | Thông báo hiển thị | Thử lại được |
| --- | --- | --- | --- |
| `REPO_NOT_FOUND` | Truy Xuất Repo | Không tìm thấy repo công khai tại đường dẫn này | Không |
| `REPO_RATE_LIMITED` | Truy Xuất Repo | Đã vượt hạn mức GitHub API, thử lại sau ít phút (kèm thời điểm đặt lại) | Có |
| `REPO_NETWORK` | Truy Xuất Repo | Không kết nối được tới GitHub | Có |
| `LLM_SCHEMA_INVALID` | Biên Kịch | Kịch bản trả về không đúng cấu trúc; cho xem nội dung thô | Có |
| `LLM_LANGUAGE_MISMATCH` | Biên Kịch | Kịch bản trả về không đúng ngôn ngữ yêu cầu | Có, một lần |

Xử lý giao diện: `REPO_NOT_FOUND` kèm nút "Thử lại riêng node này" và nút phụ "Dùng văn bản thô thay thế"; nút phụ chuyển tiêu điểm về Node Nhập Liệu, xóa đường dẫn hỏng, đặt con trỏ sẵn để dán mô tả. Nó không đổi chế độ của Truy Xuất Repo.

---

## 7. Tiêu Chí Nghiệm Thu (Pha B)

1. Dán một đường dẫn repo GitHub công khai bất kỳ rồi bấm Chạy Luồng, luồng chạy hết chín node (bỏ qua Xuất MP4) và Xuất Bản Video phát được video có tiếng, không cần dán khóa nào.
2. Số sao trên cảnh Hook khớp chính xác số sao thật tại thời điểm truy xuất.
3. Đổi tốc độ đọc rồi chạy lại: không gọi lại mô hình ngôn ngữ, không gọi lại GitHub.
4. Ngắt mạng rồi chạy: Truy Xuất Repo đỏ với thông báo cụ thể, phía sau chờ, nút thử lại riêng hoạt động sau khi mạng phục hồi.
5. Đổi ngôn ngữ trên Biên Kịch sang tiếng Việt rồi chạy lại: chỉ Biên Kịch và phía sau chạy lại, chữ và tiếng đều tiếng Việt, Giọng Đọc tự chọn giọng tiếng Việt.
6. Đăng xuất Claude Code rồi chạy: Claude Code Provider vàng nêu đúng lệnh đăng nhập, Biên Kịch `blocked` viền vàng cùng lý do, không tiến trình nào được sinh ra.

---

## 8. Kiểm Thử Bắt Buộc

1. Dữ kiện trong IR bằng đúng dữ kiện trong `FactSheet`: `stars`, `installCommand`, `brandName` của các cảnh trong IR luôn bằng giá trị tương ứng trong `facts`, kể cả khi kết quả mô hình có chứa trường trùng tên với giá trị khác.
2. Lược đồ kết quả mô hình từ chối mọi trường dữ kiện: một kết quả có thêm `stars` hoặc `installCommand` bị loại bỏ trường đó trước khi tới `props`.
3. Chế độ đi qua: với văn bản thô, `facts.stars` là `null`, cảnh Hook ẩn huy hiệu, cảnh Mockup ẩn dòng lệnh, cảnh CTA ẩn đường dẫn; không gọi mạng.
