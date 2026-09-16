import { describe, expect, it, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { useStudio } from '@/store/useStudio';
import { StudioNodeHost as wrapper } from '@/components/node-host';
import { _resetNodeRegistry } from '@/core/nodes/definition';
import { registerNodes } from '@/capsules/nodes';
import type { Graph } from '@/core/engine/graph';
import { FillBody } from '../body';

/** A Data Merge node wired to a composition that declares what this kit lets a film set. */
function seed(values: Record<string, unknown>, variables?: unknown[]) {
  const graph: Graph = {
    nodes: [
      { id: 'composition', type: 'composition', params: {}, bypassed: false, position: { x: 0, y: 0 } },
      { id: 'fill', type: 'fill', params: { values }, bypassed: false, position: { x: 0, y: 0 } },
    ],
    edges: [{ id: 'e', source: 'composition', sourcePort: 'composition', target: 'fill', targetPort: 'composition' }],
  };
  useStudio.setState({
    graph, locale: 'vi', tabs: [], activeTab: 'fill-body-test', executor: null,
    runtimes: {
      composition: {
        state: 'done', outputs: { composition: { payloadType: 'Composition', payload: {
          engine: 'hyperframes', width: 1080, height: 1920, fps: 30, files: {}, media: {}, values: {},
          variables: variables ?? [
            { id: 'voiceover', type: 'string', label: 'Voice-over file', default: '' },
            { id: 'videoSeconds', type: 'number', label: 'Length of the film (s)', default: 45 },
            { id: 'mark', type: 'color', label: 'Marker colour', labels: { vi: 'Màu bút dạ' }, default: '#d6263b' },
          ],
        } } },
      } as never,
    },
  });
}

beforeEach(() => { _resetNodeRegistry(); registerNodes(); });

describe('the Data Merge node', () => {
  it('offers only what a person sets: not the voice, not the length the run works out', () => {
    seed({});
    const { container } = render(<FillBody nodeId="fill" />, { wrapper });
    expect(container.textContent).toContain('Màu bút dạ');
    expect(container.textContent).not.toContain('Voice-over file');
    expect(container.textContent).not.toContain('Length of the film');
  });

  it('says so when a kit sets its own look and asks for nothing', () => {
    seed({}, [
      { id: 'voiceover', type: 'string', label: 'Voice-over file', default: '' },
      { id: 'videoSeconds', type: 'number', label: 'Length of the film (s)', default: 45 },
    ]);
    const { container } = render(<FillBody nodeId="fill" />, { wrapper });
    expect(container.textContent).toContain('kit này tự quyết hình thức');
  });

  it('says a colour is the kit\'s until this film chooses one, and gives it back', () => {
    seed({});
    const unset = render(<FillBody nodeId="fill" />, { wrapper });
    expect(unset.container.textContent).toContain('theo kit');
    expect(unset.container.querySelector('input[type=color]')).toHaveProperty('value', '#d6263b');
    // Choosing a colour is this film's own decision, and it can be taken back.
    fireEvent.change(unset.container.querySelector('input[type=color]')!, { target: { value: '#0f8a63' } });
    expect((useStudio.getState().graph.nodes.find((n) => n.id === 'fill')!.params as { values: Record<string, unknown> }).values).toEqual({ mark: '#0f8a63' });
    unset.unmount();

    seed({ mark: '#0f8a63' });
    const set = render(<FillBody nodeId="fill" />, { wrapper });
    expect(set.container.textContent).not.toContain('theo kit');
    expect(set.container.querySelector('input[type=color]')).toHaveProperty('value', '#0f8a63');
    fireEvent.click(set.container.querySelector('button')!);
    expect((useStudio.getState().graph.nodes.find((n) => n.id === 'fill')!.params as { values: Record<string, unknown> }).values).toEqual({});
  });
});
