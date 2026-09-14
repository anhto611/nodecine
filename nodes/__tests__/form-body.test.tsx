import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { z } from 'zod';
import { FormBody } from '@/nodes/form-body';
import { useStudio } from '@/store/useStudio';
import { _resetNodeRegistry, registerNodeType, type AnyNodeDefinition } from '@/core/nodes/definition';
import type { Graph } from '@/core/engine/graph';

/**
 * The form every node body leans on. Half of each capsule is a React body, and until now that half
 * had no test at all — the review found a hook called from a plain callback and an effect running on
 * every render, both in this layer, both invisible to `tsc`.
 */

const Params = z.object({
  codec: z.enum(['h264', 'h265']).default('h264'),
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
    paramsSchema: Params, defaultParams: { codec: 'h264', title: 'Untitled', fps: 30, burn: false },
    run: async () => ({}),
  } as unknown as AnyNodeDefinition);
  useStudio.setState({ graph: graphWith({ codec: 'h264', title: 'Untitled', fps: 30, burn: false }), tabs: [], activeTab: 'form-test', executor: null, locale: 'en' });
});

const paramsNow = () => useStudio.getState().graph.nodes[0]!.params;

describe('a form read off a schema', () => {
  it('draws one control per field, of the kind the schema says', () => {
    render(<FormBody nodeId="n" />);
    expect(screen.getByRole('combobox')).toHaveProperty('value', 'h264');
    expect(screen.getByRole('spinbutton')).toHaveProperty('value', '30');
    expect(screen.getByRole('checkbox')).toHaveProperty('checked', false);
    expect(screen.getByDisplayValue('Untitled')).toBeDefined();
  });

  it('shows only the fields asked for, in the order given', () => {
    render(<FormBody nodeId="n" fields={['fps', 'codec']} />);
    expect(screen.queryByRole('checkbox')).toBeNull();
    const labels = [...document.querySelectorAll('.nc-k')].map((e) => e.textContent);
    // `node.codec` has a string in a dictionary; `node.fps` has none, so its key shows.
    expect(labels).toEqual(['node.fps', 'codec']);
  });

  it('writes a choice back to the node', async () => {
    render(<FormBody nodeId="n" />);
    await userEvent.selectOptions(screen.getByRole('combobox'), 'h265');
    expect(paramsNow().codec).toBe('h265');
    await userEvent.click(screen.getByRole('checkbox'));
    expect(paramsNow().burn).toBe(true);
  });

  it('lets a number be typed freely and applies the bounds when the field is left', async () => {
    render(<FormBody nodeId="n" />);
    const fps = screen.getByRole('spinbutton');
    await userEvent.clear(fps);
    await userEvent.type(fps, '999');
    // Still being typed: the store is not touched, so half a number never reaches the graph.
    expect(paramsNow().fps).toBe(30);
    await userEvent.tab();
    expect(paramsNow().fps).toBe(60);
  });

  it('labels an enum value from the dictionary and falls back to the value itself', () => {
    render(<FormBody nodeId="n" fields={['codec']} />);
    const options = [...screen.getByRole('combobox').querySelectorAll('option')].map((o) => o.textContent);
    // `node.codec.h264` is in the dictionary; a value with no key of its own shows raw.
    expect(options).toEqual(['H.264', 'H.265']);
  });

  it('takes a widget in place of what the schema alone would draw', async () => {
    render(<FormBody nodeId="n" fields={['title']} widgets={{ title: { widget: 'textarea', label: false, placeholder: 'say something' } }} />);
    expect(document.querySelector('.nc-k')).toBeNull();
    const box = screen.getByPlaceholderText('say something');
    expect(box.tagName).toBe('TEXTAREA');
    await userEvent.type(box, '!');
    expect(paramsNow().title).toBe('Untitled!');
  });

  it('draws nothing for a node that is not in the graph', () => {
    const { container } = render(<FormBody nodeId="gone" />);
    expect(container.textContent).toBe('');
  });
});
