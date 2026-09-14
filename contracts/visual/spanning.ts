import { z } from 'zod';
import { SCENE_SOURCE_MAX, type CaptionBand, type LLMRef, type Style } from '../types/payloads';
import type { NodeServices } from '@/core/engine/services';
import { describeFrame, type FrameSize } from './frame';
import { captionBandBox } from './scene-markup';
import { safeZonesFor } from './safe-zones';
import { NodeError } from '@/contracts/errors';
import { SpanningErrorCode } from './spanning-errors';
import { lintSceneSource } from './scene-rules';

/**
 * The one thing that is on screen for the whole film and is not a scene (CORE_CONTRACTS §5.9): a
 * device the scenes talk about, a mascot, a frame around a screen recording, a camera flying through
 * one world. Drawn once, by the same model that draws the scenes, and emitted as a layer.
 *
 * Why the Illustrator and not the Layer node: a thing drawn beside the scenes only works if the two
 * sides agree — on where it sits, on how much of the frame it takes, on whether the scenes may paint
 * a ground at all. Only the one who draws both can make them agree, and the run on 2026-09-11 showed
 * what happens otherwise: the scenes wrote text straight across the phone.
 */

/**
 * The key the scenes use to say where they want it, and the layer's script reads back. One fixed
 * word, because a name negotiated between two model answers is a name they will one day spell
 * differently — which is exactly how a phone ended up off the frame.
 */
export const STAGE_KEY = 'spanning';

/**
 * The box a spanning drawing may fill: the safe area, less the caption band and a gap above it.
 *
 * Without it the model drew a phone as tall as the safe area and the voice's words landed on its
 * screen for the whole film. Raising the words over the phone only swaps which of the two is
 * unreadable, so the room is divided once, here, and both sides are told the same numbers.
 */
export function spanningLane(frame: FrameSize, captions?: CaptionBand): { x: number; y: number; width: number; height: number } {
  const zone = safeZonesFor(frame.width, frame.height);
  const band = captionBandBox(frame.width, frame.height, captions);
  const floor = band.y - Math.round(frame.height * 0.02);
  return { x: zone.left, y: zone.top, width: frame.width - zone.left - zone.right, height: Math.max(64, floor - zone.top) };
}

const DrawnSpanningSchema = z
  .object({
    source: z.string().min(1).max(SCENE_SOURCE_MAX),
    /** Its natural size in frame pixels: what `scale: 1` in a scene's stage entry means. */
    width: z.number().int().min(16).max(8192),
    height: z.number().int().min(16).max(8192),
  })
  .strip();

export interface SpanningBrief {
  /** What the thing is, in the user's words. */
  brief: string;
  /**
   * The rectangle it lives in, when the film gave it one. The scenes keep out of exactly this, so
   * this is also the promise it has to keep: never a pixel outside it.
   */
  home?: { x: number; y: number; width: number; height: number };
  /**
   * The scenes place it, one pose at a time (§6.1). Then the home is a size and not a cage: the
   * drawing must fit it, but every beat moves it somewhere the pose decided, which is usually
   * outside the rectangle it was drawn in.
   */
  placedByScenes?: boolean;
  style: Style;
  guide: string;
  frame: FrameSize;
  placement: 'under' | 'over';
  /** How many scenes it will travel across. */
  beats: number;
  /**
   * The key under `stage` this one answers to. One film may carry several of these, and each has to
   * read its own entry: a name shared between two of them is two drawings fighting over one place.
   */
  stageKey?: string;
  /** Where the film writes its captions, so this keeps out of them. */
  band?: CaptionBand;
}

export function buildSpanningPrompt(b: SpanningBrief, feedback?: string): string {
  const over = b.placement === 'over';
  const key = b.stageKey ?? STAGE_KEY;
  // Its own home when the film gave it one, else the whole lane above the captions.
  const lane = b.home ?? spanningLane(b.frame, b.band);
  return [
    `You are the illustrator of a short video. Draw ONE thing that stays on screen for the whole film, on its own layer ${over ? 'over' : 'under'} the scenes. You are not drawing a scene; the scenes are drawn separately and sit ${over ? 'under' : 'over'} you.`,
    ``,
    `What it is, in the user's words:`,
    `"""`,
    b.brief.trim(),
    `"""`,
    ``,
    `Style "${b.style.name}" — the guide:`,
    b.guide.trim(),
    `Its style sheet is already on the page; use its variables and classes, do not repeat it.`,
    ``,
    `Rules:`,
    `- Output format: one HTML fragment containing markup, optional <style>, and optional <script>. No <html>, <head> or <body>.`,
    `- The frame is ${describeFrame(b.frame)}. Draw the thing at its natural size, positioned at left: 0; top: 0 — the script below moves it. Do not centre it with flex or with margins: the script owns where it is.`,
    b.home && b.placedByScenes
      ? `- Draw to fit ${lane.width}×${lane.height} px: report a width no larger than ${lane.width} and a height no larger than ${lane.height}. Where you sit is not yours to choose — every scene says so under "stage" below, and the scenes are laid out around wherever that is.`
      : b.home
      ? `- You live in a ${lane.width}×${lane.height} px rectangle whose top-left corner is at ${lane.x},${lane.y} in the frame. Report a width no larger than ${lane.width} and a height no larger than ${lane.height}, and never move a pixel outside that rectangle: the scenes are drawn around it, and everything you put outside covers their words.`
      : `- It has to fit in ${lane.width}×${lane.height} px: report a width no larger than ${lane.width} and a height no larger than ${lane.height}, and draw it to that size. Below that lane is the band the spoken words are written in, and a thing that reaches into it covers them for the whole film.`,
    over
      ? `- You are OVER the scenes, so paint NO full-frame background of any kind: everything outside the thing itself must stay transparent, or the scenes under you disappear.`
      : `- You are UNDER the scenes, so you may fill the frame: this is the film's backdrop.`,
    `- The film has ${b.beats} scenes. Your script receives nodecine.beats: a list of { index, start, duration, clipId, stage }, in seconds. Each scene says where it wants you in stage.${key} = { x, y, scale, rot }: x and y are YOUR CENTRE in pixels of the ${b.frame.width}×${b.frame.height} frame measured from its top-left, scale 1 is the natural size you are about to report, rot is degrees clockwise.`,
    `- gsap, nodecine and root are already variables in scope where your <script> runs — they are arguments, not globals. Never read them off window: window.nodecine does not exist, and a fallback for when it is missing would run every time and pin you in one place.`,
    `- Move between those positions on one gsap timeline: set the first beat's entry at its start, then tween to each later beat's entry at that beat's start, a little under a second each, and register it with nodecine.timeline(). Use xPercent: -50 and yPercent: -50 so x and y mean the centre. Tween ALL FOUR of x, y, scale and rotation every time — a beat that asks you to come forward and turn is not answered by sliding, and a film where you only ever slide reads as a sticker rather than a camera.`,
    // Scenes poured into plates carry no stage: a plate is drawn once for a shape and cannot decide
    // where this belongs in one particular scene. Standing still through the whole film is the worst
    // of the three answers, so the drawing is asked for a path of its own to fall back on.
    `- Not every film tells you where to be. A beat with no entry under "${key}" is yours to decide: carry on from where you were, or move along a path of your own across the beats — a slow drift, a tilt, a step to the other side of the frame at a cut. Never simply stand still for the whole film. Stay inside the lane above whatever you choose.`,
    `- Anything inside the thing may change from beat to beat as well — a screen that shows a different state, a face that turns — driven by the same beats.`,
    `- Animation uses fromTo, never from, and never an infinite repeat: the film is seeked frame by frame, not played.`,
    `- No network, no external files.`,
    ...(feedback ? [``, `Your previous attempt was rejected: ${feedback}. Fix that.`] : []),
    ``,
    `Return ONLY a JSON object, no prose, no markdown fence: { "source": "<the fragment>", "width": <its natural width in px>, "height": <its natural height in px> }`,
  ].join('\n');
}

export interface DrawnSpanning {
  source: string;
  width: number;
  height: number;
  attempts: number;
  warnings: string[];
}

/** Ask for it, check it, ask once more with the reason if it fails, else throw. */
export async function drawSpanning(services: Pick<NodeServices, 'complete'>, ref: LLMRef, b: SpanningBrief, signal: AbortSignal): Promise<DrawnSpanning> {
  let feedback: string | undefined;
  for (let attempt = 1; attempt <= 2; attempt++) {
    const a = await services.complete(ref, buildSpanningPrompt(b, feedback), DrawnSpanningSchema, signal, { fresh: attempt > 1 });
    const source = a.source.replace(/^```(?:html)?\s*\n?/, '').replace(/\n?```\s*$/, '').trim();
    const lane = b.home ?? spanningLane(b.frame, b.band);
    const tooBig = a.width > lane.width || a.height > lane.height
      ? [`it is ${a.width}×${a.height} px and must fit in ${lane.width}×${lane.height}: draw it smaller, do not reach into the caption band`]
      : [];
    const lint = lintSpanning(source, b);
    if (lint.hard.length === 0 && tooBig.length === 0) return { source, width: a.width, height: a.height, attempts: attempt, warnings: lint.soft };
    feedback = [...lint.hard, ...tooBig].join('; ');
  }
  throw new NodeError(SpanningErrorCode.SPANNING_DRAW_FAILED, `the model could not draw the spanning layer: ${feedback}`, true).withFix('say it more simply, or leave the spanning brief empty');
}

/**
 * What a spanning drawing must not do, on top of the scene rules. The one that matters is the
 * timeline: a thing that never reads the beats does not travel with the film, it just sits there.
 */
export function lintSpanning(source: string, b: Pick<SpanningBrief, 'beats' | 'placement'>): { hard: string[]; soft: string[] } {
  const { hard, soft } = lintSceneSource(source);
  // By name, not by spelling: a script may bind it to a shorter name first, and only the reading matters.
  if (b.beats > 1 && !(/\bnodecine\b/.test(source) && /\bbeats\b/.test(source))) hard.push('the script never reads nodecine.beats, so it cannot follow the scenes');
  if (!/\.\s*timeline\s*\(/.test(source)) soft.push('nothing was registered with nodecine.timeline(), so it will not move');
  if (b.placement === 'over' && /(?:^|[^-\w])(?:background|background-color)\s*:\s*(?!none|transparent)[^;]+;[^}]*}\s*$/m.test(source.replace(/\s+/g, ' '))) {
    soft.push('a background is painted while over the scenes; anything opaque hides them');
  }
  return { hard, soft };
}
