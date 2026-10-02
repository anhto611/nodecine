# Kho kiến thức LLM Wiki

Kho Markdown để agent nhập tài liệu, liên kết kiến thức và trả lời có nguồn.
Quy trình lấy cảm hứng từ [LLM Wiki của Karpathy](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f).

## Bắt đầu

1. Đặt tài liệu vào `raw/`.
2. Yêu cầu agent: **Đọc knowledge/AGENTS.md rồi ingest tài liệu knowledge/raw/ten-tai-lieu.md vào wiki.**
3. Đọc [mục lục](wiki/index.md) và kiểm tra các trang vừa tạo.

Các câu lệnh mẫu khi trò chuyện với agent:

- **Dựa trên knowledge/wiki, trả lời câu hỏi … và dẫn nguồn.**
- **Lưu phân tích vừa rồi thành một trang synthesis và cập nhật mục lục.**
- **Lint knowledge/wiki: kiểm tra liên kết, nguồn, mâu thuẫn và thông tin lỗi thời.**
- **Ingest URL … vào knowledge, lưu thông tin nguồn và cập nhật các trang liên quan.**

Không cần chạy server, cài package hoặc tạo API key riêng cho thư mục này.
Agent thực hiện việc tổng hợp khi bạn yêu cầu; đây không phải tác vụ tự chạy nền.

## Xem trong Obsidian

Nếu có Obsidian, dùng **Open folder as vault** và chọn thư mục `knowledge`.
Bạn cũng có thể đọc và sửa các file bằng trình soạn thảo Markdown hiện có.

## Cấu trúc

- `raw/`: tài liệu gốc, giữ nguyên sau khi nhập.
- `wiki/`: kiến thức đã tổng hợp, mục lục và lịch sử cập nhật.
- `templates/`: mẫu trang để agent sử dụng.
- `AGENTS.md`: quy tắc nhập tài liệu, trả lời và bảo trì.

Các file trong thư mục này nằm trong repository hiện tại. Kiểm tra nội dung trước khi commit hoặc chia sẻ.
