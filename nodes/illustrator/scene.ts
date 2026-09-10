import { z } from 'zod';
import { SCENE_SOURCE_MAX, isAssetUrl, type LLMRef, type SceneScript, type Style } from '@/core/types/payloads';
import type { NodeServices } from '@/core/engine/services';
import type { FrameSize } from '@/core/visual/frame';
import { SCENE_RULES, codeRules, lintSceneSource } from './rules';

/**
 * One scene, drawn by a model (CORE_CONTRACTS §5.9): from what the scene says and shows, in the
 * style of the run, one HTML fragment — markup, its own style, its own motion — with the content
 * written in and the verified keys marked for the assembler. Checked against the rules, asked once
 * more with the reason when it fails, then used for this run and kept nowhere.
 */

const DrawnSceneSchema = z.object({ source: z.string().min(1).max(SCENE_SOURCE_MAX) }).strip();

export interface SceneBrief {
  style: Style;
  guide: string;
  frame: FrameSize;
  language: string;
  scene: SceneScript['scenes'][number];
  index: number;
  count: number;
  /** The names of the video's values a scene may draw with `data-var`; a picture is named as such. */
  vars: Record<string, string>;
}

/**
 * The scene's content as lines the model reads: text keys verbatim, bound keys marked, and every
 * picture as a short token (`asset:image`, `asset:entries.2.image`) the model writes into a `src`
 * — a data URL is thousands of characters the model would only copy, and copy wrong. The tokens
 * are swapped for the real sources after the answer (`resolveAssets`).
 */
export function describeContent(scene: SceneScript['scenes'][number]): string[] {
  const bound: Record<string, string | undefined> = scene.factBindings ?? {};
  const line = (k: string, v: unknown, path: string): string => {
    const shown = typeof v === 'string' && isAssetUrl(v) ? `a ${k === 'clip' ? 'clip' : 'picture'} — write src="asset:${path}"` : JSON.stringify(v);
    return `- ${k}: ${shown}${bound[k] ? ` — bound to verified data "${bound[k]}": data-fact="${bound[k]}"` : ''}`;
  };
  const out: string[] = [];
  for (const [k, v] of Object.entries(scene.content)) {
    if (v === undefined || v === '' || (Array.isArray(v) && v.length === 0)) continue;
    if (k === 'entries' && Array.isArray(v)) {
      out.push(`- entries (${v.length}, laid out alike):`);
      v.forEach((e, i) => { for (const [ek, ev] of Object.entries(e as Record<string, unknown>)) if (ev !== undefined && ev !== '') out.push(`  ${i + 1}. ${line(ek, ev, `entries.${i + 1}.${ek}`).slice(2)}`); });
      continue;
    }
    out.push(line(k, v, k));
  }
  // A bound key the script left empty still needs its element.
  const content = scene.content as Record<string, unknown>;
  for (const [k, f] of Object.entries(bound)) if (content[k] === undefined || content[k] === '') out.push(`- ${k}: "…" — bound to verified data "${f}": data-fact="${f}"`);
  return out;
}

/** Every picture and clip of the scene by its token path: `image`, `clip`, `entries.1.image`. */
export function sceneAssets(scene: SceneScript['scenes'][number]): Record<string, string> {
  const out: Record<string, string> = {};
  const content = scene.content as Record<string, unknown>;
  for (const k of ['image', 'clip']) if (typeof content[k] === 'string' && isAssetUrl(content[k] as string)) out[k] = content[k] as string;
  (Array.isArray(content.entries) ? (content.entries as Record<string, unknown>[]) : []).forEach((e, i) => {
    for (const k of ['image', 'clip']) if (typeof e[k] === 'string' && isAssetUrl(e[k] as string)) out[`entries.${i + 1}.${k}`] = e[k] as string;
  });
  return out;
}

/** Swap the `asset:` tokens for the real sources; a token that names nothing is left, for the lint to catch. */
export function resolveAssets(source: string, assets: Record<string, string>): string {
  return source.replace(/asset:([a-z]+(?:\.\d+\.[a-z]+)?)/g, (m, path: string) => assets[path] ?? m);
}

export function buildScenePrompt(b: SceneBrief, feedback?: string): string {
  const content = describeContent(b.scene);
  const vars = Object.entries(b.vars);
  return [
    `You are the illustrator of a short video. Draw scene ${b.index + 1} of ${b.count} as one HTML fragment in the video's style.`,
    ``,
    `The voice says over this scene (${b.scene.role}): "${b.scene.narration}"`,
    content.length ? `On screen, this content:` : `Nothing is written on screen: the ground, the motion and the voice carry it.`,
    ...content,
    ...(vars.length ? [``, `Values of the whole video, to draw with data-var: ${vars.map(([k, v]) => `${k} (${isAssetUrl(v) ? 'a picture, <img data-var="' + k + '">' : JSON.stringify(v)})`).join(', ')}.`] : []),
    ``,
    `Style "${b.style.name}" — the guide:`,
    b.guide.trim(),
    `Its style sheet (already on the page; use its classes and variables, do not repeat it):`,
    '```css',
    b.style.css.trim(),
    '```',
    ``,
    `Rules:`,
    ...codeRules(b.frame).map((r) => `- ${r}`),
    ...SCENE_RULES.map((r) => `- ${r}`),
    ...(feedback ? [``, `Your previous attempt was rejected: ${feedback}. Fix that.`] : []),
    ``,
    `Return ONLY a JSON object, no prose, no markdown fence: { "source": "<the fragment>" }`,
  ].join('\n');
}

/** Ask for the scene, check it, ask once more with the reason if it fails, else throw. */
export async function drawScene(services: Pick<NodeServices, 'complete'>, ref: LLMRef, b: SceneBrief, signal: AbortSignal): Promise<{ source: string; attempts: number; warnings: string[] }> {
  const facts = [...new Set(Object.values(b.scene.factBindings ?? {}))];
  const assets = sceneAssets(b.scene);
  let feedback: string | undefined;
  for (let attempt = 1; attempt <= 2; attempt++) {
    const a = await services.complete(ref, buildScenePrompt(b, feedback), DrawnSceneSchema, signal, { fresh: attempt > 1 });
    // A fenced answer is still an answer.
    const source = resolveAssets(a.source.replace(/^```(?:html)?\s*\n?/, '').replace(/\n?```\s*$/, '').trim(), assets);
    const lint = lintSceneSource(source, { facts, assets });
    if (lint.hard.length === 0) return { source, attempts: attempt, warnings: lint.soft };
    feedback = lint.hard.join('; ');
  }
  throw Object.assign(new Error(`the model could not draw scene ${b.index + 1}: ${feedback}`), { code: 'SCENE_DRAW_FAILED', fix: 'simplify that scene, or try again' });
}
