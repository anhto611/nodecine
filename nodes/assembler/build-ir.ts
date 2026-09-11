import type { AudioTrackSpec, CaptionTrack, LayerSpec, ScenePlan, FactSheet, Voiceover } from '@/core/types/payloads';
import { readFactPath } from '@/core/types/payloads';
import { videoVars } from '@/core/visual/vars';
import { IR_VERSION, secondsToFrames, type AudioTrack, type Beat, type Clip, type CodeClip, type IRCaptions, type Track, type VideoIR } from '@/core/types/ir';
import { SCENE_FORMAT } from '@/core/types/payloads';
import { allocateFrames, computeTotalFrames, framesFromSegments } from './allocate';
import { assertValidIR } from '@/core/types/validate-ir';
import { NodeError } from '@/core/errors';
import { AssemblerErrorCode } from './errors';

/** Timeline Assembler node parameters (CORE_CONTRACTS §5.4). */
export interface AssemblerParams {
  fps: number;
  minTotalFrames: number;
  title: string;
  /** The film's length when nothing spoken sets it; ignored when a voice-over is wired in. */
  durationSeconds?: number;
}

export const DEFAULT_ASSEMBLER_PARAMS: AssemblerParams = {
  fps: 30,
  minTotalFrames: 270,
  title: 'Untitled',
};

export interface BuildIRInput {
  plan: ScenePlan;
  /** Absent for a silent film; then `params.durationSeconds` is the clock. */
  voiceover?: Voiceover;
  facts?: FactSheet;
  /** Read only when there is a voice for the lines to belong to (IR invariant 7). */
  captions?: CaptionTrack;
  /** The film's layers in wire order; each becomes a track under or over the scenes. */
  layers?: LayerSpec[];
  /** Sounds beside the voice, in wire order: music, ambience. */
  audio?: AudioTrackSpec[];
  params?: Partial<AssemblerParams>;
  /** The clock this run reads for `date` and `time`; a test passes a fixed one. */
  now?: number;
}

/**
 * The verified values a scene's `data-fact` elements take (CORE_CONTRACTS §5.4): one per binding
 * whose fact is present and says something. An empty string is a fact that says nothing (a page
 * with no description); it leaves the element as drawn rather than blanking it.
 */
export function resolveFacts(bindings: Record<string, string> | undefined, facts: FactSheet['facts'] | undefined): Record<string, unknown> | undefined {
  if (!bindings || !facts) return undefined;
  const out: Record<string, unknown> = {};
  for (const [name, factKey] of Object.entries(bindings)) {
    // A plain key, or `items.2.title` when the beat ran over a list (CORE_CONTRACTS §2.2).
    const value = readFactPath(facts, factKey);
    if (value !== undefined && value !== null && value !== '') out[name] = value;
  }
  return Object.keys(out).length ? out : undefined;
}

/** Seconds on the voice-over's clock → frames on the video's; a word never gets fewer than one frame. */
export function captionsToFrames(track: CaptionTrack, fps: number, totalFrames: number): IRCaptions {
  const frame = (s: number) => Math.min(totalFrames - 1, Math.max(0, Math.round(s * fps)));
  const cues = track.cues
    .map((c) => {
      const startFrame = frame(c.start);
      const durationInFrames = Math.max(1, frame(c.end) - startFrame);
      const words = c.words.map((w) => {
        const ws = frame(w.start);
        return { text: w.text, startFrame: ws, durationInFrames: Math.max(1, frame(w.end) - ws) };
      });
      return { startFrame, durationInFrames, words };
    })
    .filter((c) => c.words.length > 0);
  return { cues };
}

/** Where the film's length came from (docs/IR_V3.md §5.3). */
export type ClockSource = 'voice' | 'duration' | 'audio';

/**
 * The clock, in order of authority: the voice plus the tail it is padded to; else the node's own
 * `durationSeconds`, exactly; else the longest sound wired in. A silent film is not padded to
 * `minTotalFrames`: a three-second logo sting asked for is a three-second film. The parameter comes
 * before the sounds because a music bed is nearly always longer than the film it sits under — a
 * twenty-second slideshow with a three-minute track set to twenty seconds stays twenty seconds,
 * while a film with only music and no length asked for is as long as the music: a music video.
 */
export function clockOf(voiceover: Voiceover | undefined, p: Pick<AssemblerParams, 'fps' | 'minTotalFrames' | 'durationSeconds'>, audio: AudioTrackSpec[] = []): { total: number; source: ClockSource } {
  if (voiceover) return { total: computeTotalFrames(voiceover.durationSeconds, p.fps, p.minTotalFrames).total, source: 'voice' };
  if (p.durationSeconds && p.durationSeconds > 0) return { total: Math.max(1, secondsToFrames(p.durationSeconds, p.fps)), source: 'duration' };
  const longest = Math.max(0, ...audio.map((a) => a.startSeconds + (a.playSeconds ?? a.durationSeconds)));
  if (longest > 0) return { total: Math.max(1, secondsToFrames(longest, p.fps)), source: 'audio' };
  throw new NodeError(AssemblerErrorCode.NO_CLOCK, 'nothing sets the length of the film: no voice-over or sound is wired in and durationSeconds is not set').withFix('connect a voice-over to the voiceover port, a sound to the audio port, or set durationSeconds for a silent film');
}

/**
 * A sound as an IR audio track, clamped to the film. Numbered in wire order after its role, so the
 * ids read in a log: `music-1`, `ambient-2`. It ducks under the voice only when there is one to
 * duck under (IR invariant 8); a film with no voice keeps the track at its level.
 */
export function audioTrackOf(spec: AudioTrackSpec, n: number, total: number, fps: number, hasVoice: boolean): AudioTrack {
  const startFrame = secondsToFrames(spec.startSeconds, fps);
  if (startFrame >= total) {
    throw new NodeError(AssemblerErrorCode.AUDIO_OUTSIDE_FILM, `audio track ${n} starts at ${spec.startSeconds}s, after the film ends at ${(total / fps).toFixed(2)}s`).withFix(`set the track's startSeconds below ${(total / fps).toFixed(2)}`);
  }
  // A looping sound fills what is left of the film; one that plays once ends with the file.
  const wanted = spec.playSeconds ?? (spec.loop ? total / fps : spec.durationSeconds);
  const durationInFrames = Math.min(total - startFrame, Math.max(1, secondsToFrames(wanted, fps)));
  return {
    id: `${spec.role}-${n}`,
    role: spec.role,
    url: spec.url,
    startFrame,
    durationInFrames,
    gain: spec.gain,
    ...(spec.offsetSeconds ? { offsetSeconds: spec.offsetSeconds } : {}),
    ...(spec.loop ? { loop: true } : {}),
    ...(spec.fadeInSeconds ? { fadeInSeconds: spec.fadeInSeconds } : {}),
    ...(spec.fadeOutSeconds ? { fadeOutSeconds: spec.fadeOutSeconds } : {}),
    ...(hasVoice && spec.duckTo !== undefined ? { duck: { by: 'voice', to: spec.duckTo } } : {}),
    ...(spec.analysisUrl ? { analysisUrl: spec.analysisUrl } : {}),
  };
}

/**
 * A layer as a track of one clip, clamped to the film (docs/IR_V3.md §10 step 4). Layers are
 * numbered in wire order across both placements, so a layer keeps its id when moved from under the
 * scenes to over them. A layer that starts after the film ends is a mistake, not a no-op.
 */
export function layerTrack(layer: LayerSpec, n: number, total: number, fps: number): Track {
  const id = `layer-${n}`;
  const startFrame = secondsToFrames(layer.startSeconds, fps);
  if (startFrame >= total) {
    throw new NodeError(AssemblerErrorCode.LAYER_OUTSIDE_FILM, `layer ${n} starts at ${layer.startSeconds}s, after the film ends at ${(total / fps).toFixed(2)}s`).withFix(`set the layer's startSeconds below ${(total / fps).toFixed(2)}`);
  }
  const durationInFrames = Math.min(total - startFrame, layer.durationSeconds ? Math.max(1, secondsToFrames(layer.durationSeconds, fps)) : total);
  const clip: Clip = layer.kind === 'media'
    ? { id: `${id}-clip`, kind: 'media', startFrame, durationInFrames, url: layer.url, offsetSeconds: layer.offsetSeconds, fit: layer.fit, loop: layer.loop, gain: layer.gain }
    : { id: `${id}-clip`, kind: 'code', startFrame, durationInFrames, format: SCENE_FORMAT, source: layer.source };
  return { id, clips: [clip] };
}

export function buildIR(input: BuildIRInput): VideoIR {
  const p = { ...DEFAULT_ASSEMBLER_PARAMS, ...input.params };
  const { plan, voiceover, facts } = input;
  const layers = input.layers ?? [];
  const sounds = input.audio ?? [];
  const captions = voiceover ? input.captions : undefined;

  const { total } = clockOf(voiceover, p, sounds);
  // The cut follows the speech when the voice-over came scene by scene; weights are for a voice-over that did not, and for silence.
  const bySpeech = voiceover?.segments && voiceover.segments.length === plan.scenes.length;
  const frames = bySpeech ? framesFromSegments(total, voiceover!.segments!, p.fps) : allocateFrames(total, plan.scenes.map((s) => s.weight));

  // One track of code clips, one beat per clip: the plan's scenes, in order, edge to edge. The
  // layers stack around it: those placed under, in wire order, bottom first; then the scenes; then
  // those placed over, in wire order, the last wired on top.
  let cursor = 0;
  const clips: CodeClip[] = plan.scenes.map((scene, i) => {
    const resolved = resolveFacts(scene.factBindings, facts?.facts);
    const clip: CodeClip = {
      id: `scene-${i + 1}`,
      kind: 'code',
      startFrame: cursor,
      durationInFrames: frames[i] as number,
      format: scene.format ?? SCENE_FORMAT,
      source: scene.source,
      ...(resolved ? { facts: resolved } : {}),
    };
    cursor += frames[i] as number;
    return clip;
  });
  const beats: Beat[] = clips.map((c, index) => {
    const stage = plan.scenes[index]!.stage;
    return { index, startFrame: c.startFrame, durationInFrames: c.durationInFrames, clipId: c.id, ...(stage ? { stage } : {}) };
  });
  const overrides = plan.scenes.flatMap((scene, i) => (scene.transitionAfter && i < plan.scenes.length - 1 ? [{ afterClipId: clips[i]!.id, name: scene.transitionAfter.type, seconds: scene.transitionAfter.seconds }] : []));
  const numbered = layers.map((layer, i) => ({ layer, track: layerTrack(layer, i + 1, total, p.fps) }));
  const tracks: Track[] = [
    ...numbered.filter((l) => l.layer.placement === 'under').map((l) => l.track),
    { id: 'scenes', clips },
    ...numbered.filter((l) => l.layer.placement === 'over').map((l) => l.track),
  ];

  const ir: VideoIR = {
    irVersion: IR_VERSION,
    meta: {
      title: p.title,
      language: plan.language,
      fps: p.fps,
      width: plan.frame.width,
      height: plan.frame.height,
      totalDurationInFrames: total,
    },
    style: plan.style,
    vars: videoVars(plan.vars, plan.language, input.now ?? Date.now()),
    tracks,
    beats,
    // The voice is the one audio track a run makes today, and a silent film has none. It never
    // outlasts the film; the film may outlast it, and that difference is what used to be called padTailFrames.
    audio: [
      ...(voiceover ? [{ id: 'voice', role: 'voice' as const, url: voiceover.audioUrl, startFrame: 0, durationInFrames: Math.min(total, secondsToFrames(voiceover.durationSeconds, p.fps)), gain: 1 }] : []),
      ...sounds.map((spec, i) => audioTrackOf(spec, i + 1, total, p.fps, !!voiceover)),
    ],
    transitions: {
      default: { name: plan.transition.type, seconds: plan.transition.seconds },
      // A scene that names its own way out overrides the default at that one boundary; the last scene has no boundary after it.
      ...(overrides.length ? { at: overrides } : {}),
    },
    ...(captions && captions.cues.length ? { captions: captionsToFrames(captions, p.fps, total) } : {}),
  };

  assertValidIR(ir);
  return ir;
}
