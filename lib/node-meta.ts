/** UI-only metadata per core node type: icon and library group. Packs register their own. */
export type IconKey = 'bolt' | 'doc' | 'term' | 'mic' | 'wave' | 'layers' | 'chip' | 'screen' | 'down' | 'branch' | 'bot';
export type LibraryGroup = 'source' | 'provider' | 'process' | 'engine' | 'output';

export type NodeMeta = { icon: IconKey; group: LibraryGroup | string; soon?: boolean };

export const NODE_META: Record<string, NodeMeta> = {
  'core/input-trigger': { icon: 'bolt', group: 'source' },
  'core/static-script': { icon: 'doc', group: 'source' },
  'core/claude-code-provider': { icon: 'term', group: 'provider' },
  'core/system-tts-provider': { icon: 'mic', group: 'provider' },
  'core/tts-engine': { icon: 'wave', group: 'process' },
  'core/timeline-assembler': { icon: 'layers', group: 'process' },
  'core/remotion-engine': { icon: 'chip', group: 'engine' },
  'core/hyperframes-engine': { icon: 'chip', group: 'engine' },
  'core/video-output': { icon: 'screen', group: 'output' },
  'core/mp4-export': { icon: 'down', group: 'output' },
};

export const GROUP_ORDER: LibraryGroup[] = ['source', 'provider', 'process', 'engine', 'output'];

/** Packs call this from their client registration so their nodes get an icon and a library group. */
export function registerNodeMeta(type: string, meta: NodeMeta): void {
  NODE_META[type] = meta;
}
