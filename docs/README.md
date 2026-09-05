# Tài liệu NodeCine

Docs chia hai tầng, đúng như mã nguồn: **lõi** (khung chạy được với zero phụ thuộc ngoài) và **gói bản mẫu** (thêm khối, kiểu cảnh và đồ thị mẫu cho một loại video). Đọc lõi trước; gói chỉ có nghĩa khi đã hiểu lõi.

## Tầng lõi

1. [`PRD.md`](PRD.md) — Yêu cầu Sản phẩm. Sản phẩm giải quyết vấn đề gì, cho ai; khung lõi và gói; bộ khối lõi; trình tự Pha A rồi Pha B; tiêu chí nghiệm thu; những gì cố ý không làm.
2. [`ARCHITECTURE.md`](ARCHITECTURE.md) — Kiến trúc Hệ thống. Mã nguồn chạy ở đâu, ranh giới máy khách và máy chủ, cây thư mục với `core/`, `engines/`, `providers/`, `packs/`, quy tắc phụ thuộc, thông tin đăng nhập, vòng đời tệp tạm.
3. [`CORE_CONTRACTS.md`](CORE_CONTRACTS.md) — Hợp đồng Lõi. Chín kiểu cổng, gói dữ liệu, Bản Đặc Tả Video Trung Gian generic và năm bất biến, scene registry, bộ khối lõi (gồm Kịch Bản Tĩnh và Đóng Gói Timeline), Adapter và Provider, an toàn tiến trình con, định nghĩa gói bản mẫu.
4. [`EXECUTION_ENGINE.md`](EXECUTION_ENGINE.md) — Bộ Máy Thực Thi. Chín trạng thái khối và khối tài nguyên, thứ tự chạy, chữ ký và chạy lại từng phần, thời gian chờ, bảng mã lỗi lõi, lưu trữ cục bộ, lịch sử và nhật ký, kiểm thử bắt buộc.
5. [`USER_FLOWS_AND_WIREFRAMES.md`](USER_FLOWS_AND_WIREFRAMES.md) — Trải nghiệm Người dùng của khung. Bố cục, dải trái và các panel, giải phẫu khối lõi, Kịch bản A (Kịch Bản Tĩnh), Kịch bản 4 và 5, phím tắt.

## Gói bản mẫu

6. [`packs/github-showcase.md`](packs/github-showcase.md) — Gói GitHub Repo Showcase (Pha B). Đồ thị mười khối, Truy Xuất Repo và dữ kiện, AI Đạo Diễn và ba kiểu cảnh, Kịch bản 1 đến 3b, lỗi và tiêu chí nghiệm thu riêng.

## Bất biến cốt lõi

Ba điều dưới đây xuyên suốt mọi tài liệu. Nếu một thay đổi làm vỡ một trong ba, đó là thay đổi mức kiến trúc chứ không phải sửa lặt vặt:

1. Bản Đặc Tả Video Trung Gian là ranh giới duy nhất giữa phần dựng nội dung và phần kết xuất, và **không biết tên kiểu cảnh nào**. Tầng lõi không biết Remotion cũng không biết gói nào: nó chỉ giữ giao diện và ba registry rỗng, các cài đặt cụ thể nằm ngoài lõi và tự đăng ký.
2. Dữ kiện kiểm chứng được không đi xuyên qua mô hình ngôn ngữ. Chúng chảy qua cổng Dữ kiện thẳng tới Khối Đóng Gói Timeline và được đè lên props theo `factBindings`, bằng cấu trúc chứ không bằng quy ước.
3. Tổng thời lượng các phân cảnh luôn bằng đúng tổng số khung hình khai báo, không lệch dù chỉ một khung, và được hàm kiểm định IR của lõi bảo vệ trước khi bản đặc tả ra khỏi khối.
