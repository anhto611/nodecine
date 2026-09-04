# Product Requirements Document (PRD) - v0.1 MVP

Tên dự án: NodeCine
Định vị: The Open-Source Node-Based Agentic Video Studio

## 1. Tuyên ngôn Sứ mệnh & Vấn đề Cốt lõi

- Vấn đề thực tế: Việc làm video ngắn (TikTok, Shorts, Reels, X video) để quảng bá một dự án mã nguồn mở hoặc repo GitHub thường đòi hỏi nhiều giờ dựng tay trên CapCut, Premiere, hoặc phụ thuộc vào các công cụ tự động dạng "hộp đen" tạo ra video chất lượng thấp, không thể tùy biến.
- Sứ mệnh của NodeCine: Kết hợp khả năng lập trình video chuẩn xác từng khung hình của Remotion/Canvas với sự linh hoạt của đồ thị luồng (DAG Canvas). AI Agent đóng vai trò Đạo diễn (AI Director) hỗ trợ sáng tạo kịch bản phân cảnh, trong khi các tác vụ kỹ thuật (tạo giọng nói TTS, căn chỉnh khung hình, kết xuất video) được tự động hóa tuyệt đối.

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

- Chân dung: Nhà tiếp thị tăng trưởng, chủ shop online, người làm tiếp thị liên kết (Affiliate) cần sản xuất hàng loạt video quảng cáo A/B test.
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

1. Đồ thị luồng thay vì Timeline đa rãnh: Người dùng lắp ráp và cấu hình video thông qua các khối chức năng kết nối dây (Nodes & Edges), loại bỏ sự phức tạp của timeline truyền thống.
2. Bản mẫu là Đồ thị được cấu hình sẵn: Một bản mẫu (Template) trong NodeCine là một tệp cấu hình đồ thị gồm các node, dây nối và tham số đã được tối ưu hóa sẵn cho một mục đích cụ thể.
3. Kiến trúc Độc lập Động cơ (Engine-Agnostic Core via Adapter Pattern): Quy trình đồ thị chỉ tập trung tạo ra Bản Đặc Tả Video Trung Gian (Universal Video IR). Khối xuất bản sử dụng Adapter để nạp vào Remotion hoặc Hyperframes mà không làm xáo trộn luồng dữ liệu phía trước.

## 4. Phạm vi Tính năng Phiên bản MVP v0.1 (In-Scope)

### 4.1. Không gian Làm việc Đồ thị (NodeCine Canvas)

- Hỗ trợ đầy đủ các thao tác: Kéo trượt màn hình làm việc (Pan), phóng to thu nhỏ (Zoom), căn giữa tự động (Fit View) và bản đồ thu nhỏ (Mini-map).
- Cho phép kéo kết nối các dây nối dữ liệu từ cổng xuất sang cổng nhận tương thích giữa các khối. Tính tương thích được quyết định bởi hệ thống kiểu cổng mô tả tại tài liệu Hợp đồng Lõi, mục 1.
- Dải công cụ bên trái theo mô hình ComfyUI, gom mọi điều hướng: Bản mẫu, Thư viện khối để kéo thả khối lên canvas, Lịch sử chạy trong phiên để xem lại các bản dựng trước mà không chạy lại, Nhật ký để đọc và sao chép nhật ký từng khối cùng nhật ký kết xuất, và Cài đặt ghim ở đáy. Thanh điều hướng chỉ còn tên dự án và nút Chạy Luồng.

### 4.2. Khung Lõi và Gói Bản Mẫu

NodeCine v0.1 gồm hai tầng tách bạch, theo đúng mô hình core nodes và custom node packs của ComfyUI:

- **Khung lõi** (Hợp đồng Lõi): hệ thống kiểu cổng, bộ máy thực thi, Bản Đặc Tả Video Trung Gian generic, ba registry (engine, nhà cung cấp, kiểu cảnh), giao diện Studio, và bộ khối lõi đủ để dựng video từ kịch bản gõ tay mà không cần mạng hay mô hình ngôn ngữ.
- **Gói bản mẫu**: thêm khối, kiểu cảnh và đồ thị mẫu cho một loại video cụ thể, không sửa gì ở lõi. Gói đầu tiên là GitHub Repo Showcase, đặc tả tại `packs/github-showcase.md`.

Nguyên tắc phân chia khối, theo mô hình ComfyUI: mỗi khối một trách nhiệm; mọi khối gọi ra ngoài tiến trình đứng riêng để thử lại độc lập; mọi tài nguyên hay hành động có tham số riêng là một khối chứ không phải cài đặt toàn cục.

### 4.3. Bộ Khối Lõi

1. Nhập Liệu (Input Trigger): Ô văn bản, phát Dữ liệu Nguồn, không diễn giải, không gọi mạng.
2. Kịch Bản Tĩnh (Static Script): Người dùng gõ tay lời thoại và danh sách cảnh (kiểu cảnh, trọng số, nội dung). Phát Kịch bản Phân cảnh và Lời thoại. Là cách dựng video không cần gói nào, và là khối dùng để nghiệm thu khung.
3. Nhà Cung Cấp Mô Hình Ngôn Ngữ (ở v0.1 là Claude Code Provider): Khối tài nguyên phát `LLMRef`. Gọi công cụ dòng lệnh Claude Code đã đăng nhập trên máy, không dùng khóa API. Thân khối hiện phiên bản và trạng thái đăng nhập từ `probe()`; đường dẫn tệp thực thi chỉ nằm trong Cài đặt. Anthropic API Provider có mặt trong Thư viện với huy hiệu "v0.2".
4. Nhà Cung Cấp Giọng Đọc (ở v0.1 là System TTS Provider): Khối tài nguyên phát `TTSRef`. Dùng bộ tổng hợp của hệ điều hành, trên macOS là `say`, không khóa, không mạng. ElevenLabs Provider có mặt trong Thư viện với huy hiệu "v0.2".
5. Giọng Đọc (TTS Engine): Nhận Lời thoại kèm ngôn ngữ và `TTSRef`, tự chọn giọng khớp ngôn ngữ, tạo MP3, đo thời lượng từ tệp.
6. Đóng Gói Timeline (Timeline Assembler): Hàm thuần. Nhận Kịch bản Phân cảnh, Âm thanh, và tùy chọn Dữ kiện. Phân bổ khung hình theo trọng số, đè dữ kiện lên props theo `factBindings`, kiểm định bất biến IR, phát Bản Đặc Tả Video Trung Gian.
7. Động Cơ (ở v0.1 là Remotion Engine; Hyperframes Engine có mặt với huy hiệu "v0.2"): Khối tài nguyên phát `EngineRef`, tương đương Load Checkpoint của ComfyUI. Đổi engine là thay khối.
8. Xuất Bản Video (Video Output): Nhận IR và `EngineRef`, tự thân là trình phát, theo mô hình PreviewImage. Không có khung xem trước nào khác.
9. Xuất MP4 (MP4 Export): Nhận cùng hai đầu vào, mang tham số codec, chất lượng, tên tệp, theo mô hình SaveImage nhưng bỏ qua mặc định vì kết xuất tốn hàng chục giây; bấm Kết xuất trên khối để chạy riêng.

Ranh giới trách nhiệm:

- Khối gọi ra ngoài tiến trình: Giọng Đọc (qua nhà cung cấp), cùng các khối của gói. Đây là các khối có nút "Thử lại riêng khối này". Khối tài nguyên có nút "Kiểm tra lại", Xuất MP4 có nút thử lại khi kết xuất hỏng; cả ba là cùng một thao tác chạy riêng một khối.
- Khối tài nguyên: ba loại trên. Việc chạy của chúng là `probe()`; chưa sẵn sàng không phải lỗi mà là nội dung của tham chiếu, khối tiêu thụ tự khóa dựa trên đó. Chi tiết tại Đặc tả Bộ Máy Thực Thi mục 1.1.
- Khối thuần cục bộ: Nhập Liệu, Kịch Bản Tĩnh, Đóng Gói Timeline, Xuất Bản Video.
- Khối chạy theo yêu cầu: Xuất MP4.

### 4.4. Kiến trúc Độc lập Engine và Độc lập Gói

- Giao diện Adapter dùng chung, nhận IR generic; mỗi Khối Động Cơ bọc đúng một Adapter. Remotion đầy đủ ở v0.1; Hyperframes là khung xương tự khai báo chưa sẵn sàng, để lộ ngay từ đầu nhằm buộc kiến trúc thực sự độc lập engine.
- Bản Đặc Tả Video Trung Gian không biết tên bất kỳ kiểu cảnh nào: `sceneType` là chuỗi tra trong scene registry, cùng pattern với registry engine và nhà cung cấp. Thêm bản mẫu mới không đụng tới IR, Adapter hay khối lõi. Lõi ship sẵn kiểu cảnh `core/title-card` để khung tự chạy được.
- Dữ kiện kiểm chứng được đi từ khối truy xuất của gói thẳng tới Đóng Gói Timeline qua cổng Dữ kiện và cơ chế `factBindings` của lõi, không qua mô hình ngôn ngữ. Lõi đảm bảo bằng cấu trúc; gói chỉ khai báo ánh xạ.
- So sánh hai engine: hai Khối Động Cơ và hai Khối Xuất Bản Video trên cùng đồ thị. Bố cục v0.1 cho phép; cả hai cùng phát được là v0.2.

### 4.5. Trình duyệt Bản Mẫu (Template Browser) trong phạm vi v0.1

- Bản mẫu được chọn qua một cửa sổ modal mở từ tab đầu tiên trên dải trái, theo mô hình trình duyệt workflow của ComfyUI: cột danh mục bên trái, lưới thẻ có ảnh xem trước bên phải. Cửa sổ hiển thị đầy đủ 4 danh mục và toàn bộ tên bản mẫu dự kiến, nhằm bộc lộ tầm nhìn sản phẩm cho người dùng ngay từ lần đầu mở ứng dụng.
- Ở v0.1 chỉ có hai mục thực sự hoạt động: "GitHub Repo Showcase" và "Canvas trống".
- Toàn bộ thẻ còn lại được làm mờ, không bấm được, kèm nhãn "Sắp có". Chúng không nằm trong phạm vi v0.1 và không có lược đồ phân cảnh riêng ở phiên bản này.

### 4.6. Xem Trước Thời Gian Thực & Xuất Tệp Cục Bộ

- Xem trước trực tiếp ngay trong Khối Xuất Bản Video, chạy hoàn toàn phía máy khách.
- Xuất MP4 từ Khối Xuất MP4 bằng phần cứng máy đang chạy ứng dụng. Bước này cần một tiến trình Node cục bộ điều khiển headless Chromium, nằm ngay trong ứng dụng self-hosted; chi tiết tại Kiến trúc Hệ thống.

### 4.7. Bảng Cài Đặt

- Ở v0.1 ứng dụng không cần khóa API nào: mô hình ngôn ngữ đi qua Claude Code đã đăng nhập, giọng đọc đi qua bộ tổng hợp của hệ điều hành, kết xuất chạy cục bộ. Cửa sổ Cài đặt vì thế không có mục nhập khóa.
- Cài đặt gồm: đường dẫn ghi đè cho tệp thực thi Claude Code và ffmpeg khi tự phát hiện thất bại, thư mục tệp tạm, và ngôn ngữ giao diện.
- Khi các khối Nhà Cung Cấp qua API xuất hiện ở v0.2, Cài đặt trở thành két giữ khóa; khối Nhà Cung Cấp chỉ trỏ tới khóa trong két, khóa không bao giờ nằm trên canvas hay trong tệp dự án.
- Nếu một khối Nhà Cung Cấp báo chưa sẵn sàng, thông báo trên thân khối chỉ thẳng cách khắc phục, ví dụ lệnh đăng nhập cần chạy trong terminal.

### 4.8. Trình Tự Triển Khai: Pha A rồi Pha B

Khung phải chạy được và qua nghiệm thu trước khi bất kỳ gói nào bắt đầu. Lý do: mọi quyết định của gói đều xây trên hợp đồng lõi, và lỗi ở lõi phát hiện sau khi có gói sẽ tốn gấp nhiều lần.

- **Pha B — gói đầu tiên.** Gói `github-showcase` gồm Truy Xuất Repo, AI Đạo Diễn, ba kiểu cảnh kèm renderer Remotion và đồ thị mẫu mười khối; kênh RPC chung cho gói và registry đồ thị mẫu nằm ở lõi. Hoàn thành 2026-09-05, nghiệm thu bằng một lần chạy thật từ đường dẫn repo tới MP4.
- **Pha A — khung lõi.** Tầng lõi, ba registry, bộ khối lõi, giao diện Studio, đa ngôn ngữ, Remotion Adapter, Hyperframes khung xương. Đồ thị nghiệm thu là **đồ thị Kịch Bản Tĩnh** bảy khối: Kịch Bản Tĩnh, System TTS Provider, Giọng Đọc, Đóng Gói Timeline, Remotion Engine, Xuất Bản Video, Xuất MP4. Không mạng, không mô hình ngôn ngữ, không khóa. Đây là bản mẫu "Canvas trống có sẵn ví dụ" trong Trình duyệt Bản mẫu.
- **Pha B — gói GitHub Repo Showcase.** Hai khối, ba kiểu cảnh, đồ thị mẫu mười khối, theo `packs/github-showcase.md`. Chỉ bắt đầu khi Pha A đạt đủ tiêu chí mục 6.

## 5. Triết lý Kiến trúc & Các Tính năng Không Bao Giờ Làm (Non-Goals)

- Quyền riêng tư & Zero-Auth: NodeCine không bao giờ xây dựng tính năng đăng ký, đăng nhập tài khoản hay cơ sở dữ liệu người dùng trên đám mây. Ở v0.1 đi xa hơn một bước, Zero-Key: không yêu cầu người dùng dán bất kỳ khóa API nào, vì các Khối Nhà Cung Cấp tận dụng công cụ dòng lệnh đã đăng nhập và bộ tổng hợp giọng nói của hệ điều hành. Khi có khóa ở phiên bản sau, chúng được lưu cục bộ trong trình duyệt hoặc tệp môi trường của người dùng.
- Không phát triển Timeline đa rãnh: NodeCine không chạy theo mô hình kéo thả thủ công của Premiere hay CapCut. Mọi chuyển động thị giác do mã nguồn của template và engine quy định.
- Không phụ thuộc hạ tầng đám mây: Ứng dụng hoạt động độc lập theo mô hình self-hosted, không bắt buộc người dùng kết nối tới dịch vụ đám mây tập trung nào để kết xuất.

Làm rõ một hiểu lầm thường gặp: nguyên tắc Zero-Auth và không phụ thuộc đám mây không có nghĩa là ứng dụng không có phần máy chủ. Ứng dụng vẫn có một lớp máy chủ cục bộ chạy trên chính máy người dùng để làm những việc mà trình duyệt không làm được: điều khiển tiến trình kết xuất, sinh tiến trình con cho các nhà cung cấp cục bộ, và ở v0.2 chuyển tiếp yêu cầu tới nhà cung cấp API. Điều bị loại trừ là máy chủ tập trung do đội ngũ NodeCine vận hành.

## 6. Tiêu chí Nghiệm thu Phiên bản v0.1 (Acceptance Criteria)

### 6.1. Pha A — khung lõi

Toàn bộ mệnh đề sau đúng trên đồ thị Kịch Bản Tĩnh, không có kết nối mạng:

1. Mở ứng dụng lần đầu, đồ thị Kịch Bản Tĩnh bảy khối hiện ra đã nối dây; ba khối tài nguyên có mặt tự probe và báo sẵn sàng (System TTS Provider và Remotion Engine); Xuất MP4 ở trạng thái bỏ qua.
2. Gõ lời thoại và ba cảnh `core/title-card` rồi bấm Chạy Luồng: luồng chạy hết sáu khối, Xuất Bản Video phát được video có tiếng.
3. Tổng số khung hình của các cảnh bằng đúng tổng khai báo, không lệch một khung; hàm kiểm định IR từ chối mọi bản đặc tả vi phạm.
4. Bấm Kết xuất trên Xuất MP4 tạo tệp phát được, 1080x1920, 30 fps, có tiếng khớp hình.
5. Đổi tốc độ đọc rồi chạy lại: Kịch Bản Tĩnh dùng lại, chỉ Giọng Đọc và phía sau chạy lại.
6. Tải lại trang: đồ thị và tham số khôi phục nguyên vẹn; khối tài nguyên tự probe lại.
7. Kéo một khối từ Thư viện thả lên canvas trống, nối dây, chạy được luồng tự dựng; ô Nhập Liệu trống hoặc cổng chưa nối khóa nút Chạy Luồng ngay lập tức.
8. Chạy hai lần với tham số khác nhau: Lịch sử chạy đủ hai mục, bấm mục cũ nạp lại đúng bản dựng cũ mà không chạy khối nào.
9. Khi một khối lỗi, Panel Nhật ký chứa dòng lỗi mang đúng mã; Sao chép toàn bộ hoạt động.
10. Với cấu hình mặc định, Chạy Luồng không kết xuất; Xuất MP4 chỉ chạy khi bấm Kết xuất hoặc khi đã bỏ đánh dấu bỏ qua.
11. Thay Remotion Engine bằng Hyperframes Engine: Xuất Bản Video chuyển viền vàng kèm lớp phủ, không khối nào phía trước chạy lại.
12. Gỡ ffmpeg rồi chạy: System TTS Provider vàng nêu lệnh cài, Giọng Đọc `blocked` viền vàng cùng lý do, không tiến trình nào được sinh ra.
13. Đổi ngôn ngữ giao diện trong Cài đặt: mọi chuỗi đổi ngay, lựa chọn giữ sau khi tải lại.
14. Dán lời thoại tiếng Việt vào Kịch Bản Tĩnh rồi chạy lại: khối tự nhận diện `vi`, Giọng Đọc tự chọn giọng tiếng Việt, hoặc dùng giọng dự phòng kèm huy hiệu vàng nếu máy không có.
15. Một kiểu cảnh không có renderer cho engine đang nối làm Xuất Bản Video `blocked` viền vàng nêu tên kiểu cảnh, không vỡ.

### 6.2. Pha B — gói GitHub Repo Showcase

Tiêu chí riêng của gói nằm tại `packs/github-showcase.md` mục 7, chỉ được đánh giá sau khi 6.1 đạt trọn vẹn.

## 7. Chỉ tiêu Phi chức năng (Non-Functional Requirements)

- Trình duyệt hỗ trợ: các trình duyệt nhân Chromium phiên bản hiện hành. Firefox và Safari không nằm trong cam kết hỗ trợ của v0.1 do phụ thuộc hành vi kết xuất của Remotion.
- Độ phản hồi đồ thị: thao tác kéo trượt và phóng to trên canvas phải giữ mượt ở mức 60 khung hình mỗi giây với đồ thị tối đa 20 khối.
- Độ trễ khởi động xem trước: sau khi Bản Đặc Tả Video Trung Gian sẵn sàng, Khối Video Output phải hiển thị khung hình đầu tiên trong vòng dưới một giây.
- Thời gian kết xuất tham chiếu: một video 12 giây ở độ phân giải 1080x1920 nên hoàn tất kết xuất trong khoảng dưới 90 giây trên máy tính xách tay đời mới. Đây là chỉ tiêu tham chiếu để phát hiện suy giảm hiệu năng, không phải cam kết với người dùng.
- Ngôn ngữ giao diện: đa ngôn ngữ ngay từ v0.1, mặc định tiếng Anh, kèm sẵn tiếng Việt. Toàn bộ chuỗi hiển thị nằm trong tệp từ điển theo mã ngôn ngữ, không có chuỗi nào mã hóa cứng trong thành phần giao diện. Người dùng đổi trong Cài đặt, lựa chọn lưu cục bộ. Ngôn ngữ giao diện và ngôn ngữ của video là hai thứ độc lập.
- Font chữ: JetBrains Mono (SIL OFL 1.1) cho cả video lẫn giao diện Studio, đóng gói cục bộ trong kho mã, không tải từ mạng lúc chạy. Đây là điều kiện để kết xuất tất định và để ứng dụng chạy được khi ngắt mạng. Font phải có đủ dấu tiếng Việt, đã kiểm tra với JetBrains Mono.
- Ngôn ngữ của video: với Kịch Bản Tĩnh là ngôn ngữ của lời thoại đã dán, tự nhận diện; với khối đạo diễn của gói là tham số `outputLanguage` (mặc định `auto` bằng ngôn ngữ nguồn), vì chỉ ở đó mới có bước viết lại lời. Danh sách ngôn ngữ có thể chọn là giao của những gì mô hình ngôn ngữ viết được và những gì nhà cung cấp giọng đọc có giọng; ngôn ngữ không có giọng vẫn chọn được nhưng Khối Giọng Đọc sẽ cảnh báo và dùng giọng dự phòng.

## 8. Định hướng Sau v0.1 (Ngoài Phạm vi Hiện tại)

Các hạng mục dưới đây đã được cân nhắc và cố ý loại khỏi v0.1. Chúng được ghi lại ở đây để tránh việc vô tình thiết kế chặn đường chúng:

- Hoàn thiện Hyperframes Adapter tới mức xem trước và kết xuất đầy đủ, kèm renderer Hyperframes cho các kiểu cảnh đã có.
- Khối đạo diễn generic dùng chung cho mọi gói, nhận "công thức" gồm lời nhắc và lược đồ cảnh từ gói thay vì mỗi gói tự viết khối.
- Bổ sung các bản mẫu còn lại trong 4 danh mục dưới dạng gói, mỗi gói tự mang khối, kiểu cảnh và đồ thị mẫu của nó.
- Họ khối truy xuất dữ liệu mở rộng: Reddit Fetcher, CSV và Google Sheet Loader, Market API Fetcher. Chúng dùng chung vị trí và vai trò với Khối Truy Xuất Repo trong đồ thị.
- Họ khối Nhà Cung Cấp mở rộng: Anthropic API Provider và các nhà cung cấp mô hình khác qua khóa API; ElevenLabs và các nhà cung cấp giọng đọc đám mây; nhà cung cấp giọng đọc chạy mô hình cục bộ trên GPU. Tất cả cắm vào cùng cổng `LLMRef` hoặc `TTSRef` đã có từ v0.1.
- Chạy hàng loạt (batch) nhiều biến thể video từ một nguồn dữ liệu bảng tính.
- Đặt nhiều Khối Video Output trên cùng một đồ thị để so sánh hai engine, hoặc hai bản dựng, cạnh nhau.
- Phụ đề chạy từng từ, phục vụ nhóm người dùng sáng tạo nội dung không lộ mặt.
