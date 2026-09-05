import type { Graph } from '@/core/engine/graph';
import { PACK_ID } from './constants';
import { QUOTE_DIRECTOR } from './nodes/quote-director';

export const QUOTE_CARDS_TEMPLATE = PACK_ID;

/**
 * Eight nodes, eight wires. There is no fetcher and no Fact Sheet: the Input Trigger's text goes
 * straight to the director, and the Timeline Assembler's Facts port stays empty — which is exactly
 * what proves that port is genuinely optional.
 */
export function quoteCardsTemplate(): Graph {
  return {
    nodes: [
      { id: 'input', type: 'core/input-trigger', params: { value: 'staying focused when progress feels slow' }, bypassed: false, position: { x: 40, y: 40 } },
      { id: 'llm-provider', type: 'core/llm-provider', params: { providerId: 'claude-code', settings: {} }, bypassed: false, position: { x: 40, y: 300 } },
      { id: 'director', type: QUOTE_DIRECTOR, params: { outputLanguage: 'auto', count: 4 }, bypassed: false, position: { x: 340, y: 40 } },
      { id: 'tts-provider', type: 'core/tts-provider', params: { providerId: 'system-tts', settings: { rate: 1 } }, bypassed: false, position: { x: 340, y: 460 } },
      { id: 'tts', type: 'core/tts-engine', params: { speed: 1 }, bypassed: false, position: { x: 640, y: 300 } },
      { id: 'assembler', type: 'core/timeline-assembler', params: { fps: 30, width: 1080, height: 1920, minTotalFrames: 300, title: 'Quote cards' }, bypassed: false, position: { x: 920, y: 40 } },
      { id: 'remotion', type: 'core/remotion-engine', params: { glBackend: 'angle' }, bypassed: false, position: { x: 920, y: 420 } },
      { id: 'output', type: 'core/video-output', params: {}, bypassed: false, position: { x: 1200, y: 40 } },
    ],
    edges: [
      { id: 'e1', source: 'input', sourcePort: 'source', target: 'director', targetPort: 'topic' },
      { id: 'e2', source: 'llm-provider', sourcePort: 'llm', target: 'director', targetPort: 'llm' },
      { id: 'e3', source: 'director', sourcePort: 'script', target: 'tts', targetPort: 'script' },
      { id: 'e4', source: 'tts-provider', sourcePort: 'tts', target: 'tts', targetPort: 'tts' },
      { id: 'e5', source: 'director', sourcePort: 'plan', target: 'assembler', targetPort: 'plan' },
      { id: 'e6', source: 'tts', sourcePort: 'voiceover', target: 'assembler', targetPort: 'voiceover' },
      { id: 'e7', source: 'assembler', sourcePort: 'ir', target: 'output', targetPort: 'ir' },
      { id: 'e8', source: 'remotion', sourcePort: 'engine', target: 'output', targetPort: 'engine' },
    ],
  };
}
