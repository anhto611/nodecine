---
title: 'Running NodeCine on Windows'
type: concept
created: 2026-10-02
updated: 2026-10-02
---

# Running NodeCine on Windows

## Content

According to the [archived README](../../raw/2026-10-02-nodecine-readme.md), the project requires Node.js 22.12 or newer.
In PowerShell, if execution policy blocks `npm.ps1`, use:

```powershell
npm.cmd ci
npm.cmd run dev
```

Open `http://127.0.0.1:3000`. Studio and the sample composition do not require an API key.
Source: README, Quick start and Windows instructions.

FFmpeg and ffprobe are required for media processing. `NODECINE_FFMPEG_BIN` can be set
in `.env.local` to point to `ffmpeg.exe`, with `ffprobe.exe` located in the same directory.
System TTS relies on macOS `say`, so a different voice provider must be selected on Windows.
Source: README, Requirements and Advanced environment overrides.

## Limitations and open questions

The commands above reflect instructions from documentation. This page does not verify current server runtime status
or provider compatibility across all setups. Re-verify if project versions change.

## Sources

- [README source summary](../sources/nodecine-readme.md).
- [Archived README](../../raw/2026-10-02-nodecine-readme.md).

## Related

- [Catalog Index](../index.md).
