# Gói Bản Mẫu: GitHub Repo Showcase - v0.1

Gói bản mẫu đầu tiên của NodeCine, và là bằng chứng rằng khung lõi chạy được với dữ liệu thật. Mọi thứ trong tài liệu này xây trên Hợp đồng Lõi và **không sửa gì ở lõi**: gói chỉ thêm hai khối, ba kiểu cảnh, một đồ thị mẫu và bài kiểm thử của riêng nó.

Thứ tự triển khai: gói này thuộc **Pha B**, chỉ bắt đầu sau khi Pha A (khung lõi với Kịch Bản Tĩnh) đã qua nghiệm thu. Xem Tài liệu Yêu cầu Sản phẩm mục 4.8.

---

## 1. Đồ Thị Mẫu

Mười khối, mười hai dây. Sáu khối lõi, hai khối của gói (Truy Xuất Repo, AI Đạo Diễn), hai khối tài nguyên nhà cung cấp.

```
Khối Nhập Liệu (lõi)
     │ SourceRef
     ▼
Khối Truy Xuất Repo (gói) ──── FactSheet ────────────────┐
     │ FactSheet                                         │
     ▼                                                   │
Khối AI Đạo Diễn (gói) ◄── LLMRef ── Claude Code Provider│
     │ DirectorPlan ─────────────────────────────────────┤
     │ AudioScript                                       │
     ▼                                                   ▼
Khối Giọng Đọc (lõi) ◄── TTSRef ── System TTS Provider   │
     │ Voiceover ─────────────────────────► Khối Đóng Gói Timeline (lõi)
                                                         │ VideoIR
                                             ┌───────────┴───────────┐
                                             ▼                       ▼
                                   Khối Xuất Bản Video        Khối Xuất MP4 (bỏ qua mặc định)
                                             ▲                       ▲
                                             └──── EngineRef ────────┘
                                                       │
                                             Khối Remotion Engine
```

Dây `FactSheet` từ Truy Xuất Repo chạy thẳng tới Đóng Gói Timeline là điểm quan trọng nhất của gói: số sao, lệnh cài đặt và đường dẫn repo tới video mà không đi qua mô hình ngôn ngữ, nhờ cơ chế `factBindings` của lõi.

Bố cục mặc định trên canvas: năm khối xử lý xếp hình quạt bên trái để hai dây rẽ nhánh của `FactSheet` không cắt qua khối nào; Claude Code Provider phía trên Truy Xuất Repo, System TTS Provider phía dưới AI Đạo Diễn, để dây tham chiếu ngắn; Remotion Engine nằm thấp ở giữa; Xuất Bản Video đứng cao và Xuất MP4 đứng thấp ở cột cuối, hai dây engine chạy song song dọc mép trái cột đó. Sau khi nạp, hệ thống tự căn giữa, mức thu phóng khoảng 85% đến 90% trên màn hình 1440 pixel.

---

## 2. Khối Truy Xuất Repo (GitHub Fetcher)

Nhận `SourceRef`, phát `FactSheet`. Khối duy nhất của gói gọi ra mạng.

### 2.1. Nhận diện nguồn

Giá trị được coi là đường dẫn repo khi khớp mẫu GitHub gồm tên chủ sở hữu và tên repo. Mọi trường hợp còn lại là văn bản thô, khi đó khối **đi qua** (passthrough): không gọi mạng, đóng gói văn bản vào `facts.readmeExcerpt` và để trống các dữ kiện khác. Không có tham số nào ép khối đi qua với một đường dẫn hỏng, vì như thế sẽ đưa chính đường dẫn đó vào `readmeExcerpt`.

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

Gọi GitHub REST API ẩn danh, hạn mức theo địa chỉ IP. Máy chủ chỉ chấp nhận miền GitHub và tự dựng lại đường dẫn từ cặp owner và name đã tách, theo Kiến trúc Hệ thống mục 5. Thời gian chờ 10 giây, tự thử lại 2 lần với lỗi tạm thời, không thử lại với `REPO_NOT_FOUND` và `REPO_RATE_LIMITED`.

---

## 3. Khối AI Đạo Diễn (AI Director)

Nhận `FactSheet` và `LLMRef`, phát `DirectorPlan` và `AudioScript`. Tham số: `outputLanguage` (mặc định `auto`: bằng ngôn ngữ nguồn do lõi nhận diện từ văn bản của `FactSheet`; chọn `vi` để mô hình viết toàn bộ lời thoại và tiêu đề bằng tiếng Việt dù nguồn là tiếng Anh). Dữ kiện đi qua cổng Dữ kiện không bị dịch. Chủ đề thị giác cố định `github-showcase/developer-dark`, không chọn được ở v0.1.

### 3.1. Lược đồ kết quả mô hình phải trả về

- `language`: Phải bằng `outputLanguage` đã phân giải; khác thì thử lại một lần với chỉ dẫn siết chặt, vẫn khác thì lỗi `LLM_LANGUAGE_MISMATCH`.
- `audioScript`: Lời thoại 10 đến 15 giây đọc, viết bằng `outputLanguage` đã phân giải.
- `scenes`: Đúng ba mục theo thứ tự:
  1. Hook: `headline` (in hoa, tối đa 6 từ), `subline` (tối đa 10 từ), `badgeText`, `accentColor` (Hex).
  2. Mockup: `headline`, `featureHighlights` (đúng 3 chuỗi ngắn), `accentColor`.
  3. CTA: `headline`, `callToActionText`, `accentColor`.

Lược đồ này **không có** trường số sao, lệnh cài đặt, đường dẫn hay tên chủ sở hữu. Nếu mô hình trả thêm trường lạ, kiểm định loại bỏ. Sai cấu trúc thử lại một lần, vẫn sai thì `LLM_SCHEMA_INVALID`.

### 3.2. Cách khối dựng hai gói phát ra

Khối tách kết quả thành hai gói có mã băm riêng:

- `AudioScript`: `{text: audioScript, language}`.
- `DirectorPlan`: `{language, theme, scenes}` với mỗi cảnh được gắn `sceneType`, `weight` và `factBindings` như sau, còn `props` là đúng các trường mô hình đã viết:

| Cảnh | `sceneType` | `weight` | `factBindings` |
| --- | --- | --- | --- |
| Hook | `github-showcase/hook` | 1 | `stars → stars` |
| Mockup | `github-showcase/mockup` | 2 | `installCommand → installCommand`, `repoName → name` |
| CTA | `github-showcase/cta` | 1 | `brandName → url` |

Trọng số 1, 2, 1 cho phân bổ 25%, 50%, 25% theo quy tắc của lõi, với `minTotalFrames` mặc định 270. Với âm thanh 11.2 giây: 336 khung, chia 84, 168, 84.

### 3.3. Lời nhắc

Lời nhắc gửi cho mô hình chứa: `readmeExcerpt`, `description`, `topics`, `primaryLanguage`, và `name`; **không** chứa `stars`, `installCommand`, `url`, để mô hình không có gì để chép sai. Lời nhắc đi qua đầu vào chuẩn của tiến trình con theo Hợp đồng Lõi mục 9. Thời gian chờ 120 giây, cộng thời gian khởi động tiến trình.

---

## 4. Kiểu Cảnh của Gói

Ba kiểu cảnh đăng ký vào scene registry, mỗi kiểu có renderer Remotion ở v0.1; renderer Hyperframes để v0.2. Chủ đề `github-showcase/developer-dark`: nền tối, font JetBrains Mono, hiệu ứng cửa sổ Terminal.

### 4.1. `github-showcase/hook`

`props`: `headline`, `subline`, `badgeText`, `accentColor`, và `stars` (đè từ dữ kiện). Hiển thị tiêu đề in hoa, nhãn xu hướng, huy hiệu Star nảy chuyển động với số sao thật. `stars` bằng `null` thì ẩn hoàn toàn huy hiệu và căn lại bố cục, không hiển thị số 0.

### 4.2. `github-showcase/mockup`

`props`: `headline`, `featureHighlights`, `accentColor`, và `installCommand`, `repoName` (đè từ dữ kiện). Khung cửa sổ dòng lệnh hiển thị tên repo, lệnh cài đặt và ba tính năng. `installCommand` rỗng (chỉ ở chế độ đi qua) thì ẩn dòng lệnh.

### 4.3. `github-showcase/cta`

`props`: `headline`, `callToActionText`, `accentColor`, và `brandName` (đè từ dữ kiện). Thẻ thông tin repo, đường dẫn và lời kêu gọi Star hoặc đóng góp. `brandName` rỗng thì ẩn dòng đường dẫn.

---

## 5. Các Kịch Bản Sử Dụng của Gói

### Kịch bản 1: Sản Xuất Nhanh Từ Bản Mẫu

1. Người dùng mở studio; đồ thị mẫu mười khối đã nối sẵn, tự căn giữa. Ba khối tài nguyên tự probe và báo sẵn sàng. Xuất MP4 ở trạng thái bỏ qua. Không phải dán khóa nào.
2. Dán đường dẫn repo vào Khối Nhập Liệu, bấm Chạy Luồng.
3. Nhập Liệu phát `SourceRef`; Truy Xuất Repo gọi GitHub, phát `FactSheet` ra hai dây; AI Đạo Diễn gọi Claude Code qua nhà cung cấp, tạo ba cảnh; Giọng Đọc tạo MP3 qua `say` và đo thời lượng, ví dụ 11.2 giây; Đóng Gói Timeline chia 336 khung thành 84, 168, 84, đè dữ kiện theo `factBindings`, kiểm định IR; Xuất Bản Video nạp qua Remotion và phát ngay trong khối. Xuất MP4 không chạy.
4. Người dùng bấm Phát trên khối. Số sao ở cảnh Hook đúng bằng số sao thật.
5. Bấm Kết xuất trên Khối Xuất MP4: chỉ khối này chạy, tiến độ trên thân khối, nhật ký vào Panel Nhật ký, xong thì tải về.

### Kịch bản 2: Đổi Engine bằng cách Thay Khối

1. Kéo Khối Hyperframes Engine từ Thư viện; thân khối hiện chấm vàng "chưa sẵn sàng, v0.2".
2. Nối dây "Động cơ" của nó vào Xuất Bản Video; dây cũ bị thay vì một cổng nhận chỉ giữ một dây.
3. Chỉ chữ ký của các khối nhận `EngineRef` đổi; không khối nào khác chạy lại. Xuất Bản Video `blocked` viền vàng với lớp phủ "Hyperframes Engine sẽ có ở v0.2"; kết quả Remotion cũ vẫn nằm dưới lớp phủ. Nếu Xuất MP4 cũng nối sang engine mới, nút Kết xuất bị khóa kèm lý do.
4. Nối lại Remotion Engine, khung phát khôi phục tức thì.

### Kịch bản 3: Tinh Chỉnh Tham Số Cục Bộ

1. Kéo tốc độ đọc trên Khối Giọng Đọc từ 1.0x lên 1.15x; khối đó và mọi khối phía sau chuyển sang trạng thái cũ.
2. Bấm Chạy Luồng. Nhập Liệu, Truy Xuất Repo và AI Đạo Diễn không đổi chữ ký nên dùng lại, hiện huy hiệu "Dùng lại"; ba khối tài nguyên probe lại nhưng kết quả không đổi. Không có lệnh gọi nào tới GitHub hay mô hình ngôn ngữ.
3. Giọng Đọc chạy lại, kéo theo Đóng Gói Timeline và Xuất Bản Video.

### Kịch bản 3b: Đổi Ngôn Ngữ của Video

1. Trên Khối AI Đạo Diễn đặt `outputLanguage` là Tiếng Việt; khối đó và phía sau chuyển sang cũ.
2. Bấm Chạy Luồng. Nhập Liệu, Truy Xuất Repo và ba khối tài nguyên dùng lại; AI Đạo Diễn chạy lại, sinh lời thoại và tiêu đề tiếng Việt, thử lại một lần nếu mô hình sai ngôn ngữ.
3. Giọng Đọc nhận `language` là `vi`, tự chọn giọng tiếng Việt; không có thì dùng giọng dự phòng kèm huy hiệu vàng.
4. Video mới có chữ và tiếng tiếng Việt. Ngôn ngữ giao diện không đổi.

---

## 6. Lỗi Riêng của Gói

Bổ sung vào bảng mã lỗi của lõi; cùng quy tắc hiển thị.

| Mã | Khối | Thông báo hiển thị | Thử lại được |
| --- | --- | --- | --- |
| `REPO_NOT_FOUND` | Truy Xuất Repo | Không tìm thấy repo công khai tại đường dẫn này | Không |
| `REPO_RATE_LIMITED` | Truy Xuất Repo | Đã vượt hạn mức GitHub API, thử lại sau ít phút (kèm thời điểm đặt lại) | Có |
| `REPO_NETWORK` | Truy Xuất Repo | Không kết nối được tới GitHub | Có |
| `LLM_SCHEMA_INVALID` | AI Đạo Diễn | Kịch bản trả về không đúng cấu trúc; cho xem nội dung thô | Có |
| `LLM_LANGUAGE_MISMATCH` | AI Đạo Diễn | Kịch bản trả về không đúng ngôn ngữ yêu cầu | Có, một lần |

Xử lý giao diện: `REPO_NOT_FOUND` kèm nút "Thử lại riêng khối này" và nút phụ "Dùng văn bản thô thay thế"; nút phụ chuyển tiêu điểm về Khối Nhập Liệu, xóa đường dẫn hỏng, đặt con trỏ sẵn để dán mô tả. Nó không đổi chế độ của Truy Xuất Repo.

---

## 7. Tiêu Chí Nghiệm Thu của Gói (Pha B)

1. Dán một đường dẫn repo GitHub công khai bất kỳ rồi bấm Chạy Luồng, luồng chạy hết chín khối (bỏ qua Xuất MP4) và Xuất Bản Video phát được video có tiếng, không cần dán khóa nào.
2. Số sao trên cảnh Hook khớp chính xác số sao thật tại thời điểm truy xuất.
3. Đổi tốc độ đọc rồi chạy lại: không gọi lại mô hình ngôn ngữ, không gọi lại GitHub.
4. Ngắt mạng rồi chạy: Truy Xuất Repo đỏ với thông báo cụ thể, phía sau chờ, nút thử lại riêng hoạt động sau khi mạng phục hồi.
5. Đổi ngôn ngữ trên AI Đạo Diễn sang tiếng Việt rồi chạy lại: chỉ AI Đạo Diễn và phía sau chạy lại, chữ và tiếng đều tiếng Việt, Giọng Đọc tự chọn giọng tiếng Việt.
6. Đăng xuất Claude Code rồi chạy: Claude Code Provider vàng nêu đúng lệnh đăng nhập, AI Đạo Diễn `blocked` viền vàng cùng lý do, không tiến trình nào được sinh ra.

---

## 8. Kiểm Thử Bắt Buộc của Gói

1. Dữ kiện trong IR bằng đúng dữ kiện trong `FactSheet`: `stars`, `installCommand`, `brandName` của các cảnh trong IR luôn bằng giá trị tương ứng trong `facts`, kể cả khi kết quả mô hình có chứa trường trùng tên với giá trị khác.
2. Lược đồ kết quả mô hình từ chối mọi trường dữ kiện: một kết quả có thêm `stars` hoặc `installCommand` bị loại bỏ trường đó trước khi tới `props`.
3. Chế độ đi qua: với văn bản thô, `facts.stars` là `null`, cảnh Hook ẩn huy hiệu, cảnh Mockup ẩn dòng lệnh, cảnh CTA ẩn đường dẫn; không gọi mạng.
