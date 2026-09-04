import React from 'react';
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import type { TitleCardProps } from '@/core/scenes/title-card';

/** Remotion renderer for `core/title-card` (CORE_CONTRACTS §4). */
export const TitleCard: React.FC<TitleCardProps> = ({ headline, subline, accentColor = '#7c5cff' }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame, fps, config: { damping: 200 } });
  const y = interpolate(enter, [0, 1], [40, 0]);
  const opacity = interpolate(frame, [0, 12], [0, 1], { extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill style={{ background: 'linear-gradient(#0b0c10, #08090c)', justifyContent: 'center', alignItems: 'center', padding: 96 }}>
      <div style={{ width: 120, height: 10, background: accentColor, borderRadius: 5, marginBottom: 56, opacity }} />
      <div
        style={{
          fontFamily: "'JetBrains Mono', ui-monospace, Menlo, monospace",
          fontWeight: 700,
          fontSize: 88,
          lineHeight: 1.15,
          color: '#ffffff',
          textAlign: 'center',
          letterSpacing: '0.01em',
          transform: `translateY(${y}px)`,
          opacity,
        }}
      >
        {headline}
      </div>
      {subline ? (
        <div
          style={{
            marginTop: 40,
            fontFamily: "'JetBrains Mono', ui-monospace, Menlo, monospace",
            fontSize: 36,
            color: '#8b909b',
            textAlign: 'center',
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            opacity: interpolate(frame, [8, 24], [0, 1], { extrapolateRight: 'clamp', extrapolateLeft: 'clamp' }),
          }}
        >
          {subline}
        </div>
      ) : null}
    </AbsoluteFill>
  );
};
