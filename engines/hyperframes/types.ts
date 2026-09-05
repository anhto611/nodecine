/**
 * What a Hyperframes scene renderer is (CORE_CONTRACTS §4): a plain function that paints one frame
 * of one scene onto a 2D canvas. No React, no component tree — the whole point of the second engine
 * is that the Video IR says nothing about how a scene is drawn.
 */

export interface DrawContext {
  ctx: CanvasRenderingContext2D;
  /** Composition size in pixels, from `VideoIR.meta`. */
  width: number;
  height: number;
  /** Frame index inside this scene, 0-based. */
  frame: number;
  /** Length of this scene in frames. */
  durationInFrames: number;
  fps: number;
}

export type SceneDraw<P = Record<string, unknown>> = (props: P, c: DrawContext) => void;
