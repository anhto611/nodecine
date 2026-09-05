import { registerSceneRenderer } from '@/core/scenes/registry';
import { HYPERFRAMES_ENGINE_ID } from '@/engines/hyperframes/constants';
import { MONO, alpha, centredText, easeOut, ramp, roundRect, wrapText } from '@/engines/hyperframes/draw';
import type { SceneDraw } from '@/engines/hyperframes/types';
import { CTA, HOOK, MOCKUP, registerGithubShowcaseScenes, type CtaProps, type HookProps, type MockupProps } from '../scenes/schemas';

/**
 * Canvas renderers for the pack's three scenes, the counterpart of ./remotion. Having the same
 * scenes drawn by two engines is what makes "the IR does not know the engine" more than a claim.
 */

const BG = '#0b0c10';
const PANEL = '#14161c';
const LINE = '#2a2e37';
const TX = '#f2f3f5';
const TX_2 = '#9aa0ab';
const TX_3 = '#5f6570';

const drawHook: SceneDraw<HookProps> = ({ headline, subline, badgeText, accentColor, stars }, c) => {
  const { ctx, width, height, frame } = c;
  const glow = ctx.createRadialGradient(width / 2, 0, 0, width / 2, 0, height * 0.8);
  glow.addColorStop(0, alpha(accentColor, 0.22));
  glow.addColorStop(0.45, '#101218');
  glow.addColorStop(1, BG);
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, width, height);

  ctx.globalAlpha = ramp(frame, 0, 10);
  ctx.fillStyle = alpha(accentColor, 0.5);
  ctx.fillRect(84, 120, width - 168, 2);

  const centre = width / 2;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';

  // Badge
  const badgeIn = easeOut(ramp(frame, 6, 24));
  ctx.font = `700 30px ${MONO}`;
  const label = badgeText.toUpperCase();
  const bw = ctx.measureText(label).width + 68;
  ctx.save();
  ctx.translate(centre, height / 2 - 300);
  ctx.scale(badgeIn, badgeIn);
  ctx.fillStyle = alpha(accentColor, 0.18);
  ctx.strokeStyle = accentColor;
  ctx.lineWidth = 2;
  roundRect(ctx, -bw / 2, -30, bw, 60, 30);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = accentColor;
  ctx.fillText(label, 0, -18);
  ctx.restore();

  const titleIn = easeOut(ramp(frame, 0, 20));
  ctx.save();
  ctx.translate(0, (1 - titleIn) * 50);
  ctx.globalAlpha = titleIn;
  ctx.fillStyle = TX;
  ctx.font = `800 104px ${MONO}`;
  const used = centredText(ctx, headline.toUpperCase(), centre, height / 2 - 200, width - 168, 110);
  ctx.restore();

  ctx.globalAlpha = ramp(frame, 10, 24);
  ctx.fillStyle = TX_2;
  ctx.font = `400 40px ${MONO}`;
  const subTop = height / 2 - 200 + used + 44;
  const subUsed = centredText(ctx, subline, centre, subTop, 880, 54);

  if (typeof stars === 'number') {
    const pop = easeOut(ramp(frame, 18, 36));
    const text = stars.toLocaleString('en-US');
    ctx.save();
    ctx.translate(centre, subTop + subUsed + 92);
    ctx.scale(pop, pop);
    ctx.font = `700 60px ${MONO}`;
    const nw = ctx.measureText(text).width;
    ctx.font = `400 30px ${MONO}`;
    const lw = ctx.measureText('STARS').width;
    const boxW = 56 + nw + 22 + lw + 88;
    ctx.fillStyle = alpha('#ffffff', 0.06);
    ctx.strokeStyle = alpha('#ffffff', 0.12);
    ctx.lineWidth = 2;
    roundRect(ctx, -boxW / 2, -52, boxW, 104, 24);
    ctx.fill();
    ctx.stroke();
    ctx.textAlign = 'left';
    ctx.fillStyle = '#e3b341';
    ctx.font = `700 52px ${MONO}`;
    ctx.textBaseline = 'middle';
    ctx.fillText('★', -boxW / 2 + 44, 0);
    ctx.fillStyle = TX;
    ctx.font = `700 60px ${MONO}`;
    ctx.fillText(text, -boxW / 2 + 44 + 56, 0);
    ctx.fillStyle = TX_2;
    ctx.font = `400 30px ${MONO}`;
    ctx.fillText('STARS', -boxW / 2 + 44 + 56 + nw + 22, 4);
    ctx.restore();
  }
  ctx.globalAlpha = 1;
};

const drawMockup: SceneDraw<MockupProps> = ({ headline, featureHighlights, accentColor, installCommand, repoName }, c) => {
  const { ctx, width, height, frame } = c;
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, width, height);
  ctx.globalAlpha = ramp(frame, 0, 10);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';

  const win = easeOut(ramp(frame, 0, 20));
  const left = 72;
  const w = width - 144;

  ctx.save();
  ctx.translate(0, (1 - win) * 30);
  ctx.fillStyle = TX;
  ctx.font = `800 62px ${MONO}`;
  const titleH = wrapText((s) => ctx.measureText(s).width, headline, w).length * 72;
  wrapText((s) => ctx.measureText(s).width, headline, w).forEach((line, i) => ctx.fillText(line, left, height / 2 - 420 + i * 72));
  ctx.restore();

  const top = height / 2 - 420 + titleH + 56;
  const panelH = 470;
  ctx.fillStyle = PANEL;
  ctx.strokeStyle = LINE;
  ctx.lineWidth = 2;
  roundRect(ctx, left, top, w, panelH, 26);
  ctx.fill();
  ctx.stroke();

  // Title bar with the three lights.
  ctx.fillStyle = '#1a1d24';
  ctx.save();
  roundRect(ctx, left, top, w, 78, 26);
  ctx.clip();
  ctx.fillRect(left, top, w, 78);
  ctx.restore();
  ctx.strokeStyle = LINE;
  ctx.beginPath();
  ctx.moveTo(left, top + 78);
  ctx.lineTo(left + w, top + 78);
  ctx.stroke();
  ['#ff5f57', '#febc2e', '#28c840'].forEach((colour, i) => {
    ctx.fillStyle = colour;
    ctx.beginPath();
    ctx.arc(left + 42 + i * 38, top + 39, 11, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.fillStyle = TX_2;
  ctx.font = `400 28px ${MONO}`;
  ctx.textBaseline = 'middle';
  ctx.fillText(repoName ? `${repoName} — zsh` : 'zsh', left + 172, top + 40);

  ctx.textBaseline = 'top';
  let y = top + 122;
  const cmd = installCommand ?? '';
  if (cmd) {
    const typed = cmd.slice(0, Math.floor(ramp(frame, 10, 10 + Math.max(1, cmd.length) * 1.4) * cmd.length));
    ctx.font = `400 36px ${MONO}`;
    ctx.fillStyle = accentColor;
    ctx.fillText('$ ', left + 40, y);
    ctx.fillStyle = TX;
    ctx.fillText(typed, left + 40 + ctx.measureText('$ ').width, y);
    if (typed.length < cmd.length || Math.floor(frame / 8) % 2 === 0) {
      ctx.fillStyle = TX;
      ctx.fillRect(left + 40 + ctx.measureText(`$ ${typed}`).width + 4, y + 4, 18, 38);
    }
    y += 78;
  }

  const featureStart = cmd ? 14 + cmd.length * 1.4 + 8 : 14;
  featureHighlights.forEach((f, i) => {
    const t = easeOut(ramp(frame, featureStart + i * 9, featureStart + i * 9 + 14));
    ctx.globalAlpha = t;
    ctx.font = `400 36px ${MONO}`;
    ctx.fillStyle = accentColor;
    ctx.fillText('›', left + 40 + (1 - t) * 24, y);
    ctx.fillStyle = TX;
    ctx.fillText(f, left + 78 + (1 - t) * 24, y);
    y += 62;
  });
  ctx.globalAlpha = 1;

  ctx.fillStyle = TX_3;
  ctx.font = `400 28px ${MONO}`;
  ctx.fillText(cmd ? '✓ ready' : ' ', left + 40, top + panelH - 62);
  if (repoName) {
    ctx.fillText(`GITHUB.COM · ${repoName.toUpperCase()}`, left, top + panelH + 46);
  }
};

const drawCta: SceneDraw<CtaProps> = ({ headline, callToActionText, accentColor, brandName }, c) => {
  const { ctx, width, height, frame, fps } = c;
  const bg = ctx.createLinearGradient(0, 0, 0, height);
  bg.addColorStop(0, '#101218');
  bg.addColorStop(1, BG);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);
  ctx.globalAlpha = ramp(frame, 0, 10);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';

  const card = easeOut(ramp(frame, 0, 20));
  const left = 84;
  const w = width - 168;
  const top = height / 2 - 380 + (1 - card) * 40;
  const h = 760;
  ctx.fillStyle = PANEL;
  ctx.strokeStyle = LINE;
  ctx.lineWidth = 2;
  roundRect(ctx, left, top, w, h, 30);
  ctx.fill();
  ctx.stroke();

  const pad = 60;
  let y = top + 72;
  ctx.fillStyle = TX;
  ctx.font = `700 56px ${MONO}`;
  ctx.fillText('◉', left + pad, y);
  if (brandName) {
    ctx.fillStyle = TX_2;
    ctx.font = `400 34px ${MONO}`;
    ctx.fillText(brandName, left + pad + 84, y + 12);
  }
  y += 112;

  ctx.fillStyle = TX;
  ctx.font = `800 76px ${MONO}`;
  wrapText((s) => ctx.measureText(s).width, headline, w - pad * 2).forEach((line, i) => ctx.fillText(line, left + pad, y + i * 84));
  y += wrapText((s) => ctx.measureText(s).width, headline, w - pad * 2).length * 84 + 24;

  ctx.globalAlpha = ramp(frame, 8, 22);
  ctx.fillStyle = TX_2;
  ctx.font = `400 38px ${MONO}`;
  wrapText((s) => ctx.measureText(s).width, callToActionText, w - pad * 2).forEach((line, i) => ctx.fillText(line, left + pad, y + i * 54));
  ctx.globalAlpha = 1;

  const btn = easeOut(ramp(frame, 14, 32)) * (1 + 0.03 * Math.sin((frame / fps) * Math.PI * 2));
  const label = 'Star on GitHub';
  ctx.font = `800 40px ${MONO}`;
  const bw = ctx.measureText(label).width + 62 + 44;
  ctx.save();
  ctx.translate(left + pad + bw / 2, top + h - 130);
  ctx.scale(btn, btn);
  ctx.fillStyle = accentColor;
  roundRect(ctx, -bw / 2, -46, bw, 92, 18);
  ctx.fill();
  ctx.fillStyle = '#0b0c10';
  ctx.textBaseline = 'middle';
  ctx.fillText('★', -bw / 2 + 30, 0);
  ctx.fillText(label, -bw / 2 + 30 + 54, 0);
  ctx.restore();
};

export function registerGithubShowcaseHyperframes(): void {
  registerGithubShowcaseScenes();
  registerSceneRenderer(HOOK, HYPERFRAMES_ENGINE_ID, drawHook);
  registerSceneRenderer(MOCKUP, HYPERFRAMES_ENGINE_ID, drawMockup);
  registerSceneRenderer(CTA, HYPERFRAMES_ENGINE_ID, drawCta);
}
