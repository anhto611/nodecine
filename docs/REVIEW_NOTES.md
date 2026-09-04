# Biên bản Rà soát Tài liệu - Ngày 4 tháng 9 năm 2026

Ghi lại toàn bộ mâu thuẫn và lỗ hổng phát hiện được trong ba tài liệu gốc, cách xử lý từng mục, và các câu hỏi còn để ngỏ. Mục đích là để sau này đọc lại còn biết vì sao đặc tả được viết như hiện tại.

Bản sao ba tài liệu trước khi sửa nằm ở thư mục `docs.bak/`.

---

## A. Mâu thuẫn trực tiếp giữa các tài liệu

### A1. Mức độ hoàn thiện của Hyperframes Adapter

Tài liệu Yêu cầu Sản phẩm mục 4.3 mô tả Hyperframes là khung adapter sẵn sàng mở rộng, tức chưa chạy được. Kịch bản 2 trong Đặc tả Luồng Trải nghiệm lại mô tả người dùng chuyển sang Hyperframes và xem trước lẫn kết xuất MP4 đều hoạt động. Hai mô tả loại trừ lẫn nhau.

Xử lý: chốt theo hướng khung xương. Kịch bản 2 được viết lại thành mô tả hành vi giới hạn có chủ đích, gồm lớp phủ thông báo và nút xuất bị vô hiệu hóa. Bổ sung thêm khái niệm mức hỗ trợ do chính Adapter khai báo, để giao diện không phải kiểm tra tên engine bằng mã cứng.

### A2. Số lượng bản mẫu trong phạm vi v0.1

Tài liệu Yêu cầu Sản phẩm chỉ đưa một bản mẫu vào phạm vi. Đặc tả Luồng Trải nghiệm liệt kê khoảng mười bản mẫu qua bốn danh mục mà không nói mục nào chạy được.

Xử lý: giữ nguyên danh sách đầy đủ để bộc lộ tầm nhìn sản phẩm, nhưng ghi rõ ở cả hai tài liệu rằng chỉ hai mục hoạt động ở v0.1, phần còn lại làm mờ kèm nhãn "Sắp có".

### A3. Số lượng khối chức năng

Tài liệu Yêu cầu Sản phẩm quy định bộ 5 khối, trong đó Khối Nhập Liệu vừa nhận dữ liệu người dùng vừa được ngầm hiểu là nơi lấy nội dung repo về.

Xử lý: tách thành bộ 6 khối, bổ sung Khối Truy Xuất Repo. Lý do đầy đủ ghi ở mục B1.

### A4. Khối Video Output và Live Preview Dock cùng làm một việc

Tên đầy đủ của khối thứ sáu trong Tài liệu Yêu cầu Sản phẩm là "Khối Xuất Bản & Trình Chiếu (Video Output & Player)", tức khối tự nhận là trình phát. Nhưng Đặc tả Luồng Trải nghiệm lại mô tả thêm một khung xem trước riêng chiếm 35% chiều rộng với đầy đủ nút phát, thanh trượt và thanh tra phân cảnh. Hai nơi cùng hiển thị một thứ. Phát hiện này đến từ người dùng khi xem bản thiết kế giao diện, không phải từ vòng rà soát đầu.

Xử lý: bỏ hẳn khung xem trước riêng, đưa toàn bộ trình phát vào thân Khối Video Output theo mô hình khối PreviewImage của ComfyUI. Canvas chiếm trọn chiều rộng. Cách này khớp nguyên tắc 1 của Tài liệu Yêu cầu Sản phẩm, đồng thời mở đường cho việc đặt hai khối Output cạnh nhau để so sánh engine ở phiên bản sau. Cùng đợt, hộp thả xuống chọn bản mẫu được thay bằng cửa sổ Trình duyệt Bản mẫu có ảnh xem trước, cũng theo mô hình ComfyUI.

### A5. Engine Switcher và nút Xuất MP4 trên thanh điều hướng đặt sai chỗ

Sau khi đã chấp nhận rằng trình phát là một khối, hai thứ còn lại trên thanh điều hướng lộ ra cùng một vấn đề: chúng là tài sản của khối chứ không phải của dự án. Nút Xuất MP4 phải nhìn trộm trạng thái Khối Video Output để biết lúc nào tự khóa, và hộp chọn engine toàn cục khiến việc đặt hai khối Output so sánh hai engine trở thành bất khả thi. Tài liệu gốc mục 2.2 thực ra đã viết "Khối Xuất Bản Video: Lựa chọn Adapter Engine đích", tức ý ban đầu đã đúng.

Xử lý theo đúng mô hình ComfyUI: engine thành Khối Động Cơ phát tham chiếu `EngineRef` (tương đương Load Checkpoint), kết xuất thành Khối Xuất MP4 bỏ qua mặc định (tương đương SaveImage, nhưng không tự chạy vì kết xuất tốn hàng chục giây). Đồ thị mặc định từ 6 lên 8 khối, 7 lên 10 dây. Thanh điều hướng còn ba nút ở thời điểm đó, sau rút xuống một (xem mục F). Máy trạng thái thêm `bypassed`; cơ chế "chạy riêng một khối" vốn dùng cho nút thử lại nay được tổng quát hóa để phục vụ nút Kết xuất.

### A6. Nhà cung cấp API là thứ cuối cùng còn ngầm

Sau khi engine và kết xuất đã thành khối, AI Đạo Diễn và Giọng Đọc vẫn ngầm gọi ra ngoài tới một nhà cung cấp mã hóa cứng, với khóa nằm trong Cài đặt. Nhà cung cấp có đúng ba tính chất đã khiến engine thành khối: tham số riêng, dùng chung, và đổi phải nhìn thấy trên đồ thị. Đây cũng chính là đường nối cho việc thêm mô hình chạy cục bộ trên GPU sau này.

Xử lý: thêm Khối Nhà Cung Cấp Mô Hình Ngôn Ngữ và Khối Nhà Cung Cấp Giọng Đọc, cùng khuôn mẫu với Khối Động Cơ. Quyết định thực dụng đi kèm, do người dùng đề xuất: v0.1 không dùng khóa API. Nhà cung cấp mô hình ngôn ngữ gọi công cụ dòng lệnh Claude Code đã đăng nhập sẵn trên máy; nhà cung cấp giọng đọc dùng bộ tổng hợp của hệ điều hành. Ứng dụng vì thế đạt Zero-Key ngay từ v0.1, và các nhà cung cấp qua API trở thành khối cùng nhóm ở v0.2. Đồ thị mặc định lên 10 khối, 12 dây.

Giả định cần người dùng xác nhận: giọng đọc hệ thống (macOS `say`) chất lượng vừa phải, chấp nhận được cho MVP vì đổi sang nhà cung cấp tốt hơn chỉ là đổi khối.

---

## B. Lỗ hổng dữ liệu khiến bản mẫu không dựng được

### B1. Không có nguồn cho số sao và lệnh cài đặt

Tài liệu Yêu cầu Sản phẩm mục 4.4 yêu cầu Cảnh 1 hiển thị huy hiệu Star nảy chuyển động và Cảnh 2 hiển thị lệnh cài đặt. Nhưng lược đồ đầu ra của Khối AI Đạo Diễn không có trường nào chứa hai giá trị này, và cũng không có khối nào trong đồ thị đi lấy chúng về. Nếu cứ thế cài đặt, lập trình viên chỉ còn hai lựa chọn, đều tệ: để mô hình ngôn ngữ bịa ra một con số, hoặc hiển thị số 0.

Đây là lỗ hổng nghiêm trọng nhất tìm thấy, vì nó tạo ra rủi ro đăng video công khai chứa số liệu sai sự thật.

Xử lý gồm bốn phần:

1. Bổ sung Khối Truy Xuất Repo làm khối thứ hai trong luồng, gọi GitHub API công khai để dựng Hồ Sơ Repo.
2. Định nghĩa đầy đủ lược đồ Hồ Sơ Repo, gồm số sao, mô tả, chủ đề, ngôn ngữ chính, trích đoạn README, lệnh cài đặt và mốc thời gian truy xuất.
3. Nối một dây riêng từ Khối Truy Xuất Repo thẳng tới Khối Đóng Gói Timeline, không đi qua Khối AI Đạo Diễn. Nhờ vậy, ràng buộc "dữ kiện kiểm chứng được không đi xuyên qua mô hình ngôn ngữ" trở thành ràng buộc cấu trúc của đồ thị chứ không còn là quy ước dễ bị vi phạm.
4. Loại bốn trường số sao, lệnh cài đặt, đường dẫn repo và tên chủ sở hữu ra khỏi phạm vi sáng tác của mô hình ngôn ngữ, kèm một bài kiểm thử bắt buộc khẳng định điều đó.

### B2. Chưa định nghĩa hành vi khi thiếu dữ liệu

Lược đồ gốc không nói gì về trường hợp repo có 0 sao, repo không có lệnh cài đặt, hay người dùng dán văn bản thô thay vì đường dẫn.

Xử lý: bổ sung bảng quy tắc thay thế trong Hợp đồng Lõi mục 5.4, và chế độ đi qua cho Khối Truy Xuất Repo.

### B3. Không có ranh giới ngôn ngữ đo thời lượng âm thanh

Bản gốc chỉ nói cần thời lượng chính xác tới hai chữ số thập phân, không nói lấy từ đâu. Nhiều nhà cung cấp giọng đọc trả về thời lượng ước lượng lệch so với tệp thực tế, và sai lệch này sẽ đẩy hình lệch tiếng.

Xử lý: quy định rõ thời lượng phải được đo lại từ chính tệp âm thanh đã tạo.

---

## C. Điểm mơ hồ dẫn tới cài đặt sai

### C1. Quy tắc làm tròn khung hình

Bản gốc quy định Cảnh 1 và Cảnh 2 chiếm 25% và 50% tổng số khung hình, làm tròn tới số nguyên gần nhất. Cách diễn đạt này không xác định được kết quả khi giá trị rơi đúng giữa hai số nguyên, mà tình huống đó xảy ra thường xuyên với tổng số khung hình lẻ.

Xử lý: đổi sang làm tròn xuống cho hai cảnh đầu và dồn toàn bộ phần dư cho cảnh cuối. Cách này loại bỏ mơ hồ, đảm bảo tổng ba cảnh luôn khớp tuyệt đối, và phần dư dồn cho Cảnh 3 luôn nhỏ hơn hai khung hình. Bổ sung hai ví dụ đối chiếu, trong đó có một ví dụ kích hoạt ngưỡng thời lượng tối thiểu.

### C2. Ngưỡng tối thiểu 270 khung hình tạo ra đoạn hình không tiếng

Bản gốc quy định khi âm thanh ngắn hơn 9 giây thì video vẫn dài 270 khung hình, nhưng không nói phần chênh lệch đó xảy ra chuyện gì. Người cài đặt rất dễ tưởng là lỗi và tự ý cắt video theo độ dài âm thanh.

Xử lý: đặt tên cho hiện tượng này là phần đuôi không tiếng, đưa vào Bản Đặc Tả Video Trung Gian dưới dạng một trường riêng, và cho Thanh tra Phân cảnh vẽ vạch đánh dấu thời điểm âm thanh kết thúc.

### C3. Tính tương thích cổng chưa có định nghĩa

Đặc tả Luồng Trải nghiệm nói người dùng chỉ nối được vào cổng tương thích, nhưng không tài liệu nào định nghĩa thế nào là tương thích.

Xử lý: bổ sung hệ thống kiểu cổng, ban đầu sáu định danh và nay là chín, quy tắc khớp tuyệt đối không ép kiểu ngầm, ràng buộc một cổng nhận chỉ có một dây tới, và hành vi giao diện khi kéo dây.

### C4. Tuyên bố không phụ thuộc đám mây dễ bị hiểu thành không có máy chủ

Tài liệu Yêu cầu Sản phẩm nói mọi thứ chạy cục bộ và không phụ thuộc hạ tầng đám mây, đồng thời yêu cầu kết xuất MP4. Nhưng Remotion bắt buộc cần tiến trình Node điều khiển headless Chromium, không thể chạy thuần trong trình duyệt.

Xử lý: bổ sung đoạn làm rõ trong mục Non-Goals rằng điều bị loại trừ là máy chủ tập trung do đội ngũ NodeCine vận hành, không phải mọi loại máy chủ. Toàn bộ mô hình triển khai được viết thành tài liệu Kiến trúc Hệ thống riêng.

---

## D. Lỗ hổng đặc tả đã bổ sung bằng tài liệu mới

Những phần dưới đây hoàn toàn không tồn tại trong ba tài liệu gốc, nhưng bắt buộc phải có trước khi viết dòng mã đầu tiên:

| Hạng mục | Vì sao cần | Đã đưa vào |
| --- | --- | --- |
| Mô hình triển khai và ranh giới máy khách với máy chủ | Không có nó thì không ai biết viết mã ở đâu | `ARCHITECTURE.md` mục 1 |
| Cấu trúc thư mục và quy tắc phụ thuộc | Nếu tầng lõi lỡ nhập mã Remotion, tuyên bố độc lập engine sụp đổ | `ARCHITECTURE.md` mục 2 |
| Đường đi và vòng đời khóa API | Liên quan trực tiếp tới cam kết quyền riêng tư | `ARCHITECTURE.md` mục 4 |
| Phòng vệ điểm cuối chuyển tiếp | Máy chủ nhận đường dẫn từ đồ thị, mà đồ thị có thể do người khác chia sẻ | `ARCHITECTURE.md` mục 5 |
| Máy trạng thái của khối | Đặc tả gốc chỉ có bốn trạng thái hiển thị, thiếu trạng thái chờ và trạng thái cũ | `EXECUTION_ENGINE.md` mục 1 |
| Cơ chế chạy lại từng phần | Kịch bản 3 mô tả kết quả nhưng không mô tả cách hệ thống biết được điều đó | `EXECUTION_ENGINE.md` mục 3 |
| Chính sách thời gian chờ và thử lại | Ba khối có gọi mạng, không có chính sách thì mỗi khối làm một kiểu | `EXECUTION_ENGINE.md` mục 5 |
| Bảng mã lỗi | Đặc tả gốc mô tả lỗi bằng câu chữ, không có mã ổn định để cài đặt và kiểm thử | `EXECUTION_ENGINE.md` mục 6 |
| Lược đồ lưu trữ cục bộ và nâng cấp phiên bản | Đặc tả gốc nói lưu vào bộ nhớ trình duyệt nhưng không nói lưu cái gì | `EXECUTION_ENGINE.md` mục 7 |
| Tiêu chí nghiệm thu | Không có tiêu chí thì không có mốc kết thúc cho v0.1 | `PRD.md` mục 6 |
| Chỉ tiêu phi chức năng | Trình duyệt hỗ trợ, độ mượt, thời gian kết xuất tham chiếu | `PRD.md` mục 7 |
| Trạng thái rỗng và trạng thái chờ của khung xem trước | Đặc tả gốc chỉ mô tả trạng thái đã có kết quả | `USER_FLOWS_AND_WIREFRAMES.md` mục 1.4 |
| Phím tắt | Sản phẩm dành cho lập trình viên mà không có phím tắt là thiếu sót | `USER_FLOWS_AND_WIREFRAMES.md` mục 4 |
| Ranh giới kiểm thử bắt buộc | Ba nhóm kiểm thử bảo vệ đúng ba bất biến quan trọng nhất | `EXECUTION_ENGINE.md` mục 9 |

---

## E. Câu hỏi Còn Để Ngỏ

Những mục dưới đây chưa cản trở việc bắt đầu viết mã, nhưng cần chốt trước khi hoàn thiện v0.1.

### E1. Ngôn ngữ của video đầu ra — đã chốt

Đã giải quyết: ngôn ngữ của video là tham số của Khối AI Đạo Diễn, mặc định tiếng Anh, và đi theo dữ liệu qua cổng `AudioScript` tới Khối Giọng Đọc, nơi giọng được chọn tự động theo ngôn ngữ. Giao diện đa ngôn ngữ ngay từ v0.1, mặc định tiếng Anh kèm tiếng Việt. Hai tầng ngôn ngữ độc lập. Nội dung gốc của câu hỏi giữ lại bên dưới để đối chiếu.

Đây là câu hỏi tồn đọng đáng chú ý nhất. Không tài liệu nào nói lời thoại và chữ trên màn hình dùng ngôn ngữ gì. Giao diện Studio đã chốt là tiếng Việt, nhưng đối tượng xem của một video quảng bá dự án mã nguồn mở trên X và TikTok phần lớn dùng tiếng Anh. Hai lựa chọn dẫn tới hai hướng khác nhau về lựa chọn giọng đọc, về chỉ dẫn cho mô hình ngôn ngữ và về xử lý dấu tiếng Việt trong font monospace. Cần chốt sớm.

### E2. Nhà cung cấp mô hình ngôn ngữ và giọng đọc bắt buộc cho v0.1 — đã chốt

Đã giải quyết tại A6: Claude Code CLI cho mô hình ngôn ngữ, bộ tổng hợp hệ điều hành cho giọng đọc, không khóa API. Điểm còn để ngỏ: chất lượng giọng hệ thống có đủ cho video đăng công khai hay không, hay cần đưa một nhà cung cấp đám mây vào sớm hơn v0.2.

### E3. Không có nhạc nền trong Bản Đặc Tả Video Trung Gian

Rãnh âm thanh hiện chỉ có giọng đọc. Video ngắn trên nền tảng mạng xã hội thường có nhạc nền, và nhóm người dùng sáng tạo nội dung không lộ mặt nêu trong Tài liệu Yêu cầu Sản phẩm gần như chắc chắn cần tới nó. Đây có thể là quyết định có chủ đích để giữ phạm vi v0.1 gọn, nhưng cần ghi rõ là có chủ đích, đồng thời cân nhắc để rãnh âm thanh có chỗ mở rộng ngay từ bây giờ, vì thêm rãnh vào sau sẽ phải sửa cả hai Adapter.

### E4. Font monospace cụ thể và giấy phép sử dụng — đã chốt

Đã giải quyết: JetBrains Mono, giấy phép SIL Open Font License 1.1, cho phép nhúng và phân phối lại. Font được đóng gói cục bộ trong kho mã cho cả video (kết xuất tất định, không phụ thuộc mạng) lẫn giao diện Studio; Google Fonts chỉ dùng trong bản vẽ thiết kế, không dùng lúc chạy. Ghi tại Tài liệu Yêu cầu Sản phẩm mục 7 và Kiến trúc Hệ thống mục 2. Nội dung gốc giữ bên dưới.

#### Nội dung gốc

Phong cách hiển thị đã chốt là font monospace, nhưng chưa chọn font nào. Font phải được nhúng kèm để bảo đảm kết xuất tất định, nên giấy phép phân phối lại là điều kiện bắt buộc phải kiểm tra.

### E5. Ràng buộc hợp lệ của đồ thị tự dựng từ canvas trống — đã chốt

Đã giải quyết tại Đặc tả Bộ Máy Thực Thi mục 2 và 6: nhiều khối đích là hợp lệ (cần cho việc so sánh engine), không có khối đích nào chỉ là cảnh báo `GRAPH_NO_SINK`. Nội dung gốc giữ bên dưới.

#### Nội dung gốc

Kịch bản 4 cho phép người dùng tự lắp đồ thị. Hiện đặc tả mới quy định kiểm tra chu trình và kiểm tra cổng nhận còn trống. Chưa quy định điều gì xảy ra khi đồ thị hợp lệ về kiểu nhưng không có Khối Xuất Bản Video, hay khi có hai Khối Xuất Bản Video cùng lúc. Đề xuất cho v0.1: yêu cầu đúng một Khối Xuất Bản Video, và báo lỗi mức đồ thị nếu không thỏa.

---

## F. Bổ sung Sau Khi Duyệt Thiết kế Giao diện

Ba thành phần dưới đây được thêm vào phạm vi v0.1 sau khi đối chiếu bản thiết kế với mô hình giao diện của ComfyUI. Chúng không có trong ba tài liệu gốc.

| Thành phần | Vì sao thêm | Đã đưa vào |
| --- | --- | --- |
| Dải trái với Thư viện khối | Kịch bản 4 cần chỗ để thêm khối; nút cộng ở thanh công cụ đáy không đủ chỗ cho tên, mô tả và nhãn cổng | `USER_FLOWS_AND_WIREFRAMES.md` mục 1.6 |
| Lịch sử chạy trong phiên | So sánh hai bản dựng mà không chạy lại; giữ đúng quy tắc không lưu bền bằng cách chỉ giữ trong bộ nhớ | `USER_FLOWS_AND_WIREFRAMES.md` mục 1.6, `EXECUTION_ENGINE.md` mục 8.1 |
| Panel Nhật ký ở đáy | Docs đã yêu cầu giữ nhật ký kết xuất để sao chép khi báo lỗi nhưng chưa nói hiện ở đâu | `USER_FLOWS_AND_WIREFRAMES.md` mục 1.7, `EXECUTION_ENGINE.md` mục 8.2 |
| Khối Động Cơ | Engine có tham số riêng, dùng chung, và đổi engine phải nhìn thấy trên đồ thị | `PRD.md` mục 4.2, `DATA_CONTRACT_SCHEMA.md` mục 9, `USER_FLOWS_AND_WIREFRAMES.md` mục 1.8 |
| Khối Xuất MP4 bỏ qua mặc định | Tham số kết xuất cần nhà riêng; nhiều cấu hình xuất là nhiều khối; không tự chạy vì tốn thời gian | `PRD.md` mục 4.2, `DATA_CONTRACT_SCHEMA.md` mục 10, `EXECUTION_ENGINE.md` mục 1 và 3 |
| Header tối giản | Mọi điều hướng gom về dải trái như ComfyUI; header chỉ giữ thứ phải thấy ở mọi trạng thái là nút Chạy Luồng | `USER_FLOWS_AND_WIREFRAMES.md` mục 1.1 và 1.6 |
| Khối Nhà Cung Cấp, Zero-Key | Không khối xử lý nào được ngầm gọi ra ngoài; v0.1 tận dụng Claude Code đã đăng nhập và giọng hệ thống | `PRD.md` mục 4.2 và 4.7, `DATA_CONTRACT_SCHEMA.md` mục 11, `ARCHITECTURE.md` mục 4 |

Những gì của ComfyUI được cân nhắc nhưng cố ý không đưa vào v0.1: Model Library (chưa có mô hình cục bộ nào để liệt kê, sẽ có nghĩa khi thêm worker GPU), Workflows (v0.1 một dự án một tab), panel thuộc tính bên phải (tham số đã là widget trong khối), và selection toolbox nổi trên khối đang chọn.

---

## G. Tách Lõi Khỏi Gói Bản Mẫu

Phát hiện từ người dùng sau bốn vòng rà soát: docs dành khoảng 40% dung lượng cho bản mẫu GitHub Showcase, và quan trọng hơn, bản mẫu đã rò rỉ vào hợp đồng lõi. Bản Đặc Tả Video Trung Gian, thứ được gọi là universal, mã hóa cứng ba kiểu cảnh Hook, Mockup, CTA, đúng ba cảnh, và chủ đề developer-dark. Bản mẫu thứ hai sẽ phải sửa lược đồ IR và cả hai Adapter, tức bất biến số 1 chỉ đúng với một bản mẫu. Cả bốn vòng rà soát trước đều không thấy vì chúng đối chiếu tài liệu với nhau, không đối chiếu với câu hỏi "bản mẫu thứ hai sẽ đụng đâu".

Xử lý:

- `DATA_CONTRACT_SCHEMA.md` tách thành `CORE_CONTRACTS.md` (khung) và `packs/github-showcase.md` (gói). Không chi tiết nào bị xóa, chỉ dời chỗ.
- IR trở thành generic: `sceneType` là chuỗi tra trong scene registry, cùng pattern với registry engine và nhà cung cấp; `timeline` bất kỳ số cảnh; `theme` là chuỗi do gói định nghĩa. Lõi ship kiểu cảnh `core/title-card` để tự chạy được.
- Dữ kiện đi qua cổng generic `FactSheet` với cơ chế `factBindings` trên `DirectorPlan`; Khối Đóng Gói Timeline generic phân bổ theo trọng số. Bất biến số 2 và 3 giờ do lõi bảo vệ bằng cấu trúc và hàm kiểm định, gói chỉ khai báo.
- Thêm khối Kịch Bản Tĩnh: dựng video hoàn toàn bằng tay, không mạng, không mô hình ngôn ngữ. Đây là đồ thị nghiệm thu của Pha A.
- Trình tự Pha A (khung, bảy khối) rồi Pha B (gói, mười khối) ghi vào PRD với hai bộ tiêu chí nghiệm thu riêng.

Mã lỗi và thời gian chờ riêng của gói (`REPO_*`, `LLM_SCHEMA_INVALID`, `LLM_LANGUAGE_MISMATCH`) chuyển sang tài liệu gói; lõi thêm `IR_INVALID` và `ENGINE_SCENE_UNSUPPORTED`.
