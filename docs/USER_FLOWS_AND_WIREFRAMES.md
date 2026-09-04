# Đặc tả Luồng Trải nghiệm Người dùng & Giao diện NodeCine (UI/UX Specification)

Tài liệu này mô tả giao diện của **khung lõi**: bố cục, dải trái, giải phẫu khối, và các kịch bản chỉ dùng khối lõi. Kịch bản riêng của từng gói bản mẫu nằm trong tài liệu của gói đó (`packs/github-showcase.md` mục 5). Tài liệu liên quan: Hợp đồng Lõi định nghĩa kiểu cổng và dữ liệu chảy qua dây nối; Đặc tả Bộ Máy Thực Thi định nghĩa thứ tự chạy, cơ chế chạy lại từng phần và bảng mã lỗi.

## 1. Cấu trúc Bố cục Màn hình (Studio Layout)

Giao diện vận hành trên chuẩn màn hình Desktop, tối thiểu 1080p. Bố cục theo mô hình của ComfyUI: một thanh điều hướng mỏng phía trên và một canvas đồ thị chiếm trọn phần còn lại. Không có khung xem trước riêng, vì chính Khối Video Output là trình phát. Dưới ngưỡng 1280 pixel chiều rộng, ứng dụng hiển thị thông báo khuyến nghị dùng màn hình lớn hơn thay vì cố co bố cục; giao diện di động không nằm trong phạm vi v0.1.

### 1.1. Thanh Điều Hướng Toàn Cục (Header Bar)

Thanh điều hướng chỉ giữ những gì phải luôn nhìn thấy. Mọi thứ khác nằm trên dải trái.

- Chiều cao cố định 56 pixel, nền tối với đường kẻ biên dưới sắc nét.
- Góc bên trái: Logo nhận diện NodeCine và trường tên dự án. Nhấp đúp để đổi tên trực tiếp, tự động lưu vào bộ nhớ trình duyệt.
- Khu vực trung tâm: trống. Không có hộp chọn bản mẫu, không có hộp chọn engine, không có nút xuất.
- Góc bên phải: duy nhất nút "Chạy Luồng" (Run Pipeline), nút hành động chính, nền màu thương hiệu tím nổi bật. Trong lúc luồng đang chạy, nút chuyển thành "Dừng Luồng". Đây là thứ duy nhất đủ quan trọng để chiếm chỗ trên thanh điều hướng, vì nó được bấm ở mọi kịch bản và phải thấy được ở mọi trạng thái panel.
- Bản mẫu và Cài đặt chuyển sang dải trái, mô tả ở mục 1.6.

### 1.2. Không gian Đồ thị Luồng (Workflow Canvas, chiếm trọn chiều rộng)

- Nền lưới chấm mờ vô cực, chiếm toàn bộ diện tích dưới thanh điều hướng.
- Thao tác điều hướng: Giữ chuột trái trên nền trống để kéo trượt không gian, cuộn con lăn chuột để phóng to và thu nhỏ.
- Thanh công cụ nổi ở góc dưới bên trái gồm: Thêm khối (mở panel Thư viện khối), Phóng to, Thu nhỏ, Căn giữa đồ thị, chỉ số thu phóng hiện tại, và Bản đồ thu nhỏ định vị.
- Dây nối giữa các khối: Dạng đường cong Bézier mượt mà, đổi màu phát sáng theo trạng thái kích hoạt của luồng dữ liệu.
- Thẻ khối hiển thị rõ ràng loại dữ liệu vào và ra qua nhãn cạnh cổng; tên engine hay nhà cung cấp đang nối hiện trên nhãn của cổng tham chiếu tương ứng.
- Quy ước bố cục cho mọi đồ thị mẫu: vì cổng nhận luôn ở mép trái và cổng phát luôn ở mép phải, mọi dây nối đều đi từ trái sang phải; khối tài nguyên đứng ngay cạnh khối tiêu thụ của nó để dây tham chiếu ngắn; Khối Xuất Bản Video đứng cao và Khối Xuất MP4 đứng thấp ở cột cuối. Sau khi nạp, hệ thống tự Căn giữa đồ thị. Bố cục cụ thể của từng đồ thị mẫu nằm trong tài liệu của gói.

### 1.3. Trình duyệt Bản mẫu (Template Browser)

Cửa sổ dạng modal theo mô hình trình duyệt workflow của ComfyUI, mở từ tab "Bản mẫu" ở đầu dải trái.

- Đầu cửa sổ: tiêu đề, một dòng phụ, ô tìm kiếm theo tên, nút đóng.
- Cột bên trái: danh sách danh mục kèm số lượng bản mẫu trong mỗi danh mục. Gồm "Tất cả" và bốn nhóm: Tech & Product, Faceless Content, Commerce & Ads, Dữ liệu & Tài chính. Cuối cột là mục "Canvas trống" và một ghi chú ngắn về phạm vi v0.1.
- Vùng chính: lưới thẻ ba cột. Mỗi thẻ gồm ảnh xem trước dạng khung dọc 9:16 thu nhỏ, tên bản mẫu, một câu mô tả, và dòng thông số gồm số khối cùng tỷ lệ khung hình và tốc độ khung hình.
- Danh sách bản mẫu theo danh mục:
  - Lõi: Kịch Bản Tĩnh.
  - Tech & Product: GitHub Repo Showcase, Mobile App Promo, Product Changelog.
  - Faceless Content: Reddit Storytelling, Daily Facts & Trivia, Motivational Quotes.
  - Commerce & Ads: Flash Sale Alert, Product Comparison (A vs B).
  - Dữ liệu & Tài chính: Market Recap & Movers, Crypto Trends.
- Phạm vi hoạt động ở v0.1: ba mục chọn được là "Kịch Bản Tĩnh" (đồ thị bảy khối của lõi, có ngay từ Pha A), "GitHub Repo Showcase" (từ Pha B) và "Canvas trống". Thẻ GitHub Repo Showcase có viền màu thương hiệu; toàn bộ thẻ còn lại hiển thị mờ, không nhận thao tác, kèm nhãn "Sắp có" ngay cạnh tên. Chúng vẫn được liệt kê nhằm bộc lộ tầm nhìn sản phẩm, không phải do sót việc.
- Chân cửa sổ: dòng cảnh báo "Mở bản mẫu sẽ thay toàn bộ đồ thị hiện tại", nút Hủy và nút hành động chính ghi rõ tên bản mẫu sắp mở.

### 1.4. Khối Video Output là Trình phát (Player Node)

Khối Xuất Bản Video không chỉ nhận Bản Đặc Tả Video Trung Gian mà còn là nơi duy nhất để xem và tua video, giống khối PreviewImage của ComfyUI. Toàn bộ nội dung dưới đây nằm trong thân khối, cuộn và thu phóng cùng canvas.

- Đầu khối: biểu tượng, tên khối, và huy hiệu trạng thái xử lý như mọi khối khác. Không có hộp chọn engine: engine đến từ cổng nhận thứ hai.
- Hai cổng nhận: "Bản đặc tả IR" và "Động cơ". Tên engine đang dùng hiện dưới dạng nhãn mờ cạnh cổng Động cơ, lấy từ tham chiếu đang nối vào.
- Khung phát video: tỷ lệ dọc chuẩn 9:16 trên nền đen sâu, cố định 1080 trên 1920 và co giãn theo mức thu phóng của canvas.
- Cụm điều khiển trình phát nằm ngay dưới khung:
  - Nút Nhảy về khung hình đầu tiên, nút Phát và Tạm dừng.
  - Thanh trượt tiến trình khung hình hỗ trợ kéo rê mượt mà theo từng khung.
  - Bộ đếm kép hiển thị song song: khung hình hiện tại trên tổng số khung hình, và giây hiện tại trên tổng số giây.
- Thanh tra Phân cảnh (Scene Inspector):
  - Liệt kê các thẻ phân cảnh thu nhỏ Hook, Feature và CTA nằm ngay dưới thanh trượt, có bề rộng tỷ lệ thuận với số khung hình của từng cảnh.
  - Nhấp vào bất kỳ thẻ phân cảnh nào sẽ đưa con trỏ phát nhảy ngay đến khung hình đầu tiên của phân cảnh đó.
  - Nếu Bản Đặc Tả Video Trung Gian có phần đuôi không tiếng, thanh trượt vẽ thêm một vạch mờ đánh dấu thời điểm âm thanh kết thúc, kèm chú giải khi rê chuột.
- Dòng tóm tắt cuối khối: tổng số khung hình, tốc độ khung hình, độ dài đuôi lặng và độ phân giải, để đối chiếu nhanh với Khối Đóng Gói Timeline. Không có nút xuất tệp trong khối này.
- Hệ quả của việc gộp trình phát vào khối: đặt hai Khối Video Output cạnh nhau, cùng nhận một Bản Đặc Tả Video Trung Gian, là cách so sánh trực tiếp hai engine. Đây là hạng mục cho v0.2 nhưng bố cục v0.1 không được chặn đường nó.

### 1.5. Các Trạng thái của Khối Video Output

Khung phát trong khối có bốn trạng thái loại trừ lẫn nhau, và giao diện phải luôn ở đúng một trong bốn:

1. Chưa chạy lần nào: khung đen với dòng hướng dẫn ngắn "Chưa có Bản đặc tả IR. Bấm Chạy Luồng để dựng video". Cụm điều khiển bị làm mờ.
2. Đang chạy: hiển thị tên khối đang xử lý và số thứ tự bước trên tổng số bước, ví dụ "Đang tạo giọng đọc, bước 7 trên 9", kèm thanh tiến độ mảnh. Bộ đếm tính mọi khối sẽ chạy trong lần này theo thứ tự tô-pô, gồm cả ba khối tài nguyên probe trước, không tính khối bị bỏ qua.
3. Đã có kết quả: trình phát hoạt động đầy đủ.
4. Engine chưa hỗ trợ hoặc kết quả cũ: phủ một lớp thông báo mờ lên khung phát, giữ nguyên kết quả cũ bên dưới lớp phủ để người dùng không mất ngữ cảnh. Khi nguyên nhân là engine nối vào chưa hỗ trợ xem trước, viền khối chuyển vàng; khi nguyên nhân là một khối phía trước đang lỗi, thông báo nêu rõ tên khối đó.

### 1.6. Dải Công cụ và Panel Bên trái (Left Sidebar)

Theo mô hình dải icon dọc của ComfyUI, nằm ở mép trái ngay dưới thanh điều hướng.

- Dải icon rộng 44 pixel. Từ trên xuống: Bản mẫu, Thư viện khối, Lịch sử chạy, Nhật ký; một khoảng trống co giãn; rồi Cài đặt ghim ở đáy dải, đúng vị trí bánh răng của ComfyUI. Tab đang mở có vạch màu thương hiệu ở mép trái và biểu tượng sáng lên. Tab Nhật ký hiện thêm một chấm đỏ khi có lỗi mới chưa xem; tab Cài đặt hiện chấm vàng khi một khối tài nguyên báo chưa sẵn sàng vì thiếu đường dẫn tệp thực thi.
- Tab Bản mẫu và tab Cài đặt không mở panel bên trái mà mở cửa sổ modal tương ứng, vì nội dung của chúng cần bề ngang.
- Bấm tab Thư viện khối hoặc Lịch sử chạy mở một panel rộng 280 pixel trượt ra bên phải dải; bấm lại tab đó, bấm nút đóng ở đầu panel, hoặc nhấn `Esc` để đóng. Chỉ một panel mở tại một thời điểm. Canvas co lại tương ứng và không tự căn giữa lại đồ thị, để người dùng không mất vị trí đang xem.
- Tab Nhật ký không mở panel bên trái mà bật tắt Panel Nhật ký ở đáy màn hình, mô tả ở mục 1.7.

Thư viện khối (Node Library):

- Ô tìm kiếm theo tên ở đầu panel.
- Khối xếp theo nhóm vai trò, khối lõi trước rồi tới khối của từng gói đã cài, mỗi gói một nhóm mang tên gói. Lõi: Nguồn (Input Trigger, Static Script), Nhà cung cấp (Claude Code Provider, System TTS Provider, cùng Anthropic API Provider và ElevenLabs Provider với huy hiệu "v0.2"), Xử lý (TTS Engine, Timeline Assembler), Động cơ (Remotion Engine, Hyperframes Engine với huy hiệu "v0.2"), Xuất (Video Output, MP4 Export). Gói GitHub Showcase: GitHub Fetcher, AI Director. Mỗi mục gồm biểu tượng, tên khối, một dòng mô tả và dòng nhãn cổng vào và ra dùng đúng tên trong bảng kiểu cổng.
- Kéo một mục thả lên canvas để tạo khối tại vị trí thả; nhấp đúp để thả vào giữa vùng đang nhìn. Trong lúc kéo, một bản mờ của khối bám theo con trỏ.
- Nút "Thêm khối" ở thanh công cụ đáy trái không còn tự mở danh mục riêng, mà chỉ mở panel này.
- Mọi khối đều được phép thêm nhiều lần trên cùng đồ thị. Bộ máy thực thi nạp dữ liệu vào mọi khối có dây nối hợp lệ; việc hai engine cùng phát được là hạng mục v0.2.

Lịch sử chạy (Run History):

- Danh sách các lần chạy hoàn tất trong phiên hiện tại, mới nhất trên cùng, tối đa 20 mục, cũ nhất bị đẩy ra.
- Mỗi mục gồm ảnh thu nhỏ khung hình đầu tiên dạng 9:16, số thứ tự lần chạy, mốc thời gian, thời lượng video, tổng thời gian chạy và tên engine.
- Bấm một mục để nạp lại Bản Đặc Tả Video Trung Gian của lần đó vào Khối Video Output mà không chạy lại luồng nào. Mục đang hiển thị có viền màu thương hiệu. Khi người dùng bấm Chạy Luồng lần nữa, kết quả mới tự thay thế mục đang hiển thị.
- Lịch sử chỉ tồn tại trong bộ nhớ của phiên. Tải lại trang là mất, đúng quy tắc không lưu bền kết quả chạy tại Đặc tả Bộ Máy Thực Thi mục 7.2. Panel ghi rõ điều này ở dòng cuối.
- Trạng thái rỗng: một dòng "Chưa có lần chạy nào trong phiên này".

Cài đặt (mở từ tab ở đáy dải):

- Cửa sổ modal. Ở v0.1 không có mục khóa API nào, chỉ gồm đường dẫn ghi đè cho Claude Code và ffmpeg, thư mục tệp tạm, và ngôn ngữ giao diện với mặc định English và có sẵn Tiếng Việt. Đổi ngôn ngữ áp dụng tức thì. Toàn bộ bản vẽ trong tài liệu này minh họa ở ngôn ngữ giao diện Tiếng Việt.

### 1.7. Panel Nhật ký (Logs Panel, đáy màn hình)

- Trượt lên từ mép dưới canvas khi bật, cao mặc định 220 pixel, kéo được từ 120 pixel tới một nửa chiều cao màn hình. Canvas co lại tương ứng.
- Đầu panel: tiêu đề, bộ lọc theo khối dạng chip, ô tìm trong nhật ký, nút "Sao chép toàn bộ", nút "Xóa", nút đóng.
- Thân panel: các dòng nhật ký theo thứ tự thời gian, font đơn cách. Mỗi dòng gồm mốc thời gian chính xác tới mili giây, tên khối phát sinh với màu theo trạng thái của khối, và thông điệp. Dòng lỗi mang mã lỗi ổn định từ bảng mã lỗi tại Đặc tả Bộ Máy Thực Thi mục 6, để người dùng sao chép nguyên văn khi báo lỗi.
- Trong lúc kết xuất MP4, nhật ký kết xuất Remotion được đưa thẳng vào đây theo thời gian thực, song song với thanh tiến độ trên thân Khối Xuất MP4.
- Panel không tự bật khi có lỗi, để không cướp không gian làm việc. Lỗi mới chỉ báo bằng chấm đỏ trên tab Nhật ký ở dải trái.
- Nhật ký chỉ tồn tại trong phiên, tối đa 2.000 dòng, dòng cũ nhất bị đẩy ra.

### 1.8. Khối Tài Nguyên và Khối Xuất MP4 (Resource Nodes & Export Node)

Ba khối tài nguyên dùng chung một khuôn mẫu: không cổng nhận, một cổng phát, thân khối gồm dòng trạng thái từ `probe()`, tham số riêng và nút "Kiểm tra lại".

Khối Claude Code Provider:

- Cổng phát "Mô hình ngôn ngữ". Thân khối: phiên bản công cụ tìm thấy, dòng trạng thái "đã đăng nhập" chấm xanh hoặc "chưa đăng nhập" chấm vàng kèm đúng lệnh cần chạy trong terminal, và ô chọn model để trống là dùng mặc định.
- Không có ô nhập khóa. Người dùng chưa cài Claude Code thấy chấm vàng kèm liên kết cài đặt.

Khối System TTS Provider:

- Cổng phát "Giọng đọc". Thân khối: tên bộ tổng hợp của hệ điều hành, dòng trạng thái gồm cả việc tìm thấy ffmpeg hay chưa, hộp chọn giọng mặc định lấy từ danh sách hệ thống.
- Trên hệ điều hành chưa hỗ trợ, thân khối ghi rõ lý do và Khối Giọng Đọc nối vào tự khóa.

Khối Động Cơ (ví dụ Remotion Engine):

- Không có cổng nhận. Một cổng phát duy nhất "Động cơ".
- Thân khối: tên và phiên bản Adapter; dòng trạng thái lấy từ `probe()` với chấm xanh "sẵn sàng" hoặc chấm vàng kèm lý do; các tham số riêng của engine. Với Remotion là mức song song và backend đồ họa.
- Khối Hyperframes Engine ở v0.1 hiện chấm vàng "chưa sẵn sàng, v0.2" ngay trên thân, và mọi khối nối vào nó tự khóa theo khai báo đó.
- Đổi engine: kéo Khối Động Cơ khác từ Thư viện khối, nối dây "Động cơ" vào Khối Xuất Bản Video. Không có hộp chọn nào khác.

Khối Xuất MP4 (MP4 Export):

- Hai cổng nhận: "Bản đặc tả IR" và "Động cơ". Không có cổng phát.
- Thân khối ở trạng thái bỏ qua mặc định: ba dòng tham số gồm codec, chất lượng ba mức, tên tệp; nút "Kết xuất" chiếm hết bề ngang. Viền khối đứt nét và huy hiệu ghi "bỏ qua".
- Bấm Kết xuất: khối chuyển sang đang chạy, thân khối hiện thanh tiến độ theo phần trăm khung hình cùng nút Hủy, tab Nhật ký ở dải trái nhận dòng nhật ký kết xuất theo thời gian thực.
- Khi xong: thân khối hiện tên tệp, dung lượng và nút "Tải xuống". Trình duyệt tự tải tệp về, và mục kết xuất được gắn vào lần chạy tương ứng trong Lịch sử chạy.
- Nút Kết xuất bị vô hiệu hóa kèm chú giải khi một trong hai dây vào chưa có dữ liệu, khi engine nối vào khai báo chưa hỗ trợ kết xuất, hoặc khi một kiểu cảnh trong bản đặc tả không có renderer cho engine đó.
- Phím tắt `Ctrl` kèm `B` bật tắt trạng thái bỏ qua của khối đang chọn, áp dụng cho mọi khối, giống ComfyUI.

### 1.9. Khối Kịch Bản Tĩnh (Static Script)

Khối duy nhất của lõi cho phép dựng video hoàn toàn bằng tay, và là đồ thị nghiệm thu của Pha A.

- Hai cổng phát: "Kịch bản Phân cảnh" và "Lời thoại". Không cổng nhận.
- Thân khối: hộp chọn ngôn ngữ (mặc định English), ô văn bản nhiều dòng cho lời thoại, và danh sách cảnh. Mỗi cảnh là một hàng gồm hộp chọn kiểu cảnh (lấy từ scene registry, mặc định `core/title-card`), ô trọng số, và các ô nội dung sinh ra từ lược đồ của kiểu cảnh đã chọn. Nút thêm và xóa cảnh; kéo để đổi thứ tự.
- Mặc định ba cảnh `core/title-card` trọng số 1, 2, 1 với nội dung mẫu, để người dùng bấm Chạy Luồng là có video ngay.

## 2. Quy chuẩn Cấu trúc Khối Chức Năng (Node Anatomy)

Mọi khối chức năng trên không gian đồ thị đều tuân thủ bố cục chuẩn hóa.

### 2.1. Đầu Thẻ (Node Header)

- Biểu tượng nhận diện riêng cho từng khối lõi; gói tự khai báo biểu tượng cho khối của nó:
  - Tia sét: Khối Nhập Liệu.
  - Trang văn bản: Khối Kịch Bản Tĩnh.
  - Dấu nhắc dòng lệnh: Khối Nhà Cung Cấp Mô Hình Ngôn Ngữ.
  - Micro: Khối Nhà Cung Cấp Giọng Đọc.
  - Sóng âm: Khối Giọng Đọc.
  - Các lớp xếp chồng: Khối Đóng Gói Timeline.
  - Chip xử lý: Khối Động Cơ.
  - Màn hình phát: Khối Xuất Bản Video.
  - Mũi tên tải xuống: Khối Xuất MP4.
  - Gói GitHub Showcase: nhánh mã nguồn cho Truy Xuất Repo, người máy cho AI Đạo Diễn.
- Tên định danh của khối, chữ in hoa đậm, kích thước nhỏ gọn.
- Huy hiệu trạng thái xử lý ở góc trên bên phải. Với khối tài nguyên, huy hiệu Hoàn thành được phủ thêm lớp sẵn sàng: xanh lá "sẵn sàng" khi mọi năng lực đều có, vàng "chưa sẵn sàng" kèm lý do khi thiếu, theo Đặc tả Bộ Máy Thực Thi mục 1.1. Chín trạng thái của bộ máy được vẽ bằng bảy huy hiệu cộng hai lớp phủ, đúng theo cột "Huy hiệu" tại Đặc tả Bộ Máy Thực Thi mục 1: `cancelled` dùng chung huy hiệu cũ; `blocked` dùng huy hiệu chờ lượt khi bị chặn bởi khối phía trước, và viền vàng khi bị chặn vì năng lực của tham chiếu nhận vào; lớp phủ xanh lá hoặc vàng trên khối tài nguyên là trạng thái sẵn sàng:
  - Sẵn sàng: Nền xám mờ.
  - Đang chờ lượt: Nền xám kèm chữ "chờ". Áp dụng cho khối nằm sau một khối đang chạy; khi nguyên nhân là khối phía trước đang lỗi hoặc bị bỏ qua, huy hiệu mờ hơn và chú giải nêu tên khối chặn.
  - Đang chạy: Vòng xoay chuyển động kèm viền xanh dương nhấp nháy.
  - Hoàn thành: Viền xanh lá kèm thời gian thực thi, ví dụ "0.8s". Nếu kết quả được tái sử dụng từ lần chạy trước thay vì tính lại, huy hiệu ghi "Dùng lại" thay cho thời gian.
  - Cũ: Viền đứt nét mờ, dùng cho cả khối có cấu hình đã đổi lẫn khối bị hủy giữa chừng.
  - Lỗi: Viền đỏ kèm dấu chấm than cảnh báo.
  - Bỏ qua: Viền đứt nét mờ kèm chữ "bỏ qua". Khối không chạy theo Chạy Luồng. Mặc định của Khối Xuất MP4.

### 2.2. Thân Thẻ (Node Body)

Chứa các trường nhập liệu trực tiếp hoặc khu vực tóm tắt kết quả. Khối lõi:

- Khối Nhập Liệu: Hộp văn bản, kèm dòng đếm ký tự. Khối không diễn giải nội dung; khối truy xuất của gói nối vào sẽ hiện cách nó nhận diện.
- Khối Kịch Bản Tĩnh: Mô tả ở mục 1.9.
- Khối Nhà Cung Cấp Mô Hình Ngôn Ngữ, Khối Nhà Cung Cấp Giọng Đọc, Khối Động Cơ, Khối Xuất MP4: Mô tả ở mục 1.8.
- Khối Giọng Đọc: Hộp thả chọn giọng lấy từ danh sách mà nhà cung cấp đang nối khai báo, đã lọc theo ngôn ngữ của lời thoại đang vào, cùng thanh kéo tốc độ phát. Không có ô chọn ngôn ngữ: dòng nhãn mờ ghi "khớp ngôn ngữ kịch bản: en". Khi phải dùng giọng dự phòng, khối hiện huy hiệu vàng kèm lý do.
- Khối Đóng Gói Timeline: Tóm tắt tổng số khung hình, tốc độ khung hình, bảng phân bổ theo trọng số của từng cảnh, cảnh báo khi ngưỡng tối thiểu được kích hoạt, và dòng "đã đè N dữ kiện" khi có cổng Dữ kiện nối vào.
- Khối Xuất Bản Video: Chính là trình phát, mô tả đầy đủ ở mục 1.4. Không có cổng phát.

Thân khối của gói được mô tả trong tài liệu gói; ví dụ tại `packs/github-showcase.md` mục 2 và 3.

### 2.3. Cổng Kết Nối (Connection Ports)

- Cổng nhận dữ liệu nằm ở mép viền bên trái khối; cổng phát dữ liệu nằm ở mép viền bên phải.
- Mỗi cổng tròn đều có nhãn chữ mờ cạnh bên chỉ dẫn loại dữ liệu tương ứng, dùng đúng nhãn hiển thị đã quy định trong bảng kiểu cổng: "Dữ liệu Nguồn", "Dữ kiện", "Kịch bản Phân cảnh", "Lời thoại", "Âm thanh & Thời lượng", "Bản đặc tả IR", "Động cơ", "Mô hình ngôn ngữ", "Giọng đọc".
- Khi người dùng bắt đầu kéo một dây nối, toàn bộ cổng có kiểu tương thích trên canvas sáng lên, các cổng không tương thích mờ đi. Thả dây vào cổng không tương thích sẽ khiến dây bật ngược trở lại kèm chú giải ngắn nêu rõ kiểu đang kéo và kiểu mà cổng đó yêu cầu.

## 3. Các Luồng Trải Nghiệm Người Dùng Chi Tiết (User Interaction Flows)

### Kịch bản A: Dựng Video Bằng Kịch Bản Tĩnh (Pha A, không mạng)

1. Người dùng mở studio lần đầu; đồ thị "Kịch Bản Tĩnh" bảy khối hiện ra đã nối dây: Kịch Bản Tĩnh, System TTS Provider, Giọng Đọc, Đóng Gói Timeline, Remotion Engine, Xuất Bản Video, Xuất MP4. Hai khối tài nguyên tự probe và báo sẵn sàng. Không cần mạng, không cần khóa.
2. Người dùng sửa lời thoại và ba cảnh `core/title-card` mẫu ngay trên Khối Kịch Bản Tĩnh, hoặc giữ nguyên nội dung mẫu.
3. Bấm Chạy Luồng. Kịch Bản Tĩnh phát Kịch bản Phân cảnh và Lời thoại; Giọng Đọc tạo MP3 qua `say` và đo thời lượng; Đóng Gói Timeline chia khung hình theo trọng số 1, 2, 1, kiểm định IR; Xuất Bản Video phát ngay trong khối. Xuất MP4 không chạy.
4. Người dùng bấm Phát, tua bằng thanh trượt, nhảy cảnh bằng Thanh tra Phân cảnh.
5. Bấm Kết xuất trên Xuất MP4 để lấy tệp.

Kịch bản này là toàn bộ phạm vi nghiệm thu của Pha A. Đổi engine (thay khối), tinh chỉnh tham số cục bộ (đổi tốc độ đọc, chỉ Giọng Đọc và phía sau chạy lại) và đổi ngôn ngữ (đổi `language` trên Kịch Bản Tĩnh, giọng tự khớp) đều thực hiện được trên đồ thị này với cùng cơ chế mô tả tại Đặc tả Bộ Máy Thực Thi.

Các kịch bản có dữ liệu thật (dán link repo, gọi mô hình ngôn ngữ, đổi ngôn ngữ kịch bản do AI viết) thuộc gói GitHub Repo Showcase, tại `packs/github-showcase.md` mục 5.

### Kịch bản 4: Xây Dựng Luồng Mới từ Bản Vẽ Trống (Custom Pipeline Flow)

1. Người dùng bấm tab "Bản mẫu" ở đầu dải trái, chọn "Canvas trống" ở cột trái của Trình duyệt Bản mẫu. Hệ thống hỏi xác nhận vì thao tác này xóa toàn bộ đồ thị hiện tại, sau đó dọn sạch canvas.
2. Người dùng mở panel Thư viện khối từ dải trái, tìm và kéo thả từng khối lên canvas.
3. Người dùng nhấp giữ chuột từ cổng xuất của khối nguồn, kéo đường dây liên kết và thả vào cổng nhận của khối kế tiếp. Dây liên kết tự động khóa dính và phát sáng khi kết nối hợp lệ.
4. Trong lúc dựng, kiểm tra đồ thị chạy liên tục. Chừng nào còn cổng nhận bắt buộc chưa được nối, các khối liên quan viền vàng kèm thông báo nêu đúng tên cổng còn thiếu, và nút Chạy Luồng bị vô hiệu hóa; nối đủ dây là nút sáng lại.
5. Người dùng cấu hình nội dung cho các khối và nhấn "Chạy Luồng" để thử nghiệm quy trình do mình tự thiết kế.

### Kịch bản 5: Xử Lý Ngoại Lệ & Báo Lỗi Trực Quan (Error Handling)

Nguyên tắc chung: lỗi luôn được gắn vào đúng khối gây ra nó, không bao giờ hiển thị dưới dạng thông báo toàn cục trôi nổi. Mọi khối nằm sau khối lỗi dừng ở trạng thái chờ lượt và giữ nguyên kết quả cũ nếu có.

1. Thiếu thông tin đầu vào: ô văn bản ở Khối Nhập Liệu trống thuộc kiểm tra liên tục như 4b. Khối Nhập Liệu viền vàng với "Vui lòng nhập nội dung trước khi chạy" và nút Chạy Luồng bị vô hiệu hóa ngay khi ô trống, không có bước bấm rồi mới báo.
2. Khối của gói gặp lỗi từ nguồn ngoài (repo không tồn tại, vượt hạn mức): khối đó viền đỏ với thông báo cụ thể và nút "Thử lại riêng khối này"; phía sau chờ. Chi tiết từng lỗi tại tài liệu gói, ví dụ `packs/github-showcase.md` mục 6.
4. Nhà cung cấp chưa sẵn sàng: Khối System TTS Provider chuyển vàng với thông báo "Thiếu ffmpeg" kèm nguyên văn lệnh cài và nút Kiểm tra lại; Khối Giọng Đọc nối vào bị chặn với viền vàng nêu cùng lý do và cách khắc phục, không tiến trình nào được sinh ra. Tương tự với Khối Claude Code Provider khi chưa đăng nhập, thông báo nêu lệnh đăng nhập.
4b. Chưa nối nhà cung cấp: kiểm tra đồ thị chạy liên tục mỗi khi đồ thị thay đổi, không đợi tới lúc bấm. Ngay khi dây bị tháo, Khối Giọng Đọc viền vàng với "Chưa nối khối Nhà Cung Cấp vào cổng Giọng đọc" và nút Chạy Luồng bị vô hiệu hóa kèm chú giải nêu tên khối và cổng còn thiếu. Không tồn tại thời điểm "bấm rồi mới biết".
5. Bản đặc tả không qua kiểm định (`IR_INVALID`): Khối Đóng Gói Timeline viền đỏ nêu đúng bất biến bị vi phạm; đây là lỗi lập trình, thông báo mời người dùng sao chép nhật ký để báo lỗi.
6. Nhà cung cấp gặp sự cố khi chạy: tiến trình con thoát với lỗi, Khối Giọng Đọc (hoặc khối đạo diễn của gói) chuyển viền đỏ kèm dòng cuối của đầu ra lỗi. Nút "Thử lại riêng khối này" xuất hiện trực tiếp trên thẻ, cho phép chạy lại mà không làm mất kịch bản đã sinh ra trước đó.
7. Chênh lệch tính năng giữa các Engine: Khi Adapter phải thay một hiệu ứng không dựng được bằng hiệu ứng cơ bản, Khối Video Output hiển thị huy hiệu vàng ở đầu khối kèm nội dung "Hiệu ứng chuyển cảnh phức tạp đã được thay bằng hiệu ứng mờ dần cơ bản". Đây là cảnh báo mức thông tin, không chặn luồng.
7b. Kiểu cảnh không có renderer cho engine đang nối: Khối Xuất Bản Video `blocked` viền vàng với "Remotion không có renderer cho `pack-x/scene-y`", nút Chạy Luồng vẫn hoạt động cho phần còn lại của đồ thị.
8. Kết xuất MP4 thất bại: Khối Xuất MP4 chuyển viền đỏ kèm thông báo thân thiện "Kết xuất video thất bại" và nút thử lại riêng; mã `EXPORT_FAILED` chỉ xuất hiện trong phần chi tiết mở rộng và trong Panel Nhật ký, đúng quy tắc tại Đặc tả Bộ Máy Thực Thi mục 6; nhật ký kết xuất nằm nguyên trong Panel Nhật ký để người dùng sao chép khi báo lỗi. Bản Đặc Tả Video Trung Gian vẫn được giữ nguyên nên bấm Kết xuất lại không cần chạy lại luồng.
9. Kết xuất khi engine chưa hỗ trợ: nút Kết xuất bị vô hiệu hóa từ trước, không có lỗi phát sinh. Chú giải trên nút nêu đúng lý do do Adapter khai báo.

## 4. Phím Tắt (Keyboard Shortcuts)

Tập phím tắt tối thiểu của v0.1, chỉ có hiệu lực khi tiêu điểm không nằm trong một ô nhập liệu. `Ctrl` ở đây hiểu là `Cmd` trên macOS; giao diện hiển thị đúng ký hiệu theo hệ điều hành đang chạy:

- Chạy luồng: `Ctrl` kèm `Enter`.
- Căn giữa đồ thị: phím `F`.
- Phóng to và thu nhỏ: phím `+` và `-`.
- Xóa khối hoặc dây nối đang chọn: phím `Delete`.
- Hoàn tác và làm lại thao tác trên đồ thị: `Ctrl` kèm `Z`, và `Ctrl` kèm `Shift` kèm `Z`.
- Phát và tạm dừng trình phát trong Khối Video Output: phím `Space`.
- Mở Trình duyệt Bản mẫu: phím `T`. Mở Thư viện khối: phím `N`. Mở Lịch sử chạy: phím `H`. Bật tắt Panel Nhật ký: `Ctrl` kèm `J`. Mở Cài đặt: `Ctrl` kèm `,`. Đóng panel hoặc cửa sổ đang mở: `Esc`.
- Bật tắt bỏ qua khối đang chọn: `Ctrl` kèm `B`.
