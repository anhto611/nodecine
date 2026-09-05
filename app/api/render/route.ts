import { z } from 'zod';
import { ensureServerRegistrations } from '@/server/register';
import { getEngineFactory } from '@/core/adapters/registry';
import { VideoIRSchema } from '@/core/types/ir';
import { validateIR } from '@/core/assembler/validate-ir';
import { GraphSchema, LocalizedTextSchema } from '@/core/templates/registry';
import { embedWorkflow } from '@/server/video-meta';
import { mediaPath, fileNameFromMediaUrl } from '@/server/paths';

const Body = z.object({
  engineId: z.string(),
  settings: z.record(z.string(), z.unknown()).default({}),
  ir: VideoIRSchema,
  exportSettings: z.object({
    codec: z.enum(['h264', 'h265']),
    quality: z.enum(['high', 'medium', 'low']),
    fileName: z.string().min(1),
  }),
  /** The graph that made this video, to be written into the file so it can be opened again from it. */
  workflow: z.object({ name: LocalizedTextSchema, graph: GraphSchema }).optional(),
});

/** Render as a server-sent event stream: `progress` events, then `done` or `error` (ARCHITECTURE §7). */
export async function POST(req: Request) {
  ensureServerRegistrations();
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: 'bad request', issues: parsed.error.issues }, { status: 400 });
  const { engineId, settings, ir, exportSettings, workflow } = parsed.data;
  const v = validateIR(ir);
  if (!v.ok) return Response.json({ error: 'IR_INVALID', violations: v.violations }, { status: 400 });
  const f = getEngineFactory(engineId);
  if (!f) return Response.json({ error: `unknown engine ${engineId}` }, { status: 404 });
  const adapter = f(settings);

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      try {
        const result = await adapter.render(ir, exportSettings, (p) => send('progress', p), req.signal);
        if (workflow) {
          // Best-effort: a video without its tag is still a video.
          try {
            await embedWorkflow(mediaPath(fileNameFromMediaUrl(result.outputUrl)), { ...workflow, ir }, req.signal);
          } catch (e) {
            send('progress', { renderedFrames: ir.meta.totalDurationInFrames, totalFrames: ir.meta.totalDurationInFrames, note: `workflow tag skipped: ${e instanceof Error ? e.message : String(e)}` });
          }
        }
        send('done', result);
      } catch (e) {
        const code = req.signal.aborted ? 'EXPORT_CANCELLED' : ((e as { code?: string }).code ?? 'EXPORT_FAILED');
        send('error', { code, message: e instanceof Error ? e.message : String(e) });
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, { headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' } });
}
