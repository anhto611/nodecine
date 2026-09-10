# Tình Trạng Triển Khai

**Cập nhật 2026-09-10.** Đây là tài liệu nguồn duy nhất cho tiến độ hiện tại; lịch sử các kiến trúc đã bỏ không được giữ ở đây.

## Luồng hiện tại

NodeCine dựng video theo chuỗi:

`Nguồn → Kịch bản → Tư liệu → Họa Sĩ → Âm thanh → Đóng Gói → HyperFrames → MP4`

- `core/screenwriter` viết lời và nội dung có cấu trúc cho từng cảnh.
- `core/scene-breakdown` bổ sung nội dung hình cho kịch bản có sẵn mà không sửa lời.
- `core/stock-media` tìm ảnh hoặc clip từ Pexels/Pixabay và lưu thành asset theo hash.
- `core/illustrator` nhận `SceneScript` cùng `LLMRef`, tạo một tờ CSS chung rồi vẽ mỗi cảnh thành một HTML fragment hoàn chỉnh. Node không giữ thư viện bố cục và không ghi kết quả sinh vào tham số.
- `core/timeline-assembler` phân thời lượng theo từng đoạn lời, gắn dữ kiện đã kiểm chứng và tạo IR v2.
- HyperFrames xem trước và kết xuất `html-gsap`; Remotion chưa có renderer cho định dạng này.

## Họa Sĩ

Tham số hiện có: `brief`, preset `frame`, và ảnh `character` tùy chọn. Một lần chạy gồm một lời gọi tạo `Style`, sau đó tối đa ba lời gọi vẽ cảnh chạy song song. Mỗi kết quả được lint; kết quả không hợp lệ được yêu cầu sửa đúng một lần.

`ScenePlan` mang ngôn ngữ, kích thước khung, CSS dùng chung, chuyển cảnh, biến toàn video và danh sách cảnh. Mỗi cảnh có trọng số, HTML hoàn chỉnh và binding dữ kiện tùy chọn. IR v2 giữ cùng cấu trúc tự chứa để renderer không cần registry hình ảnh riêng.

## Giao diện chỉnh sửa

- Kịch Bản Tĩnh thu gọn mỗi cảnh thành một dòng; bấm để mở `SceneEditorDialog`.
- Họa Sĩ hiện brief, tỉ lệ, nhân vật/logo và storyboard của kết quả gần nhất.
- `ScenePreview` dùng cùng markup với renderer và có overlay vùng an toàn.
- Nhóm thư viện cho Kho Tư Liệu và Họa Sĩ là `visual`.

## Media và âm thanh

- Ảnh upload và clip lấy từ thư viện cục bộ đều trở thành `/api/assets/<hash>.<ext>`.
- SVG nhỏ có thể nhúng trực tiếp trong workflow.
- Voice-over hỗ trợ System TTS, Piper, ElevenLabs và Vbee.
- Căn mốc từ, phụ đề karaoke/reveal, xuất SRT/VTT và nhạc nền có ducking đã có.
- Media route hỗ trợ byte range để preview clip không phải tải toàn tệp.

## Bản mẫu

Các tệp JSON hiện có: GitHub Showcase, Quote Cards, AI News, Still Wide và Compare Explainer. Mỗi bản mẫu chỉ giữ graph, nội dung, brief và cấu hình node; hình được Họa Sĩ tạo khi chạy.

## Engine

| Engine | Preview `html-gsap` | Xuất MP4 |
|---|---:|---:|
| HyperFrames | Có | Có, H.264 |
| Remotion | Chưa | Chưa cho định dạng hiện tại |

HyperFrames đóng gói runtime, GSAP, font, voice-over và asset vào project tạm; preview và render dùng chung document builder. Lớp bảo vệ web globals giữ các API route của Next hoạt động trong lúc producer chạy.

## Kiểm tra gần nhất

- TypeScript: đạt.
- Next production build: đạt.
- 338 automated test đạt; 6 manual test bỏ qua.
- Hai integration test System TTS có thể lỗi nếu MP3 cache trong `.nodecine/tmp` bị hỏng; đây không phải lỗi của luồng Illustrator.

## Chưa làm

- Nút vẽ lại riêng; hiện dùng forced run.
- Vẽ thumbnail độc lập.
- Renderer `html-gsap` cho Remotion.
- Timestamp trực tiếp từ ElevenLabs.
