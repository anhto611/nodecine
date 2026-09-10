# Ảnh Tĩnh Ngang

Bản mẫu 16:9 dành cho video kể chuyện bằng ảnh hoặc clip kín khung, có một dòng phụ đề ở đáy.

Kho Tư Liệu có thể tìm clip trước và dùng ảnh khi không có clip phù hợp. Media được đưa vào `content.clip` hoặc `content.image`; Họa Sĩ nhận đúng asset của từng cảnh và viết thẻ `<video>` hoặc `<img>` tương ứng. Video media được đóng timing theo cảnh để seek và render tất định.

Brief yêu cầu:

- khung 1920×1080;
- media kín khung, clip không thêm chuyển động giả;
- ảnh tĩnh có chuyển động chậm nhẹ;
- phụ đề một dòng, chữ trắng có stroke tối và nằm trong vùng an toàn;
- chuyển cảnh cắt thẳng.

Tiêu chí nghiệm thu:

- ảnh và clip preview qua byte range;
- mỗi media chỉ xuất hiện trong cảnh của nó;
- phụ đề không xuống dòng ở cấu hình mặc định;
- font tiếng Việt render đúng;
- MP4 giữ đúng tỉ lệ 16:9 và có audio.
