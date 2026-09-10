import { z } from 'zod';
import { SCENE_SOURCE_MAX, type LLMRef, type Style } from '@/core/types/payloads';
import type { NodeServices } from '@/core/engine/services';
import { describeFrame, type FrameSize } from '@/core/visual/frame';
import { STYLE_RULES, lintStyleCss } from './rules';
import { NodeError } from '@/core/errors';
import { IllustratorErrorCode } from './errors';

/**
 * The style, drawn by a model from a brief (CORE_CONTRACTS §5.9): one sheet of CSS every scene of
 * the run shares — the palette and the type as variables on `.nc-scene`, and the classes the scenes
 * are built from — plus a short guide to those classes for the scene prompts. Checked (lint),
 * asked once more with the reason when it fails, then used for this run and kept nowhere: the next
 * run draws again, and the model's answer is cached by prompt, so the same brief is free and comes
 * back the same.
 */

const DrawnStyleSchema = z
  .object({
    name: z.string().min(1).max(80),
    css: z.string().min(40).max(SCENE_SOURCE_MAX),
    guide: z.string().min(1).max(4000),
  })
  .strip();

export interface StyleBrief {
  brief: string;
  frame: FrameSize;
  language: string;
  /** A picture fixed for the whole video — a character, a logo — the scenes should make room for. */
  character?: boolean;
}

export function buildStylePrompt(b: StyleBrief, feedback?: string): string {
  return [
    `You are the illustrator of a short video. Design its style: one CSS style sheet that every scene of the video will share, and a short guide to it for whoever draws the scenes afterwards.`,
    ``,
    `Brief from the user (may be in any language):`,
    `"""`,
    b.brief.trim() || 'No brief: a clean, modern visual style that fits a spoken-word video.',
    `"""`,
    `The video's language is "${b.language}". The frame is ${describeFrame(b.frame)}.`,
    ...(b.character ? [`The user supplied a picture fixed for the whole video (a character or a logo); every scene will show it with <img data-var="character">. Give the guide a rule for where it goes and how big.`] : []),
    ``,
    `Rules:`,
    ...STYLE_RULES.map((r) => `- ${r}`),
    ...(feedback ? [``, `Your previous attempt was rejected: ${feedback}. Fix that.`] : []),
    ``,
    `Return ONLY a JSON object, no prose, no markdown fence:`,
    `{ "name": "a short name for this style", "css": "the whole style sheet", "guide": "five to ten lines: the mood, each class and what it is for, where captions sit, what to avoid" }`,
  ].join('\n');
}

/** Ask for a style, check it, ask once more with the reason if it fails, else throw. */
export async function drawStyle(services: Pick<NodeServices, 'complete'>, ref: LLMRef, b: StyleBrief, signal: AbortSignal): Promise<{ style: Style; guide: string; attempts: number; warnings: string[] }> {
  let feedback: string | undefined;
  for (let attempt = 1; attempt <= 2; attempt++) {
    const a = await services.complete(ref, buildStylePrompt(b, feedback), DrawnStyleSchema, signal, { fresh: attempt > 1 });
    const css = a.css.replace(/^```(?:css)?\s*\n?/, '').replace(/\n?```\s*$/, '').trim();
    const lint = lintStyleCss(css);
    if (lint.hard.length === 0) return { style: { name: a.name, css }, guide: a.guide, attempts: attempt, warnings: lint.soft };
    feedback = lint.hard.join('; ');
  }
  throw new NodeError(IllustratorErrorCode.STYLE_DRAW_FAILED, `the model could not draw a style: ${feedback}`, true).withFix('say less in the brief, or try again');
}
