# GitHub Repo Showcase

Bản mẫu nhận URL repository, lấy dữ kiện thật từ GitHub, viết lời giới thiệu và dựng video dọc cho lập trình viên.

`core/github-fetcher` phát `FactSheet`; `core/screenwriter` tạo `SceneScript` nhưng không được viết các giá trị đã bind như số sao, tên repo hay lệnh cài. `core/illustrator` đọc từng cảnh và brief phong cách developer để tạo CSS chung cùng HTML hoàn chỉnh. Đóng Gói Timeline mới gắn dữ kiện thật vào các phần tử `data-fact`.

Chuỗi chính:

`Nhập Liệu → Truy Xuất Repo → Biên Kịch → Họa Sĩ → Đóng Gói Timeline → HyperFrames`

TTS, căn mốc từ, phụ đề và nhạc nền nối vào nhánh âm thanh trước Đóng Gói Timeline.

Tiêu chí nghiệm thu:

- dữ kiện đã bind không đi qua mô hình;
- narration theo cảnh quyết định thời điểm cắt;
- thay brief chỉ chạy lại Họa Sĩ và phần phía sau;
- đổi engine không chạy lại các node nội dung;
- HyperFrames preview và xuất MP4 dùng cùng IR.
