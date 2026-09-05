/** UI-only metadata per node type: icon and library group. */
export type IconKey = 'bolt' | 'doc' | 'term' | 'mic' | 'wave' | 'layers' | 'chip' | 'screen' | 'down' | 'branch' | 'bot';
export type LibraryGroup = 'source' | 'look' | 'provider' | 'process' | 'engine' | 'output';

export type NodeMeta = { icon: IconKey; group: LibraryGroup | string };

export const NODE_META: Record<string, NodeMeta> = {
  'core/input-trigger': { icon: 'bolt', group: 'source' },
  'core/github-fetcher': { icon: 'branch', group: 'source' },
  'core/static-script': { icon: 'doc', group: 'source' },
  'core/stage': { icon: 'screen', group: 'look' },
  'core/block': { icon: 'layers', group: 'look' },
  'core/ai-director': { icon: 'bot', group: 'process' },
  'core/llm-provider': { icon: 'term', group: 'provider' },
  'core/tts-provider': { icon: 'mic', group: 'provider' },
  'core/tts-engine': { icon: 'wave', group: 'process' },
  'core/timeline-assembler': { icon: 'layers', group: 'process' },
  'core/remotion-engine': { icon: 'chip', group: 'engine' },
  'core/hyperframes-engine': { icon: 'chip', group: 'engine' },
  'core/video-output': { icon: 'screen', group: 'output' },
  'core/mp4-export': { icon: 'down', group: 'output' },
};

export const GROUP_ORDER: LibraryGroup[] = ['source', 'look', 'provider', 'process', 'engine', 'output'];

