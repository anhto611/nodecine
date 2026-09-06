# Đặc tả Bộ Máy Thực Thi Đồ Thị (Graph Execution Engine)

Tài liệu này định nghĩa cách một đồ thị được chạy, cách hệ thống quyết định node nào cần chạy lại, cách lỗi được biểu diễn, và cách toàn bộ trạng thái được lưu giữ giữa các phiên làm việc. Tài liệu này thuộc tầng lõi và không biết tên node nào của gói; ví dụ dùng node lõi. Đây là phần nền mà các kịch bản trong Đặc tả Luồng Trải nghiệm và trong từng gói dựa vào.

---

## 1. Trạng thái Node (Node State Machine)

Mỗi node tại mọi thời điểm nằm ở đúng một trong chín trạng thái. Cột "Huy hiệu" là cách duy nhất giao diện được phép vẽ trạng thái đó, để Đặc tả Luồng Trải nghiệm và mã nguồn không tự diễn giải khác nhau.

| Trạng thái | Ý nghĩa | Chuyển tiếp ra | Huy hiệu |
| --- | --- | --- | --- |
| `idle` | Chưa từng chạy trong phiên hiện tại | `queued`, `blocked` | Sẵn sàng: chấm xám |
| `queued` | Đã tới lượt nhưng node phía trước chưa xong | `running`, `blocked` | Đang chờ lượt: chấm xám kèm chữ "chờ" |
| `running` | Đang thực thi | `success`, `error`, `cancelled` | Đang chạy: vòng xoay, viền xanh dương |
| `success` | Đã có kết quả hợp lệ khớp với cấu hình hiện tại | `stale`, `queued`, `blocked` | Hoàn thành: viền xanh lá kèm thời gian, hoặc chữ "dùng lại" khi lấy từ bộ nhớ đệm |
| `stale` | Có kết quả cũ nhưng cấu hình hoặc đầu vào đã đổi | `queued`, `blocked` | Cũ: viền đứt nét mờ |
| `error` | Thất bại, kèm mã lỗi | `queued` | Lỗi: viền đỏ, dấu chấm than |
| `blocked` | Không thể chạy vì một node phía trước đang lỗi, bị hủy, bị bỏ qua, hoặc vì năng lực cần thiết của tham chiếu nhận vào là `unavailable` | `queued` | Chặn bởi node phía trước: huy hiệu chờ lượt mờ kèm tên node chặn. Chặn bởi năng lực: viền vàng kèm lý do và cách khắc phục |
| `cancelled` | Bị hủy giữa chừng khi người dùng bấm Dừng Luồng | `queued` | Cũ: vẽ giống `stale` |
| `bypassed` | Người dùng đánh dấu bỏ qua; Chạy Luồng không chạm tới | `queued` (khi được chạy riêng hoặc bỏ đánh dấu) | Bỏ qua: viền đứt nét kèm chữ "bỏ qua" |

### 1.1. Node tài nguyên trong máy trạng thái

Node tài nguyên (Nhà Cung Cấp Mô Hình Ngôn Ngữ, Nhà Cung Cấp Giọng Đọc, Động Cơ) là node thực thi bình thường, dùng đúng chín trạng thái trên. Việc chạy của chúng là `probe()`, và kết quả là gói dữ liệu `LLMRef`, `TTSRef` hoặc `EngineRef` phát ra cổng như mọi node khác, có mã băm nội dung và tham gia cơ chế chữ ký. Ba quy tắc riêng:

1. `probe()` không bao giờ đưa node vào `error` vì lý do "chưa sẵn sàng". Công cụ chưa cài, chưa đăng nhập, thiếu ffmpeg, engine chưa hỗ trợ đều là câu trả lời hợp lệ: node vẫn `success`, gói dữ liệu mang `capabilities` với trường tương ứng là `unavailable` kèm `reason` và `fix`. Node chỉ vào `error` khi chính `probe()` vỡ, ví dụ quá thời gian chờ.
2. Tầng thứ hai, trạng thái sẵn sàng, được suy ra từ gói dữ liệu chứ không phải từ máy trạng thái: mọi năng lực `ready` thì huy hiệu xanh lá "sẵn sàng"; có năng lực `unavailable` thì huy hiệu vàng "chưa sẵn sàng" kèm lý do. Đây là lớp phủ hiển thị trên huy hiệu `success`, không phải trạng thái thứ mười.
3. Node tiêu thụ tự quyết dựa trên `capabilities`: nếu năng lực nó cần là `unavailable`, nó chuyển sang `blocked` với viền vàng và thông báo lấy từ `reason` và `fix` của node tài nguyên. Viền vàng phân biệt "chặn vì năng lực" với "chặn vì node phía trước lỗi", vì cách khắc phục khác nhau. Ví dụ: Node Giọng Đọc `blocked` với "Thiếu ffmpeg, chạy `brew install ffmpeg`" trong khi Node System TTS Provider `success` và vàng; node biên kịch của gói `blocked` tương tự khi Claude Code chưa đăng nhập.

Bộ máy tự chạy toàn bộ node tài nguyên một lần khi mở studio và mỗi khi Cài đặt thay đổi đường dẫn tệp thực thi, để trạng thái sẵn sàng hiện ra trước khi người dùng bấm Chạy Luồng. Node tài nguyên là ngoại lệ của bộ nhớ đệm chữ ký: `probe()` chạy lại ở mọi lần Chạy Luồng, vì thế giới bên ngoài (đăng xuất, gỡ ffmpeg) đổi mà chữ ký không đổi. Chi phí chỉ vài trăm mili giây. Nếu kết quả `probe()` giống hệt lần trước, mã băm của tham chiếu không đổi và mọi node phía sau vẫn được dùng lại như bình thường; nếu khác, chỉ node tiêu thụ trực tiếp chạy lại. Nút "Kiểm tra lại" trên thân node là thao tác chạy riêng node đó ngoài lần Chạy Luồng.

Quy tắc lan truyền: khi một node chuyển sang `error`, `cancelled` hoặc `bypassed`, toàn bộ node nằm phía sau nó theo chiều dây nối chuyển sang `blocked`; node tiêu thụ tham chiếu có năng lực `unavailable` cũng `blocked` theo mục 1.1. Node `blocked` giữ nguyên kết quả cũ của mình nếu có, và Node Video Output tiếp tục hiển thị kết quả cũ đó dưới một lớp phủ nêu tên node đang lỗi, thay vì bị xóa trắng.

Khi người dùng sửa một tham số của node, node đó và toàn bộ node phía sau chuyển sang `stale`. Trạng thái `stale` được vẽ bằng viền đứt nét mờ, mang thông điệp: kết quả bạn đang nhìn không còn khớp với cấu hình hiện tại.

---

## 2. Thứ tự Thực thi

1. Bộ máy sắp xếp đồ thị theo thứ tự tô-pô. Nếu phát hiện chu trình, luồng dừng ngay trước khi chạy node nào, và các dây nối tạo thành chu trình được tô đỏ.
2. Kiểm tra tính đầy đủ: mọi cổng nhận bắt buộc phải có đúng một dây nối tới. Thiếu dây nối là lỗi mức đồ thị, không phải lỗi mức node. Kiểm tra này chạy liên tục theo mỗi thay đổi của đồ thị, kết quả hiện ngay trên node liên quan và trên nút Chạy Luồng bị vô hiệu hóa, nên không có bước kiểm tra riêng lúc bấm. Số lượng Node Xuất Bản Video và Node Xuất MP4 không bị giới hạn, kể cả bằng không; đồ thị không có node đích nào chỉ nhận cảnh báo `GRAPH_NO_SINK` chứ không bị chặn, vì người dùng có thể đang dựng dở.
3. Node ở trạng thái `bypassed` bị bỏ qua khi duyệt. Nếu một node phía sau cần đầu ra của node bị bỏ qua ở một cổng **bắt buộc**, node đó chuyển sang `blocked` với thông báo nêu tên node bị bỏ qua. Cổng **tùy chọn** nối vào node bị bỏ qua được coi như không nối: Đóng Gói Timeline vẫn chạy khi cặp Căn Mốc Từ → Phụ Đề trong bản mẫu đang bỏ qua, chỉ không có phụ đề. Node Xuất MP4 bị bỏ qua không node nào phụ thuộc, nên luồng chạy hết các node còn lại.
4. Các node được chạy theo thứ tự tô-pô, tuần tự, kể cả với những node về lý thuyết có thể chạy song song. Đồ thị mẫu chỉ có khoảng mười node và node thắt cổ chai nằm ở lệnh gọi ra ngoài, nên chạy song song không mang lại lợi ích đáng kể mà lại làm phức tạp việc báo tiến độ.
5. Dây luồng và dây thành phần (Hợp Đồng Lõi mục 1.1) là một với bộ máy: một node chờ mọi dây vào của nó, dù dây đó mang nội dung hay mang stage, mô hình, giọng, động cơ. Sự phân biệt chỉ nằm ở cách vẽ trên canvas.
6. Trước khi chạy một node, bộ máy tính chữ ký của node đó. Nếu chữ ký trùng với chữ ký của kết quả đang lưu, node được bỏ qua và kết quả cũ được tái sử dụng.

---

## 3. Chữ ký Node & Cơ chế Chạy Lại Từng Phần

Chữ ký của một node là mã băm ổn định tính từ bốn thành phần:

1. Định danh loại node.
2. Số hiệu phiên bản của loại node. Trường này tồn tại để khi logic của một node thay đổi trong lần nâng cấp ứng dụng, kết quả cũ tự động bị coi là không dùng lại được.
3. Toàn bộ tham số cấu hình của node, đã chuẩn hóa thứ tự trường.
4. Danh sách mã băm nội dung của mọi gói dữ liệu đi vào các cổng nhận của node.

Hệ quả trực tiếp: đổi tốc độ đọc chỉ làm thay đổi thành phần thứ ba của Node Giọng Đọc. Chữ ký của node phát Kịch bản Phân cảnh phía trước (Kịch Bản Tĩnh, hoặc node biên kịch của gói cùng mọi node trước nó) không đổi, nên được dùng lại và không phát sinh lệnh gọi nào ra ngoài. Chữ ký của Node Đóng Gói Timeline thay đổi vì mã băm đầu vào từ Node Giọng Đọc đã khác, nên node này chạy lại, và đó là điều mong muốn.

Chạy riêng một node: người dùng có thể yêu cầu bộ máy chạy đúng một node, dùng gói dữ liệu đang có trên các dây vào mà không duyệt lại đồ thị. Thao tác này phục vụ nút thử lại trên node đang lỗi, nút Kiểm tra lại trên node tài nguyên và nút Kết xuất trên Node Xuất MP4. Nếu một dây vào chưa có gói dữ liệu, yêu cầu bị từ chối trước khi chạy, kèm tên cổng còn thiếu.

Bốn trường hợp bắt buộc bỏ qua bộ nhớ đệm:

- Người dùng bấm nút thử lại riêng trên một node đang lỗi.
- Node đang ở trạng thái `error`. Kết quả lỗi không bao giờ được đưa vào bộ nhớ đệm.
- Người dùng giữ phím bổ trợ khi bấm Chạy Luồng, tương ứng thao tác chạy lại toàn bộ từ đầu.
- Node tài nguyên, theo mục 1.1: `probe()` luôn chạy lại, chỉ kết quả của nó mới tham gia bộ nhớ đệm phía sau.

Ghi chú về node truy xuất dữ kiện của gói: dữ kiện lấy từ nguồn ngoài thay đổi theo thời gian, nên kết quả dùng lại có thể đã cũ. Lõi chấp nhận điều này: node hiển thị `fetchedAt` trên thân kèm node làm mới thủ công, thay vì tự động vô hiệu hóa bộ nhớ đệm theo thời gian, vì tự làm mới sẽ khiến mọi lần chạy lại đều tốn hạn mức nguồn ngoài.

---

**Node sửa tham số của chính nó.** `RunContext.patchParams(patch)` là đường duy nhất để một node đổi tham số của mình trong lúc chạy (hiện chỉ Đạo Diễn Mỹ Thuật dùng, để giữ block do mô hình viết). Bộ máy ghi patch vào đồ thị ngay, phát sự kiện `params` (JobHub → SSE → store, vào lịch sử hoàn tác, workflow chuyển sang chưa lưu), và **ký kết quả trên tham số đã vá**: lần chạy sau với đồ thị đã mang patch có cùng chữ ký nên dùng lại, không làm lại việc. Đồ thị khách gửi lên sau đó chỉ xác nhận điều máy chủ đã biết.

**Bộ nhớ câu trả lời mô hình.** `services.complete` trên máy chủ ghi mọi câu trả lời xuống `.nodecine/cache/llm/<băm(nhà cung cấp, prompt)>.json` (đổi bằng `NODECINE_CACHE_DIR`) và trả lại từ đó khi gặp lại đúng prompt: sau khi restart, hay khi một node đứng sau Đạo Diễn Mỹ Thuật chạy lại vì sửa giao diện, không tốn thêm một lần gọi và kết quả y hệt. Chạy ép (Shift+Run, Thử lại, chạy một node) đi kèm `fresh` nên hỏi lại thật sự. Bộ nhớ này nằm ngoài đồ thị và ngoài chữ ký; xóa thư mục chỉ khiến lần chạy tới gọi lại.

## 4. Hủy Luồng Đang Chạy

- Khi luồng đang chạy, nút Chạy Luồng chuyển thành Dừng Luồng.
- Node đang chạy nhận tín hiệu hủy. Nếu nó đang chờ một lệnh gọi mạng, lệnh gọi đó bị hủy bỏ.
- Node bị hủy chuyển sang `cancelled` và được vẽ giống `stale`. Các node đã hoàn thành trước đó giữ nguyên kết quả và vẫn dùng lại được ở lần chạy sau.

---

## 5. Chính sách Thời Gian Chờ & Thử Lại

| Node | Thời gian chờ tối đa | Tự thử lại | Ghi chú |
| --- | --- | --- | --- |
| Nhập Liệu, Kịch Bản Tĩnh | Không áp dụng | Không | Thuần cục bộ |
| Giọng Đọc | 60 giây | 2 lần, giãn cách tăng dần | Chỉ thử lại với lỗi tạm thời của nhà cung cấp; với bộ tổng hợp hệ thống thì không thử lại |
| Đóng Gói Timeline | Không áp dụng | Không | Hàm thuần, thất bại đồng nghĩa có lỗi lập trình |
| Node tài nguyên (ba loại) | 5 giây cho `probe()` | Không | Không sẵn sàng là trạng thái đã biết, không phải lỗi |
| Xuất Bản Video | Không áp dụng | Không | Chỉ nạp trình phát |
| Xuất MP4 | Không đặt thời gian chờ cứng | Không | Có tiến độ và nút Hủy riêng |
| Node lấy dữ liệu (Truy Xuất Repo) | Do node khai báo | Do node khai báo | Ví dụ tại `templates/github-showcase.md` mục 2.4 |

Nguyên tắc chung: chỉ tự thử lại với lỗi tạm thời. Lỗi do cấu hình sai, do thiếu khóa API hoặc do dữ liệu đầu vào không hợp lệ phải hiện ra ngay để người dùng sửa, vì thử lại tự động chỉ làm chậm việc phát hiện vấn đề.

---

## 6. Bảng Mã Lỗi

Mỗi lỗi mang một mã ổn định, một thông báo hiển thị lấy từ từ điển ngôn ngữ giao diện theo mã đó (cột dưới đây minh họa bằng tiếng Việt), và cờ cho biết có thể thử lại hay không. Mã lỗi không bao giờ được hiển thị trực tiếp lên giao diện chính, chỉ xuất hiện trong phần chi tiết mở rộng và trong nội dung sao chép khi người dùng báo lỗi.

| Mã | Node | Thông báo hiển thị | Thử lại được |
| --- | --- | --- | --- |
| `INPUT_EMPTY` | Nhập Liệu, kiểm tra liên tục | Vui lòng nhập nội dung trước khi chạy; khóa nút Chạy Luồng | Không |
| `PROVIDER_NOT_CONNECTED` | Node tiêu thụ tham chiếu, kiểm tra liên tục | Chưa nối node Nhà Cung Cấp vào cổng này; khóa nút Chạy Luồng | Không |
| `PROVIDER_NOT_INSTALLED` | Mã lý do trong `capabilities` | Không tìm thấy công cụ trên máy, kèm hướng dẫn cài; node tài nguyên vàng, node tiêu thụ `blocked` | Không |
| `PROVIDER_NOT_AUTHENTICATED` | Mã lý do trong `capabilities` | Công cụ chưa đăng nhập, kèm lệnh cần chạy; như trên | Không |
| `PROVIDER_PROBE_FAILED` | Nhà Cung Cấp, Động Cơ | `probe()` vỡ hoặc quá thời gian chờ | Có |
| `PROVIDER_PROCESS_FAILED` | Node tiêu thụ tham chiếu | Tiến trình nhà cung cấp thoát với lỗi | Có |
| `KEY_MISSING` | Nhà cung cấp cần khóa | Chưa cấu hình khóa API, mở Cài đặt để bổ sung | Không |
| `KEY_INVALID` | Nhà cung cấp cần khóa | Khóa API bị từ chối | Không |
| `LLM_UPSTREAM` | Node gọi mô hình ngôn ngữ | Nhà cung cấp mô hình đang gặp sự cố | Có |
| `TTS_UPSTREAM` | Giọng Đọc | Dịch vụ giọng đọc đang gặp sự cố | Có |
| `TTS_AUDIO_UNREADABLE` | Giọng Đọc | Không đọc được thời lượng tệp âm thanh vừa tạo | Có |
| `TTS_VOICE_LANGUAGE_MISMATCH` | Giọng Đọc | Nhà cung cấp không có giọng cho ngôn ngữ này, đã dùng giọng dự phòng | Cảnh báo, không dừng |
| `IR_INVALID` | Đóng Gói Timeline | Bản đặc tả vi phạm bất biến, kèm bất biến nào; là lỗi lập trình | Không |
| `IR_VERSION_UNSUPPORTED` | Xuất Bản Video, Xuất MP4 | Bản đặc tả thuộc phiên bản không được hỗ trợ | Không |
| `ENGINE_SCENE_UNSUPPORTED` | Mã lý do trong scene registry | Engine nối vào không có renderer cho kiểu cảnh này, kèm danh sách; node tiêu thụ `blocked` viền vàng | Không |
| `ENGINE_NOT_READY` | Mã lý do trong `capabilities` | Engine nối vào chưa hỗ trợ thao tác này; node tiêu thụ `blocked` hoặc khóa node | Không |
| `EXPORT_FAILED` | Xuất MP4 | Kết xuất video thất bại | Có |
| `EXPORT_CANCELLED` | Xuất MP4 | Đã hủy kết xuất | Có |
| `NODE_BYPASSED_UPSTREAM` | Mức đồ thị | Node phía trước đang bị bỏ qua | Không |
| `GRAPH_CYCLE` | Mức đồ thị | Đồ thị có vòng lặp, hãy gỡ bớt một dây nối | Không |
| `GRAPH_PORT_UNCONNECTED` | Mức đồ thị | Còn cổng nhận chưa được nối dây | Không |
| `GRAPH_NO_SINK` | Mức đồ thị | Không có Node Xuất Bản Video hay Node Xuất MP4 nào được nối; luồng vẫn chạy nhưng không có gì để xem | Cảnh báo, không chặn |

Mã lỗi riêng của từng gói (ví dụ `REPO_*`, `LLM_SCHEMA_INVALID`) nằm trong tài liệu của gói đó và dùng cùng quy tắc hiển thị.

---

## 7. Lưu Trữ Cục Bộ & Nâng Cấp Lược Đồ

### 7.1. Những gì được lưu

*Cập nhật:* các workflow người dùng lưu không còn ở `localStorage` mà là tệp trên máy chủ (`CORE_CONTRACTS.md` §10.1); các workflow **đang mở** trên thanh tab (kể cả bản nháp chưa lưu) tự lưu vào `localStorage` dưới khóa `nodecine.tabs`, như ComfyUI giữ các workflow đang mở; tải lại trang là các tab trở lại nguyên trạng.

Trạng thái bền vững phía trình duyệt nằm trong bộ nhớ cục bộ, chia thành các khóa tách biệt (trạng thái chạy của node thì ở executor trên máy chủ, đọc lại qua `/api/executors/<khóa>`):

1. Tài liệu dự án: tên dự án, danh sách node kèm vị trí, tham số và cờ bỏ qua, danh sách dây nối.
2. Khóa API: tách riêng để có thể xóa độc lập mà không mất đồ thị, và để không bao giờ bị vô tình đưa vào nội dung xuất hay chia sẻ. Khóa này chỉ được tạo khi có nhà cung cấp cần khóa (xem `STATUS.md`).
3. Tùy chọn giao diện: ngôn ngữ giao diện (mặc định `en`), vị trí và mức thu phóng của canvas, danh mục đang chọn trong Trình duyệt Bản mẫu.

### 7.2. Việc và lịch sử chạy nằm trên đĩa của máy chủ

Bộ máy chạy ở máy chủ (mục 8 và `ARCHITECTURE.md` §1.2), nên kết quả chạy không còn phụ thuộc vào trình duyệt. Mỗi việc trong hàng đợi (`run`, `node`, `probe`) là một tệp `.nodecine/jobs/<id>.json` (đổi thư mục bằng biến môi trường `NODECINE_JOBS_DIR`), ghi lại theo kiểu ghi tạm rồi đổi tên ở mỗi lần đổi trạng thái, giống `job.json` của cutdown. Một việc `run` đi tới được Bản Đặc Tả Video Trung Gian thì giữ luôn bản đặc tả đó, định danh engine và tổng thời gian chạy; việc Xuất MP4 hoàn tất sau đó được gắn vào lần chạy gần nhất của cùng khóa. Khi tiến trình khởi động, thư mục được đọc lại: việc đang `pending` hay `running` lúc tiến trình cũ chết được đánh dấu `cancelled` với mã `RUN_CANCELLED`, tệp không đọc được bị bỏ qua, và chỉ giữ 200 tệp mới nhất.

Trạng thái node trong bộ nhớ (kết quả từng node, chữ ký bộ nhớ đệm) và nhật ký (2.000 dòng) vẫn là của executor theo từng khóa trong tiến trình máy chủ: tải lại trang là thấy lại qua `GET /api/executors/<khóa>`, nhưng khởi động lại máy chủ thì mọi node xử lý về `idle` và cần chạy lại; ba node tài nguyên tự `probe()` sau khi nạp theo mục 1.1. Tệp âm thanh và MP4 vẫn nằm trong thư mục tạm theo vòng đời riêng, nên một mục lịch sử cũ có thể trỏ tới tệp đã bị dọn (mục 8.1).

### 7.3. Đánh phiên bản

- Mọi tài liệu lưu ra (tệp workflow, danh sách tab trong trình duyệt) mang một số hiệu phiên bản lược đồ (`PROJECT_SCHEMA_VERSION` trong `lib/storage.ts`).
- **Không có hàm nâng cấp.** Tài liệu mang số hiệu khác phiên bản hiện hành thì không được đọc: tệp workflow không hiện trong danh sách, tab đã lưu bị bỏ và ứng dụng mở sạch. Quyết định này là của người dùng lúc còn chưa có workflow nào đáng giữ; khi lược đồ đổi thì tăng số hiệu, và nếu về sau cần giữ tệp cũ thì viết hàm nâng cấp lúc đó.
- Bản Đặc Tả Video Trung Gian mang số hiệu phiên bản riêng, độc lập với số hiệu phiên bản của tài liệu, vì hai thứ này thay đổi theo nhịp khác nhau.

---

## 8. Lịch sử Chạy và Nhật ký

### 8.1. Lịch sử chạy

- Lịch sử là của máy chủ, theo từng khóa workflow, suy ra từ các việc `run` đã lưu trên đĩa (mục 7.2): 20 lần chạy gần nhất, mới nhất trước. Trình duyệt nhận nó trong ảnh chụp `GET /api/executors/<khóa>` khi mở tab và qua sự kiện SSE `history` mỗi khi có lần chạy hay lần xuất mới; trình duyệt không tự ghép lịch sử.
- Mỗi lần luồng chạy tới khi Node Đóng Gói Timeline phát ra Bản Đặc Tả Video Trung Gian, bộ máy ghi vào việc đó một mục gồm: số thứ tự, mốc thời gian, bản đặc tả đó, tổng thời gian chạy. Ảnh khung hình đầu tiên và định danh engine được bổ sung từ Node Xuất Bản Video đầu tiên thành công trong lần chạy; nếu không có node nào, mục dùng ảnh giữ chỗ và ghi "chưa có trình phát". Nhiều Node Xuất Bản Video vẫn là một mục; bấm mục đó nạp bản đặc tả vào mọi Node Xuất Bản Video đang có. Mỗi lần Node Xuất MP4 hoàn tất, mục kết xuất gồm tên tệp và dung lượng được gắn vào lần chạy đã sinh ra Bản Đặc Tả Video Trung Gian tương ứng.
- Chọn một mục trong lịch sử chỉ đổi Bản Đặc Tả Video Trung Gian đang nạp vào các Node Xuất Bản Video. Trạng thái và chữ ký của mọi node khác giữ nguyên, nên không có lệnh gọi mạng nào phát sinh và lần Chạy Luồng kế tiếp vẫn tận dụng được bộ nhớ đệm như bình thường.
- Đường dẫn âm thanh trong một mục cũ có thể đã bị dọn ở phía máy chủ theo vòng đời tệp tạm. Khi nạp lại mục đó mà tệp không còn, Node Video Output hiển thị kết quả không tiếng kèm cảnh báo, không chuyển sang trạng thái lỗi.

### 8.2. Nhật ký

- Mỗi node phát dòng nhật ký qua một kênh chung với cấu trúc: mốc thời gian mili giây, định danh node, mức độ gồm thông tin, cảnh báo và lỗi, mã lỗi nếu có, và thông điệp.
- Bộ máy thực thi tự ghi các mốc: bắt đầu luồng, bắt đầu và kết thúc từng node kèm thời gian, node được dùng lại từ bộ nhớ đệm, hủy, và kết thúc luồng.
- Tiến trình kết xuất đưa đầu ra của Remotion vào cùng kênh này với định danh node là Xuất MP4.
- Nội dung nhật ký được lọc khóa API và mã thông báo trước khi ghi, theo quy tắc tại Kiến trúc Hệ thống mục 4. Đầu ra chuẩn của tiến trình con được đưa vào nhật ký với định danh của node tiêu thụ, cắt ở 8 KB mỗi lần gọi; tiến trình mà đầu ra **là dữ liệu** (bộ căn mốc từ trả JSON từng từ) tự nâng trần (`maxOutput`), và kết quả bị cắt được đánh dấu `truncated` để bên gọi báo lỗi thay vì đọc JSON cụt.

## 9. Ranh giới Kiểm thử

Tài liệu này đặt ra ba nhóm kiểm thử bắt buộc của lõi; gói có bài kiểm thử riêng trong tài liệu của gói.

1. Kiểm thử phân bổ khung hình và kiểm định IR. Với một tập thời lượng âm thanh trải từ dưới ngưỡng tối thiểu tới trên ngưỡng, và với các bộ trọng số khác nhau kể cả một cảnh duy nhất, khẳng định tổng các cảnh luôn bằng đúng tổng số khung hình, cảnh liền nhau không khe hở, không cảnh nào có thời lượng bằng 0, cùng đầu vào luôn cho cùng kết quả; và hàm kiểm định IR từ chối mọi bản đặc tả dựng tay vi phạm một trong năm bất biến.
2. Kiểm thử chữ ký node. Khẳng định việc đổi tham số của một node chỉ làm thay đổi chữ ký của chính node đó và các node phía sau, không ảnh hưởng node phía trước; và node tài nguyên probe lại nhưng mã băm không đổi thì phía sau vẫn dùng lại.
3. Kiểm thử đè dữ kiện. Với một `FactSheet` và một `ScenePlan` có `factBindings`, khẳng định giá trị trong IR luôn bằng giá trị trong `facts`, kể cả khi `props` gốc có cùng tên với giá trị khác; và không có `factBindings` thì `props` giữ nguyên.
