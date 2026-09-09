# So Sánh Hai Bên (compare-explainer)

Bản mẫu dọc 9:16 dựng theo một video tham chiếu dạng giảng bài: **hai thẻ so sánh ở dải trên, phụ đề karaoke chạy ở giữa, một nhân vật cầm gậy đứng ở dải dưới**. Mỗi cảnh so sánh là hai mục (`entries`), mỗi mục một tên, một dòng và một tranh.

## Ba dải, ai sở hữu dải nào

| Dải | Của ai | Vì sao |
|---|---|---|
| Trên (tới 56%) | Block | Đổi theo cảnh: câu hỏi hay hai thẻ |
| Giữa | Stage | Phụ đề, chung mọi cảnh |
| Dưới | Stage | Nhân vật đứng ở **mọi** cảnh, nên là của stage chứ không của block |

Nhân vật là một **SVG vẽ ngay trong markup của stage**, không phải tệp. Bản mẫu là JSON và không mang được tệp bên cạnh; nó mang được nét vẽ. Hai cánh tay vẽ sẵn (`.arm-point`, `.arm-think`) và stage chọn bằng CSS `:has()` theo lớp mà block đang lên gắn vào gốc của nó:

- `hero-question` gắn `hero` → tay chống cằm, bong bóng "?"
- `compare-cards` gắn `compare` → tay giơ gậy chỉ lên thẻ; cảnh so sánh **lẻ** gắn thêm `flip` (đọc `nodecine.index % 2`) → stage lật gương cả hình, để ba cảnh so sánh liên tiếp không đứng chết một tư thế.

Cảnh nào mang ảnh nhân vật riêng (prop `character` của block, khóa `image` của cảnh) thì hình vẽ sẵn ẩn đi: `.stage:has(.nc-block .who img)`.

## Hai tranh so sánh nằm trong kịch bản

`Website` và `Web App` là hai SVG phẳng nhúng dạng `data:image/svg+xml;base64` vào `entries[].image` của **từng** cảnh so sánh — đúng mô hình từ vựng: tranh là nội dung của mục, không phải của giao diện. Cái giá là đổi chủ đề thì phải thay tranh ở mỗi cảnh (ô "đổi ảnh" trong Kịch Bản Tĩnh); ba cảnh là sáu lần bấm. Chưa có cách nói "bên này dùng tranh này cho cả phim".

Nguồn của ba tranh ở `templates/assets/compare-explainer/`. `templates/__tests__/compare-explainer.test.ts` so byte JSON với tệp nguồn, nên sửa tranh mà quên nhúng lại là test đỏ. Nhúng lại: đọc tệp, base64, đặt vào JSON (xem test để biết chỗ).

## Màu

`accent` (xanh) cho bên trái và phụ đề; `accent2` (đỏ hồng) cho nhãn bên phải. Tranh mẫu vẽ theo đúng hai màu này. Đổi bảng màu thì tranh không tự đổi theo — chúng là ảnh.

## Không phải tranh vẽ tay

Video tham chiếu dùng minh họa vẽ tay (nét bút chì, tóc có sợi). Tranh ở đây là vector phẳng kiểu unDraw: hình khối sạch, không nét. Muốn giống tham chiếu hơn thì sinh ảnh bằng mô hình hoặc mua bộ minh họa có giấy phép, rồi tải vào ô ảnh của mỗi mục và thay SVG nhân vật trong code của stage.
