/** The eleven core port types (CORE_CONTRACTS §1.1). Nothing outside the core may add a port type. */
export const PORT_TYPES = [
  'SourceRef',
  'FactSheet',
  'ScenePlan',
  'AudioScript',
  'Voiceover',
  'VideoIR',
  'EngineRef',
  'LLMRef',
  'TTSRef',
  'SceneScript',
  'CaptionTrack',
] as const;

export type PortType = (typeof PORT_TYPES)[number];

/** Display label next to each port — dictionary keys, translated by the UI locale. */
export const PORT_LABEL_KEYS: Record<PortType, string> = {
  SourceRef: 'port.sourceRef',
  FactSheet: 'port.factSheet',
  ScenePlan: 'port.scenePlan',
  AudioScript: 'port.audioScript',
  Voiceover: 'port.voiceover',
  VideoIR: 'port.videoIR',
  EngineRef: 'port.engineRef',
  LLMRef: 'port.llmRef',
  TTSRef: 'port.ttsRef',
  SceneScript: 'port.sceneScript',
  CaptionTrack: 'port.captionTrack',
};

/**
 * Two kinds of wire (CORE_CONTRACTS §1.1): content flows step by step through the pipeline; a
 * resource is a part a node needs — a model, a voice, an engine. The executor treats both
 * as dependencies; the canvas draws them apart (resources enter from the top, dashed).
 */
export const PORT_KIND: Record<PortType, 'flow' | 'resource'> = {
  SourceRef: 'flow', FactSheet: 'flow', SceneScript: 'flow', ScenePlan: 'flow', AudioScript: 'flow', Voiceover: 'flow', VideoIR: 'flow', CaptionTrack: 'flow',
  EngineRef: 'resource', LLMRef: 'resource', TTSRef: 'resource',
};
export const isResourcePort = (type: PortType): boolean => PORT_KIND[type] === 'resource';

export function isPortType(value: string): value is PortType {
  return (PORT_TYPES as readonly string[]).includes(value);
}
