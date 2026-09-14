import { registerPortType, type PortType, type PortTypeInfo } from '@/core/types/ports';
import type { VideoIR } from './types/ir';
import {
  AudioScriptSchema,
  AudioTrackSpecSchema,
  CaptionTrackSchema,
  FactSheetSchema,
  LayerSheetSchema,
  PlateSheetSchema,
  ScenePlanSchema,
  SceneScriptSchema,
  SourceRefSchema,
  StyleSheetSchema,
  VoiceoverSchema,
  type AudioScript,
  type AudioTrackSpec,
  type CaptionTrack,
  type FactSheet,
  type LayerSheet,
  type PlateSheet,
  type ScenePlan,
  type SceneScript,
  type SourceRef,
  type StyleSheet,
  type Voiceover,
} from './types/payloads';

/**
 * The port types a video workflow speaks (CORE_CONTRACTS §1.1): the core runs wires, this names what
 * runs on them. Each name maps to the payload its packets carry.
 */
declare module '@/core/types/ports' {
  interface PortTypes {
    SourceRef: SourceRef;
    FactSheet: FactSheet;
    ScenePlan: ScenePlan;
    AudioScript: AudioScript;
    Voiceover: Voiceover;
    VideoIR: VideoIR;
    SceneScript: SceneScript;
    CaptionTrack: CaptionTrack;
    StyleSheet: StyleSheet;
    LayerSheet: LayerSheet;
    PlateSheet: PlateSheet;
    AudioTrackSpec: AudioTrackSpec;
  }
}

/** Every port type with its label and schema. The IR is validated by its own checks (§3.1), not here. */
const PORTS: Record<PortType, PortTypeInfo> = {
  SourceRef: { labelKey: 'port.sourceRef', schema: SourceRefSchema },
  FactSheet: { labelKey: 'port.factSheet', schema: FactSheetSchema },
  ScenePlan: { labelKey: 'port.scenePlan', schema: ScenePlanSchema },
  AudioScript: { labelKey: 'port.audioScript', schema: AudioScriptSchema },
  Voiceover: { labelKey: 'port.voiceover', schema: VoiceoverSchema },
  VideoIR: { labelKey: 'port.videoIR' },
  SceneScript: { labelKey: 'port.sceneScript', schema: SceneScriptSchema },
  CaptionTrack: { labelKey: 'port.captionTrack', schema: CaptionTrackSchema },
  StyleSheet: { labelKey: 'port.styleSheet', schema: StyleSheetSchema },
  LayerSheet: { labelKey: 'port.layerSheet', schema: LayerSheetSchema },
  PlateSheet: { labelKey: 'port.plateSheet', schema: PlateSheetSchema },
  AudioTrackSpec: { labelKey: 'port.audioTrackSpec', schema: AudioTrackSpecSchema },
};

/** Called wherever node types are registered: a node's ports mean nothing until their types are. */
export function registerPortTypes(): void {
  for (const [type, info] of Object.entries(PORTS)) registerPortType(type as PortType, info);
}
