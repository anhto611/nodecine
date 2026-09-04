import React from 'react';
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import type { CtaProps } from '../scenes/schemas';
import { BG, BG_2, LINE, MONO, PANEL, TX, TX_2, alpha } from './theme';

/** `github-showcase/cta` (spec §4.3): repo card with the url line and a pulsing Star call to action. */
export const Cta: React.FC<CtaProps> = ({ headline, callToActionText, accentColor, brandName }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const fade = interpolate(frame, [0, 10], [0, 1], { extrapolateRight: 'clamp' });
  const card = spring({ frame, fps, config: { damping: 200 } });
  const btn = spring({ frame: frame - 14, fps, config: { damping: 12, stiffness: 170 } });
  const pulse = 1 + 0.03 * Math.sin((frame / fps) * Math.PI * 2);
  const textIn = interpolate(frame, [8, 22], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill style={{ background: `linear-gradient(180deg, ${BG_2} 0%, ${BG} 100%)`, fontFamily: MONO, color: TX, padding: '0 84px', justifyContent: 'center', alignItems: 'center', opacity: fade }}>
      <div style={{ width: '100%', background: PANEL, border: `2px solid ${LINE}`, borderRadius: 30, padding: '72px 60px', boxShadow: `0 30px 100px rgba(0,0,0,.55), 0 0 0 6px ${alpha(accentColor, 0.1)}`, transform: `translateY(${interpolate(card, [0, 1], [40, 0])}px)`, opacity: card }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 22, marginBottom: 40 }}>
          <svg width="64" height="64" viewBox="0 0 16 16" fill={TX} aria-hidden><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8z" /></svg>
          {brandName ? <span style={{ fontSize: 34, color: TX_2, wordBreak: 'break-all' }}>{brandName}</span> : null}
        </div>
        <div style={{ fontSize: 76, fontWeight: 800, lineHeight: 1.1, marginBottom: 32 }}>{headline}</div>
        <div style={{ fontSize: 38, lineHeight: 1.45, color: TX_2, opacity: textIn }}>{callToActionText}</div>
        <div style={{ marginTop: 64, display: 'inline-flex', alignItems: 'center', gap: 18, background: accentColor, color: '#0b0c10', borderRadius: 18, padding: '26px 44px', fontSize: 40, fontWeight: 800, transform: `scale(${btn * pulse})`, boxShadow: `0 20px 60px ${alpha(accentColor, 0.35)}` }}>
          <svg width="44" height="44" viewBox="0 0 24 24" fill="currentColor" aria-hidden><polygon points="12 2 15.09 8.6 22 9.6 17 14.5 18.2 21.5 12 18.2 5.8 21.5 7 14.5 2 9.6 8.91 8.6 12 2" /></svg>
          Star on GitHub
        </div>
      </div>
    </AbsoluteFill>
  );
};
