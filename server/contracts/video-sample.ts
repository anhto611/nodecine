import crypto from 'node:crypto';
import path from 'node:path';
import { createReadStream, existsSync } from 'node:fs';
import { copyFile, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { exec } from '@/server/exec';
import { ffmpegBin } from '@/server/contracts/audio';
import { findBinary } from '@/server/exec';
import { publicLink } from '@/server/contracts/web';
import { mkdtemp } from 'node:fs/promises';
import os from 'node:os';
import { assetPath, assetUrl, ensureAssetsDir } from '@/server/paths';
import type { SampleFrame, SampleProfile, SampleSegment } from '@/contracts/agent/sample';

/**
 * Sample videos for a workflow's agent: kept by content in `.nodecine/samples/<id>/`, read once by
 * rea-video, and turned into the profile the agent is given. rea-video is installed by
 * `npm run setup:rea-video`; this file only runs it and reads what it wrote.
 */

export const REA_SETUP = 'npm run setup:rea-video';
/** Stills sent to the model, at most: one a segment, spread over the film when there are more. */
export const MAX_FRAMES = 24;
/** A reading of a 30-second film takes about two minutes; a long film, proportionally more. */
const REA_TIMEOUT_MS = 30 * 60_000;

export const samplesDir = (): string => path.resolve(process.cwd(), process.env.NODECINE_SAMPLES_DIR ?? '.nodecine/samples');
const ID = /^[a-f0-9]{16}$/;

export function reaVideoBin(): string | null {
  const bin = process.env.NODECINE_REA_VIDEO_BIN || path.resolve(process.cwd(), '.nodecine', 'tools', 'rea-video', 'venv', process.platform === 'win32' ? 'Scripts/rea-video.exe' : 'bin/rea-video');
  return existsSync(bin) ? bin : null;
}

async function hashOf(file: string): Promise<string> {
  const h = crypto.createHash('sha256');
  for await (const chunk of createReadStream(file)) h.update(chunk as Buffer);
  return h.digest('hex').slice(0, 16);
}

export async function readSample(id: string): Promise<SampleProfile | null> {
  if (!ID.test(id)) return null;
  try {
    return JSON.parse(await readFile(path.join(samplesDir(), id, 'profile.json'), 'utf8')) as SampleProfile;
  } catch {
    return null;
  }
}

interface Breakdown {
  source: { width: number; height: number; fps: number; duration: number; has_audio?: boolean };
  summary?: { verdict?: string; packaging?: string[]; transitions?: Record<string, number> };
  shots: { start: number; end: number; beats?: number[]; transition_in?: string }[];
  audio?: { has_audio?: boolean; tempo_bpm?: number; beat_synced_edit?: boolean; music?: { present?: boolean; ratio?: number } };
  speech?: { ok?: boolean; language?: string; lines?: { start: number; end: number; text: string }[] };
}

/**
 * Where the film changes: every shot boundary, and inside a shot every beat rea-video found — in a
 * motion-graphics film, which it reads as one long shot, the beats are where one card gives way to the
 * next. Segments shorter than half a second are folded into the one before.
 */
export function segmentsOf(b: Breakdown): SampleSegment[] {
  const marks: { t: number; by: SampleSegment['by'] }[] = [];
  for (const [i, shot] of b.shots.entries()) {
    marks.push({ t: shot.start, by: i === 0 ? 'start' : 'cut' });
    for (const beat of shot.beats ?? []) if (beat > shot.start + 0.5 && beat < shot.end - 0.5) marks.push({ t: beat, by: 'beat' });
  }
  marks.sort((a, c) => a.t - c.t);
  const kept = marks.filter((m, i) => i === 0 || m.t - marks[i - 1]!.t >= 0.5);
  const end = b.source.duration;
  return kept.map((m, i) => ({ start: Math.round(m.t * 100) / 100, end: Math.round((kept[i + 1]?.t ?? end) * 100) / 100, by: m.by }));
}

const spread = <T>(list: T[], n: number): T[] => (list.length <= n ? list : Array.from({ length: n }, (_, i) => list[Math.round((i * (list.length - 1)) / (n - 1))]!));

async function stills(video: string, id: string, segments: SampleSegment[], signal: AbortSignal): Promise<SampleFrame[]> {
  const ffmpeg = await ffmpegBin();
  if (!ffmpeg) return [];
  await ensureAssetsDir();
  const frames: SampleFrame[] = [];
  for (const [i, seg] of spread(segments, MAX_FRAMES).entries()) {
    const t = Math.round(((seg.start + seg.end) / 2) * 100) / 100;
    // Uploads are named in hex: the sample's id, then the still's place.
    const name = `${id}${(i + 1).toString(16).padStart(2, '0')}.jpg`;
    const r = await exec(ffmpeg, { args: ['-v', 'error', '-y', '-ss', String(t), '-i', video, '-frames:v', '1', '-vf', 'scale=540:-2', '-q:v', '4', assetPath(name)], timeoutMs: 60_000, signal });
    if (r.code === 0) frames.push({ t, url: assetUrl(name) });
  }
  return frames;
}

const MAX_DOWNLOAD = '512M';

/**
 * A sample from a link: a page on YouTube, TikTok, Facebook and the like, or a video file on the web,
 * fetched with yt-dlp — at most 1080p and 512 MB, one video, never a playlist — then read like an upload.
 * The link must point at the public web. Use only videos you may use.
 */
export async function analyzeSampleLink(link: string, signal: AbortSignal): Promise<SampleProfile> {
  const url = await publicLink(link);
  const ytdlp = await findBinary('yt-dlp', 'NODECINE_YTDLP_BIN');
  if (!ytdlp) throw Object.assign(new Error('yt-dlp, which fetches videos from links, is not installed'), { code: 'PROVIDER_NOT_INSTALLED', fix: 'brew install yt-dlp' });
  const dir = await mkdtemp(path.join(os.tmpdir(), 'nodecine-link-'));
  try {
    const ffmpeg = await ffmpegBin();
    const r = await exec(ytdlp, {
      args: [
        '--no-playlist',
        '--no-progress',
        '--no-warnings',
        '--max-filesize',
        MAX_DOWNLOAD,
        '-f',
        'bv*[height<=1080]+ba/b[height<=1080]/b',
        '--merge-output-format',
        'mp4',
        ...(ffmpeg ? ['--ffmpeg-location', ffmpeg] : []),
        '-o',
        path.join(dir, 'video.%(ext)s'),
        '--print',
        'before_dl:%(title)s',
        '--print',
        'after_move:filepath',
        '--',
        url.href,
      ],
      timeoutMs: 15 * 60_000,
      signal,
      maxOutput: 64 * 1024,
    });
    const lines = r.stdout
      .trim()
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
    const file = lines.at(-1);
    if (r.code !== 0 || !file || !existsSync(file)) {
      const why = (r.stderr.trim() || r.stdout.trim()).split('\n').filter(Boolean).at(-1) ?? `exit ${r.code}`;
      throw Object.assign(new Error(`could not fetch the video from that link: ${why.replace(/^ERROR:\s*/, '').slice(0, 300)}`), { code: 'SAMPLE_UNREADABLE' });
    }
    const title =
      (lines.length > 1 ? lines[0]! : url.hostname)
        .replace(/[\\/:*?"<>|]+/g, ' ')
        .trim()
        .slice(0, 100) || url.hostname;
    return await analyzeSample(file, `${title}${path.extname(file) || '.mp4'}`, signal);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

/**
 * Read a video: copied in by content, analysed by rea-video unless it already was, and kept as a
 * profile. `name` is what the person called the file.
 */
export async function analyzeSample(file: string, name: string, signal: AbortSignal): Promise<SampleProfile> {
  const bin = reaVideoBin();
  if (!bin) throw Object.assign(new Error('rea-video, which reads sample videos, is not installed'), { code: 'PROVIDER_NOT_INSTALLED', fix: REA_SETUP });
  const id = await hashOf(file);
  const known = await readSample(id);
  if (known) return { ...known, name };

  const dir = path.join(samplesDir(), id);
  await mkdir(dir, { recursive: true });
  const video = path.join(dir, `video${path.extname(name).toLowerCase() || '.mp4'}`);
  if (!existsSync(video)) await copyFile(file, video);
  const out = path.join(dir, 'rea');
  await rm(out, { recursive: true, force: true });
  const r = await exec(bin, { args: ['decompose', video, '-o', out, '--lang', 'en'], timeoutMs: REA_TIMEOUT_MS, signal, maxOutput: 1024 * 1024 });
  if (r.code !== 0)
    throw Object.assign(new Error(`rea-video could not read this video: ${(r.stderr.trim() || r.stdout.trim()).split('\n').slice(-2).join(' ').slice(0, 300)}`), { code: 'SAMPLE_UNREADABLE' });
  const b = JSON.parse(await readFile(path.join(out, 'breakdown.json'), 'utf8')) as Breakdown;

  const segments = segmentsOf(b);
  const music = b.audio?.music;
  const bed = music?.present ? `music under ${Math.round((music.ratio ?? 0) * 100)}% of it${b.audio?.beat_synced_edit ? ', the cuts on its beat' : ''}` : 'no music';
  const profile: SampleProfile = {
    id,
    name,
    durationSeconds: b.source.duration,
    width: b.source.width,
    height: b.source.height,
    fps: b.source.fps,
    segments,
    frames: await stills(video, id, segments, signal),
    ...(b.summary?.verdict ? { made: b.summary.verdict } : {}),
    ...(b.summary?.packaging?.length ? { captions: b.summary.packaging } : {}),
    ...(b.summary?.transitions ? { transitions: b.summary.transitions } : {}),
    audio: {
      present: !!(b.audio?.has_audio ?? b.source.has_audio),
      ...(music?.present && b.audio?.tempo_bpm ? { musicBpm: Math.round(b.audio.tempo_bpm) } : {}),
      ...(b.audio?.has_audio ? { music: bed } : {}),
    },
    ...(b.speech?.ok && b.speech.lines?.length ? { speech: { language: b.speech.language ?? '', lines: b.speech.lines.slice(0, 80).map(({ start, end, text }) => ({ start, end, text })) } } : {}),
  };
  await writeFile(path.join(dir, 'profile.json'), JSON.stringify(profile, null, 2));
  return profile;
}
