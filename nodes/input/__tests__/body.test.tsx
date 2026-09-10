import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { InputTriggerBody } from '../body';
import { inputTrigger } from '../node';
import { useStudio } from '@/store/useStudio';
import { _resetNodeRegistry, registerNodeType, type AnyNodeDefinition } from '@/core/nodes/definition';
import type { Graph } from '@/core/engine/graph';

/**
 * A node body is half the capsule and the half a person actually touches. This one is the shape the
 * rest follow: `FormBody` for what the schema already says, hand-written JSX for what it cannot.
 */

const graphWith = (params: Record<string, unknown>): Graph => ({
  nodes: [{ id: 'in', type: inputTrigger.type, version: inputTrigger.version, params, bypassed: false, position: { x: 0, y: 0 } }],
  edges: [],
});

beforeEach(() => {
  _resetNodeRegistry();
  registerNodeType(inputTrigger as unknown as AnyNodeDefinition);
  useStudio.setState({ graph: graphWith({ value: '', perRun: false }), tabs: [], activeTab: 'input-test', executor: null, locale: 'en' });
});

const paramsNow = () => useStudio.getState().graph.nodes[0]!.params;

describe('the Input Trigger body', () => {
  it('types into the node and counts what is there', async () => {
    render(<InputTriggerBody nodeId="in" />);
    await userEvent.type(screen.getByRole('textbox'), 'hello');
    expect(paramsNow().value).toBe('hello');
    expect(screen.getByText('5 characters')).toBeDefined();
  });

  it('counts runs instead of characters once every line is its own run', async () => {
    useStudio.setState({ graph: graphWith({ value: 'first\n\nsecond\nthird ', perRun: false }) });
    render(<InputTriggerBody nodeId="in" />);
    expect(screen.getByText(/characters/)).toBeDefined();

    await userEvent.click(screen.getByRole('checkbox'));
    expect(paramsNow().perRun).toBe(true);
    // Blank lines are not runs, and neither is trailing space on one.
    expect(screen.getByText('3 runs')).toBeDefined();
  });

  it('speaks the language the Studio is set to', () => {
    useStudio.setState({ locale: 'vi', graph: graphWith({ value: 'xin chào', perRun: false }) });
    render(<InputTriggerBody nodeId="in" />);
    expect(screen.getByText('mỗi dòng một lần chạy')).toBeDefined();
    expect(screen.getByText('8 ký tự')).toBeDefined();
  });

  it('gives the text box the whole width, with no label row of its own', () => {
    render(<InputTriggerBody nodeId="in" />);
    expect(screen.getByRole('textbox').tagName).toBe('TEXTAREA');
    expect(document.querySelector('.nc-k')).toBeNull();
  });
});
