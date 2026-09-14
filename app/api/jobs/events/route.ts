import { jobHub } from '@/server/contracts/hub';
import type { HubEvent } from '@/server/jobs';

export const dynamic = 'force-dynamic';

/**
 * Server-sent events for one workflow key: node states, steps, logs and job status as they happen —
 * the channel ComfyUI uses a WebSocket for. The browser opens one per open tab it is looking at.
 */
export async function GET(req: Request) {
  const key = new URL(req.url).searchParams.get('key') ?? '';
  const encoder = new TextEncoder();
  let off: (() => void) | undefined;
  let beat: ReturnType<typeof setInterval> | undefined;
  const stream = new ReadableStream({
    start(controller) {
      const send = (e: HubEvent) => {
        if (e.key !== key) return;
        try {
          controller.enqueue(encoder.encode(`event: ${e.type}\ndata: ${JSON.stringify(e)}\n\n`));
        } catch {
          /* closed */
        }
      };
      controller.enqueue(encoder.encode(`: connected ${key}\n\n`));
      off = jobHub().subscribe(send);
      beat = setInterval(() => { try { controller.enqueue(encoder.encode(': keepalive\n\n')); } catch { /* closed */ } }, 15_000);
      req.signal.addEventListener('abort', () => { off?.(); if (beat) clearInterval(beat); try { controller.close(); } catch { /* already */ } }, { once: true });
    },
    cancel() {
      off?.();
      if (beat) clearInterval(beat);
    },
  });
  return new Response(stream, { headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' } });
}
