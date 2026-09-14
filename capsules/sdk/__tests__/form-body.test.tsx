import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { z } from 'zod';
import { FormBody } from '@/capsules/sdk/form-body';
import { useStudio } from '@/store/useStudio';
// The Studio's own host: these bodies are drawn the way the canvas draws them.
import { StudioNodeHost as wrapper } from '@/components/node-host';
import { _resetNodeRegistry, registerNodeType, type AnyNodeDefinition } from '@/core/nodes/definition';
import type { Graph } from '@/core/engine/graph';

/**
 * The form every node body leans on. Half of each capsule is a React body, and until now that half
 * had no test at all — the review found a hook called from a plain callback and an effect running on
 * every render, both in this layer, both invisible to `tsc`.
 */

const Params = z.object({
  quality: z.enum(['high', 'ultra']).default('high'),
  title: z.string().max(20).default('Untitled'),
  fps: z.number().int().min(1).max(60).default(30),
  burn: z.boolean().default(false),
});

const graphWith = (params: Record<string, unknown>): Graph => ({
  nodes: [{ id: 'n', type: 'test/form', version: 1, params, bypassed: false, position: { x: 0, y: 0 } }],
  edges: [],
});

beforeEach(() => {
  _resetNodeRegistry();
  registerNodeType({
    type: 'test/form', version: 1, kind: 'source', inputs: [], outputs: [],
    paramsSchema: Params, defaultParams: { quality: 'high', title: 'Untitled', fps: 30, burn: false },
    run: async () => ({}),
  } as unknown as AnyNodeDefinition);
  useStudio.setState({ graph: graphWith({ quality: 'high', title: 'Untitled', fps: 30, burn: false }), tabs: [], activeTab: 'form-test', executor: null, locale: 'en' });
});

const paramsNow = () => useStudio.getState().graph.nodes[0]!.params;

describe('a form read off a schema', () => {
  it('draws one control per field, of the kind the schema says', () => {
    render(<FormBody nodeId="n" />, { wrapper });
    expect(screen.getByRole('combobox')).toHaveProperty('value', 'high');
    expect(screen.getByRole('spinbutton')).toHaveProperty('value', '30');
    expect(screen.getByRole('checkbox')).toHaveProperty('checked', false);
    expect(screen.getByDisplayValue('Untitled')).toBeDefined();
  });

  it('shows only the fields asked for, in the order given', () => {
    render(<FormBody nodeId="n" fields={['fps', 'quality']} />, { wrapper });
    expect(screen.queryByRole('checkbox')).toBeNull();
    const labels = [...document.querySelectorAll('.nc-k')].map((e) => e.textContent);
    // `node.quality` has a string in a dictionary; `node.fps` has none, so its key shows.
    expect(labels).toEqual(['node.fps', 'quality']);
  });

  it('writes a choice back to the node', async () => {
    render(<FormBody nodeId="n" />, { wrapper });
    await userEvent.selectOptions(screen.getByRole('combobox'), 'ultra');
    expect(paramsNow().quality).toBe('ultra');
    await userEvent.click(screen.getByRole('checkbox'));
    expect(paramsNow().burn).toBe(true);
  });

  it('lets a number be typed freely and applies the bounds when the field is left', async () => {
    render(<FormBody nodeId="n" />, { wrapper });
    const fps = screen.getByRole('spinbutton');
    await userEvent.clear(fps);
    await userEvent.type(fps, '999');
    // Still being typed: the store is not touched, so half a number never reaches the graph.
    expect(paramsNow().fps).toBe(30);
    await userEvent.tab();
    expect(paramsNow().fps).toBe(60);
  });

  it('labels an enum value from the dictionary and falls back to the value itself', () => {
    render(<FormBody nodeId="n" fields={['quality']} />, { wrapper });
    const options = [...screen.getByRole('combobox').querySelectorAll('option')].map((o) => o.textContent);
    // `node.quality.high` is in the dictionary; a value with no key of its own shows raw.
    expect(options).toEqual(['high · final', 'ultra']);
  });

  it('takes a widget in place of what the schema alone would draw', async () => {
    render(<FormBody nodeId="n" fields={['title']} widgets={{ title: { widget: 'textarea', label: false, placeholder: 'say something' } }} />, { wrapper });
    expect(document.querySelector('.nc-k')).toBeNull();
    const box = screen.getByPlaceholderText('say something');
    expect(box.tagName).toBe('TEXTAREA');
    await userEvent.type(box, '!');
    expect(paramsNow().title).toBe('Untitled!');
  });

  it('draws nothing for a node that is not in the graph', () => {
    const { container } = render(<FormBody nodeId="gone" />, { wrapper });
    expect(container.textContent).toBe('');
  });
});
