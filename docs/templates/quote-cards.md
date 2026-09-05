# Thẻ Trích Dẫn (Quote Cards)

Bản mẫu thứ hai, và cố ý khác `github-showcase` càng nhiều càng tốt. Mục đích không phải thêm một loại video — mà là để phần *chung* giữa hai gói tự lộ ra. Khái quát hóa từ một ví dụ chỉ tạo ra thứ trừu tượng nhìn giống ví dụ đó.

Một chủ đề người dùng gõ vào → mô hình ngôn ngữ viết một thẻ mở đầu và N thẻ trích dẫn → giọng đọc → video dọc 9:16. Không mạng, không khóa.

---

## 1. Đồ Thị Mẫu

Tám node, tám dây:

```
Nhập Liệu ──────────────► Đạo Diễn Trích Dẫn ──plan──► Đóng Gói Timeline ──► Xuất Bản Video
Mô Hình Ngôn Ngữ ───llm──►        │                          ▲                     ▲
                                  └──script──► Giọng Đọc ────┘                     │
Giọng Đọc Nguồn ─────tts──────────────────────►  │              Remotion Engine ───┘
```

Không có node truy xuất, không có handler máy chủ, và **cổng Dữ kiện của Đóng Gói Timeline để trống**.

## 2. Bốn Điểm Khác Về Cấu Trúc

Đây là lý do gói này tồn tại. Mỗi điểm thử một chỗ mà `github-showcase` không chạm tới:

1. **Cổng vào là `SourceRef`, không phải `FactSheet`.** Node đạo diễn của hai gói nhận hai loại dữ liệu khác nhau ở cổng trái nhưng phát ra cùng `DirectorPlan` và `AudioScript`. Nếu sau này gom phần chung của hai node đạo diễn vào lõi, phần gom được không thể giả định có `FactSheet`.
2. **Số cảnh do người dùng chọn, không cố định.** `github-showcase` luôn ba cảnh theo một tuple; ở đây tham số `count` từ 3 tới 6, lược đồ đầu ra là một mảng, và độ dài bản kế hoạch đi theo câu trả lời của mô hình. Luật chia khung của lõi vì thế bị thử với số cảnh thay đổi.
3. **Bản kế hoạch trộn cảnh của lõi với cảnh của gói.** Thẻ mở đầu dùng `core/title-card` — kiểu cảnh gói không định nghĩa và không đăng ký renderer. Đây là điều scene registry hứa: gói ghép với thứ đã có sẵn thay vì khai lại.
4. **Không có `factBindings` ở bất kỳ cảnh nào.** Không có gì trong video này là dữ kiện kiểm chứng được, nên Đóng Gói Timeline không có gì để đè, và cảnh báo `FACTS_NOT_CONNECTED` **phải không** kêu. Đây là bài kiểm tra cảnh báo đó không kêu oan.

## 3. Đạo Diễn — cùng node lõi, tham số khác

Không có node đạo diễn trích dẫn. Bản mẫu dùng `core/ai-director` với stage `ink`, một node Blocks mang `text-card` và `quote`, và hai beat: `title ×1` (trọng số 0,5, block `text-card`) và `quote ×4`. Chủ đề đi vào cổng `Nguồn` từ Nhập Liệu; đề bài trong JSON cấm gán trích dẫn cho người nổi tiếng không nói câu đó và yêu cầu giữ một tone chung. Muốn 6 trích dẫn thì đổi `count`, không sửa code.

## 4. Block và Stage

Hai block trong node Blocks của bản mẫu: `quote` (trích dẫn chiếm trọn khung, một vạch màu, tên nguồn bên dưới) và `text-card` cho thẻ mở đầu. Stage `ink`: nền giấy sáng, chữ serif display, mono cho phần phụ — ngược hẳn stage terminal tối của bản mẫu GitHub. Không có code nào riêng cho bản mẫu này; mọi thứ là dữ liệu trong `templates/quote-cards.json`.

**Vấn đề cũ đã được giải quyết ở mức hợp đồng:** trước đây `theme` không renderer nào đọc nên thẻ mở đầu nền tối còn thẻ trích dẫn nền giấy. Nay cả hai block cùng vẽ trên stage `ink` bằng biến CSS của stage, nên thẻ mở đầu `text-card` tự mang nền giấy và chữ serif. Engine Hyperframes vẽ cả hai trên cùng stage.

## 5. Tiêu Chí Nghiệm Thu

- Mở bản mẫu, bấm Chạy Luồng ngay mà không phải nhập gì: chủ đề đã có sẵn giá trị mặc định, đồ thị mở ra không mang lỗi nào.
- Đổi `count` rồi chạy lại: số cảnh trong bản đặc tả đổi theo, tổng số khung vẫn khớp tuyệt đối.
- Đóng Gói Timeline **không** phát cảnh báo `FACTS_NOT_CONNECTED`.
- Nối Remotion Engine thay Hyperframes: Xuất Bản Video chặn vàng với `ENGINE_SCENE_UNSUPPORTED: html-gsap`, không node nào phía trước chạy lại.
