import React from 'react';
import { Composition } from 'remotion';
import { COMPOSITION_ID, NodeCineVideo, type VideoProps } from './Video';
import { DEFAULT_STAGE } from '@/core/nodes/stage';
import { DEFAULT_BLOCK } from '@/core/nodes/blocks';

const placeholder: VideoProps = {
  ir: {
    irVersion: 1,
    meta: { title: 'placeholder', language: 'en', fps: 30, width: 1080, height: 1920, totalDurationInFrames: 270 },
    stage: DEFAULT_STAGE,
    blocks: [DEFAULT_BLOCK],
    audioTrack: { voiceoverUrl: '/api/media/0000000000000000.mp3', durationSeconds: 9, padTailFrames: 0 },
    timeline: [{ id: 's1', blockId: DEFAULT_BLOCK.id, startFrame: 0, durationInFrames: 270, props: { headline: 'NodeCine' } }],
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
