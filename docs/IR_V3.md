# Bản Đặc Tả Video Trung Gian, phiên bản 3 (đề xuất)

Tài liệu này đề xuất `irVersion` 3. Nó chưa phải hợp đồng: khi được chấp nhận, mục 3 của `CORE_CONTRACTS.md` sẽ thay bằng nội dung ở đây và tệp này bị xóa. Cho tới lúc đó, mọi thứ trong đây là câu hỏi để bạn trả lời, không phải quyết định đã chốt.

---

## 1. Vì sao cần bản này

Phiên bản 2 diễn đạt được chín trong mười sáu thể loại video mà hai engine làm được, và toàn bộ chín thể loại đó đều nằm gọn **trong ranh giới một cảnh**. Bảy thể loại còn lại không đi được, và khi truy từng cái một thì chúng quy về đúng một thiếu sót:

> **IR không biết thứ gì sống lâu hơn một cảnh.**

Sáu chỗ nghẽn đã liệt kê là sáu mặt của điều đó. Không có lớp xuyên phim, nên chiếc điện thoại không bay được từ cảnh này sang cảnh kia và gameplay không chạy nền được dưới mọi cảnh. Một track âm thanh đã trộn sẵn, nên footage không có tiếng và nhạc không tách khỏi giọng. Voice-over là đồng hồ, nên không có lời là không có phim. Một định dạng cảnh duy nhất, nên không khai được cảnh 3D hay Lottie. Không có dữ liệu phân tích âm thanh. Chuyển cảnh là một enum bốn giá trị dùng chung.

Hai trong bốn nhóm người dùng của PRD bị chặn ngay ở thể loại đầu bảng của họ: **App Feature Demo & Mobile Mockup Highlights** của nhóm indie hacker, và **Reddit storytelling kèm gameplay loop** của nhóm faceless. Đây là lý do đủ để đổi lược đồ.

## 2. Những gì không đổi

Bốn nguyên tắc của phiên bản 2 giữ nguyên, và bản 3 phải chứng minh được từng cái:

1. **Độc lập engine.** IR không có trường nào chỉ một engine hiểu. Mọi năng lực mới đi qua registry rỗng trong lõi mà engine tự lấp, cùng mẫu với `registerCodeRenderer`.
2. **Tự chứa.** Một IR đã lưu phát lại được ở bất kỳ đâu. Mỗi đoạn mang bức vẽ hoặc tệp của chính nó. Lõi không có danh sách kiểu cảnh.
3. **Kiểm định bằng mã.** Bất biến kiểm ở Đóng Gói Timeline trước khi phát và ở mọi Adapter trước khi nạp.
4. **Đồ thị là bề mặt soạn thảo, không phải timeline.** PRD mục 5 nói không làm timeline đa rãnh. Bản 3 đưa **rãnh** vào dữ liệu, không đưa vào giao diện: người dùng vẫn lắp node và nối dây, còn rãnh là thứ Đóng Gói Timeline sinh ra từ đồ thị. Đây là cùng một khoảng cách như giữa `timeline[]` hiện tại và việc không có thanh timeline nào trên canvas.

## 3. Ý tưởng duy nhất

Thay `timeline[]` phẳng bằng **rãnh chứa đoạn**. Một rãnh là một lớp, xếp từ dưới lên. Một đoạn là thứ nằm trên rãnh trong một khoảng khung hình, và **một đoạn được phép dài bằng cả phim**. Cảnh của phiên bản 2 trở thành một đoạn mã trên một rãnh. Đó là toàn bộ thay đổi về mô hình; phần còn lại là hệ quả.

Ba thứ được giải bằng cùng một cơ chế:

- **Lớp xuyên phim.** Một rãnh với một đoạn dài bằng phim. Gameplay chạy nền là một đoạn media trên rãnh dưới cùng. Chiếc điện thoại là một đoạn mã trên rãnh phía trên các cảnh.
- **Chỉ đạo theo nhịp.** Đoạn xuyên phim cần biết từng cảnh muốn nó ở đâu. IR mang danh sách **nhịp** (`beats`), mỗi nhịp là một cảnh với khoảng khung hình và một `stage` tự do do kế hoạch đặt vào. Script của đoạn xuyên phim đọc `nodecine.beats` và tự nội suy giữa hai nhịp. Đây chính xác là `STAGES` trong dự án `pigmoney-video`, chuyển thành dữ liệu của IR.
- **Nhiều track âm thanh.** `audioTrack` số ít thành `audio[]`. Giọng là một track có vai `voice`; nhạc là track khác; tiếng của footage là track thứ ba. Đồng hồ không còn treo vào giọng.

## 4. Lược đồ

Viết bằng Zod để không mơ hồ. Tên trường bằng tiếng Anh theo quy ước kho mã.

```ts
export const IR_VERSION = 3 as const;

/** Một đoạn mã: bức vẽ của nó, theo một định dạng engine đăng ký renderer cho. */
const CodeClipSchema = z.object({
  id: z.string().min(1),
  kind: z.literal('code'),
  startFrame: z.number().int().nonnegative(),
  durationInFrames: z.number().int().positive(),
  /** Mặc định `html-gsap`. Engine không có renderer cho định dạng này thì node xuất tự chặn (mục 4 của hợp đồng). */
  format: z.string().min(1).default('html-gsap'),
  source: z.string().min(1).max(SCENE_SOURCE_MAX),
  facts: z.record(z.string(), z.unknown()).optional(),
});

/** Một đoạn media: một tệp, không có bức vẽ. Footage nguyên bản, gameplay nền, ảnh tĩnh. */
const MediaClipSchema = z.object({
  id: z.string().min(1),
  kind: z.literal('media'),
  startFrame: z.number().int().nonnegative(),
  durationInFrames: z.number().int().positive(),
  url: z.union([MediaUrlSchema, AssetUrlSchema]),
  /** Giây trong tệp mà đoạn bắt đầu lấy hình; mặc định 0. */
  offsetSeconds: z.number().nonnegative().default(0),
  fit: z.enum(['cover', 'contain']).default('cover'),
  /** Tệp ngắn hơn đoạn thì lặp lại; dùng cho nền chạy suốt phim. */
  loop: z.boolean().default(false),
  /** Tiếng của chính tệp này, 0 là câm. Mặc định 0 vì phim có giọng đọc không muốn footage nói đè. */
  gain: z.number().min(0).max(1).default(0),
});

const ClipSchema = z.discriminatedUnion('kind', [CodeClipSchema, MediaClipSchema]);

/** Một lớp. Thứ tự trong `tracks` là thứ tự chồng, phần tử đầu ở dưới cùng. */
const TrackSchema = z.object({
  id: z.string().min(1),
  clips: z.array(ClipSchema),
});

/** Một cảnh theo nghĩa của kịch bản: khoảng khung hình, đoạn mã vẽ nó, và chỉ đạo cho các lớp xuyên phim. */
const BeatSchema = z.object({
  index: z.number().int().nonnegative(),
  startFrame: z.number().int().nonnegative(),
  durationInFrames: z.number().int().positive(),
  /** Đoạn mã của cảnh này; phụ đề đổ vào khe `captions` của đoạn đó. */
  clipId: z.string().min(1),
  /** Chỉ đạo tự do do kế hoạch đặt: thế đứng của máy, chỗ đặt chữ, trục trượt. Lõi không đọc, chỉ chuyển. */
  stage: z.record(z.string(), z.unknown()).optional(),
});

const AudioTrackSchema = z.object({
  id: z.string().min(1),
  url: MediaUrlSchema,
  startFrame: z.number().int().nonnegative(),
  durationInFrames: z.number().int().positive(),
  gain: z.number().min(0).max(1).default(1),
  offsetSeconds: z.number().nonnegative().optional(),
  loop: z.boolean().optional(),
  fadeInSeconds: z.number().nonnegative().optional(),
  fadeOutSeconds: z.number().nonnegative().optional(),
  /** Gợi ý, không phải logic: `voice` là track mà `words` và phụ đề thuộc về. Tối đa một track `voice`. */
  role: z.enum(['voice', 'music', 'ambient']).optional(),
  /** Hạ âm lượng khi track `by` đang có tiếng; engine hoặc node trộn thực hiện. */
  duck: z.object({ by: z.string().min(1), to: z.number().min(0).max(1) }).optional(),
  /** Dải tần theo khung hình đã trích sẵn, cho cảnh phản ứng theo nhạc. JSON `{fps, frames: [{bands: number[]}]}`. */
  analysisUrl: MediaUrlSchema.optional(),
});

const TransitionRefSchema = z.object({
  /** Tên trong registry chuyển cảnh; engine không có tên này thì node xuất tự chặn. `cut`, `fade`, `slide`, `zoom` là bốn tên mọi engine phải có. */
  name: z.string().min(1),
  seconds: z.number().min(0.1).max(2),
});

export const VideoIRSchema = z.object({
  irVersion: z.literal(IR_VERSION),
  meta: z.object({
    title: z.string(),
    language: z.string().min(2),
    fps: z.number().int().positive(),
    width: z.number().int().positive(),
    height: z.number().int().positive(),
    /** Có thẩm quyền. Không suy từ bất kỳ track nào lúc đọc. */
    totalDurationInFrames: z.number().int().positive(),
  }),
  style: StyleSchema,
  vars: VarsSchema.optional(),
  tracks: z.array(TrackSchema).min(1),
  beats: z.array(BeatSchema).min(1),
  audio: z.array(AudioTrackSchema),
  transitions: z.object({
    default: TransitionRefSchema,
    /** Ghi đè tại một ranh giới: sau đoạn `afterClipId` trên rãnh nhịp. */
    at: z.array(z.object({ afterClipId: z.string().min(1) }).merge(TransitionRefSchema)).optional(),
  }),
  captions: IRCaptionsSchema.optional(),
});
```

Bốn trường của phiên bản 2 giữ nguyên hình dạng: `meta`, `style`, `vars`, `captions`. Hai trường đổi tên và mở rộng: `timeline` thành `tracks` cộng `beats`, `audioTrack` thành `audio`, `transition` thành `transitions`.

## 5. Ngữ nghĩa

### 5.1. Rãnh và đoạn

Rãnh xếp chồng theo thứ tự mảng, không có trường z riêng: hai cách nói cùng một điều là một cách thừa. Trong một rãnh, các đoạn không chồng lấn và được phép có khe hở; rãnh không buộc phải phủ hết phim. Một rãnh trống là hợp lệ nhưng vô nghĩa, kiểm định cảnh báo chứ không từ chối.

Đoạn mã của bản 3 là cảnh của bản 2, thêm `kind` và `format`. Đoạn media là mới: nó tồn tại để footage nguyên bản và nền chạy suốt phim không phải bọc trong một mảnh HTML chỉ để chứa một thẻ `<video>`. Cả hai engine ánh xạ nó thẳng vào thứ chúng có sẵn.

Quy tắc `timeVideos` của bản 2, đóng dấu mọi `<video>` trong cảnh theo khung của cảnh và ép câm, **giữ nguyên cho đoạn mã**: một `<video>` trong bức vẽ vẫn là B-roll của cảnh đó. Footage muốn dài hơn cảnh hoặc muốn có tiếng thì là đoạn media, không phải thẻ trong bức vẽ.

### 5.2. Nhịp và `stage`

`beats` là cách kịch bản nhìn bộ phim: một dãy cảnh liền nhau từ khung 0 tới hết. Nó thay cho ba bất biến đầu của bản 2, vốn chỉ đúng khi cả phim là một rãnh. Mỗi nhịp trỏ tới một đoạn mã bằng `clipId`; đoạn đó là "cảnh" theo nghĩa cũ, và phụ đề đổ vào khe `captions` của nó như hôm nay.

`stage` là bản đồ tự do. Lõi không đọc nó, không kiểm định nội dung, chỉ chuyển từ kế hoạch sang IR sang engine. Ai viết thì người đó đọc: Họa Sĩ hoặc Kịch Bản Tĩnh đặt `stage.device = {x, y, scale, rot}`, và đoạn xuyên phim vẽ chiếc điện thoại tự nội suy giữa nhịp trước và nhịp này. Đây là điểm cố ý để mở: định nghĩa cứng hình dạng của `stage` trong lõi nghĩa là lõi biết có thứ gọi là điện thoại.

Script của mọi đoạn mã nhận thêm `nodecine.beats` bên cạnh `words`, `when`, `count`, `index`, `duration`. Đoạn nằm trên rãnh nhịp thấy nhịp của chính nó ở `nodecine.beat`; đoạn xuyên phim thấy cả dãy.

### 5.3. Âm thanh và đồng hồ

`audio[]` thay `audioTrack`. Không track nào là bắt buộc. Track có vai `voice` là nơi `words`, `when` và `captions` lấy mốc; không có track `voice` thì `captions` phải vắng và `when` trả về dự phòng.

Đồng hồ là `meta.totalDurationInFrames`, và nó có thẩm quyền. Đóng Gói Timeline **suy** nó lúc dựng theo thứ tự ưu tiên: có track `voice` thì bằng giọng cộng `padTail` như hôm nay; không có giọng thì bằng tham số `durationSeconds` của node nhân với fps; không có tham số thì bằng âm thanh dài nhất. Tham số đứng trước âm thanh (đổi so với bản nháp đầu, khi làm bước 5): nhạc nền hầu như luôn dài hơn phim nó nằm dưới, nên một slideshow hai mươi giây với bản nhạc ba phút phải giữ hai mươi giây; còn phim chỉ có nhạc và không xin độ dài thì dài bằng bản nhạc, đúng nghĩa video ca nhạc. Nhờ vậy logo sting không tiếng, slideshow im lặng và bản dựng chỉ có nhạc đều là phim hợp lệ, không cần đường vòng.

`duck` là dữ liệu, không phải hành vi bắt buộc của engine: node Nhạc Nền hôm nay trộn sẵn và có thể tiếp tục trộn sẵn rồi phát một track đơn; một engine hiểu `duck` có thể trộn lúc kết xuất. Hai đường cùng hợp lệ.

`analysisUrl` trỏ tới JSON dải tần theo khung hình. Cảnh đọc `nodecine.audio(id).bands(frame)`. Node trích xuất chưa có; IR có chỗ cho nó trước để không phải đổi lược đồ lần nữa.

### 5.4. Định dạng và chuyển cảnh

`format` theo từng đoạn thay cho hằng số `SCENE_FORMAT`. Bảng renderer của lõi đã khóa theo `(format, engineId)` từ bản 2, nên phần lõi của thay đổi này chỉ là đọc `clip.format` thay vì hằng số. `html-gsap` là mặc định và là định dạng duy nhất mọi engine bắt buộc phải có.

Chuyển cảnh đi cùng một đường: `registerTransition(name, engineId, impl)` trong lõi, rỗng, engine tự lấp. Bốn tên `cut`, `fade`, `slide`, `zoom` bắt buộc, để mọi IR bản 2 sau di trú vẫn chạy ở mọi engine. HyperFrames đăng ký thêm catalog CSS của nó; Remotion đăng ký các presentation của `TransitionSeries`. Node xuất chặn bằng `ENGINE_TRANSITION_UNSUPPORTED` cùng cách với `ENGINE_SCENE_UNSUPPORTED`.

## 6. Bất biến do lõi kiểm định

1. Ít nhất một rãnh, ít nhất một đoạn trên toàn IR.
2. Trong mỗi rãnh, đoạn sắp theo `startFrame` tăng dần và không chồng lấn.
3. Mọi đoạn và mọi track âm thanh kết thúc không muộn hơn `meta.totalDurationInFrames`.
4. `beats[0].startFrame` bằng 0; mỗi nhịp bắt đầu đúng nơi nhịp trước kết thúc; tổng bằng `meta.totalDurationInFrames`. Ba bất biến đầu của bản 2, chuyển từ rãnh sang nhịp.
5. Mỗi `beats[i].clipId` trỏ tới một đoạn mã có thật, và khoảng khung của nhịp nằm trong khoảng của đoạn đó.
6. Mỗi đoạn mã có `source` không rỗng và là một mảnh, không `<html>`, `<head>`, `<body>`.
7. Tối đa một track âm thanh có vai `voice`; có `captions` thì phải có track `voice`.
8. Mỗi `duck.by` và mỗi `transitions.at[].afterClipId` trỏ tới một id có thật.
9. Mọi `id` của rãnh, đoạn và track âm thanh duy nhất trên toàn IR.

Không bất biến nào nhắc tới `format` hay tên chuyển cảnh: đó là việc của node xuất đối chiếu với engine đã nối, không phải của IR, đúng như bản 2.

## 7. Ánh xạ lên hai engine

| Khái niệm IR | HyperFrames | Remotion |
| --- | --- | --- |
| Rãnh | `data-track-index`, có sẵn | Một `AbsoluteFill` mỗi rãnh, xếp theo thứ tự |
| Đoạn mã | `.clip` với `data-start`, `data-duration`, CSS `@scope`, gsap riêng, như hôm nay | `Sequence` với `from` và `durationInFrames` |
| Đoạn media | `<video>` hoặc `<img>` do framework sở hữu phát, `loop` bằng seek theo modulo | `OffthreadVideo`, `Img`, `Loop` |
| Đoạn xuyên phim | Một `.clip` dài bằng phim trên rãnh riêng | Component không bọc `Sequence`, đúng cách `pigmoney-video` làm |
| `beats` và `stage` | Tiêm JSON vào bootstrap, đọc qua `nodecine.beats` | Truyền qua props |
| `audio[]` | Một `<audio>` mỗi track với `data-start`, `data-duration`, volume | Một `Audio` mỗi track |
| `duck` | Trộn sẵn ở node, hoặc `volume` theo khung | `volume` là hàm của khung |
| `format` | Bảng renderer, có sẵn; thêm `html-three`, `html-webgpu`, `lottie` khi vendor | Thêm `react` như PRD mục 8 |
| Chuyển cảnh | Catalog CSS theo tên | `TransitionSeries` theo tên |
| `analysisUrl` | Mẫu `tl.call` theo khung như kỹ thuật audio-reactive của nó | `visualizeAudio` hoặc đọc JSON |

Không dòng nào trong bảng cần một trường riêng cho một engine. Đó là bằng chứng cho nguyên tắc 1.

## 8. Bản 3 mở khóa tầng nào

Đối chiếu với bảng mười sáu tầng:

| Tầng | Bản 2 | Bản 3 | Nhờ gì |
| --- | --- | --- | --- |
| 2 Một cú máy liên tục | Không | **Được** | Rãnh xuyên phim cộng `beats.stage` |
| 5 Ghép footage | Một phần | **Được** | Đoạn media, `gain`, nhiều track âm thanh |
| 11 Screencast | Không | **Được** | Đoạn media dài bằng phim cộng rãnh chú thích phía trên |
| 14 Phụ đề lên clip có sẵn | Không | **Được** | Đoạn media cộng track `voice` từ Nhập Âm Thanh |
| 12 Logo sting không tiếng | Đường vòng | **Được** | Đồng hồ không treo vào giọng |
| 15 Slideshow | Nghèo | **Đủ** | Chuyển cảnh theo tên, theo từng ranh giới |
| 4 Phản ứng theo nhạc | Không | Có chỗ | `analysisUrl`; còn thiếu node trích xuất |
| 1 3D và shader, 9 Lottie | Không | Có chỗ | `format` theo đoạn; còn thiếu renderer và vendor ở engine |
| Reddit kèm gameplay loop (PRD) | Không | **Được** | Đoạn media `loop` trên rãnh dưới cùng |

Bốn tầng chuyển hẳn sang được, hai tầng có chỗ chờ engine, và cả hai thể loại PRD bị chặn đều mở.

## 9. Di trú từ bản 2

IR không nằm trong tệp workflow, nên đây là bước nhẹ hơn di trú đồ thị. IR bản 2 sống ở ba nơi: kết quả việc trong `.nodecine/jobs/` mà Lịch sử đọc, thẻ `nodecine_workflow` trong MP4 đã xuất, và bộ nhớ của trình phát đang mở. Một hàm thuần `migrateIR(v2): v3` trong `core/types/` chạy ở ba điểm đọc đó:

- `tracks = [{ id: 'scenes', clips: timeline.map(c => ({ ...c, kind: 'code', format: 'html-gsap' })) }]`
- `beats = timeline.map((c, i) => ({ index: i, startFrame: c.startFrame, durationInFrames: c.durationInFrames, clipId: c.id }))`
- `audio = [{ id: 'voice', role: 'voice', url: audioTrack.voiceoverUrl, startFrame: 0, durationInFrames: round(audioTrack.durationSeconds × fps), gain: 1 }]`
- `transitions = { default: { name: transition.type, seconds: transition.seconds } }`

Thuần và không mất thông tin: mỗi IR bản 2 có đúng một IR bản 3 tương đương, và cả hai vẽ ra cùng một phim. `core/__tests__/fixtures/` nhận một IR bản 2 thật để giữ hàm này khỏi mục.

## 10. Thay đổi kéo theo, theo thứ tự ship được từng bước

Mỗi bước để lại app chạy được và test xanh. Không bước nào phải chờ bước sau.

1. **Lược đồ bản 3 và hàm di trú, chưa nối vào đâu.** `migrateIR` thuần, lược đồ bản 3 song song lược đồ bản 2, bộ kiểm định bản 3 với chín bất biến, và một IR bản 2 thật làm tệp mẫu. Không đổi hành vi, vì chưa có gì tiêu thụ bản 3; ba điểm đọc chỉ gọi di trú ở bước 2, khi engine đã đọc được kết quả của nó.
2. **Ghi bản 3 tương đương.** Đóng Gói Timeline phát bản 3 với đúng một rãnh và một track âm thanh; hai engine đọc `tracks`, `beats`, `audio` thay vì `timeline`, `audioTrack`; ba điểm đọc IR cũ (lịch sử việc, thẻ trong MP4, trình phát) gọi `migrateIR`. Phim ra giống hệt. Lược đồ bản 2 xóa khỏi đường ghi.
3. **Đồng hồ không treo vào giọng.** Đóng Gói Timeline nhận `voiceover` thành tùy chọn, thêm tham số `durationSeconds`; quy tắc suy đồng hồ ở mục 5.3. Phim không tiếng là hợp lệ từ đây.
4. **Rãnh thật.** Kiểu cổng mới `LayerSpec`, một thay đổi lõi có chủ đích vì cổng là từ vựng chung. Node mới **Lớp** phát nó: một tệp từ kho asset hoặc thư viện `clips`, hoặc một mảnh HTML, với vị trí dưới hay trên các cảnh và cờ `loop`. Đóng Gói Timeline thêm cổng `layers` dạng `multiple`. Kịch Bản Tĩnh thêm `stage` theo cảnh; Họa Sĩ phát `stage` khi mô tả phong cách yêu cầu. `SCENE_SCRIPT_API` thêm `beats` và `beat`. Bước này mở tầng 2, 5, 11, 14 và gameplay loop.
5. **Âm thanh nhiều track.** Nhập Âm Thanh và Nhạc Nền phát thẳng track thay vì trộn sẵn; Đóng Gói Timeline nhận `audio` dạng `multiple`. Nhạc Nền giữ đường trộn sẵn cho tới khi cả hai engine hiểu `duck`.
6. **Chuyển cảnh theo tên và định dạng theo đoạn.** Registry chuyển cảnh trong lõi, HyperFrames đăng ký catalog, Remotion đăng ký presentation; `ENGINE_TRANSITION_UNSUPPORTED`. `format` đọc từ đoạn. Họa Sĩ nhận cổng `engine` tùy chọn để chọn định dạng theo engine nối vào, đúng PRD mục 8.

Bước 1 tới 3 là việc trong lõi và Đóng Gói Timeline, không cần node mới, không đổi giao diện. Bước 4 là bước duy nhất người dùng nhìn thấy, và là bước trả về nhiều nhất.

### Trạng thái

- **Bước 1 xong, 2026-09-11.** `core/types/ir-v3.ts`, `ir-v2.ts`, `migrate-ir.ts`, `validate-ir.ts`; tệp mẫu `core/__tests__/fixtures/ir-v2-lumen.json` là phim Lumen thật; `core/__tests__/ir-v3.test.ts` kiểm di trú và chín bất biến.
- **Bước 2 xong, 2026-09-11.** `core/types/ir.ts` chỉ còn tên thường trỏ vào bản 3; Đóng Gói Timeline ghi bản 3; HyperFrames và Remotion đọc `tracks`, `beats`, `audio`, `transitions`; Lịch sử việc, Xuất Video và `server/jobs.ts` gọi `migrateIR` khi nạp. Bằng chứng phim giống hệt: `nodes/hyperframes-engine/__tests__/fixtures/lumen-v2*.html` là trang bộ dựng cũ tạo từ phim Lumen, được chụp trước khi sửa bộ dựng; test `the migrated film is the same film` so phần hình của trang mới với bản chụp đó từng byte. Ba thứ đổi có chủ ý và không ảnh hưởng hình: đảo dữ liệu nói bằng `tracks`/`beats`, phần tử `<audio>` mang id của track (`voice`) và độ dài đếm bằng khung nguyên (29,33 s thay vì 29,31 s cho phim 880 khung), và bộ dựng đã vẽ được đoạn `media` và nhiều track âm thanh dù chưa node nào phát ra chúng.
- **Bước 3 xong, 2026-09-11.** Cổng `voiceover` của Đóng Gói Timeline thành tùy chọn, tham số `durationSeconds` mới; `clockOf` trong `nodes/assembler/build-ir.ts` suy đồng hồ theo mục 5.3: giọng thắng, không giọng thì `durationSeconds` đúng bằng và không đệm tới `minTotalFrames`, không có gì thì lỗi `NO_CLOCK` kèm cách sửa. Phụ đề nối vào phim không giọng bị bỏ với cảnh báo `CAPTIONS_WITHOUT_VOICE`. Hai engine đã đọc `audio` rỗng từ bước 2; `nodecine.when` không nghe thấy gì thì rải mốc như trước. Vế "không có giọng nhưng có âm thanh thì theo track dài nhất" chờ bước 5, khi node đầu tiên phát track không phải giọng xuất hiện.
- **Bước 4 xong, 2026-09-11.** Kiểu cổng thứ mười hai `LayerSpec` (`core/types/payloads.ts`), node **Lớp** `core/layer` (tệp từ thư mục clips hay ảnh tải lên, hoặc một bức vẽ; `under`/`over`; `startSeconds`/`durationSeconds`; `fit`, `loop`, `offsetSeconds`, `gain`). Đóng Gói Timeline nhận `layers` dạng `multiple`, `layerTrack` kẹp mỗi lớp vào phim thành một rãnh, `LAYER_OUTSIDE_FILM` khi lớp bắt đầu sau khi phim hết. `stage` đi từ `SceneScript` qua Kịch Bản Tĩnh và Họa Sĩ vào `ScenePlan` rồi `beats[i].stage`; `SCENE_SCRIPT_API` ghi nhận `beats`, `beat`. HyperFrames ghi `loop`, `data-media-start`, `data-volume` trên `<video>` của đoạn media, đúng tên thuộc tính runtime đọc (đã soi trong `hyperframe.runtime.iife.js`). Chưa làm trong bước này: ô sửa `stage` trong Kịch Bản Tĩnh, và Họa Sĩ chưa được nhắc phát `stage` hay vẽ lớp xuyên phim — mô hình chưa biết `nodecine.beats` tồn tại.
- **Bước 5 xong, 2026-09-11.** Kiểu cổng thứ mười ba `AudioTrackSpec`; Nhạc Nền nhận giọng tùy chọn và phát thêm `track` (nhạc lặp, fade, `duckTo`), giữ nguyên đường trộn sẵn có sidechain; Nhập Âm Thanh phát thêm `track` vai `ambient`; Đóng Gói Timeline nhận `audio` nhiều dây, `audioTrackOf` kẹp và đặt tên `<role>-<n>`, `duck` chỉ khi có giọng, `AUDIO_OUTSIDE_FILM`; đồng hồ có nguồn thứ ba là âm thanh dài nhất, xếp sau tham số (lý do ở 5.3). `AudioTrackSchema` thêm `offsetSeconds`, `loop`, `fadeInSeconds`, `fadeOutSeconds`. HyperFrames ghi `data-volume`, `data-media-start`, `loop` và vẽ fade bằng keyframe `volume` trên timeline chủ; Remotion truyền `volume` theo khung, `loop`, `trimBefore`. Bộ nhập âm thanh dùng chung `importLibraryAudio` trong `server/audio.ts`. Chưa làm: engine tự hạ nhạc theo giọng (`duck` vẫn là dữ liệu), node trích `analysisUrl`.
- **Bước 6 xong, 2026-09-11.** Registry chuyển cảnh `core/visual/transitions.ts` (`registerTransition`, `listTransitions`, `unsupportedFilmBlock` hỏi cả renderer theo `format` của từng đoạn lẫn tên chuyển cảnh của phim; `ENGINE_TRANSITION_UNSUPPORTED` kèm danh sách tên engine có). HyperFrames đăng ký catalog mười ba tên (bốn bắt buộc cộng `slide-left`, `slide-right`, `push-up`, `push-left`, `wipe-left`, `wipe-up`, `iris`, `blur`, `flip`), bộ dựng nhúng catalog vào bootstrap và vẽ theo tên thay vì if/else; Remotion đăng ký bốn tên bắt buộc. `ScenePlan.transition.type` thành tên tự do; cảnh có `format` và `transitionAfter`; Đóng Gói đọc `format` từ cảnh và phát `transitions.at`. Họa Sĩ có tham số `transition`/`transitionSeconds`, cổng `engine` tùy chọn để cảnh báo sớm, và ghi `format` lên từng cảnh. Chưa làm: Họa Sĩ chỉ vẽ `html-gsap` nên `format` theo engine mới là dữ liệu, chưa có nhánh vẽ khác; Remotion chưa có `TransitionSeries` vì chưa có renderer cảnh nào; chưa có ô sửa `transitionAfter` trong Kịch Bản Tĩnh.

Sáu bước của mục 10 đã xong. Các việc ngoài IR còn lại làm nốt cùng ngày 2026-09-11:

- Họa Sĩ được nhắc về `nodecine.beats`, `nodecine.beat.stage`, `nodecine.audio`; lời nhắc vẽ cảnh cho phép mô hình trả `stage` khi guide nêu một thứ xuyên phim.
- Kịch Bản Tĩnh có ô `transitionAfter` và `stage` trong hộp sửa cảnh.
- `duck` được engine vẽ: `speechWindowsOf` trong lõi, keyframe `volume` ở HyperFrames, hàm `volume` theo khung ở Remotion.
- Node **Phân Tích Âm Thanh** (`core/audio-analysis`) viết `analysisUrl`; `core/audio/analysis.ts` là FFT thuần; `nodecine.audio(id)` ở cả hai engine.
- Remotion vẽ `html-gsap`: bộ máy cảnh chuyển vào `core/visual/scene-markup.ts` (`SCENE_MOUNT`), catalog gsap vào `core/visual/gsap-transitions.ts`; `nodes/remotion-engine/scene-runtime.ts` gắn cảnh và `seek` theo khung, `transitions.ts` vẽ mười ba tên bằng style theo tiến độ. Chưa kiểm bằng một lần kết xuất Remotion thật trong phiên này; trình phát và bộ dựng được test trong jsdom.
- **Các tầng còn lại, 2026-09-11.** Tầng 1 và 9: định dạng `html-three` và `lottie` trong `SCENE_FORMATS`, `nodecine.frame(fn)` cho cảnh tự vẽ từng khung, three đóng gói bằng `scripts/vendor-three.mjs`, lottie-web vendor thẳng; **kiểm bằng render thật** (`formats.manual.test.ts`: khung sáng và đổi giữa hai mốc). Tầng 4 trọn vẹn: `detectBeats` trong lõi, `beatSeconds` trên track, tham số `snapToBeat` của Đóng Gói dời mốc cắt tới nhịp gần nhất. Lỗ nền cảnh đã vá: `hasTracksUnderBeats` + `TRANSPARENT_GROUND_CSS` ở cả hai engine, Họa Sĩ có tham số `ground`. Remotion lặp được clip: node Lớp đo tệp (`layer/measure`), `sourceSeconds` vào IR, `Loop` bọc clip — **kiểm bằng render thật** (clip 2 giây dưới phim 3 giây, khung 0,5 s và 2,5 s trùng nhau).
- Còn mở: tách phông xanh (runtime HyperFrames chỉ có `chromaBleed` và `chromaticAberration`, không có chroma key; làm được thì phải tự vẽ canvas từng khung và sẽ giẫm lên đường tiêm khung hình của producer); Họa Sĩ chỉ vẽ `html-gsap`, hai định dạng kia phải viết tay qua node Lớp; node nguồn CSV/Sheet và dữ liệu thị trường vẫn nằm ở PRD mục 8.

## 11. Cố ý không làm

- **Tương tác.** Deck điều hướng được và trình phát đổi props lúc chạy không phải video. IR không mang trạng thái đầu vào.
- **Sub-composition lồng nhau.** Rãnh phẳng đủ cho cả bảy tầng đang chặn. Lồng nhau là câu hỏi của bản 4 nếu có nhu cầu thật.
- **Hình dạng cứng cho `stage`.** Đặt `device` hay `caption` vào lược đồ là để lõi biết có điện thoại. Nó ở lại là bản đồ tự do.
- **Trường riêng cho một engine.** Không bao giờ. Mọi thứ engine cần mà IR không có đi qua registry.
