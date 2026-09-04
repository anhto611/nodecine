import type { Graph } from '../engine/graph';
import { DEFAULT_STATIC_SCRIPT } from '../nodes/static-script';

/** Phase A acceptance graph: seven nodes, no network (PRD §4.8, USER_FLOWS Scenario A). */
export function staticScriptTemplate(): Graph {
  return {
    nodes: [
      { id: 'script', type: 'core/static-script', params: { ...DEFAULT_STATIC_SCRIPT }, bypassed: false, position: { x: 60, y: 200 } },
      { id: 'tts-provider', type: 'core/system-tts-provider', params: { rate: 1 }, bypassed: false, position: { x: 330, y: 520 } },
      { id: 'tts', type: 'core/tts-engine', params: { speed: 1 }, bypassed: false, position: { x: 550, y: 380 } },
      { id: 'assembler', type: 'core/timeline-assembler', params: { fps: 30, width: 1080, height: 1920, minTotalFrames: 270, title: 'Static script' }, bypassed: false, position: { x: 770, y: 200 } },
      { id: 'remotion', type: 'core/remotion-engine', params: { glBackend: 'angle' }, bypassed: false, position: { x: 550, y: 600 } },
      { id: 'output', type: 'core/video-output', params: {}, bypassed: false, position: { x: 1100, y: 60 } },
      { id: 'export', type: 'core/mp4-export', params: { codec: 'h264', quality: 'high', fileName: 'static-script.mp4' }, bypassed: true, position: { x: 1100, y: 684 } },
    ],
    edges: [
      { id: 'e1', source: 'script', sourcePort: 'plan', target: 'assembler', targetPort: 'plan' },
      { id: 'e2', source: 'script', sourcePort: 'script', target: 'tts', targetPort: 'script' },
      { id: 'e3', source: 'tts-provider', sourcePort: 'tts', target: 'tts', targetPort: 'tts' },
      { id: 'e4', source: 'tts', sourcePort: 'voiceover', target: 'assembler', targetPort: 'voiceover' },
      { id: 'e5', source: 'assembler', sourcePort: 'ir', target: 'output', targetPort: 'ir' },
      { id: 'e6', source: 'assembler', sourcePort: 'ir', target: 'export', targetPort: 'ir' },
      { id: 'e7', source: 'remotion', sourcePort: 'engine', target: 'output', targetPort: 'engine' },
      { id: 'e8', source: 'remotion', sourcePort: 'engine', target: 'export', targetPort: 'engine' },
    ],
  };
}
