import React from 'react';
import { AbsoluteFill, Audio, Sequence, continueRender, delayRender } from 'remotion';
import type { VideoIR } from '@/core/types/ir';
import { getScene } from '@/core/scenes/registry';

import { REMOTION_ENGINE_ID } from './constants';
import { loadVideoFonts } from './fonts';
export { REMOTION_ENGINE_ID, COMPOSITION_ID } from './constants';

export type VideoProps = {
  ir: VideoIR;
  /** '' in the browser player (same origin); an absolute http://127.0.0.1:<port> during headless render. */
  mediaBaseUrl: string;
};

/** Generic composition: every scene is looked up in the scene registry — this file knows no scene by name. */
export const NodeCineVideo: React.FC<VideoProps> = ({ ir, mediaBaseUrl }) => {
  // Hold the first frame until the web fonts are in place, otherwise the render captures
  // fallback metrics and the text reflows a few frames in.
  const [handle] = React.useState(() => delayRender('loading video fonts'));
  React.useEffect(() => {
    let cancelled = false;
    void loadVideoFonts(mediaBaseUrl).then(() => { if (!cancelled) continueRender(handle); });
    return () => { cancelled = true; continueRender(handle); };
  }, [handle, mediaBaseUrl]);

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
