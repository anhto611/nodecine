import React from 'react';
import { Composition } from 'remotion';
import { COMPOSITION_ID, NodeCineVideo, type VideoProps } from './Video';
import { registerRemotionRenderers } from './renderers';
import { installRemotionBundlePacks } from '@/packs/installed.remotion';

// The bundle is a separate module graph: it has to repeat both registrations for itself.
registerRemotionRenderers();
installRemotionBundlePacks();

const placeholder: VideoProps = {
  ir: {
    irVersion: 1,
    meta: { title: 'placeholder', language: 'en', theme: 'core/dark', fps: 30, width: 1080, height: 1920, totalDurationInFrames: 270 },
    audioTrack: { voiceoverUrl: '/api/media/0000000000000000.mp3', durationSeconds: 9, padTailFrames: 0 },
    timeline: [{ id: 's1', sceneType: 'core/title-card', startFrame: 0, durationInFrames: 270, props: { headline: 'NodeCine' } }],
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
