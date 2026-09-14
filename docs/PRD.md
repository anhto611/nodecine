# Product Requirements Document (PRD) - v0.1 MVP

Tên dự án: NodeCine
Định vị: The Open-Source Node-Based Agentic Video Studio

## 1. Tuyên ngôn Sứ mệnh & Vấn đề Cốt lõi

- Vấn đề thực tế: Việc làm video ngắn (TikTok, Shorts, Reels, X video) để quảng bá một dự án mã nguồn mở hoặc repo GitHub thường đòi hỏi nhiều giờ dựng tay trên CapCut, Premiere, hoặc phụ thuộc vào các công cụ tự động dạng "hộp đen" tạo ra video chất lượng thấp, không thể tùy biến.
- Sứ mệnh của NodeCine: Kết hợp khả năng lập trình video chuẩn xác từng khung hình của Remotion/Canvas với sự linh hoạt của đồ thị luồng (DAG Canvas). AI Agent đóng vai trò Đạo diễn (Screenwriter) hỗ trợ sáng tạo kịch bản phân cảnh, trong khi các tác vụ kỹ thuật (tạo giọng nói TTS, căn chỉnh khung hình, kết xuất video) được tự động hóa tuyệt đối.

## 2. Người dùng Mục tiêu & Các Kịch bản Ứng dụng (Target Personas & Use Cases)

NodeCine phục vụ 4 nhóm người dùng trọng tâm tương ứng với các danh mục nội dung có tính lặp lại cao:

### 2.1. Indie Hackers, Solo Founders & Technical Builders

- Chân dung: Các nhà phát triển độc lập xây dựng ứng dụng di động, SaaS hoặc tác giả các dự án mã nguồn mở. Họ không có ngân sách thuê video editor và ghét thao tác kéo thả timeline thủ công.
- Nhu cầu cốt lõi: Biến link GitHub, bài viết blog changelog hoặc tóm tắt tính năng thành video marketing ngắn chuyên nghiệp (tỷ lệ 9:16) để kéo người dùng trên X, TikTok, Shorts.
- Thể loại video chính:
  - GitHub Repo / Open-Source Showcase.
  - App Feature Demo & Mobile Mockup Highlights.
  - Product Release Changelog Summary.

### 2.2. Faceless Content Creators (Nhà sáng tạo kênh tự động)

- Chân dung: Những người vận hành mạng lưới kênh nội dung ngắn không lộ mặt (TikTok, YouTube Shorts, Reels) kiếm tiền từ Affiliate, Creator Rewards hoặc xây dựng cộng đồng.
- Nhu cầu cốt lõi: Tự động hóa hoàn toàn chuỗi sản xuất từ lấy nội dung thô (Reddit, tin tức, trivia) -> AI biên tập kịch bản -> TTS lồng tiếng -> render video có phụ đề chạy từng từ với số lượng lớn.
- Thể loại video chính:
  - Reddit & Social Forum Storytelling (kèm gameplay/cinematic background loop).
  - Daily Facts, Trivia & Myth Busters.
  - Motivational Quotes & Mindset Shorts.

### 2.3. Growth Marketers & E-commerce Sellers (Tiếp thị & Bán hàng)

- Chân dung: Nhà tiếp thị tăng trưởng, chủ shop online, người làm tiếp thị liên kết (Affiliate) cần sản xuất nhiều video quảng cáo để A/B test.
- Nhu cầu cốt lõi: Nối nguồn dữ liệu từ bảng tính (CSV/Google Sheet) hoặc API sản phẩm vào quy trình node để xuất hàng chục biến thể video quảng cáo với tiêu đề, giá bán và lời kêu gọi hành động khác nhau mà không phải dựng lại từ đầu.
- Thể loại video chính:
  - Flash Sale & Discount Countdown Alerts.
  - Product Feature vs Benefit Carousel.
  - A vs B Product Comparison Videos.

### 2.4. Data Journalists & Niche Curators (Điểm tin & Dữ liệu chuyên ngành)

- Chân dung: Những người vận hành kênh tin tức chuyên sâu về tài chính, công nghệ, tiền mã hóa hoặc dữ liệu thị trường.
- Nhu cầu cốt lõi: Trực quan hóa các con số và biến động thị trường khô khan thành các biểu đồ chuyển động (Animated Charts) đẹp mắt, chuẩn xác về mặt số liệu.
- Thể loại video chính:
  - Daily Market & Crypto 24h Movers Digest.
  - 60-Second Tech/AI News Roundups.
  - Data Visualization Shorts (Bar race, animated line graphs).

## 3. Các Nguyên tắc Thiết kế Sản phẩm Cốt lõi

1. Đồ thị luồng thay vì Timeline đa rãnh: Người dùng lắp ráp và cấu hình video thông qua các node chức năng kết nối dây (Nodes & Edges), loại bỏ sự phức tạp của timeline truyền thống.
2. Bản mẫu là Đồ thị được cấu hình sẵn: Một bản mẫu (Template) trong NodeCine là một tệp cấu hình đồ thị gồm các node, dây nối và tham số đã được tối ưu hóa sẵn cho một mục đích cụ thể.
3. Kiến trúc Độc lập Động cơ (Engine-Agnostic Core via Adapter Pattern): Quy trình đồ thị chỉ tập trung tạo ra Bản Đặc Tả Video Trung Gian (Universal Video IR). Node xuất bản sử dụng Adapter để nạp vào Remotion hoặc Hyperframes mà không làm xáo trộn luồng dữ liệu phía trước.

## 4. Phạm vi Tính năng Phiên bản MVP v0.1 (In-Scope)

### 4.1. Không gian Làm việc Đồ thị (NodeCine Canvas)

- Hỗ trợ đầy đủ các thao tác: Kéo trượt màn hình làm việc (Pan), phóng to thu nhỏ (Zoom), căn giữa tự động (Fit View) và bản đồ thu nhỏ (Mini-map).
- Cho phép kéo kết nối các dây nối dữ liệu từ cổng xuất sang cổng nhận tương thích giữa các node. Tính tương thích được quyết định bởi hệ thống kiểu cổng mô tả tại tài liệu Hợp đồng Lõi, mục 1.
- Dải công cụ bên trái theo mô hình ComfyUI, gom mọi điều hướng: Bản mẫu, Thư viện node để kéo thả node lên canvas, Lịch sử chạy trong phiên để xem lại các bản dựng trước mà không chạy lại, Nhật ký để đọc và sao chép nhật ký từng node cùng nhật ký kết xuất, và Cài đặt ghim ở đáy. Thanh điều hướng chỉ còn tên dự án và nút Chạy Luồng.

### 4.2. Khung Lõi, Nội Dung Kèm App và Bản Mẫu

NodeCine v0.1 gồm một tầng code và một tầng dữ liệu. **Cả ba đều ship cùng app và có sẵn ngay sau khi cài** — người dùng mới phải dựng được mọi bản mẫu từ canvas trống mà không cài thêm gì:

- **Khung lõi** (Hợp đồng Lõi): hệ thống kiểu cổng, bộ máy thực thi, Bản Đặc Tả Video Trung Gian generic tự chứa, registry engine và nhà cung cấp, renderer theo định dạng code, giao diện Studio, và toàn bộ node — kể cả node lấy dữ liệu như Truy Xuất Repo, vì mỗi nguồn dữ liệu là một node riêng của lõi.
- **Bản mẫu** (`templates/`): đồ thị JSON, cùng hình dạng tệp dự án, gọi tên node bằng chuỗi. Người dùng dựng được từ canvas trống, lưu lại thành bản mẫu, tải xuống để chia sẻ. Năm bản mẫu ship kèm là GitHub Repo Showcase, Thẻ Trích Dẫn Truyền Cảm Hứng, Bản Tin AI Đếm Ngược, Ảnh Tĩnh Ngang và So Sánh Hai Bên. Đồ thị Kịch Bản Tĩnh không còn là bản mẫu: nó là **đồ thị mở máy** (`lib/first-run.json`), thứ hiện ra khi chưa có gì được lưu — người ta mở app để vào việc của mình, không phải để xoá một bản demo trước đã.

Nguyên tắc phân chia node, theo mô hình ComfyUI: mỗi node một trách nhiệm; mọi node gọi ra ngoài tiến trình đứng riêng để thử lại độc lập; mọi tài nguyên hay hành động có tham số riêng là một node chứ không phải cài đặt toàn cục.

### 4.3. Bộ Node Lõi

1. Nhập Liệu (Input Trigger): Ô văn bản, phát Dữ liệu Nguồn, không diễn giải, không gọi mạng.
2. Kịch Bản Tĩnh (Static Script): Người dùng gõ tay lời thoại và danh sách cảnh (vai, trọng số, nội dung theo từ vựng cố định); Họa Sĩ đứng sau vẽ bố cục. Phát Kịch bản Phân cảnh và Lời thoại. Là cách dựng video không cần mô hình ngôn ngữ, và là node dùng để nghiệm thu khung.
2b. Biên Kịch (Screenwriter): Node biên kịch duy nhất. Nhận `LLMRef` và tùy chọn `FactSheet` hoặc `SourceRef`; người dùng viết đề bài và các beat (vai trò, mô tả, số cảnh, ràng buộc dữ kiện). Mô hình chỉ viết nội dung cảnh theo từ vựng nội dung cố định, không biết giao diện; dữ kiện đã ràng buộc không đi qua mô hình. Một video GitHub hay một video trích dẫn khác nhau chỉ ở tham số của node này và mô tả phong cách của Họa Sĩ.
2c. Họa Sĩ (Illustrator): Chặng hình, đứng **sau** kịch bản, một node một việc: mỗi lần chạy, mô hình vẽ giao diện cho đúng kịch bản này — phong cách (bảng màu, font, nền, chỗ đặt nội dung, chỗ phụ đề) rồi một bố cục cho mỗi kiểu nội dung, gán cho từng cảnh — và phát Kế hoạch dựng. Nhận Kịch bản Phân cảnh và `LLMRef` bắt buộc. Tham số chỉ là chữ: mô tả phong cách, tỉ lệ, ảnh nhân vật tùy chọn. Không lưu gì; câu trả lời mô hình cache theo prompt nên chạy lại là miễn phí và giống nhau, chạy ép là vẽ mới. Một bản mẫu mang giao diện dưới dạng một câu mô tả.
2d. Node lấy dữ liệu: Truy Xuất Repo (GitHub) và Truy Xuất Trang (đọc trang web, tùy chọn chụp ảnh trang) — mỗi nguồn một node, cùng phát Dữ kiện.
3. Nhà Cung Cấp Mô Hình Ngôn Ngữ: **một** node tài nguyên phát `LLMRef`, chọn nhà cung cấp ngay trong node theo mẫu Load Checkpoint của ComfyUI — thêm nhà cung cấp không thêm node. Thân node hiện `capabilities` từ `probe()` và các tham số riêng của nhà cung cấp đang chọn; đường dẫn tệp thực thi và địa chỉ máy chủ chỉ đến từ biến môi trường, không bao giờ từ đồ thị. Danh sách nhà cung cấp hiện có ở `STATUS.md`.
4. Nhà Cung Cấp Giọng Đọc: **một** node tài nguyên phát `TTSRef`, cùng cơ chế chọn nhà cung cấp như trên. Thân node liệt kê giọng mà `probe()` tìm được. Danh sách nhà cung cấp hiện có ở `STATUS.md`.
5. Giọng Đọc (TTS Engine): Nhận Lời thoại kèm ngôn ngữ và `TTSRef`, tự chọn giọng khớp ngôn ngữ, tạo MP3, đo thời lượng từ tệp.
5b. Căn Mốc Từ, Phụ Đề, Nhạc Nền: ba node xử lý âm thanh sau Giọng Đọc — căn chỉnh cưỡng bức để biết mỗi từ đọc lúc nào, gom từ thành dòng phụ đề, và đặt một bản nhạc dưới giọng có hạ nhạc khi nói.
6. Đóng Gói Timeline (Timeline Assembler): Hàm thuần. Nhận Kế hoạch Phân cảnh, Âm thanh, và tùy chọn Dữ kiện và Phụ đề. Phân bổ khung hình theo trọng số, đè dữ kiện lên props theo `factBindings`, kiểm định bất biến IR, phát Bản Đặc Tả Video Trung Gian.
7. Động Cơ (Hyperframes Engine xem trước và kết xuất cảnh `html-gsap` bằng thư viện HyperFrames; Remotion Engine chờ định dạng cảnh `react`): Node tài nguyên phát `EngineRef`, tương đương Load Checkpoint của ComfyUI. Đổi engine là thay node; engine không vẽ được định dạng của cảnh thì node xuất tự chặn.
8. Xuất Bản Video (Video Output): Nhận IR và `EngineRef`, tự thân là trình phát, theo mô hình PreviewImage. Không có khung xem trước nào khác.
9. Xuất MP4 (MP4 Export): Nhận cùng hai đầu vào, mang tham số codec, chất lượng, tên tệp, theo mô hình SaveImage nhưng bỏ qua mặc định vì kết xuất tốn hàng chục giây; bấm Kết xuất trên node để chạy riêng.

Ranh giới trách nhiệm:

- Node gọi ra ngoài tiến trình: Giọng Đọc (qua nhà cung cấp), cùng các node của gói. Đây là các node có nút "Thử lại riêng node này". Node tài nguyên có nút "Kiểm tra lại", Xuất MP4 có nút thử lại khi kết xuất hỏng; cả ba là cùng một thao tác chạy riêng một node.
- Node tài nguyên: ba loại trên. Việc chạy của chúng là `probe()`; chưa sẵn sàng không phải lỗi mà là nội dung của tham chiếu, node tiêu thụ tự khóa dựa trên đó. Chi tiết tại Đặc tả Bộ Máy Thực Thi mục 1.1.
- Node thuần cục bộ: Nhập Liệu, Kịch Bản Tĩnh, Đóng Gói Timeline, Xuất Bản Video.
- Node chạy theo yêu cầu: Xuất MP4.

### 4.4. Kiến trúc Độc lập Engine và Độc lập Gói

- Giao diện Adapter dùng chung, nhận IR generic tự chứa; mỗi Node Động Cơ bọc đúng một Adapter và đăng ký renderer theo định dạng code của cảnh. Hyperframes chạy `html-gsap` đầy đủ (xem trước và MP4). Remotion chưa có định dạng nào; định dạng `react` là việc của bản sau.
- Bản Đặc Tả Video Trung Gian không biết tên bất kỳ kiểu cảnh nào: mỗi cảnh mang bức vẽ của chính nó, IR mang phong cách chung. Engine chỉ đăng ký một renderer cho định dạng code (`html-gsap`), cùng pattern với registry engine và nhà cung cấp. Thêm bản mẫu mới không đụng tới IR, Adapter hay node lõi.
- Dữ kiện kiểm chứng được đi từ node truy xuất của gói thẳng tới Đóng Gói Timeline qua cổng Dữ kiện và cơ chế `factBindings` của lõi, không qua mô hình ngôn ngữ. Lõi đảm bảo bằng cấu trúc; gói chỉ khai báo ánh xạ.
- So sánh hai engine: hai Node Động Cơ và hai Node Xuất Bản Video trên cùng đồ thị. Bố cục cho phép; việc cả hai cùng phát một lúc xem `STATUS.md`.

### 4.5. Trình duyệt Bản Mẫu (Template Browser)

- Bản mẫu được chọn qua một cửa sổ modal mở từ tab đầu tiên trên dải trái, theo mô hình trình duyệt workflow của ComfyUI: cột danh mục bên trái, lưới thẻ có ảnh xem trước bên phải.
- Trình duyệt chỉ liệt kê bản mẫu thật, đọc từ registry chứ không mã hóa cứng trong giao diện; danh sách hiện tại ở `STATUS.md`. Không quảng cáo thứ chưa dựng: một cái tên không mở được thì không có mặt ở đây.

### 4.6. Xem Trước Thời Gian Thực & Xuất Tệp Cục Bộ

- Xem trước trực tiếp ngay trong Node Xuất Bản Video: trình phát chạy trong trình duyệt trên IR mà executor ở máy chủ đã dựng.
- Xuất MP4 từ Node Xuất MP4 bằng phần cứng máy đang chạy ứng dụng. Bước này cần một tiến trình Node cục bộ điều khiển headless Chromium, nằm ngay trong ứng dụng self-hosted; chi tiết tại Kiến trúc Hệ thống.

### 4.7. Bảng Cài Đặt

- Nguyên tắc Zero-Key: phải luôn tồn tại ít nhất một đường đi trọn vẹn từ nguồn tới MP4 mà không cần khóa API nào. Chừng nào chưa nhà cung cấp nào cần khóa, Cài đặt không có mục nhập khóa; xem `STATUS.md`.
- Cài đặt gồm: đường dẫn ghi đè cho tệp thực thi Claude Code và ffmpeg khi tự phát hiện thất bại, thư mục tệp tạm, và ngôn ngữ giao diện.
- Khi có nhà cung cấp cần khóa, Cài đặt trở thành két giữ khóa; node Nhà Cung Cấp chỉ trỏ tới khóa trong két, khóa không bao giờ nằm trên canvas hay trong tệp dự án. Nhà cung cấp khai báo tham số nào là khóa qua `secretSettings`.
- Nếu một node Nhà Cung Cấp báo chưa sẵn sàng, thông báo trên thân node chỉ thẳng cách khắc phục, ví dụ lệnh đăng nhập cần chạy trong terminal.

### 4.8. Trình Tự Triển Khai: Pha A rồi Pha B

Khung phải chạy được và qua nghiệm thu trước khi bất kỳ gói nào bắt đầu. Lý do: mọi quyết định của gói đều xây trên hợp đồng lõi, và lỗi ở lõi phát hiện sau khi có gói sẽ tốn gấp nhiều lần.

- **Pha A — khung lõi.** Tầng lõi, ba registry, bộ node lõi, giao diện Studio, đa ngôn ngữ, Remotion Adapter. Đồ thị nghiệm thu là **đồ thị Kịch Bản Tĩnh** bảy node: Kịch Bản Tĩnh, Giọng Đọc Nguồn, Giọng Đọc, Đóng Gói Timeline, Remotion Engine, Xuất Bản Video, Xuất MP4. Không mạng, không mô hình ngôn ngữ, không khóa.
- **Pha B — bản mẫu đầu tiên có mô hình ngôn ngữ.** GitHub Repo Showcase: node Truy Xuất Repo và một đồ thị dùng Biên Kịch, theo `templates/github-showcase.md`. Chỉ bắt đầu khi Pha A đạt đủ tiêu chí mục 6.

Pha nào đã qua nghiệm thu, xem `STATUS.md`.

## 5. Triết lý Kiến trúc & Các Tính năng Không Bao Giờ Làm (Non-Goals)

- Quyền riêng tư & Zero-Auth: NodeCine không bao giờ xây dựng tính năng đăng ký, đăng nhập tài khoản hay cơ sở dữ liệu người dùng trên đám mây. Thêm một bước nữa là Zero-Key: luôn phải có đường đi không cần khóa API nào, nhờ các nhà cung cấp tận dụng công cụ đã đăng nhập trên máy, máy chủ cục bộ và bộ tổng hợp giọng nói của hệ điều hành. Khóa, khi có, được lưu cục bộ trong trình duyệt hoặc tệp môi trường của người dùng.
- Không phát triển Timeline đa rãnh: NodeCine không chạy theo mô hình kéo thả thủ công của Premiere hay CapCut. Mọi chuyển động thị giác do mã nguồn của template và engine quy định.
- Không phụ thuộc hạ tầng đám mây: Ứng dụng hoạt động độc lập theo mô hình self-hosted, không bắt buộc người dùng kết nối tới dịch vụ đám mây tập trung nào để kết xuất.

Làm rõ một hiểu lầm thường gặp: nguyên tắc Zero-Auth và không phụ thuộc đám mây không có nghĩa là ứng dụng không có phần máy chủ. Ứng dụng vẫn có một lớp máy chủ cục bộ chạy trên chính máy người dùng để làm những việc mà trình duyệt không làm được: điều khiển tiến trình kết xuất, sinh tiến trình con cho các nhà cung cấp cục bộ, và chuyển tiếp yêu cầu tới nhà cung cấp gọi qua HTTP. Điều bị loại trừ là máy chủ tập trung do đội ngũ NodeCine vận hành.

## 6. Tiêu chí Nghiệm thu Phiên bản v0.1 (Acceptance Criteria)

### 6.1. Pha A — khung lõi

Toàn bộ mệnh đề sau đúng trên đồ thị Kịch Bản Tĩnh, không có kết nối mạng:

1. Mở ứng dụng lần đầu, đồ thị Kịch Bản Tĩnh bảy node hiện ra đã nối dây; ba node tài nguyên có mặt tự probe và báo sẵn sàng (System TTS Provider và Remotion Engine); Xuất MP4 ở trạng thái bỏ qua.
2. Gõ lời thoại và ba cảnh `text-card` rồi bấm Chạy Luồng: luồng chạy hết tám node, Xuất Bản Video phát được video có tiếng.
3. Tổng số khung hình của các cảnh bằng đúng tổng khai báo, không lệch một khung; hàm kiểm định IR từ chối mọi bản đặc tả vi phạm.
4. Bấm Kết xuất trên Xuất MP4 tạo tệp phát được, 1080x1920, 30 fps, có tiếng khớp hình.
5. Đổi tốc độ đọc rồi chạy lại: Kịch Bản Tĩnh dùng lại, chỉ Giọng Đọc và phía sau chạy lại.
6. Tải lại trang: đồ thị và tham số khôi phục nguyên vẹn; node tài nguyên tự probe lại.
7. Kéo một node từ Thư viện thả lên canvas trống, nối dây, chạy được luồng tự dựng; ô Nhập Liệu trống hoặc cổng chưa nối khóa nút Chạy Luồng ngay lập tức.
8. Chạy hai lần với tham số khác nhau: Lịch sử chạy đủ hai mục, bấm mục cũ nạp lại đúng bản dựng cũ mà không chạy node nào.
9. Khi một node lỗi, Panel Nhật ký chứa dòng lỗi mang đúng mã; Sao chép toàn bộ hoạt động.
10. Với cấu hình mặc định, Chạy Luồng không kết xuất; Xuất MP4 chỉ chạy khi bấm Kết xuất hoặc khi đã bỏ đánh dấu bỏ qua.
11. Thay Hyperframes Engine bằng Remotion Engine: không node nào phía trước chạy lại; Xuất Bản Video và Xuất MP4 chuyển vàng với `ENGINE_SCENE_UNSUPPORTED: html-gsap`, nêu đúng định dạng thiếu.
12. Gỡ ffmpeg rồi chạy: System TTS Provider vàng nêu lệnh cài, Giọng Đọc `blocked` viền vàng cùng lý do, không tiến trình nào được sinh ra.
13. Đổi ngôn ngữ giao diện trong Cài đặt: mọi chuỗi đổi ngay, lựa chọn giữ sau khi tải lại.
14. Dán lời thoại tiếng Việt vào Kịch Bản Tĩnh rồi chạy lại: node tự nhận diện `vi`, Giọng Đọc tự chọn giọng tiếng Việt, hoặc dùng giọng dự phòng kèm huy hiệu vàng nếu máy không có.
15. Một định dạng code mà engine đang nối không vẽ được làm Xuất Bản Video `blocked` viền vàng nêu tên định dạng, không vỡ.

### 6.2. Pha B — gói GitHub Repo Showcase

Tiêu chí riêng của bản mẫu nằm tại `templates/github-showcase.md` mục 7, chỉ được đánh giá sau khi 6.1 đạt trọn vẹn.

## 7. Chỉ tiêu Phi chức năng (Non-Functional Requirements)

- Trình duyệt hỗ trợ: các trình duyệt nhân Chromium phiên bản hiện hành. Firefox và Safari không nằm trong cam kết hỗ trợ của v0.1 do phụ thuộc hành vi kết xuất của Remotion.
- Độ phản hồi đồ thị: thao tác kéo trượt và phóng to trên canvas phải giữ mượt ở mức 60 khung hình mỗi giây với đồ thị tối đa 20 node.
- Độ trễ khởi động xem trước: sau khi Bản Đặc Tả Video Trung Gian sẵn sàng, Node Video Output phải hiển thị khung hình đầu tiên trong vòng dưới một giây.
- Thời gian kết xuất tham chiếu: một video 12 giây ở độ phân giải 1080x1920 nên hoàn tất kết xuất trong khoảng dưới 90 giây trên máy tính xách tay đời mới. Đây là chỉ tiêu tham chiếu để phát hiện suy giảm hiệu năng, không phải cam kết với người dùng.
- Ngôn ngữ giao diện: đa ngôn ngữ ngay từ v0.1, mặc định tiếng Anh, kèm sẵn tiếng Việt. Toàn bộ chuỗi hiển thị nằm trong tệp từ điển theo mã ngôn ngữ, không có chuỗi nào mã hóa cứng trong thành phần giao diện. Người dùng đổi trong Cài đặt, lựa chọn lưu cục bộ. Ngôn ngữ giao diện và ngôn ngữ của video là hai thứ độc lập.
- Font chữ: JetBrains Mono (SIL OFL 1.1) cho cả video lẫn giao diện Studio, đóng gói cục bộ trong kho mã, không tải từ mạng lúc chạy. Đây là điều kiện để kết xuất tất định và để ứng dụng chạy được khi ngắt mạng. Font phải có đủ dấu tiếng Việt, đã kiểm tra với JetBrains Mono.
- Ngôn ngữ của video: với Kịch Bản Tĩnh là ngôn ngữ của lời thoại đã dán, tự nhận diện; với node biên kịch của gói là tham số `outputLanguage` (mặc định `auto` bằng ngôn ngữ nguồn), vì chỉ ở đó mới có bước viết lại lời. Danh sách ngôn ngữ có thể chọn là giao của những gì mô hình ngôn ngữ viết được và những gì nhà cung cấp giọng đọc có giọng; ngôn ngữ không có giọng vẫn chọn được nhưng Node Giọng Đọc sẽ cảnh báo và dùng giọng dự phòng.

## 8. Định hướng Sau v0.1 (Ngoài Phạm vi Hiện tại)

Các hạng mục dưới đây đã được cân nhắc và cố ý loại khỏi v0.1. Chúng được ghi lại ở đây để tránh việc vô tình thiết kế chặn đường chúng:

- Định dạng cảnh `react` cho Remotion Engine: code cảnh là mã một component React dạng chuỗi, dịch lúc chạy trong trình duyệt và trong bundle kết xuất; Họa Sĩ chọn định dạng theo engine nối vào.
- Node biên kịch generic dùng chung cho mọi gói, nhận "công thức" gồm lời nhắc và lược đồ cảnh từ gói thay vì mỗi gói tự viết node.
- Bổ sung các bản mẫu còn lại trong 4 danh mục dưới dạng JSON, mỗi bản mang mô tả phong cách của nó; node lấy dữ liệu mới (RSS, YouTube) là node lõi riêng.
- Họ node truy xuất dữ liệu mở rộng: Reddit Fetcher, CSV và Google Sheet Loader, Market API Fetcher. Chúng dùng chung vị trí và vai trò với Node Truy Xuất Repo trong đồ thị.
- Nhà cung cấp cần khóa API: Anthropic, ElevenLabs và các dịch vụ đám mây khác. Tất cả cắm vào cùng cổng `LLMRef` hoặc `TTSRef` đã có, và vào cùng hai node nhà cung cấp — cái phải làm thêm là két giữ khóa, không phải node mới.
- Đặt nhiều Node Video Output trên cùng một đồ thị để so sánh hai engine, hoặc hai bản dựng, cạnh nhau.
- Phụ đề chạy từng từ, phục vụ nhóm người dùng sáng tạo nội dung không lộ mặt.
