# Ảnh Tĩnh Ngang (still-wide)

Bản mẫu 16:9 dựng theo khung `still-wide` của cutdown: mỗi cảnh là **một tấm ảnh kín khung** và **một dòng phụ đề ở đáy**. Không có gì khác trên hình — cố ý.

## Vì sao dựng được mà không cần mô hình

Ảnh là thứ mô hình không bao giờ được điền (`image` nằm ngoài `WRITTEN_KEYS`), nên chặng kịch bản ở đây là **Kịch Bản Tĩnh**: người dùng gõ lời thoại từng cảnh và tự chọn ảnh. Không có node Mô Hình Ngôn Ngữ trong đồ thị, không gọi mạng — chỉ cần giọng đọc và ffmpeg.

## Các con số, và vì sao là chúng

| | |
|---|---|
| Khung | 1920×1080 |
| Bo góc ảnh | 112px (~6% của 1920) — bản đầu của cutdown là 56 nhưng góc phải đọc được ngay ở cỡ xem trước, không chỉ ở 1920 |
| Phụ đề | 44px, nét 700, giãn dòng 1,3 |
| Lề phụ đề | 160px mỗi bên (cột 1600px) — rộng hơn vùng an toàn 96px vì chữ là thứ duy nhất trên hình, và trên TikTok video ngang bị cột nút bên phải đè lên mép |
| Đáy dải | 150px — trên thanh điều khiển của nền tảng |
| `maxChars` | 52 — vừa **một** dòng ở 44px trong cột 1600px |

Một dòng, không bao giờ hai: trên khung ngang, dòng thứ hai đọc ra như chú thích ảnh chứ không phải phụ đề. `white-space: nowrap` trong stage chỉ **từ chối xuống dòng**; thứ giữ cho cue vừa một dòng là `maxChars` của node Phụ Đề. Cue quá dài sẽ bị cắt ở mép thấy được, chứ không lặng lẽ trèo ra khỏi dải.

**Font là Comfortaa**, đúng face cutdown dùng: nét bo tròn, đầu chữ mềm — cùng giọng với một khung chỉ có ảnh và một dòng chữ. Đóng gói kèm (`public/fonts`, ba subset của Google), không phải link ra ngoài: bản kết xuất không được phụ thuộc Google Fonts có trả lời hay không. **Nét chỉ tới 700** vì đây là font biến thiên 300–700; xin 800 thì trình duyệt tự bôi đậm, và nét giả trên nền ảnh đọc ra là chữ nhoè viền. Không dùng mono đóng gói sẵn: JetBrains Mono cắt mất dấu chồng của tiếng Việt — Ổ và Ặ nằm cao hơn đường chân chữ khoảng 1,4em và rơi lên dòng trên.

**Chữ trên ảnh nào cũng đọc được**: viền đen trước, ruột trắng sau (`paint-order: stroke fill`), rồi một lớp đổ bóng mềm. Không có màn tối phủ ảnh — cutdown bỏ nó vì kho ảnh đã lọc theo độ sáng, và ở đây người dùng tự chọn ảnh nên tự quyết.

**Cắt thẳng, không mờ dần**: hai tấm ảnh chồng nhau lúc chuyển đọc ra như trình chiếu slide.

## Hai block

- `still-clip` — **clip kín khung**, đường mặc định. Không Ken Burns: cảnh quay đã động sẵn, trôi thêm thành rung. Cỡ đặt bằng `inset: 0` và `100%` chứ không bằng số px: lúc kết xuất producer tráo thẻ video bằng ảnh khung và đóng cỡ inline lên đó, nên số px trong CSS bị bỏ qua và clip rơi về cỡ gốc ở góc khung. Nguồn là Kho Tư Liệu, hoặc clip của bạn trong `.nodecine/clips`.
- `still` — một tấm ảnh, dự phòng khi không có clip nào hợp. Có Ken Burns phóng 106% → 114% suốt cảnh, vì một tấm ảnh đứng yên bốn giây đọc ra như khung hình bị treo.

**Không ghim vai vào block nào**, và đó là cố ý: Kho Tư Liệu đặt clip vào cảnh nào có clip hợp và ảnh vào cảnh nào không, rồi luật phủ nội dung theo sau — `still-clip` là block duy nhất có chỗ đặt clip, `still` là block duy nhất có chỗ đặt ảnh. Ghim vào một trong hai là hỏng mọi cảnh nhận cái kia.

## Ảnh ở đâu ra

Đồ thị mang sẵn node **Kho Tư Liệu** giữa kịch bản và Đạo Diễn Mỹ Thuật: nó tìm tư liệu trên Pexels cho từng cảnh và tải về kho tài nguyên. Bản mẫu đặt `media: chỉ clip` — **mọi cảnh đều là clip**, đúng như khung `still-wide` của cutdown, ở đó nền là clip ngang cắt giữa chứ không phải ảnh tĩnh. Không tìm được clip hợp thì cảnh đó **để trống chứ không rơi về ảnh**: vài cảnh tĩnh nằm giữa những cảnh động đọc ra như hỏng, không như một lựa chọn. Đổi sang *clip, không có thì ảnh* nếu muốn có dự phòng. Trong node có ô **phong cách** để chọn vùng ảnh — Phong cảnh, Đường phố, Thiên nhiên, Kiến trúc, Nội thất, Chi tiết đời thường, Phòng tối cinematic — hoặc để *Tự động* cho mô hình chọn một nhóm cho cả video, hoặc *Ngẫu nhiên* cho mỗi cảnh một nhóm. Cần `PEXELS_API_KEY` trong `.env.local`, và một node Mô Hình Ngôn Ngữ để viết cụm tìm kiếm tiếng Anh từ lời thoại tiếng Việt (`CORE_CONTRACTS.md` §5.19).

Muốn tự chọn tư liệu thì **xoá node Kho Tư Liệu** và nối thẳng Kịch Bản Tĩnh vào Đạo Diễn Mỹ Thuật — khi đó bản mẫu không cần mạng, không cần khóa, không cần mô hình. Ảnh bạn tự chọn cho một cảnh luôn được giữ: `replaceExisting` tắt sẵn.

## Ảnh và clip của bạn vào máy thế nào

Ảnh: nút chọn ảnh trong từng hàng cảnh của Kịch Bản Tĩnh, tải lên `/api/assets`.
Clip: bỏ tệp vào `.nodecine/clips` rồi chọn theo tên — chỉ cái tên đi qua dây, máy chủ đọc tệp tại chỗ (`CORE_CONTRACTS.md` §2.12).

## Hai thứ lấy ra được sau một lần chạy

Phụ đề **đốt vào hình**, không có tệp `.srt` rời — bản mẫu này không mang node Xuất Phụ Đề. Cần `.srt` thì kéo node đó từ Thư Viện và nối vào cổng `captions` của node Phụ Đề.

- **Xuất MP4** — video, bấm Kết xuất trên node.
- **Ảnh Bìa** — vẽ thiết kế bìa của giao diện ra PNG. Bỏ qua mặc định như Xuất MP4, bấm Vẽ Bìa khi cần.

Đồ thị còn mang sẵn node Nhạc Nền, chưa chọn bản nhạc nên giọng đi qua nguyên vẹn.

## Bìa dọc cho phim ngang

Bìa **không phải một khung của video** — nền tảng nào cũng đã cho tua video chọn thumbnail rồi. Nó là một thiết kế riêng: `CoverDef` nằm trong Đạo Diễn Mỹ Thuật cùng stage và blocks (`CORE_CONTRACTS.md` §2.13), có **khung của riêng nó**.

Bản mẫu này ship một bìa **1080×1920** cho phim 16:9, vì bìa là thứ nằm cạnh mọi video dọc khác trong luồng — một thumbnail 16:9 có hai vạch đen ở đó đọc ra như lỗi. Cutdown cũng chọn đúng vậy (`thumbnailFrame: PORTRAIT`).

Bố cục theo đúng thumbnail của cutdown: **ảnh kín khung, một tiêu đề canh giữa màn hình**, không gì khác.

| | |
|---|---|
| Lề chữ | 220px mỗi bên (cột 640px, ~59% khung) — rộng hơn vùng an toàn 168px của nền tảng, vì trên ảnh chụp TikTok thật, chữ ở 168 vẫn chạm cột nút |
| Tiêu đề | 58px, nét 700, giãn dòng 1,35 |
| Phụ đề | 36px, cách tiêu đề 28px |

**58px chứ không to hơn**, và đây là chỗ cutdown đã thử rồi bỏ: bản đầu để 120px — gấp đôi phụ đề, lý do là lưới trang kênh — rồi bỏ vì bìa thành một bộ mặt khác hẳn video. Ý đồ là một khung của phim với một câu đứng yên ở chỗ phụ đề vẫn chạy.

**Không có màn tối phủ ảnh.** Thứ giữ chữ đọc được là mực: viền đen `0.14em` vẽ **trước**, ruột trắng đè lên (`paint-order: stroke fill`), rồi một lớp đổ bóng mềm. Vẽ ngược lại thì nét chữ dày lên và mất dáng.

**Canh giữa là canh giữa tiêu đề**, không phải canh giữa cả cụm: phụ đề nằm ngoài dòng chảy và treo bên dưới, nên thêm phụ đề không đẩy tiêu đề lệch khỏi tâm ảnh.

Props: `picture`, `title`, `subtitle` — điền trong node Ảnh Bìa.

Hai điều chưa có: **clip không hiện trong bìa** (phiên chụp không chạy chặng trích khung video của producer), và **cỡ chữ chưa tự co theo độ dài tiêu đề** như `titleSize` của cutdown, nên tiêu đề rất dài sẽ tràn lên ảnh.
