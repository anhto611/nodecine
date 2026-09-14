import { measureDurationSeconds } from '@/server/audio';
import { assetPath } from '@/server/paths';

/**
 * How long the file a layer names actually runs (CORE_CONTRACTS §5.20). Measured with ffprobe, from
 * the asset store, because no engine can repeat a clip it cannot measure and the IR is the only
 * place that knowledge can travel. A picture, or a machine without ffprobe, measures as nothing.
 */
export async function measureLayerOnServer(url: string, signal: AbortSignal): Promise<{ sourceSeconds: number | null }> {
  const m = /^\/api\/assets\/([a-f0-9]{16,64}\.[a-z0-9]+)$/.exec(url);
  if (!m) return { sourceSeconds: null };
  try {
    return { sourceSeconds: await measureDurationSeconds(assetPath(m[1]!), signal) };
  } catch {
    return { sourceSeconds: null };
  }
}

export const layerServices = { 'layer/measure': measureLayerOnServer };
