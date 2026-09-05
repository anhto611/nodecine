import React from 'react';
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import type { QuoteProps } from '../scenes/schemas';
import { BG, BG_2, INK, INK_2, RULE, SANS, SERIF, alpha } from './theme';

/** `quote-cards/quote`: the quote fills the frame, the attribution sits under a short rule. */
export const Quote: React.FC<QuoteProps> = ({ text, attribution, accentColor }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const fade = interpolate(frame, [0, 10], [0, 1], { extrapolateRight: 'clamp' });
  const rise = spring({ frame, fps, config: { damping: 200 } });
  const ruleIn = interpolate(frame, [12, 30], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const nameIn = interpolate(frame, [20, 36], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  // Long quotes need smaller type; three sizes read better than a continuous scale.
  const size = text.length > 150 ? 72 : text.length > 90 ? 88 : 106;

  return (
    <AbsoluteFill style={{ background: `radial-gradient(120% 80% at 50% 0%, ${BG_2} 0%, ${BG} 65%)`, color: INK, padding: '0 110px', justifyContent: 'center', opacity: fade }}>
      <div style={{ fontFamily: SERIF, fontSize: 190, lineHeight: 0.6, color: alpha(accentColor, 0.35), marginBottom: 24 }}>&ldquo;</div>
      <div style={{ fontFamily: SERIF, fontSize: size, lineHeight: 1.32, fontWeight: 500, transform: `translateY(${interpolate(rise, [0, 1], [36, 0])}px)`, opacity: rise }}>
        {text}
      </div>
      <div style={{ width: 180, height: 4, background: accentColor, marginTop: 64, transform: `scaleX(${ruleIn})`, transformOrigin: 'left' }} />
      <div style={{ fontFamily: SANS, fontSize: 34, letterSpacing: '0.08em', textTransform: 'uppercase', color: INK_2, marginTop: 34, opacity: nameIn }}>
        {attribution}
      </div>
      <div style={{ position: 'absolute', left: 110, right: 110, bottom: 96, height: 2, background: RULE }} />
    </AbsoluteFill>
  );
};
