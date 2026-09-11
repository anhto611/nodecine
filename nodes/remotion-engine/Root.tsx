import React from 'react';
import { Composition } from 'remotion';
import { COMPOSITION_ID, NodeCineVideo, type VideoProps } from './Video';

const placeholder: VideoProps = {
  ir: {
    irVersion: 3,
    meta: { title: 'placeholder', language: 'en', fps: 30, width: 1080, height: 1920, totalDurationInFrames: 270 },
    style: { name: 'Placeholder', css: '' },
    tracks: [{ id: 'scenes', clips: [{ id: 's1', kind: 'code', startFrame: 0, durationInFrames: 270, format: 'html-gsap', source: '<h1>NodeCine</h1>' }] }],
    beats: [{ index: 0, startFrame: 0, durationInFrames: 270, clipId: 's1' }],
    audio: [{ id: 'voice', role: 'voice', url: '/api/media/0000000000000000.mp3', startFrame: 0, durationInFrames: 270, gain: 1 }],
    transitions: { default: { name: 'cut', seconds: 0.1 } },
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
