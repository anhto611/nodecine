import { z } from 'zod';
import { CaptionBandSchema, SCENE_SOURCE_MAX, type LLMRef, type Style } from '@/contracts/types/payloads';
import type { NodeServices } from '@/core/engine/services';
import { describeFrame, type FrameSize } from './frame';
import { describeSafeZones, safeZonesFor } from './safe-zones';
import { STYLE_RULES, lintStyleCss } from './style-rules';
import { NodeError } from '@/contracts/errors';
import { StyleErrorCode } from './style-errors';

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
    captions: CaptionBandSchema,
  })
  .strip();

/** A rule for the caption band that moves it: the one thing this sheet may not decide. */
const BAND_MOVED = /\.nc-captions-default[^{]*\{([^}]*)\}/;
const MOVING = /(^|;)\s*(top|bottom|left|right|inset|position|transform|margin)\s*:/i;

export interface StyleBrief {
  brief: string;
  frame: FrameSize;
  language: string;
  /** A picture fixed for the whole video — a character, a logo — the scenes should make room for. */
  character?: boolean;
  /** Something plays under the scenes: no ground on `.nc-scene`, the picture stays visible. */
  transparent?: boolean;
  /** The film's form (§6): the classes a form leans on are the ones worth defining. */
  form?: { guidance: string };
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
    ...(b.form ? [``, `This film's form — the sheet has to serve it:`, b.form.guidance.trim()] : []),
    ...(b.character ? [`The user supplied a picture fixed for the whole video (a character or a logo); every scene will show it with <img data-var="character">. Give the guide a rule for where it goes and how big.`] : []),
    ...(b.transparent ? [`Footage or a moving picture plays UNDER every scene for the whole film. Give .nc-scene no background at all (background: transparent) and no full-frame ground: the scenes are text and panels over that picture. Make the classes legible over anything — panels and cards with translucent dark or light backgrounds and blur, text with a soft shadow — and tell the guide so.`] : []),
    ``,
    `Rules:`,
    ...STYLE_RULES.map((r) => `- ${r}`),
    ...(feedback ? [``, `Your previous attempt was rejected: ${feedback}. Fix that.`] : []),
    ``,
    ``,
    `The caption band, as numbers on this ${b.frame.width}×${b.frame.height} frame: "left" and "right" are its insets from those edges, "bottom" how far its baseline sits above the bottom edge, "size" the type size in px. Keep it clear of the platform's own UI (${describeSafeZones(safeZonesFor(b.frame.width, b.frame.height))}) and low in the frame, so the picture above it is free.`,
    ``,
    `Return ONLY a JSON object, no prose, no markdown fence:`,
    `{ "name": "a short name for this style", "css": "the whole style sheet", "guide": "five to ten lines: the mood, each class and what it is for, what to avoid", "captions": { "left": 96, "right": 96, "bottom": 150, "size": 46 } }`,
  ].join('\n');
}

/** Ask for a style, check it, ask once more with the reason if it fails, else throw. */
export async function drawStyle(services: Pick<NodeServices, 'complete'>, ref: LLMRef, b: StyleBrief, signal: AbortSignal): Promise<{ style: Style; guide: string; attempts: number; warnings: string[] }> {
  let feedback: string | undefined;
  for (let attempt = 1; attempt <= 2; attempt++) {
    const a = await services.complete(ref, buildStylePrompt(b, feedback), DrawnStyleSchema, signal, { fresh: attempt > 1 });
    const css = a.css.replace(/^```(?:css)?\s*\n?/, '').replace(/\n?```\s*$/, '').trim();
    const lint = lintStyleCss(css);
    // A sheet that moves the band wins over the number everyone else was given, which is the whole
    // reason the number exists: reject it and say so, rather than ship two answers to one question.
    const moved = MOVING.test(BAND_MOVED.exec(css)?.[1] ?? '')
      ? ['the sheet positions .nc-captions-default: take top, bottom, left, right, inset, position, transform and margin out of that rule and say where the band goes in "captions" instead']
      : [];
    if (lint.hard.length === 0 && moved.length === 0) return { style: { name: a.name, css, captions: a.captions }, guide: a.guide, attempts: attempt, warnings: lint.soft };
    feedback = [...lint.hard, ...moved].join('; ');
  }
  throw new NodeError(StyleErrorCode.STYLE_DRAW_FAILED, `the model could not draw a style: ${feedback}`, true).withFix('say less in the brief, or try again');
}
