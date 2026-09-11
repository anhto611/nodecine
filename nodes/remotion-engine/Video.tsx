import React from 'react';
import { AbsoluteFill, Audio, Img, Sequence, Video, continueRender, delayRender, useCurrentFrame } from 'remotion';
import { allClips, speechWindowsOf, type AudioTrack, type Clip, type VideoIR } from '@/core/types/ir';
import { baseLayer, baseStyles, captionStyles, styleCss } from '@/core/visual/scene-markup';
import { SceneInstance, prepareFilm, type PreparedFilm, type PreparedScene } from './scene-runtime';
import { transitionStyle } from './transitions';
export { REMOTION_ENGINE_ID, COMPOSITION_ID } from './constants';

export type VideoProps = {
  ir: VideoIR;
  /** '' in the browser player (same origin); an absolute http://127.0.0.1:<port> during headless render. */
  mediaBaseUrl: string;
};

const IMAGE_URL = /\.(png|jpe?g|webp|gif|svg)$/i;

/**
 * The film as a Remotion composition: one AbsoluteFill per track in order, a Sequence per clip, the
 * audio tracks beside them. A code clip is the core's `html-gsap` machinery mounted in a div and
 * seeked by Remotion's frame; a media clip is Remotion's own element. Transitions are styles per
 * frame from this engine's catalogue, on the incoming and the outgoing beat clip.
 */
export const NodeCineVideo: React.FC<VideoProps> = ({ ir, mediaBaseUrl }) => {
  const film = React.useMemo(() => prepareFilm(ir, mediaBaseUrl), [ir, mediaBaseUrl]);
  const [analysis, setAnalysis] = React.useState<Record<string, unknown>>({});
  // Hold the first frame until the fonts are in and the analysed sounds are read: the scenes are
  // laid out with them, and a frame captured before either reflows a few frames in.
  const [handle] = React.useState(() => delayRender('loading fonts and analysis'));
  React.useEffect(() => {
    let cancelled = false;
    const fonts = typeof document !== 'undefined' && 'fonts' in document ? document.fonts.ready.then(() => undefined) : Promise.resolve();
    const reads = ir.audio.filter((a) => a.analysisUrl).map(async (a) => {
      try { const r = await fetch(`${mediaBaseUrl}${a.analysisUrl}`); return r.ok ? [a.id, await r.json()] as const : null; } catch { return null; }
    });
    void Promise.all([fonts, ...reads]).then(([, ...rows]) => {
      if (cancelled) return;
      setAnalysis(Object.fromEntries(rows.filter((r): r is readonly [string, unknown] => !!r)));
      continueRender(handle);
    });
    return () => { cancelled = true; continueRender(handle); };
  }, [handle, ir, mediaBaseUrl]);
  const filmData = React.useMemo(() => ({ ...film, analysis }), [film, analysis]);
  const styles = [
    baseStyles(ir.meta.width, ir.meta.height, `${mediaBaseUrl}/fonts`),
    ir.captions ? baseLayer(captionStyles(ir.meta.width, ir.meta.height, film.defaultBand)) : '',
    styleCss(ir.style),
    ...film.scenes.map((s) => s.css),
  ].filter(Boolean).join('\n');

  return (
    <AbsoluteFill style={{ background: '#000' }} data-composition-id="nodecine">
      <style dangerouslySetInnerHTML={{ __html: styles }} />
      {ir.audio.map((track) => (
        <Sequence key={track.id} from={track.startFrame} durationInFrames={track.durationInFrames} name={track.id}>
          <Audio src={`${mediaBaseUrl}${track.url}`} volume={volumeOf(track, ir.meta.fps, track.duck ? speechWindowsOf(ir) : [])} loop={track.loop ?? false} trimBefore={Math.round((track.offsetSeconds ?? 0) * ir.meta.fps)} />
        </Sequence>
      ))}
      {ir.tracks.map((track) => (
        <AbsoluteFill key={track.id} data-track={track.id}>
          {track.clips.map((clip) => {
            const scene = clip.kind === 'code' ? film.scenes.find((s) => s.id === clip.id) : undefined;
            const extra = scene?.overlapFrames ?? 0;
            return (
              <Sequence key={clip.id} from={clip.startFrame} durationInFrames={clip.durationInFrames + extra} name={clip.id} layout="none">
                {scene ? <CodeClipView scene={scene} film={filmData} fps={ir.meta.fps} clip={clip} /> : <MediaClipView clip={clip} mediaBaseUrl={mediaBaseUrl} fps={ir.meta.fps} />}
              </Sequence>
            );
          })}
        </AbsoluteFill>
      ))}
    </AbsoluteFill>
  );
};

/** One `html-gsap` clip: the markup mounted once, the scene seeked to Remotion's frame, the transition's style on top. */
const CodeClipView: React.FC<{ scene: PreparedScene; film: PreparedFilm; fps: number; clip: Clip }> = ({ scene, film, fps, clip }) => {
  const frame = useCurrentFrame();
  const ref = React.useRef<HTMLDivElement>(null);
  const instance = React.useRef<SceneInstance | null>(null);
  React.useLayoutEffect(() => {
    if (!ref.current) return;
    instance.current = new SceneInstance(ref.current, scene, film);
    instance.current.seek(frame / fps);
    return () => { instance.current?.dispose(); instance.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene, film]);
  React.useLayoutEffect(() => { instance.current?.seek(frame / fps); }, [frame, fps]);
  const filmFrame = clip.startFrame + frame;
  const style: React.CSSProperties = {};
  if (scene.transitionIn && frame < scene.transitionIn.seconds * fps) Object.assign(style, transitionStyle(scene.transitionIn.name, frame / (scene.transitionIn.seconds * fps)).in);
  if (scene.transitionOut && filmFrame >= scene.transitionOut.atFrame) Object.assign(style, transitionStyle(scene.transitionOut.name, (filmFrame - scene.transitionOut.atFrame) / (scene.transitionOut.seconds * fps)).out);
  return <div ref={ref} id={scene.id} className="nc-scene" data-scene={scene.id} style={style} dangerouslySetInnerHTML={{ __html: scene.html }} />;
};

/** A file on a track, framed by the film. Looping a video waits for a media length the IR does not carry. */
const MediaClipView: React.FC<{ clip: Clip; mediaBaseUrl: string; fps: number }> = ({ clip, mediaBaseUrl, fps }) => {
  if (clip.kind !== 'media') return null;
  const style: React.CSSProperties = { position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: clip.fit };
  const src = `${mediaBaseUrl}${clip.url}`;
  return IMAGE_URL.test(clip.url)
    ? <Img src={src} style={style} />
    : <Video src={src} style={style} muted={clip.gain <= 0} volume={clip.gain} trimBefore={Math.round(clip.offsetSeconds * fps)} />;
};

/**
 * The track's level frame by frame, on the sequence's own clock: a ramp in, a hold, a ramp out,
 * and under the voice a dip to the duck level — down over a quarter second before the first word,
 * back up over four tenths after the last. `speech` is on the film's clock, so it is shifted here.
 */
export function volumeOf(track: AudioTrack, fps: number, speech: { startFrame: number; endFrame: number }[] = []): number | ((frame: number) => number) {
  const fadeIn = Math.round(Math.min(track.fadeInSeconds ?? 0, track.durationInFrames / fps / 2) * fps);
  const fadeOut = Math.round(Math.min(track.fadeOutSeconds ?? 0, track.durationInFrames / fps - fadeIn / fps) * fps);
  const duck = track.duck && speech.length ? { to: track.duck.to, windows: speech.map((w) => [w.startFrame - track.startFrame, w.endFrame - track.startFrame] as const) } : null;
  if (!fadeIn && !fadeOut && !duck) return track.gain;
  const down = Math.round(0.25 * fps);
  const up = Math.round(0.4 * fps);
  return (frame: number) => {
    const inRamp = fadeIn ? Math.min(1, frame / fadeIn) : 1;
    const outRamp = fadeOut ? Math.min(1, (track.durationInFrames - frame) / fadeOut) : 1;
    let level = track.gain * Math.max(0, Math.min(inRamp, outRamp));
    if (duck && level > duck.to) {
      // How far into a dip this frame is: 1 inside a window, ramping at both edges, 0 clear of every window.
      let depth = 0;
      for (const [s, e] of duck.windows) {
        const lead = s - Math.round(0.15 * fps);
        if (frame < lead - down || frame > e + up) continue;
        const inRampD = frame < lead ? 1 - (lead - frame) / down : 1;
        const outRampD = frame > e ? 1 - (frame - e) / up : 1;
        depth = Math.max(depth, Math.max(0, Math.min(inRampD, outRampD)));
      }
      level = level - (level - duck.to) * depth;
    }
    return level;
  };
}

/** Every clip, for a test that wants to know what the composition would mount. */
export const clipsOf = (ir: VideoIR): Clip[] => allClips(ir);
