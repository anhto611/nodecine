# Thẻ Trích Dẫn

Bản mẫu nhận một chủ đề, dùng Biên Kịch tạo thẻ mở đầu và nhiều cảnh trích dẫn, sau đó Họa Sĩ vẽ từng cảnh theo một brief giấy sáng và typography giàu tính biên tập.

Số cảnh thay đổi bằng `count` của beat. Bản mẫu không cần `FactSheet`; vì vậy Đóng Gói Timeline không được cảnh báo thiếu dữ kiện. Nội dung trích dẫn và attribution nằm trực tiếp trong `SceneScript`, còn CSS, bố cục và chuyển động được tạo ở thời điểm chạy.

Tiêu chí nghiệm thu:

- đổi số lượng trích dẫn làm thay đổi đúng số cảnh;
- tổng frame luôn khớp thời lượng voice-over;
- mọi cảnh dùng chung ngôn ngữ hình ảnh;
- thay HyperFrames bằng engine chưa hỗ trợ phải chặn ở output, không chạy lại nội dung.
