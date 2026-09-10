import React from 'react';
import { Composition } from 'remotion';
import { COMPOSITION_ID, NodeCineVideo, type VideoProps } from './Video';

const placeholder: VideoProps = {
  ir: {
    irVersion: 2,
    meta: { title: 'placeholder', language: 'en', fps: 30, width: 1080, height: 1920, totalDurationInFrames: 270 },
    style: { name: 'Placeholder', css: '' },
    transition: { type: 'cut', seconds: 0.1 },
    audioTrack: { voiceoverUrl: '/api/media/0000000000000000.mp3', durationSeconds: 9, padTailFrames: 0 },
    timeline: [{ id: 's1', startFrame: 0, durationInFrames: 270, source: '<h1>NodeCine</h1>' }],
  },
  mediaBaseUrl: '',
};

export const RemotionRoot: React.FC = () => (
  <Composition
    id={COMPOSITION_ID}
    component={NodeCineVideo}
    defaultProps={placeholder}
    durationInFrames={270}
    fps={30}
    width={1080}
    height={1920}
    calculateMetadata={({ props }) => ({
      durationInFrames: props.ir.meta.totalDurationInFrames,
      fps: props.ir.meta.fps,
      width: props.ir.meta.width,
      height: props.ir.meta.height,
    })}
  />
);
