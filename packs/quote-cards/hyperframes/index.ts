import { registerSceneRenderer } from '@/core/scenes/registry';
import { HYPERFRAMES_ENGINE_ID } from '@/engines/hyperframes/constants';
import { MONO, alpha, easeOut, ramp, wrapText } from '@/engines/hyperframes/draw';
import type { SceneDraw } from '@/engines/hyperframes/types';
import { QUOTE, registerQuoteCardsScenes, type QuoteProps } from '../scenes/schemas';

/**
 * The canvas counterpart of ./remotion. Same scene, same props, no React — the second engine is
 * only worth having if a pack can reach it without knowing anything about the first.
 */

const SERIF = "Georgia, 'Iowan Old Style', 'Times New Roman', serif";
const BG = '#f4f1ea';
const BG_2 = '#ece7dc';
const INK = '#1c1a17';
const INK_2 = '#5b554b';
const RULE = '#d6cfc0';

const drawQuote: SceneDraw<QuoteProps> = ({ text, attribution, accentColor }, c) => {
  const { ctx, width, height, frame } = c;

  const wash = ctx.createRadialGradient(width / 2, 0, 0, width / 2, 0, height * 0.9);
  wash.addColorStop(0, BG_2);
  wash.addColorStop(1, BG);
  ctx.fillStyle = wash;
  ctx.fillRect(0, 0, width, height);

  ctx.globalAlpha = ramp(frame, 0, 10);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';

  const left = 110;
  const maxW = width - left * 2;
  // Same three steps as the Remotion renderer, so a scene does not change length between engines.
  const size = text.length > 150 ? 72 : text.length > 90 ? 88 : 106;
  const lineH = Math.round(size * 1.32);

  ctx.font = `500 ${size}px ${SERIF}`;
  const lines = wrapText((s) => ctx.measureText(s).width, text, maxW);
  const blockH = lines.length * lineH;
  const top = height / 2 - blockH / 2 - 60;

  ctx.fillStyle = alpha(accentColor, 0.35);
  ctx.font = `500 190px ${SERIF}`;
  ctx.fillText('“', left, top - 190);

  const rise = easeOut(ramp(frame, 0, 20));
  ctx.save();
  ctx.translate(0, (1 - rise) * 36);
  ctx.globalAlpha = rise;
  ctx.fillStyle = INK;
  ctx.font = `500 ${size}px ${SERIF}`;
  lines.forEach((line, i) => ctx.fillText(line, left, top + i * lineH));
  ctx.restore();

  const ruleY = top + blockH + 64;
  ctx.globalAlpha = 1;
  ctx.fillStyle = accentColor;
  ctx.fillRect(left, ruleY, 180 * ramp(frame, 12, 30), 4);

  ctx.globalAlpha = ramp(frame, 20, 36);
  ctx.fillStyle = INK_2;
  ctx.font = `400 34px ${MONO}`;
  ctx.fillText(attribution.toUpperCase(), left, ruleY + 34);

  ctx.globalAlpha = 1;
  ctx.fillStyle = RULE;
  ctx.fillRect(left, height - 96, width - left * 2, 2);
};

export function registerQuoteCardsHyperframes(): void {
  registerQuoteCardsScenes();
  registerSceneRenderer(QUOTE, HYPERFRAMES_ENGINE_ID, drawQuote);
}
