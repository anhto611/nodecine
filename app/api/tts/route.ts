import path from 'node:path';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { ensureServerRegistrations } from '@/server/register';
import { getTTSProviderFactory } from '@/core/providers/registry';
import { VoiceSchema } from '@/core/types/payloads';
import { mediaUrl } from '@/server/paths';

const Body = z.object({
  providerId: z.string(),
  settings: z.record(z.string(), z.unknown()).default({}),
  text: z.string().min(1),
  voice: VoiceSchema,
  speed: z.number().positive(),
});

export async function POST(req: Request) {
  ensureServerRegistrations();
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'bad request' }, { status: 400 });
  const { providerId, settings, text, voice, speed } = parsed.data;
  const f = getTTSProviderFactory(providerId);
  if (!f) return NextResponse.json({ error: `unknown tts provider ${providerId}` }, { status: 404 });
  try {
    const r = await f(settings).synthesize(text, voice, speed, req.signal);
    return NextResponse.json({
      audioUrl: mediaUrl(path.basename(r.filePath)),
      durationSeconds: r.durationSeconds,
      voiceName: r.voice.id,
      language: r.voice.language,
      speed,
    });
  } catch (e) {
    const code = (e as { code?: string }).code ?? 'TTS_UPSTREAM';
    return NextResponse.json({ error: code, message: e instanceof Error ? e.message : String(e) }, { status: 502 });
  }
}
