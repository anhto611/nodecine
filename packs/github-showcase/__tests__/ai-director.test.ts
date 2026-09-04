import { beforeEach, describe, expect, it } from 'vitest';
import { Executor } from '@/core/engine/executor';
import type { Graph } from '@/core/engine/graph';
import { registerNodeType, type AnyNodeDefinition } from '@/core/nodes/definition';
import { registerCoreNodes } from '@/core/nodes';
import { registerCoreScenes } from '@/core/scenes/title-card';
import { _resetSceneRegistry } from '@/core/scenes/registry';
import { assertValidIR } from '@/core/assembler/validate-ir';
import type { DirectorPlan, FactSheet } from '@/core/types/payloads';
import type { VideoIR } from '@/core/types/ir';
import { makeFakeServices } from '@/core/__tests__/fakes';
import { AI_DIRECTOR, aiDirector } from '../nodes/ai-director';
import { FETCH_REPO_OP, GITHUB_FETCHER, githubFetcher } from '../nodes/github-fetcher';
import { registerGithubShowcaseScenes } from '../scenes/schemas';
import { PACK_ID } from '../constants';
import type { RepoData } from '../facts';

const repo: RepoData = {
  owner: 'acme', name: 'widget', description: 'Tiny widgets for the web.', stars: 4321, topics: ['web'], language: 'TypeScript', defaultBranch: 'main',
  readme: '# Widget\nMakes widgets.', rootFiles: ['package.json'], manifests: { 'package.json': '{"name":"widget"}' },
};

const good = (language = 'en') => ({
  language,
  audioScript: 'Meet Widget, the tiniest way to build widgets for the web. Install it, wire it up, and ship in minutes.',
  scenes: [
    { headline: 'TINY WIDGETS, BIG WEB', subline: 'Build UI pieces in minutes', badgeText: 'Trending', accentColor: '#7c5cff' },
    { headline: 'Three things it does', featureHighlights: ['Fast', 'Small', 'Typed'], accentColor: '#7c5cff' },
    { headline: 'Try it today', callToActionText: 'Star the repo and build something.', accentColor: '#7c5cff' },
  ],
});

/** Input → Fetcher → Director (+ Claude provider) → Assembler (+ TTS) so facts can be checked inside the IR. */
function graph(outputLanguage = 'auto'): Graph {
  return {
    nodes: [
      { id: 'in', type: 'core/input-trigger', params: { value: 'acme/widget' }, bypassed: false, position: { x: 0, y: 0 } },
      { id: 'fetch', type: GITHUB_FETCHER, params: {}, bypassed: false, position: { x: 0, y: 0 } },
      { id: 'llm', type: 'core/claude-code-provider', params: {}, bypassed: false, position: { x: 0, y: 0 } },
      { id: 'dir', type: AI_DIRECTOR, params: { outputLanguage }, bypassed: false, position: { x: 0, y: 0 } },
      { id: 'tts-provider', type: 'core/system-tts-provider', params: { rate: 1 }, bypassed: false, position: { x: 0, y: 0 } },
      { id: 'tts', type: 'core/tts-engine', params: { speed: 1 }, bypassed: false, position: { x: 0, y: 0 } },
      { id: 'asm', type: 'core/timeline-assembler', params: { fps: 30, width: 1080, height: 1920, minTotalFrames: 270, title: 'Widget' }, bypassed: false, position: { x: 0, y: 0 } },
    ],
    edges: [
      { id: 'e1', source: 'in', sourcePort: 'source', target: 'fetch', targetPort: 'source' },
      { id: 'e2', source: 'fetch', sourcePort: 'facts', target: 'dir', targetPort: 'facts' },
      { id: 'e3', source: 'llm', sourcePort: 'llm', target: 'dir', targetPort: 'llm' },
      { id: 'e4', source: 'dir', sourcePort: 'script', target: 'tts', targetPort: 'script' },
      { id: 'e5', source: 'tts-provider', sourcePort: 'tts', target: 'tts', targetPort: 'tts' },
      { id: 'e6', source: 'dir', sourcePort: 'plan', target: 'asm', targetPort: 'plan' },
      { id: 'e7', source: 'tts', sourcePort: 'voiceover', target: 'asm', targetPort: 'voiceover' },
      { id: 'e8', source: 'fetch', sourcePort: 'facts', target: 'asm', targetPort: 'facts' },
    ],
  };
}

const packHandlers = { [`${PACK_ID}/${FETCH_REPO_OP}`]: async () => repo };

describe('AI Director node', () => {
  beforeEach(() => {
    _resetSceneRegistry();
    registerCoreScenes();
    registerCoreNodes();
    // Not registerGithubShowcase(): its `done` guard would skip re-adding the scene schemas after the reset.
    registerGithubShowcaseScenes();
    registerNodeType(githubFetcher as unknown as AnyNodeDefinition);
    registerNodeType(aiDirector as unknown as AnyNodeDefinition);
  });

  it('runs end to end and the facts in the IR equal the FactSheet (pack acceptance test)', async () => {
    const services = makeFakeServices({ packHandlers, complete: async () => good() });
    const ex = new Executor(graph(), services);
    const { ok } = await ex.run();
    expect(ok).toBe(true);
    const ir = ex.runtimes_().get('asm')!.outputs.ir!.payload as VideoIR;
    assertValidIR(ir);
    const sheet = ex.runtimes_().get('fetch')!.outputs.facts!.payload as FactSheet;
    expect(ir.timeline[0]!.props.stars).toBe(sheet.facts.stars);
    expect(ir.timeline[1]!.props.installCommand).toBe(sheet.facts.installCommand);
    expect(ir.timeline[1]!.props.repoName).toBe('widget');
    expect(ir.timeline[2]!.props.brandName).toBe('github.com/acme/widget');
    expect(ir.meta.language).toBe('en');
    const prompt = services.calls.find((c) => c.name === 'complete')!.args[0] as string;
    expect(prompt).not.toContain('4321');
  });

  it('retries once on wrong structure, then fails with LLM_SCHEMA_INVALID and the raw output', async () => {
    let n = 0;
    const services = makeFakeServices({ packHandlers, complete: async () => { n++; return { nonsense: true }; } });
    const ex = new Executor(graph(), services);
    const { ok } = await ex.run();
    expect(ok).toBe(false);
    expect(n).toBe(2);
    const rt = ex.runtimes_().get('dir')!;
    expect(rt.error?.code).toBe('LLM_SCHEMA_INVALID');
    expect(rt.error?.retryable).toBe(true);
    expect((rt.error?.details as { raw: unknown }).raw).toEqual({ nonsense: true });
  });

  it('recovers when the retry returns a valid plan', async () => {
    let n = 0;
    const services = makeFakeServices({ packHandlers, complete: async () => (++n === 1 ? { broken: 1 } : good()) });
    const ex = new Executor(graph(), services);
    expect((await ex.run()).ok).toBe(true);
    expect(n).toBe(2);
  });

  it('retries once with a strict prompt on a language mismatch, then fails with LLM_LANGUAGE_MISMATCH', async () => {
    const prompts: string[] = [];
    const services = makeFakeServices({ packHandlers, complete: async (p) => { prompts.push(p); return good('en'); } });
    const ex = new Executor(graph('vi'), services);
    const { ok } = await ex.run();
    expect(ok).toBe(false);
    expect(prompts).toHaveLength(2);
    expect(prompts[0]).toContain('Vietnamese');
    expect(prompts[0]).not.toContain('mandatory');
    expect(prompts[1]).toContain('mandatory');
    expect(ex.runtimes_().get('dir')!.error?.code).toBe('LLM_LANGUAGE_MISMATCH');
  });

  it('accepts a regional variant of the requested language', async () => {
    const services = makeFakeServices({ packHandlers, complete: async () => good('en-US') });
    const ex = new Executor(graph('en'), services);
    expect((await ex.run()).ok).toBe(true);
    const plan = ex.runtimes_().get('dir')!.outputs.plan!.payload as DirectorPlan;
    expect(plan.language).toBe('en');
  });

  it('is blocked by capability when Claude Code is not logged in, without calling the model', async () => {
    const services = makeFakeServices({ packHandlers, claudeAuthenticated: false, complete: async () => good() });
    const ex = new Executor(graph(), services);
    await ex.run();
    const rt = ex.runtimes_().get('dir')!;
    expect(rt.state).toBe('blocked');
    expect(rt.blockedBy?.kind).toBe('capability');
    expect(services.calls.some((c) => c.name === 'complete')).toBe(false);
  });
});
