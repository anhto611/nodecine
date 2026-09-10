# So Sánh Hai Bên

Bản mẫu video dọc dạng giảng bài: hai đối tượng được so sánh ở nửa trên, phụ đề ở giữa và nhân vật ở dưới.

Kịch Bản Tĩnh mang năm cảnh. Các cảnh so sánh dùng `entries` để chứa hai mục cùng cấp; mỗi mục có thể mang nhãn, mô tả và ảnh. Ảnh nhỏ có thể là SVG nhúng nên workflow vẫn là một tệp JSON độc lập.

Node Họa Sĩ nhận brief mô tả bảng trắng, thẻ cân đối, chữ tròn thân thiện và vị trí nhân vật. Nó tạo CSS chung và vẽ từng cảnh từ nội dung thật. Ảnh nhân vật do người dùng chọn một lần qua tham số `character`; cảnh tham chiếu ảnh đó bằng `data-var="character"`.

Phụ đề được engine tạo từ timing, còn vị trí và kiểu chữ do CSS chung của workflow quyết định qua `.nc-captions-default`.

Tiêu chí nghiệm thu:

- video 1080×1920;
- hai mục trong một cảnh giữ kích thước và vị trí ổn định;
- chữ và ảnh của mỗi mục không bị tráo;
- nhân vật xuất hiện nhất quán khi đã chọn;
- năm đoạn lời tạo đúng năm cảnh và xuất được MP4 bằng HyperFrames.
