import React from 'react';
import { AbsoluteFill, Audio, Sequence } from 'remotion';
import type { VideoIR } from '@/core/types/ir';
import { getScene } from '@/core/scenes/registry';

import { REMOTION_ENGINE_ID } from './constants';
export { REMOTION_ENGINE_ID, COMPOSITION_ID } from './constants';

export type VideoProps = {
  ir: VideoIR;
  /** '' in the browser player (same origin); an absolute http://127.0.0.1:<port> during headless render. */
  mediaBaseUrl: string;
};

/** Generic composition: every scene is looked up in the scene registry — this file knows no scene by name. */
export const NodeCineVideo: React.FC<VideoProps> = ({ ir, mediaBaseUrl }) => {
  return (
    <AbsoluteFill style={{ background: '#000' }}>
      <Audio src={`${mediaBaseUrl}${ir.audioTrack.voiceoverUrl}`} />
      {ir.timeline.map((scene) => {
        const Renderer = getScene(scene.sceneType)?.renderers[REMOTION_ENGINE_ID] as React.ComponentType<Record<string, unknown>> | undefined;
        return (
          <Sequence key={scene.id} from={scene.startFrame} durationInFrames={scene.durationInFrames} name={scene.sceneType}>
            {Renderer ? <Renderer {...scene.props} /> : <MissingScene sceneType={scene.sceneType} />}
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};

const MissingScene: React.FC<{ sceneType: string }> = ({ sceneType }) => (
  <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', color: '#f85149', fontFamily: 'monospace', fontSize: 40 }}>
    no renderer: {sceneType}
  </AbsoluteFill>
);
