import React from 'react';
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import type { MockupProps } from '../scenes/schemas';
import { BG, LINE, MONO, PANEL, TX, TX_2, TX_3, alpha } from './theme';

/** `github-showcase/mockup` (spec §4.2): a terminal window with the install command and three feature lines. */
export const Mockup: React.FC<MockupProps> = ({ headline, featureHighlights, accentColor, installCommand, repoName }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const fade = interpolate(frame, [0, 10], [0, 1], { extrapolateRight: 'clamp' });
  const win = spring({ frame, fps, config: { damping: 200 } });
  const cmd = installCommand ?? '';
  const typed = cmd.slice(0, Math.floor(interpolate(frame, [10, 10 + Math.max(1, cmd.length) * 1.4], [0, cmd.length], { extrapolateRight: 'clamp', extrapolateLeft: 'clamp' })));
  const typingDone = typed.length >= cmd.length;
  const cursorOn = Math.floor(frame / 8) % 2 === 0;
  const featureStart = cmd ? 14 + cmd.length * 1.4 + 8 : 14;

  return (
    <AbsoluteFill style={{ background: BG, fontFamily: MONO, color: TX, padding: '0 72px', justifyContent: 'center', opacity: fade }}>
      <div style={{ fontSize: 62, fontWeight: 800, lineHeight: 1.15, marginBottom: 56, opacity: win, transform: `translateY(${interpolate(win, [0, 1], [30, 0])}px)` }}>{headline}</div>
      <div style={{ background: PANEL, border: `2px solid ${LINE}`, borderRadius: 26, overflow: 'hidden', boxShadow: `0 40px 120px rgba(0,0,0,.6), 0 0 0 6px ${alpha(accentColor, 0.12)}`, transform: `scale(${interpolate(win, [0, 1], [0.94, 1])})` }}>
        <div style={{ height: 78, display: 'flex', alignItems: 'center', gap: 16, padding: '0 30px', background: '#1a1d24', borderBottom: `2px solid ${LINE}` }}>
          {['#ff5f57', '#febc2e', '#28c840'].map((c) => <span key={c} style={{ width: 22, height: 22, borderRadius: 11, background: c }} />)}
          <span style={{ marginLeft: 18, fontSize: 28, color: TX_2 }}>{repoName ? `${repoName} — zsh` : 'zsh'}</span>
        </div>
        <div style={{ padding: '44px 40px 48px', fontSize: 36, lineHeight: 1.7 }}>
          {cmd ? (
            <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
              <span style={{ color: accentColor }}>$ </span>
              <span>{typed}</span>
              {!typingDone || cursorOn ? <span style={{ display: 'inline-block', width: 20, height: 40, background: TX, verticalAlign: '-6px', marginLeft: 4 }} /> : null}
            </div>
          ) : null}
          {featureHighlights.map((f, i) => {
            const t = spring({ frame: frame - featureStart - i * 9, fps, config: { damping: 200 } });
            return (
              <div key={i} style={{ display: 'flex', gap: 22, alignItems: 'baseline', opacity: t, transform: `translateX(${interpolate(t, [0, 1], [24, 0])}px)`, marginTop: i === 0 && cmd ? 30 : 0 }}>
                <span style={{ color: accentColor, fontWeight: 700 }}>›</span>
                <span style={{ color: TX }}>{f}</span>
              </div>
            );
          })}
          <div style={{ marginTop: 34, color: TX_3, fontSize: 28 }}>{typingDone && cmd ? '✓ ready' : ' '}</div>
        </div>
      </div>
      <div style={{ marginTop: 52, color: TX_3, fontSize: 26, letterSpacing: '0.14em', textTransform: 'uppercase' }}>{repoName ? `github.com · ${repoName}` : ''}</div>
    </AbsoluteFill>
  );
};
