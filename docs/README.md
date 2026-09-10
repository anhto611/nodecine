# Tài liệu NodeCine

Docs chia theo mã nguồn: **lõi** (mọi node, hai engine, các nhà cung cấp) và **bản mẫu** (đồ thị JSON dựng lại được từ canvas trống, mang theo giao diện dưới dạng một câu mô tả trong node Họa Sĩ). Đọc lõi trước; phần kia chỉ có nghĩa khi đã hiểu lõi.

Một quy ước xuyên suốt: **`STATUS.md` nói cái gì đã dựng xong, mọi tài liệu khác nói luật.** Thêm một provider hay một engine chỉ sửa `STATUS.md`; sửa tài liệu luật nghĩa là hợp đồng đổi.

## Đọc trước

0. [`STATUS.md`](STATUS.md) — **Tình trạng triển khai.** Cái gì đã dựng xong hôm nay: bản mẫu, node, engine, nhà cung cấp. Đây là tài liệu duy nhất nói về tiến độ; năm tài liệu dưới chỉ nói luật. Mâu thuẫn thì tin tệp này.

## Tầng lõi

1. [`PRD.md`](PRD.md) — Yêu cầu Sản phẩm. Sản phẩm giải quyết vấn đề gì, cho ai; khung lõi và gói; bộ node lõi; trình tự Pha A rồi Pha B; tiêu chí nghiệm thu; những gì cố ý không làm.
2. [`ARCHITECTURE.md`](ARCHITECTURE.md) — Kiến trúc Hệ thống. Mã nguồn chạy ở đâu, ranh giới máy khách và máy chủ, cây thư mục với `core/`, `nodes/`, `engines/`, `providers/`, `templates/`, quy tắc phụ thuộc, thông tin đăng nhập, vòng đời tệp tạm.
3. [`CORE_CONTRACTS.md`](CORE_CONTRACTS.md) — Hợp đồng Lõi. Mười một kiểu cổng, gói dữ liệu, Bản Đặc Tả Video Trung Gian generic tự chứa và năm bất biến, renderer theo định dạng code, bộ node lõi (gồm Kịch Bản Tĩnh và Đóng Gói Timeline), Adapter và Provider, gọi ra ngoài và an toàn tiến trình con, bản mẫu.
4. [`EXECUTION_ENGINE.md`](EXECUTION_ENGINE.md) — Bộ Máy Thực Thi. Chín trạng thái node và node tài nguyên, thứ tự chạy, chữ ký và chạy lại từng phần, thời gian chờ, bảng mã lỗi lõi, lưu trữ cục bộ, lịch sử và nhật ký, kiểm thử bắt buộc.
5. [`USER_FLOWS_AND_WIREFRAMES.md`](USER_FLOWS_AND_WIREFRAMES.md) — Trải nghiệm Người dùng của khung. Bố cục, dải trái và các panel, giải phẫu node lõi, Kịch bản A (Kịch Bản Tĩnh), Kịch bản 4 và 5, phím tắt.

## Bản mẫu

6. [`templates/github-showcase.md`](templates/github-showcase.md) — GitHub Repo Showcase. Node Truy Xuất Repo và dữ kiện, đồ thị dùng Biên Kịch và Họa Sĩ, Kịch bản 1 đến 3b, lỗi và tiêu chí nghiệm thu.
7. [`templates/quote-cards.md`](templates/quote-cards.md) — Thẻ Trích Dẫn. Đồ thị không mạng ngoài mô hình; bốn điểm khác về cấu trúc so với bản trên.

## Thuật ngữ

Thuật ngữ chuyên ngành giữ nguyên tiếng Anh trong cả code lẫn tài liệu tiếng Việt. Chỉ hai từ có gloss tiếng Việt vì ngắn và không va với gì khác.

| Khái niệm | Trong code | Trong tài liệu và giao diện |
|---|---|---|
| node của đồ thị | `node` | node — không dịch |
| tờ CSS chung của mọi cảnh trong một lần chạy: biến màu và font trên `.nc-scene`, bộ class dùng chung, chỗ phụ đề mặc định | `plan.style` (`{ name, css }`), `StyleSchema` | phong cách *(style)* |
| node vẽ giao diện cho kịch bản mỗi lần chạy bằng mô hình: một phong cách chung rồi từng cảnh, mỗi cảnh một bức; không lưu gì; thân node là storyboard chỉ để xem | node `core/illustrator`, cổng vào `SceneScript` + `llm`, cổng ra `ScenePlan`; tham số `brief`, `frame`, `character` | Họa Sĩ *(Illustrator)* |
| node viết lời đọc và nội dung từng cảnh từ đề bài và beat, không biết giao diện | node `core/screenwriter`, phát `SceneScript` + `AudioScript` | Biên Kịch *(Screenwriter)* |
| video đã chia cảnh với nội dung theo từ vựng cố định, chưa có giao diện | cổng `SceneScript`, `CONTENT_KEYS` | phân cảnh |
| một mục trong danh sách của Biên Kịch: vai trò, brief, số cảnh, ràng buộc dữ kiện | `beat` | beat *(nhịp)* |
| một ô thời gian trong timeline = một bức vẽ trọn khung (`source`) | `scene` | cảnh |
| khung hình video — **chỉ** nghĩa này | `frame`, `fps`, `totalDurationInFrames` | khung hình |
| nút bấm — **chỉ** nghĩa này | — | nút |

Các tên tránh dùng từ đồng nghĩa dễ va với node, nút bấm, đoạn văn bản hay theme của Studio. Một cảnh là một bức vẽ hoàn chỉnh; phần dùng chung của video là một tờ CSS.

## Bất biến cốt lõi

Ba điều dưới đây xuyên suốt mọi tài liệu. Nếu một thay đổi làm vỡ một trong ba, đó là thay đổi mức kiến trúc chứ không phải sửa lặt vặt:

1. Bản Đặc Tả Video Trung Gian là ranh giới duy nhất giữa phần dựng nội dung và phần kết xuất, và **tự chứa**: mỗi cảnh mang bức vẽ của nó và IR mang phong cách chung, không tra bảng nào. Tầng lõi không biết Remotion hay HyperFrames: nó chỉ giữ giao diện và các registry rỗng, engine và nhà cung cấp nằm ngoài lõi và tự đăng ký.
2. Dữ kiện kiểm chứng được không đi xuyên qua mô hình ngôn ngữ. Chúng chảy qua cổng Dữ kiện thẳng tới Node Đóng Gói Timeline và được đổ vào phần tử `data-fact` của cảnh theo `factBindings`, bằng cấu trúc chứ không bằng quy ước.
3. Tổng thời lượng các phân cảnh luôn bằng đúng tổng số khung hình khai báo, không lệch dù chỉ một khung, và được hàm kiểm định IR của lõi bảo vệ trước khi bản đặc tả ra khỏi node.
