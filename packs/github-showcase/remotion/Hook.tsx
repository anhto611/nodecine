import React from 'react';
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import type { HookProps } from '../scenes/schemas';
import { BG, BG_2, MONO, TX, TX_2, alpha, formatStars } from './theme';

/** `github-showcase/hook` (spec §4.1): uppercase headline, trend badge, star badge with a spring bounce. */
export const Hook: React.FC<HookProps> = ({ headline, subline, badgeText, accentColor, stars }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const fade = interpolate(frame, [0, 10], [0, 1], { extrapolateRight: 'clamp' });
  const title = spring({ frame, fps, config: { damping: 200 } });
  const badge = spring({ frame: frame - 6, fps, config: { damping: 14, stiffness: 160 } });
  const starIn = spring({ frame: frame - 18, fps, config: { damping: 10, stiffness: 180 } });
  const subFade = interpolate(frame, [10, 24], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const showStars = typeof stars === 'number';

  return (
    <AbsoluteFill style={{ background: `radial-gradient(120% 80% at 50% 0%, ${alpha(accentColor, 0.22)} 0%, ${BG_2} 45%, ${BG} 100%)`, fontFamily: MONO, color: TX, padding: '0 84px', justifyContent: 'center', alignItems: 'center', opacity: fade }}>
      <div style={{ position: 'absolute', top: 120, left: 84, right: 84, height: 2, background: alpha(accentColor, 0.5) }} />
      <div style={{ transform: `scale(${badge})`, background: alpha(accentColor, 0.18), border: `2px solid ${accentColor}`, color: accentColor, borderRadius: 999, padding: '14px 34px', fontSize: 30, letterSpacing: '0.18em', textTransform: 'uppercase', fontWeight: 700, marginBottom: 64 }}>
        {badgeText}
      </div>
      <div style={{ fontSize: 104, lineHeight: 1.05, fontWeight: 800, textAlign: 'center', textTransform: 'uppercase', letterSpacing: '-0.01em', transform: `translateY(${interpolate(title, [0, 1], [50, 0])}px)`, opacity: title }}>
        {headline}
      </div>
      <div style={{ marginTop: 44, fontSize: 40, lineHeight: 1.35, color: TX_2, textAlign: 'center', maxWidth: 880, opacity: subFade }}>{subline}</div>
      {showStars ? (
        <div style={{ marginTop: 92, display: 'flex', alignItems: 'center', gap: 22, background: alpha('#ffffff', 0.06), border: `2px solid ${alpha('#ffffff', 0.12)}`, borderRadius: 24, padding: '26px 44px', transform: `scale(${starIn})` }}>
          <svg width="56" height="56" viewBox="0 0 24 24" fill="#e3b341" aria-hidden><polygon points="12 2 15.09 8.6 22 9.6 17 14.5 18.2 21.5 12 18.2 5.8 21.5 7 14.5 2 9.6 8.91 8.6 12 2" /></svg>
          <span style={{ fontSize: 60, fontWeight: 700, letterSpacing: '0.02em' }}>{formatStars(stars)}</span>
          <span style={{ fontSize: 30, color: TX_2, letterSpacing: '0.16em', textTransform: 'uppercase' }}>stars</span>
        </div>
      ) : null}
    </AbsoluteFill>
  );
};
