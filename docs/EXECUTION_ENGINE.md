# Đặc tả Bộ Máy Thực Thi Đồ Thị (Graph Execution Engine) - v0.1

Tài liệu này định nghĩa cách một đồ thị được chạy, cách hệ thống quyết định khối nào cần chạy lại, cách lỗi được biểu diễn, và cách toàn bộ trạng thái được lưu giữ giữa các phiên làm việc. Tài liệu này thuộc tầng lõi và không biết tên khối nào của gói; ví dụ dùng khối lõi. Đây là phần nền mà các kịch bản trong Đặc tả Luồng Trải nghiệm và trong từng gói dựa vào.

---

## 1. Trạng thái Khối (Node State Machine)

Mỗi khối tại mọi thời điểm nằm ở đúng một trong chín trạng thái. Cột "Huy hiệu" là cách duy nhất giao diện được phép vẽ trạng thái đó, để Đặc tả Luồng Trải nghiệm và mã nguồn không tự diễn giải khác nhau.

| Trạng thái | Ý nghĩa | Chuyển tiếp ra | Huy hiệu |
| --- | --- | --- | --- |
| `idle` | Chưa từng chạy trong phiên hiện tại | `queued`, `blocked` | Sẵn sàng: chấm xám |
| `queued` | Đã tới lượt nhưng khối phía trước chưa xong | `running`, `blocked` | Đang chờ lượt: chấm xám kèm chữ "chờ" |
| `running` | Đang thực thi | `success`, `error`, `cancelled` | Đang chạy: vòng xoay, viền xanh dương |
| `success` | Đã có kết quả hợp lệ khớp với cấu hình hiện tại | `stale`, `queued`, `blocked` | Hoàn thành: viền xanh lá kèm thời gian, hoặc chữ "dùng lại" khi lấy từ bộ nhớ đệm |
| `stale` | Có kết quả cũ nhưng cấu hình hoặc đầu vào đã đổi | `queued`, `blocked` | Cũ: viền đứt nét mờ |
| `error` | Thất bại, kèm mã lỗi | `queued` | Lỗi: viền đỏ, dấu chấm than |
| `blocked` | Không thể chạy vì một khối phía trước đang lỗi, bị hủy, bị bỏ qua, hoặc vì năng lực cần thiết của tham chiếu nhận vào là `unavailable` | `queued` | Chặn bởi khối phía trước: huy hiệu chờ lượt mờ kèm tên khối chặn. Chặn bởi năng lực: viền vàng kèm lý do và cách khắc phục |
| `cancelled` | Bị hủy giữa chừng khi người dùng bấm Dừng Luồng | `queued` | Cũ: vẽ giống `stale` |
| `bypassed` | Người dùng đánh dấu bỏ qua; Chạy Luồng không chạm tới | `queued` (khi được chạy riêng hoặc bỏ đánh dấu) | Bỏ qua: viền đứt nét kèm chữ "bỏ qua" |

### 1.1. Khối tài nguyên trong máy trạng thái

Khối tài nguyên (Nhà Cung Cấp Mô Hình Ngôn Ngữ, Nhà Cung Cấp Giọng Đọc, Động Cơ) là khối thực thi bình thường, dùng đúng chín trạng thái trên. Việc chạy của chúng là `probe()`, và kết quả là gói dữ liệu `LLMRef`, `TTSRef` hoặc `EngineRef` phát ra cổng như mọi khối khác, có mã băm nội dung và tham gia cơ chế chữ ký. Ba quy tắc riêng:

1. `probe()` không bao giờ đưa khối vào `error` vì lý do "chưa sẵn sàng". Công cụ chưa cài, chưa đăng nhập, thiếu ffmpeg, engine chưa hỗ trợ đều là câu trả lời hợp lệ: khối vẫn `success`, gói dữ liệu mang `capabilities` với trường tương ứng là `unavailable` kèm `reason` và `fix`. Khối chỉ vào `error` khi chính `probe()` vỡ, ví dụ quá thời gian chờ.
2. Tầng thứ hai, trạng thái sẵn sàng, được suy ra từ gói dữ liệu chứ không phải từ máy trạng thái: mọi năng lực `ready` thì huy hiệu xanh lá "sẵn sàng"; có năng lực `unavailable` thì huy hiệu vàng "chưa sẵn sàng" kèm lý do. Đây là lớp phủ hiển thị trên huy hiệu `success`, không phải trạng thái thứ mười.
3. Khối tiêu thụ tự quyết dựa trên `capabilities`: nếu năng lực nó cần là `unavailable`, nó chuyển sang `blocked` với viền vàng và thông báo lấy từ `reason` và `fix` của khối tài nguyên. Viền vàng phân biệt "chặn vì năng lực" với "chặn vì khối phía trước lỗi", vì cách khắc phục khác nhau. Ví dụ: Khối Giọng Đọc `blocked` với "Thiếu ffmpeg, chạy `brew install ffmpeg`" trong khi Khối System TTS Provider `success` và vàng; khối đạo diễn của gói `blocked` tương tự khi Claude Code chưa đăng nhập.

Bộ máy tự chạy toàn bộ khối tài nguyên một lần khi mở studio và mỗi khi Cài đặt thay đổi đường dẫn tệp thực thi, để trạng thái sẵn sàng hiện ra trước khi người dùng bấm Chạy Luồng. Khối tài nguyên là ngoại lệ của bộ nhớ đệm chữ ký: `probe()` chạy lại ở mọi lần Chạy Luồng, vì thế giới bên ngoài (đăng xuất, gỡ ffmpeg) đổi mà chữ ký không đổi. Chi phí chỉ vài trăm mili giây. Nếu kết quả `probe()` giống hệt lần trước, mã băm của tham chiếu không đổi và mọi khối phía sau vẫn được dùng lại như bình thường; nếu khác, chỉ khối tiêu thụ trực tiếp chạy lại. Nút "Kiểm tra lại" trên thân khối là thao tác chạy riêng khối đó ngoài lần Chạy Luồng.

Quy tắc lan truyền: khi một khối chuyển sang `error`, `cancelled` hoặc `bypassed`, toàn bộ khối nằm phía sau nó theo chiều dây nối chuyển sang `blocked`; khối tiêu thụ tham chiếu có năng lực `unavailable` cũng `blocked` theo mục 1.1. Khối `blocked` giữ nguyên kết quả cũ của mình nếu có, và Khối Video Output tiếp tục hiển thị kết quả cũ đó dưới một lớp phủ nêu tên khối đang lỗi, thay vì bị xóa trắng.

Khi người dùng sửa một tham số của khối, khối đó và toàn bộ khối phía sau chuyển sang `stale`. Trạng thái `stale` được vẽ bằng viền đứt nét mờ, mang thông điệp: kết quả bạn đang nhìn không còn khớp với cấu hình hiện tại.

---

## 2. Thứ tự Thực thi

1. Bộ máy sắp xếp đồ thị theo thứ tự tô-pô. Nếu phát hiện chu trình, luồng dừng ngay trước khi chạy khối nào, và các dây nối tạo thành chu trình được tô đỏ.
2. Kiểm tra tính đầy đủ: mọi cổng nhận bắt buộc phải có đúng một dây nối tới. Thiếu dây nối là lỗi mức đồ thị, không phải lỗi mức khối. Kiểm tra này chạy liên tục theo mỗi thay đổi của đồ thị, kết quả hiện ngay trên khối liên quan và trên nút Chạy Luồng bị vô hiệu hóa, nên không có bước kiểm tra riêng lúc bấm. Số lượng Khối Xuất Bản Video và Khối Xuất MP4 không bị giới hạn, kể cả bằng không; đồ thị không có khối đích nào chỉ nhận cảnh báo `GRAPH_NO_SINK` chứ không bị chặn, vì người dùng có thể đang dựng dở.
3. Khối ở trạng thái `bypassed` bị bỏ qua khi duyệt. Nếu một khối phía sau cần đầu ra của khối bị bỏ qua, khối đó chuyển sang `blocked` với thông báo nêu tên khối bị bỏ qua. Trong các đồ thị mẫu, Khối Xuất MP4 bị bỏ qua nhưng không khối nào phụ thuộc vào nó, nên luồng chạy hết các khối còn lại.
4. Các khối được chạy theo thứ tự tô-pô. Ở v0.1 việc thực thi là tuần tự, kể cả với những khối về lý thuyết có thể chạy song song. Đồ thị mẫu chỉ có khoảng mười khối và nút thắt cổ chai nằm ở lệnh gọi ra ngoài, nên chạy song song không mang lại lợi ích đáng kể mà lại làm phức tạp việc báo tiến độ.
5. Trước khi chạy một khối, bộ máy tính chữ ký của khối đó. Nếu chữ ký trùng với chữ ký của kết quả đang lưu, khối được bỏ qua và kết quả cũ được tái sử dụng.

---

## 3. Chữ ký Khối & Cơ chế Chạy Lại Từng Phần

Chữ ký của một khối là mã băm ổn định tính từ bốn thành phần:

1. Định danh loại khối.
2. Số hiệu phiên bản của loại khối. Trường này tồn tại để khi logic của một khối thay đổi trong lần nâng cấp ứng dụng, kết quả cũ tự động bị coi là không dùng lại được.
3. Toàn bộ tham số cấu hình của khối, đã chuẩn hóa thứ tự trường.
4. Danh sách mã băm nội dung của mọi gói dữ liệu đi vào các cổng nhận của khối.

Hệ quả trực tiếp: đổi tốc độ đọc chỉ làm thay đổi thành phần thứ ba của Khối Giọng Đọc. Chữ ký của khối phát Kịch bản Phân cảnh phía trước (Kịch Bản Tĩnh, hoặc khối đạo diễn của gói cùng mọi khối trước nó) không đổi, nên được dùng lại và không phát sinh lệnh gọi nào ra ngoài. Chữ ký của Khối Đóng Gói Timeline thay đổi vì mã băm đầu vào từ Khối Giọng Đọc đã khác, nên khối này chạy lại, và đó là điều mong muốn.

Chạy riêng một khối: người dùng có thể yêu cầu bộ máy chạy đúng một khối, dùng gói dữ liệu đang có trên các dây vào mà không duyệt lại đồ thị. Thao tác này phục vụ nút thử lại trên khối đang lỗi, nút Kiểm tra lại trên khối tài nguyên và nút Kết xuất trên Khối Xuất MP4. Nếu một dây vào chưa có gói dữ liệu, yêu cầu bị từ chối trước khi chạy, kèm tên cổng còn thiếu.

Bốn trường hợp bắt buộc bỏ qua bộ nhớ đệm:

- Người dùng bấm nút thử lại riêng trên một khối đang lỗi.
- Khối đang ở trạng thái `error`. Kết quả lỗi không bao giờ được đưa vào bộ nhớ đệm.
- Người dùng giữ phím bổ trợ khi bấm Chạy Luồng, tương ứng thao tác chạy lại toàn bộ từ đầu.
- Khối tài nguyên, theo mục 1.1: `probe()` luôn chạy lại, chỉ kết quả của nó mới tham gia bộ nhớ đệm phía sau.

Ghi chú về khối truy xuất dữ kiện của gói: dữ kiện lấy từ nguồn ngoài thay đổi theo thời gian, nên kết quả dùng lại có thể đã cũ. Lõi chấp nhận điều này: khối hiển thị `fetchedAt` trên thân kèm nút làm mới thủ công, thay vì tự động vô hiệu hóa bộ nhớ đệm theo thời gian, vì tự làm mới sẽ khiến mọi lần chạy lại đều tốn hạn mức nguồn ngoài.

---

## 4. Hủy Luồng Đang Chạy

- Khi luồng đang chạy, nút Chạy Luồng chuyển thành Dừng Luồng.
- Khối đang chạy nhận tín hiệu hủy. Nếu nó đang chờ một lệnh gọi mạng, lệnh gọi đó bị hủy bỏ.
- Khối bị hủy chuyển sang `cancelled` và được vẽ giống `stale`. Các khối đã hoàn thành trước đó giữ nguyên kết quả và vẫn dùng lại được ở lần chạy sau.

---

## 5. Chính sách Thời Gian Chờ & Thử Lại

| Khối | Thời gian chờ tối đa | Tự thử lại | Ghi chú |
| --- | --- | --- | --- |
| Nhập Liệu, Kịch Bản Tĩnh | Không áp dụng | Không | Thuần cục bộ |
| Giọng Đọc | 60 giây | 2 lần, giãn cách tăng dần | Chỉ thử lại với lỗi tạm thời của nhà cung cấp; với bộ tổng hợp hệ thống thì không thử lại |
| Đóng Gói Timeline | Không áp dụng | Không | Hàm thuần, thất bại đồng nghĩa có lỗi lập trình |
| Khối tài nguyên (ba loại) | 5 giây cho `probe()` | Không | Không sẵn sàng là trạng thái đã biết, không phải lỗi |
| Xuất Bản Video | Không áp dụng | Không | Chỉ nạp trình phát |
| Xuất MP4 | Không đặt thời gian chờ cứng | Không | Có tiến độ và nút Hủy riêng |
| Khối của gói | Do gói khai báo | Do gói khai báo | Ví dụ tại `packs/github-showcase.md` mục 2.4 và 3.3 |

Nguyên tắc chung: chỉ tự thử lại với lỗi tạm thời. Lỗi do cấu hình sai, do thiếu khóa API hoặc do dữ liệu đầu vào không hợp lệ phải hiện ra ngay để người dùng sửa, vì thử lại tự động chỉ làm chậm việc phát hiện vấn đề.

---

## 6. Bảng Mã Lỗi

Mỗi lỗi mang một mã ổn định, một thông báo hiển thị lấy từ từ điển ngôn ngữ giao diện theo mã đó (cột dưới đây minh họa bằng tiếng Việt), và cờ cho biết có thể thử lại hay không. Mã lỗi không bao giờ được hiển thị trực tiếp lên giao diện chính, chỉ xuất hiện trong phần chi tiết mở rộng và trong nội dung sao chép khi người dùng báo lỗi.

| Mã | Khối | Thông báo hiển thị | Thử lại được |
| --- | --- | --- | --- |
| `INPUT_EMPTY` | Nhập Liệu, kiểm tra liên tục | Vui lòng nhập nội dung trước khi chạy; khóa nút Chạy Luồng | Không |
| `PROVIDER_NOT_CONNECTED` | Khối tiêu thụ tham chiếu, kiểm tra liên tục | Chưa nối khối Nhà Cung Cấp vào cổng này; khóa nút Chạy Luồng | Không |
| `PROVIDER_NOT_INSTALLED` | Mã lý do trong `capabilities` | Không tìm thấy công cụ trên máy, kèm hướng dẫn cài; khối tài nguyên vàng, khối tiêu thụ `blocked` | Không |
| `PROVIDER_NOT_AUTHENTICATED` | Mã lý do trong `capabilities` | Công cụ chưa đăng nhập, kèm lệnh cần chạy; như trên | Không |
| `PROVIDER_PROBE_FAILED` | Nhà Cung Cấp, Động Cơ | `probe()` vỡ hoặc quá thời gian chờ | Có |
| `PROVIDER_PROCESS_FAILED` | Khối tiêu thụ tham chiếu | Tiến trình nhà cung cấp thoát với lỗi | Có |
| `KEY_MISSING` | Nhà Cung Cấp qua API (v0.2) | Chưa cấu hình khóa API, mở Cài đặt để bổ sung | Không |
| `KEY_INVALID` | Nhà Cung Cấp qua API (v0.2) | Khóa API bị từ chối | Không |
| `LLM_UPSTREAM` | Khối gọi mô hình ngôn ngữ | Nhà cung cấp mô hình đang gặp sự cố | Có |
| `TTS_UPSTREAM` | Giọng Đọc | Dịch vụ giọng đọc đang gặp sự cố | Có |
| `TTS_AUDIO_UNREADABLE` | Giọng Đọc | Không đọc được thời lượng tệp âm thanh vừa tạo | Có |
| `TTS_VOICE_LANGUAGE_MISMATCH` | Giọng Đọc | Nhà cung cấp không có giọng cho ngôn ngữ này, đã dùng giọng dự phòng | Cảnh báo, không dừng |
| `IR_INVALID` | Đóng Gói Timeline | Bản đặc tả vi phạm bất biến, kèm bất biến nào; là lỗi lập trình | Không |
| `IR_VERSION_UNSUPPORTED` | Xuất Bản Video, Xuất MP4 | Bản đặc tả thuộc phiên bản không được hỗ trợ | Không |
| `ENGINE_SCENE_UNSUPPORTED` | Mã lý do trong scene registry | Engine nối vào không có renderer cho kiểu cảnh này, kèm danh sách; khối tiêu thụ `blocked` viền vàng | Không |
| `ENGINE_NOT_READY` | Mã lý do trong `capabilities` | Engine nối vào chưa hỗ trợ thao tác này; khối tiêu thụ `blocked` hoặc khóa nút | Không |
| `EXPORT_FAILED` | Xuất MP4 | Kết xuất video thất bại | Có |
| `EXPORT_CANCELLED` | Xuất MP4 | Đã hủy kết xuất | Có |
| `NODE_BYPASSED_UPSTREAM` | Mức đồ thị | Khối phía trước đang bị bỏ qua | Không |
| `GRAPH_CYCLE` | Mức đồ thị | Đồ thị có vòng lặp, hãy gỡ bớt một dây nối | Không |
| `GRAPH_PORT_UNCONNECTED` | Mức đồ thị | Còn cổng nhận chưa được nối dây | Không |
| `GRAPH_NO_SINK` | Mức đồ thị | Không có Khối Xuất Bản Video hay Khối Xuất MP4 nào được nối; luồng vẫn chạy nhưng không có gì để xem | Cảnh báo, không chặn |

Mã lỗi riêng của từng gói (ví dụ `REPO_*`, `LLM_SCHEMA_INVALID`) nằm trong tài liệu của gói đó và dùng cùng quy tắc hiển thị.

---

## 7. Lưu Trữ Cục Bộ & Nâng Cấp Lược Đồ

### 7.1. Những gì được lưu

Toàn bộ trạng thái bền vững nằm trong bộ nhớ cục bộ của trình duyệt, chia thành ba khóa tách biệt:

1. Tài liệu dự án: tên dự án, danh sách khối kèm vị trí, tham số và cờ bỏ qua, danh sách dây nối.
2. Khóa API (chỗ để sẵn cho v0.2, rỗng ở v0.1): tách riêng để có thể xóa độc lập mà không mất đồ thị, và để không bao giờ bị vô tình đưa vào nội dung xuất hay chia sẻ.
3. Tùy chọn giao diện: ngôn ngữ giao diện (mặc định `en`), vị trí và mức thu phóng của canvas, danh mục đang chọn trong Trình duyệt Bản mẫu.

### 7.2. Những gì cố ý không được lưu

Kết quả chạy của các khối, gồm dữ kiện, kịch bản, tệp âm thanh và Bản Đặc Tả Video Trung Gian, chỉ tồn tại trong bộ nhớ của phiên làm việc. Lịch sử chạy trong phiên và nhật ký cũng vậy: chúng là hai vùng đệm trong bộ nhớ, giới hạn lần lượt 20 mục và 2.000 dòng, mất khi tải lại trang. Tải lại trang sẽ khôi phục đồ thị và mọi tham số; mọi khối xử lý trở về trạng thái `idle` và người dùng cần chạy lại, riêng ba khối tài nguyên được tự chạy `probe()` ngay sau khi nạp theo mục 1.1 nên hiện trạng thái sẵn sàng mà không cần bấm gì.

Lý do của quyết định này: bộ nhớ cục bộ của trình duyệt có hạn mức khoảng vài megabyte, trong khi tệp âm thanh và Bản đặc tả dễ vượt ngưỡng đó. Quan trọng hơn, đường dẫn tệp tạm có thể đã bị dọn ở phía máy chủ, nên một kết quả khôi phục lại có nguy cơ trỏ vào tệp không còn tồn tại. Thà chạy lại còn hơn hiển thị một trạng thái hỏng. Việc lưu bền kết quả chạy được ghi nhận là hạng mục cho phiên bản sau, khi đó nơi lưu phù hợp là cơ sở dữ liệu phía trình duyệt chứ không phải bộ nhớ cục bộ.

### 7.3. Đánh phiên bản và nâng cấp

- Tài liệu dự án mang một trường số hiệu phiên bản lược đồ.
- Khi ứng dụng khởi động và gặp số hiệu thấp hơn phiên bản hiện hành, một chuỗi hàm nâng cấp được áp dụng lần lượt để đưa tài liệu lên phiên bản mới.
- Khi gặp số hiệu cao hơn phiên bản hiện hành, tức người dùng đã hạ cấp ứng dụng, tài liệu không bao giờ được ghi đè. Ứng dụng hiển thị cảnh báo và mở một dự án trống, giữ nguyên dữ liệu cũ.
- Bản Đặc Tả Video Trung Gian mang số hiệu phiên bản riêng, độc lập với số hiệu phiên bản của tài liệu dự án, vì hai thứ này thay đổi theo nhịp khác nhau.

---

## 8. Lịch sử Chạy và Nhật ký trong Phiên

### 8.1. Lịch sử chạy

- Mỗi lần luồng chạy tới khi Khối Đóng Gói Timeline phát ra Bản Đặc Tả Video Trung Gian, bộ máy đẩy một mục vào lịch sử gồm: số thứ tự, mốc thời gian, bản đặc tả đó, tổng thời gian chạy. Ảnh khung hình đầu tiên và định danh engine được bổ sung từ Khối Xuất Bản Video đầu tiên thành công trong lần chạy; nếu không có khối nào, mục dùng ảnh giữ chỗ và ghi "chưa có trình phát". Nhiều Khối Xuất Bản Video vẫn là một mục; bấm mục đó nạp bản đặc tả vào mọi Khối Xuất Bản Video đang có. Mỗi lần Khối Xuất MP4 hoàn tất, mục kết xuất gồm tên tệp và dung lượng được gắn vào lần chạy đã sinh ra Bản Đặc Tả Video Trung Gian tương ứng.
- Chọn một mục trong lịch sử chỉ đổi Bản Đặc Tả Video Trung Gian đang nạp vào các Khối Xuất Bản Video. Trạng thái và chữ ký của mọi khối khác giữ nguyên, nên không có lệnh gọi mạng nào phát sinh và lần Chạy Luồng kế tiếp vẫn tận dụng được bộ nhớ đệm như bình thường.
- Đường dẫn âm thanh trong một mục cũ có thể đã bị dọn ở phía máy chủ theo vòng đời tệp tạm. Khi nạp lại mục đó mà tệp không còn, Khối Video Output hiển thị kết quả không tiếng kèm cảnh báo, không chuyển sang trạng thái lỗi.

### 8.2. Nhật ký

- Mỗi khối phát dòng nhật ký qua một kênh chung với cấu trúc: mốc thời gian mili giây, định danh khối, mức độ gồm thông tin, cảnh báo và lỗi, mã lỗi nếu có, và thông điệp.
- Bộ máy thực thi tự ghi các mốc: bắt đầu luồng, bắt đầu và kết thúc từng khối kèm thời gian, khối được dùng lại từ bộ nhớ đệm, hủy, và kết thúc luồng.
- Tiến trình kết xuất đưa đầu ra của Remotion vào cùng kênh này với định danh khối là Xuất MP4.
- Nội dung nhật ký được lọc khóa API và mã thông báo trước khi ghi, theo quy tắc tại Kiến trúc Hệ thống mục 4. Đầu ra chuẩn của tiến trình con được đưa vào nhật ký với định danh của khối tiêu thụ, cắt ở 8 KB mỗi lần gọi.

## 9. Ranh giới Kiểm thử

Tài liệu này đặt ra ba nhóm kiểm thử bắt buộc của lõi trước khi Pha A được coi là hoàn thành; gói có bài kiểm thử riêng trong tài liệu của gói.

1. Kiểm thử phân bổ khung hình và kiểm định IR. Với một tập thời lượng âm thanh trải từ dưới ngưỡng tối thiểu tới trên ngưỡng, và với các bộ trọng số khác nhau kể cả một cảnh duy nhất, khẳng định tổng các cảnh luôn bằng đúng tổng số khung hình, cảnh liền nhau không khe hở, không cảnh nào có thời lượng bằng 0, cùng đầu vào luôn cho cùng kết quả; và hàm kiểm định IR từ chối mọi bản đặc tả dựng tay vi phạm một trong năm bất biến.
2. Kiểm thử chữ ký khối. Khẳng định việc đổi tham số của một khối chỉ làm thay đổi chữ ký của chính khối đó và các khối phía sau, không ảnh hưởng khối phía trước; và khối tài nguyên probe lại nhưng mã băm không đổi thì phía sau vẫn dùng lại.
3. Kiểm thử đè dữ kiện. Với một `FactSheet` và một `DirectorPlan` có `factBindings`, khẳng định giá trị trong IR luôn bằng giá trị trong `facts`, kể cả khi `props` gốc có cùng tên với giá trị khác; và không có `factBindings` thì `props` giữ nguyên.
