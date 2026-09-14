import { getEngineFactory } from '@/contracts/adapters/registry';
import { COMPOSITION_ENTRY, type Composition } from '@/contracts/types/composition';

/**
 * One block or component of a project, played on its own. HyperFrames mounts a part from a host
 * composition, so a host is written for it: the project's own head (its fonts, its theme tokens, GSAP),
 * a root carrying the entry root's id and classes so the style reaches the part, and one clip mounting
 * the part full-frame — with the values the entry mounts it with, when the entry mounts it. The engine
 * then prepares it exactly as it prepares a whole composition.
 */

export interface PartPreview {
  engineId: string;
  url: string;
  width: number;
  height: number;
  duration: number;
}

const attr = (tag: string, name: string): string | undefined => new RegExp(`\\b${name}\\s*=\\s*(["'])([\\s\\S]*?)\\1`, 'i').exec(tag)?.[2];
const escapeAttr = (value: string) => value.replace(/&/g, '&amp;').replace(/"/g, '&quot;');

export const PREVIEW_ROOT_ID = 'nodecine-part-preview';
const DEFAULT_SECONDS = 5;

/** The host page for one part, and the size and length it plays at. */
export function partHost(files: Record<string, string>, partPath: string): { html: string; width: number; height: number; duration: number } {
  const part = files[partPath];
  if (part === undefined) throw Object.assign(new Error(`the project has no ${partPath}`), { code: 'COMPOSITION_INVALID' });
  const entry = files[COMPOSITION_ENTRY] ?? '';
  const entryRoot = /<[a-z][^>]*\bdata-composition-id\s*=[^>]*>/i.exec(entry)?.[0] ?? '';
  const partRoot = /<template[^>]*>[\s\S]*?(<[a-z][^>]*\bdata-composition-id\s*=[^>]*>)/i.exec(part)?.[1] ?? /<[a-z][^>]*\bdata-composition-id\s*=[^>]*>/i.exec(part)?.[0] ?? '';
  const compositionId = attr(partRoot, 'data-composition-id') ?? attr(part, 'data-composition-id');
  if (!compositionId) throw Object.assign(new Error(`${partPath} declares no data-composition-id`), { code: 'COMPOSITION_INVALID' });

  // A block carries its own size; a component takes the frame it is put in, which here is the project's.
  const size = (name: 'width' | 'height', fallback: number) => Number(attr(partRoot, `data-${name}`) ?? attr(entryRoot, `data-${name}`) ?? fallback);
  const width = size('width', 1080);
  const height = size('height', 1920);

  // Where the entry mounts this part, its values and length are the ones worth seeing.
  const mount = [...entry.matchAll(/<[a-z][^>]*\bdata-composition-src\s*=\s*(["'])([^"']+)\1[^>]*>/gi)].find((m) => m[2] === partPath)?.[0];
  const values = mount ? attr(mount, 'data-variable-values') : undefined;
  const duration = Number(attr(mount ?? '', 'data-duration') ?? /\bdata-composition-duration\s*=\s*["']?([\d.]+)/i.exec(part)?.[1] ?? DEFAULT_SECONDS) || DEFAULT_SECONDS;

  const head = /<head[^>]*>([\s\S]*?)<\/head>/i.exec(entry)?.[1] ?? '';
  const gsap = /gsap(\.min)?\.js/.test(head) ? '' : '<script src="gsap.min.js"></script>';
  const rootId = attr(entryRoot, 'id') ?? 'root';
  const rootClass = attr(entryRoot, 'class');
  const html = `<!doctype html>
<html lang="en">
<head>
${head}
${gsap}
<style>html, body { width: ${width}px; height: ${height}px; overflow: hidden; }</style>
</head>
<body>
<div id="${escapeAttr(rootId)}"${rootClass ? ` class="${escapeAttr(rootClass)}"` : ''} data-composition-id="${PREVIEW_ROOT_ID}" data-start="0" data-width="${width}" data-height="${height}" style="position: relative; width: ${width}px; height: ${height}px; overflow: hidden;">
  <div class="clip" style="position: absolute; left: 0; top: 0; width: ${width}px; height: ${height}px;" data-composition-id="${escapeAttr(compositionId)}" data-composition-src="${escapeAttr(partPath)}"${values ? ` data-variable-values="${escapeAttr(values)}"` : ''} data-start="0" data-duration="${duration}" data-track-index="1" data-width="${width}" data-height="${height}"></div>
</div>
<script>
  window.__timelines = window.__timelines || {};
  window.__timelines['${PREVIEW_ROOT_ID}'] = gsap.timeline({ paused: true }).set({}, {}, ${duration});
</script>
</body>
</html>`;
  return { html, width, height, duration };
}

/** A page the engine's player loads to play one part of the project. */
export async function previewPart(project: Pick<Composition, 'files' | 'media'> & { engine?: string }, partPath: string): Promise<PartPreview> {
  const engineId = project.engine ?? 'hyperframes';
  const factory = getEngineFactory(engineId);
  if (!factory) throw Object.assign(new Error(`unknown engine ${engineId}`), { code: 'ENGINE_NOT_READY' });
  const { html, width, height, duration } = partHost(project.files, partPath);
  const composition: Composition = {
    engine: engineId, width, height, fps: 30,
    files: { ...project.files, [COMPOSITION_ENTRY]: html },
    media: project.media as Composition['media'],
    variables: [], values: {},
  };
  const { url } = await factory({}).preview(composition, new AbortController().signal);
  return { engineId, url, width, height, duration };
}
