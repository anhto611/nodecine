import type { TitleCardProps } from '@/core/scenes/title-card';
import type { SceneDraw } from '../types';
import { MONO, centredText, easeOut, ramp } from '../draw';

/** Hyperframes renderer for `core/title-card`, the mirror of engines/remotion/scenes/TitleCard.tsx. */
export const drawTitleCard: SceneDraw<TitleCardProps> = ({ headline, subline, accentColor = '#7c5cff' }, c) => {
  const { ctx, width, height, frame } = c;

  const bg = ctx.createLinearGradient(0, 0, 0, height);
  bg.addColorStop(0, '#0b0c10');
  bg.addColorStop(1, '#08090c');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);

  const enter = easeOut(ramp(frame, 0, 18));
  const opacity = ramp(frame, 0, 12);
  ctx.globalAlpha = opacity;
  ctx.textAlign = 'center';

  const centre = width / 2;
  const rule = { w: 120, h: 10 };
  ctx.fillStyle = accentColor;
  ctx.fillRect(centre - rule.w / 2, height / 2 - 230, rule.w, rule.h);

  ctx.save();
  ctx.translate(0, (1 - enter) * 40);
  ctx.fillStyle = '#ffffff';
  ctx.font = `700 88px ${MONO}`;
  ctx.textBaseline = 'top';
  const used = centredText(ctx, headline, centre, height / 2 - 120, width - 192, 101);
  ctx.restore();

  if (subline) {
    ctx.globalAlpha = ramp(frame, 8, 24);
    ctx.fillStyle = '#8b909b';
    ctx.font = `400 36px ${MONO}`;
    centredText(ctx, subline.toUpperCase(), centre, height / 2 - 120 + used + 40, width - 192, 46);
  }
  ctx.globalAlpha = 1;
};
