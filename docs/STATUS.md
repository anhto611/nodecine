# Tình Trạng Triển Khai

**Cập nhật 2026-09-05.**

Đây là tài liệu **duy nhất** nói cái gì đã dựng xong. Năm tài liệu còn lại nói *luật*: hợp đồng phải giữ, ranh giới không được vượt, hành vi bắt buộc — những thứ đúng bất kể hôm nay code tới đâu. Khi một tài liệu khác có vẻ khẳng định điều gì về tiến độ và mâu thuẫn với đây, tin tệp này.

Lý do tách: trước đây mỗi lần thêm một provider là phải sửa câu "ở v0.1 giọng đọc đi qua bộ tổng hợp của hệ điều hành" ở bốn chỗ, và thực tế là không sửa hết. Giờ chỉ có một chỗ để sai.

---

## Chạy được ngay

**Bản mẫu** — ba mục mở được trong Trình duyệt Bản mẫu:

| Bản mẫu | Khối | Cần mạng | Cần mô hình ngôn ngữ |
|---|---|---|---|
| Kịch Bản Tĩnh (lõi) | 7 | Không | Không |
| GitHub Repo Showcase (gói) | 10 | Có | Có |
| Canvas trống | 0 | — | — |

Các thẻ còn lại trong trình duyệt hiển thị mờ kèm nhãn "Sắp có". Chúng được liệt kê để lộ tầm nhìn sản phẩm, không phải việc đang làm dở.

**Khối lõi** — mười loại: Nhập Liệu, Kịch Bản Tĩnh, Mô Hình Ngôn Ngữ, Giọng Đọc Nguồn, Giọng Đọc, Đóng Gói Timeline, Remotion Engine, Hyperframes Engine, Xuất Bản Video, Xuất MP4.

Hai khối nhà cung cấp theo mẫu Load Checkpoint của ComfyUI: **một khối cho mỗi loại cổng**, chọn nhà cung cấp trong khối, không phải một khối cho mỗi hãng.

**Khối của gói** — `github-showcase`: Truy Xuất Repo, AI Đạo Diễn.

**Engine**

| Engine | Xem trước | Kết xuất tệp |
|---|---|---|
| Remotion | ✅ | ✅ MP4 (H.264/H.265) |
| Hyperframes | ✅ Canvas 2D | ❌ `ENGINE_NOT_READY` |

Hyperframes tồn tại để chứng minh Bản Đặc Tả Video Trung Gian thật sự độc lập engine: cùng một IR dựng được mà không cần React lẫn Remotion. Khối Xuất MP4 nối vào nó tự khóa nút, đúng theo cơ chế capabilities.

**Nhà cung cấp** — bốn, không cái nào cần khóa API:

| Nhà cung cấp | Loại | Transport | Cần gì |
|---|---|---|---|
| Claude Code | Mô hình ngôn ngữ | `cli` | Công cụ `claude` đã đăng nhập |
| Ollama | Mô hình ngôn ngữ | `api` | Máy chủ ollama cục bộ + model đã kéo |
| Giọng hệ điều hành | Giọng đọc | `local` | macOS (`say`) + ffmpeg |
| Piper | Giọng đọc | `local` | `piper` + mô hình giọng `.onnx` + ffmpeg |

Không cái nào bắt buộc phải có. Thiếu thì khối nhà cung cấp vẫn `success` màu vàng, ghi rõ thiếu gì và câu lệnh cài; khối tiêu thụ phía sau tự chặn.

**Kiểu cảnh và renderer** — bốn kiểu, cả bốn có renderer cho cả hai engine:

| Kiểu cảnh | Remotion | Hyperframes |
|---|---|---|
| `core/title-card` | ✅ | ✅ |
| `github-showcase/hook` | ✅ | ✅ |
| `github-showcase/mockup` | ✅ | ✅ |
| `github-showcase/cta` | ✅ | ✅ |

**Ngôn ngữ giao diện** — English và Tiếng Việt, hai từ điển khớp khóa.

**Biến môi trường** (`.env.example`): `NODECINE_CLAUDE_BIN`, `NODECINE_FFMPEG_BIN`, `NODECINE_PIPER_BIN`, `NODECINE_PIPER_VOICES`, `NODECINE_OLLAMA_URL`, `NODECINE_TMP_DIR`, `NODECINE_ORIGIN`.

---

## Có hợp đồng, chưa ai dùng

Những chỗ này đã định nghĩa trong tài liệu và có sẵn trong kiểu dữ liệu, nhưng chưa có cài đặt nào kích hoạt. Chúng không phải việc bỏ sót — có mặt sẵn để thứ cần chúng sau này không phải sửa hợp đồng.

- **Két khóa API.** `ProviderRegistration.secretSettings` đã có trong registry và rỗng ở mọi nhà cung cấp. Mã lỗi `KEY_MISSING`, `KEY_INVALID` đã có chuỗi hiển thị nhưng chưa chỗ nào ném. Ô lưu riêng trong localStorage thì mới có trong đặc tả (`EXECUTION_ENGINE.md` §7.1 nói ba khóa) chứ **chưa có trong `lib/storage.ts`** — code mới dùng hai khóa, dự án và giao diện.
- **Dự phòng hiệu ứng.** Adapter gặp hiệu ứng không dựng được thì tự thay bằng mờ dần và cảnh báo mức thông tin. Chưa Adapter nào kích hoạt.
- **Hai engine cùng phát một lúc.** Bố cục cho phép đặt hai Khối Xuất Bản Video cạnh nhau; hiện chỉ một cái phát được tại một thời điểm.
- **Chạy song song.** Bộ máy chạy tuần tự theo thứ tự tô-pô. Đồ thị cỡ mười khối và nút thắt nằm ở lệnh gọi ra ngoài nên song song chưa đáng đánh đổi độ phức tạp báo tiến độ.
- **Dọn tệp tạm nền.** Chỉ dọn tệp cũ hơn 24 giờ lúc khởi động, không có tiến trình nền.

---

## Cố ý chưa làm

Xem `PRD.md` mục 8. Ghi lại ở đó để tránh vô tình thiết kế chặn đường, không phải hàng đợi công việc.

---

## Nghiệm thu đã qua

- **Pha A — khung lõi.** Xong 2026-09-05. Đồ thị Kịch Bản Tĩnh bảy khối chạy từ đầu tới MP4, không mạng, không mô hình ngôn ngữ, không khóa.
- **Pha B — gói github-showcase.** Xong 2026-09-05. Chạy thật từ đường dẫn repo tới MP4 1080×1920: `expressjs/express`, 69.417 sao, `npm install express`, ba cảnh, lời thoại do mô hình viết.

Tiêu chí đầy đủ ở `PRD.md` mục 6 và `packs/github-showcase.md` mục 7.
