import type { Graph } from '@/core/engine/graph';
import { PACK_ID } from './constants';
import { GITHUB_FETCHER } from './nodes/github-fetcher';
import { AI_DIRECTOR } from './nodes/ai-director';

export const GITHUB_SHOWCASE_TEMPLATE = PACK_ID;

/**
 * github-showcase spec §1: ten nodes, twelve wires. The FactSheet wire from the fetcher straight
 * into the assembler is the point of the pack — stars, install command and url reach the video
 * without passing through the language model.
 */
export function githubShowcaseTemplate(): Graph {
  return {
    nodes: [
      { id: 'input', type: 'core/input-trigger', params: { value: '' }, bypassed: false, position: { x: 40, y: 40 } },
      { id: 'fetcher', type: GITHUB_FETCHER, params: {}, bypassed: false, position: { x: 40, y: 300 } },
      { id: 'llm-provider', type: 'core/llm-provider', params: { providerId: 'claude-code', settings: {} }, bypassed: false, position: { x: 320, y: 40 } },
      { id: 'director', type: AI_DIRECTOR, params: { outputLanguage: 'auto' }, bypassed: false, position: { x: 320, y: 360 } },
      { id: 'tts-provider', type: 'core/tts-provider', params: { providerId: 'system-tts', settings: { rate: 1 } }, bypassed: false, position: { x: 320, y: 720 } },
      { id: 'tts', type: 'core/tts-engine', params: { speed: 1 }, bypassed: false, position: { x: 600, y: 540 } },
      { id: 'assembler', type: 'core/timeline-assembler', params: { fps: 30, width: 1080, height: 1920, minTotalFrames: 270, title: 'GitHub showcase' }, bypassed: false, position: { x: 880, y: 300 } },
      { id: 'remotion', type: 'core/remotion-engine', params: { glBackend: 'angle' }, bypassed: false, position: { x: 880, y: 660 } },
      { id: 'output', type: 'core/video-output', params: {}, bypassed: false, position: { x: 1160, y: 40 } },
      { id: 'export', type: 'core/mp4-export', params: { codec: 'h264', quality: 'high', fileName: 'github-showcase.mp4' }, bypassed: true, position: { x: 1160, y: 720 } },
    ],
    edges: [
      { id: 'e1', source: 'input', sourcePort: 'source', target: 'fetcher', targetPort: 'source' },
      { id: 'e2', source: 'fetcher', sourcePort: 'facts', target: 'director', targetPort: 'facts' },
      { id: 'e3', source: 'llm-provider', sourcePort: 'llm', target: 'director', targetPort: 'llm' },
      { id: 'e4', source: 'director', sourcePort: 'script', target: 'tts', targetPort: 'script' },
      { id: 'e5', source: 'tts-provider', sourcePort: 'tts', target: 'tts', targetPort: 'tts' },
      { id: 'e6', source: 'director', sourcePort: 'plan', target: 'assembler', targetPort: 'plan' },
      { id: 'e7', source: 'tts', sourcePort: 'voiceover', target: 'assembler', targetPort: 'voiceover' },
      { id: 'e8', source: 'fetcher', sourcePort: 'facts', target: 'assembler', targetPort: 'facts' },
      { id: 'e9', source: 'assembler', sourcePort: 'ir', target: 'output', targetPort: 'ir' },
      { id: 'e10', source: 'assembler', sourcePort: 'ir', target: 'export', targetPort: 'ir' },
      { id: 'e11', source: 'remotion', sourcePort: 'engine', target: 'output', targetPort: 'engine' },
      { id: 'e12', source: 'remotion', sourcePort: 'engine', target: 'export', targetPort: 'engine' },
    ],
  };
}
