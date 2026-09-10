import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ProviderBody } from '../resource-bodies';
import { useStudio } from '@/store/useStudio';
import { PROVIDERS, providersOfKind } from '@/providers/installed';
import { _resetNodeRegistry } from '@/core/nodes/definition';
import { registerNodes } from '@/nodes';
import type { Graph } from '@/core/engine/graph';
import type { NodeRuntime } from '@/core/engine/state';
import type { TTSRef } from '@/core/types/payloads';

/**
 * One body serves both provider nodes, so it is the widest piece of node UI in the app. It draws
 * whatever the chosen provider's settings schema declares, which means adding a provider is a folder
 * and never a change here — this is the test that says so.
 */

const tts = providersOfKind('tts');
const withModel = tts.find((p) => p.fields.some((f) => f.name === 'model'))!;
// A different provider on purpose: switching between two that declare the same fields would prove
// nothing about the settings being replaced.
const withRate = tts.find((p) => p.id !== withModel.id && p.fields.some((f) => f.name === 'rate'))!;
const rateField = withRate.fields.find((f) => f.name === 'rate') as Extract<(typeof withRate.fields)[number], { kind: 'number' }>;

const graphWith = (params: Record<string, unknown>): Graph => ({
  nodes: [{ id: 'p', type: 'core/tts-provider', version: 1, params, bypassed: false, position: { x: 0, y: 0 } }],
  edges: [],
});

const probed = (voices: number): Record<string, NodeRuntime> => ({
  p: {
    state: 'success', reused: false, outputs: {
      tts: {
        id: 'pk', sourceNodeId: 'p', sourcePort: 'tts', targetPort: '', payloadType: 'TTSRef', createdAt: 0, contentHash: 'h',
        payload: {
          providerId: withRate.id, displayName: 'A voice', transport: 'local',
          capabilities: { installed: { status: 'ready' }, encoder: { status: 'unavailable', reason: 'ffmpeg is not installed', fix: 'brew install ffmpeg' } },
          voices: Array.from({ length: voices }, (_, i) => ({ id: `v${i}`, displayName: `V${i}`, language: 'en-US' })),
          settings: { rate: 1 },
        } satisfies TTSRef,
      },
    },
  } as unknown as NodeRuntime,
});

beforeEach(() => {
  _resetNodeRegistry();
  registerNodes();
  useStudio.setState({
    graph: graphWith({ providerId: withRate.id, settings: { ...withRate.defaultSettings } }),
    runtimes: {}, tabs: [], activeTab: 'provider-test', executor: null, locale: 'en',
  });
});

const paramsNow = () => useStudio.getState().graph.nodes[0]!.params as { providerId: string; settings: Record<string, unknown> };

describe('the provider body', () => {
  it('offers every provider of its kind, and no other', () => {
    render(<ProviderBody nodeId="p" kind="tts" />);
    const names = [...screen.getAllByRole('combobox')[0]!.querySelectorAll('option')].map((o) => o.getAttribute('value'));
    expect(names).toEqual(tts.map((p) => p.id));
    expect(names).not.toContain(providersOfKind('llm')[0]!.id);
  });

  it('draws the fields the chosen provider declares, from its own schema', () => {
    render(<ProviderBody nodeId="p" kind="tts" />);
    const labels = [...document.querySelectorAll('.nc-k')].map((e) => e.textContent);
    for (const field of withRate.fields) expect(labels).toContain(field.name);
  });

  it('writes a setting into the node under `settings`, not loose', async () => {
    render(<ProviderBody nodeId="p" kind="tts" />);
    const rate = screen.getByRole('spinbutton');
    await userEvent.clear(rate);
    await userEvent.type(rate, String(rateField.min!));
    await userEvent.tab();
    expect(paramsNow().settings.rate).toBe(rateField.min);
    // A graph a person shares carries `providerId` and `settings`, and never a loose vendor field.
    expect(paramsNow()).not.toHaveProperty('rate');
  });

  it('holds a setting to the bounds the provider schema declares', async () => {
    render(<ProviderBody nodeId="p" kind="tts" />);
    const rate = screen.getByRole('spinbutton');
    await userEvent.clear(rate);
    await userEvent.type(rate, String(rateField.max! + 1));
    await userEvent.tab();
    // The same schema the server validates against, so the form cannot offer what the run refuses.
    expect(paramsNow().settings.rate).toBe(rateField.max);
  });

  it('starts the new provider on its own defaults when the pick changes, and probes at once', async () => {
    const runNode = vi.fn().mockResolvedValue(undefined);
    useStudio.setState({ runNode });
    render(<ProviderBody nodeId="p" kind="tts" />);
    expect(withModel.id).not.toBe(withRate.id);
    await userEvent.selectOptions(screen.getAllByRole('combobox')[0]!, withModel.id);
    expect(paramsNow().providerId).toBe(withModel.id);
    expect(paramsNow().settings).toEqual(withModel.defaultSettings);
    // Capabilities belong to whichever provider was probed; leaving the old ones under a new name reads as fact.
    expect(runNode).toHaveBeenCalledWith('p');
  });

  it('reports a capability that is not ready once, with the way out', () => {
    useStudio.setState({ runtimes: probed(3) });
    render(<ProviderBody nodeId="p" kind="tts" />);
    expect(screen.getByText('3')).toBeDefined();
    expect(screen.getByText('ffmpeg is not installed')).toBeDefined();
    expect(screen.getByText(/brew install ffmpeg/)).toBeDefined();
    expect(screen.getAllByText('ffmpeg is not installed')).toHaveLength(1);
  });

  it('says nothing about capabilities before the node has run', () => {
    render(<ProviderBody nodeId="p" kind="tts" />);
    expect(screen.queryByText(/ffmpeg/)).toBeNull();
    const labels = [...document.querySelectorAll('.nc-k')].map((e) => e.textContent);
    expect(labels).toContain('status');
  });
});

describe('every provider this build ships', () => {
  it('can be picked and drawn without a line of UI of its own', async () => {
    for (const provider of PROVIDERS.filter((p) => p.kind === 'tts')) {
      useStudio.setState({ graph: graphWith({ providerId: provider.id, settings: { ...provider.defaultSettings } }), runtimes: {} });
      const { unmount } = render(<ProviderBody nodeId="p" kind="tts" />);
      const labels = [...document.querySelectorAll('.nc-k')].map((e) => e.textContent);
      for (const field of provider.fields) expect(labels, provider.id).toContain(field.name);
      unmount();
    }
  });
});
