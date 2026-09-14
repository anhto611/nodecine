import { registerPortType, type PortType, type PortTypeInfo } from '@/core/types/ports';
import type { VideoIR } from './types/ir';
import {
  AudioScriptSchema,
  CaptionTrackSchema,
  VoiceoverSchema,
  type AudioScript,
  type CaptionTrack,
  type Voiceover,
} from './types/payloads';

/**
 * The port types a video workflow speaks (CORE_CONTRACTS §1.1): the core runs wires, this names what
 * runs on them. Each name maps to the payload its packets carry. Only what a shipped node puts on a
 * wire is here; a new node brings its type with it.
 */
declare module '@/core/types/ports' {
  interface PortTypes {
    AudioScript: AudioScript;
    Voiceover: Voiceover;
    VideoIR: VideoIR;
    CaptionTrack: CaptionTrack;
  }
}

/** Every port type with its label and schema. The IR is validated by its own checks (§3.1), not here. */
const PORTS: Record<PortType, PortTypeInfo> = {
  AudioScript: { labelKey: 'port.audioScript', schema: AudioScriptSchema },
  Voiceover: { labelKey: 'port.voiceover', schema: VoiceoverSchema },
  VideoIR: { labelKey: 'port.videoIR' },
  CaptionTrack: { labelKey: 'port.captionTrack', schema: CaptionTrackSchema },
};

/** Called wherever node types are registered: a node's ports mean nothing until their types are. */
export function registerPortTypes(): void {
  for (const [type, info] of Object.entries(PORTS)) registerPortType(type as PortType, info);
}
