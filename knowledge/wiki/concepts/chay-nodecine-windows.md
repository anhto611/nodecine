---
title: "Chạy NodeCine trên Windows"
type: concept
created: 2026-10-02
updated: 2026-10-02
---

# Chạy NodeCine trên Windows

## Nội dung

Theo [README đã lưu](../../raw/2026-10-02-nodecine-readme.md), dự án yêu cầu Node.js 22.12 trở lên.
Trong PowerShell, nếu policy chặn `npm.ps1`, dùng:

```powershell
npm.cmd ci
npm.cmd run dev
```

Mở `http://127.0.0.1:3000`. Studio và composition mẫu không yêu cầu API key.
Nguồn: README, Quick start và hướng dẫn Windows.

Để xử lý media, cần FFmpeg và ffprobe. Có thể đặt `NODECINE_FFMPEG_BIN`
trong `.env.local` trỏ tới `ffmpeg.exe`, với `ffprobe.exe` cùng thư mục.
System TTS dùng macOS `say`, nên trên Windows cần chọn provider giọng nói khác.
Nguồn: README, Requirements và Advanced environment overrides.

## Giới hạn và câu hỏi mở

Các lệnh trên là hướng dẫn từ tài liệu. Trang này không xác nhận trạng thái server hiện tại
hay khả năng hoạt động của mọi provider. Cần kiểm tra lại nếu phiên bản dự án thay đổi.

## Nguồn

- [Tóm tắt nguồn README](../sources/nodecine-readme.md).
- [Bản README đã lưu](../../raw/2026-10-02-nodecine-readme.md).

## Liên quan

- [Mục lục](../index.md).
