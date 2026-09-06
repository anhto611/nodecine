/** The twelve core port types (CORE_CONTRACTS §1.1). Nothing outside the core may add a port type. */
export const PORT_TYPES = [
  'SourceRef',
  'FactSheet',
  'DirectorPlan',
  'AudioScript',
  'Voiceover',
  'VideoIR',
  'EngineRef',
  'LLMRef',
  'TTSRef',
  'StageDef',
  'BlockSet',
  'CaptionTrack',
] as const;

export type PortType = (typeof PORT_TYPES)[number];

/** Display label next to each port — dictionary keys, translated by the UI locale. */
export const PORT_LABEL_KEYS: Record<PortType, string> = {
  SourceRef: 'port.sourceRef',
  FactSheet: 'port.factSheet',
  DirectorPlan: 'port.directorPlan',
  AudioScript: 'port.audioScript',
  Voiceover: 'port.voiceover',
  VideoIR: 'port.videoIR',
  EngineRef: 'port.engineRef',
  LLMRef: 'port.llmRef',
  TTSRef: 'port.ttsRef',
  StageDef: 'port.stageDef',
  BlockSet: 'port.blockSet',
  CaptionTrack: 'port.captionTrack',
};

export function isPortType(value: string): value is PortType {
  return (PORT_TYPES as readonly string[]).includes(value);
}
