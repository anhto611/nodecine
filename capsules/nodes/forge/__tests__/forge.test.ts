import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Composition } from '@/contracts/types/composition';
import { componentProblems, sampleValuesOf, stillBox, stillPage, themeTokens, withDescription } from '../component';
import { FORGE_AT_ONCE, FORGE_BUDGET_MS, forge } from '../node';
import { PlanSchema, planPrompt } from '../prompt';

const SHELL = `<!doctype html><html><head><style>#shell { --bg: #050302; --fg: #ecdcb9; --brand: #d9a556; --font-display: "Noto Serif",serif; }</style></head><body><div id="shell" data-composition-id="shell" data-width="1920" data-height="1080"></div></body></html>`;

/** A component that keeps the contract, with its script swappable. */
const component = (name: string, opts: { script?: string; variables?: string; role?: string; rootId?: string } = {}) => `<!doctype html>
<html lang="en" data-composition-duration="6" data-role="${opts.role ?? 'piece'}" data-composition-variables='${opts.variables ?? '[{"id":"count","type":"number","label":"How many","default":1,"sample":3},{"id":"facing","type":"string","label":"Facing","default":"left","sample":"right"}]'}'>
<head><meta charset="UTF-8" /></head>
<body><template>
<style>#root{position:absolute;inset:0}.we-body{fill:var(--fg,#eee)}</style>
<div id="root" data-composition-id="${opts.rootId ?? name}" data-duration="6"><svg viewBox="0 0 100 60"><g class="we-pos" transform="translate(10 10)"><g class="we-body"><rect width="40" height="30"/></g></g></svg></div>
<script>(function(){
  var root=document.getElementById('root');
  var v=window.__hyperframes&&window.__hyperframes.getVariables?window.__hyperframes.getVariables():{};
  var len=(typeof duration!=='undefined'?duration:6);
  var tl=gsap.timeline({paused:true});
  ${opts.script ?? "tl.fromTo(root.querySelector('.we-body'),{opacity:0},{opacity:1,duration:.6},0).to(root.querySelector('.we-body'),{x:4,duration:len-0.6,ease:'none'},0.6);"}
  tl.set({},{},6);
  tl.seek(0);
  window.__timelines=window.__timelines||{};window.__timelines['${name}']=tl;
})();</script>
</template></body></html>`;

const wanted = [
  { id: 'count', type: 'number' as const },
  { id: 'facing', type: 'string' as const },
];

describe('the component contract', () => {
  it('passes a component that keeps it', () => {
    expect(componentProblems(component('war-elephant'), 'war-elephant', wanted)).toEqual([]);
  });

  it('refuses a root that does not carry the name', () => {
    expect(componentProblems(component('war-elephant', { rootId: 'elephant' }), 'war-elephant', wanted)).toEqual([expect.stringContaining('data-composition-id is "elephant"')]);
  });

  it('refuses a component that does not declare the values it was asked for', () => {
    const problems = componentProblems(component('war-elephant', { variables: '[{"id":"count","type":"string","label":"How many","default":"1"}]' }), 'war-elephant', wanted);
    expect(problems).toEqual([expect.stringContaining('"count" is declared as string'), expect.stringContaining('"facing" is not declared')]);
    expect(componentProblems(component('war-elephant').replace(/ data-composition-variables='[^']*'/, ''), 'war-elephant', wanted)[0]).toMatch(/declares no data-composition-variables/);
  });

  it('refuses motion that only runs in callbacks, and the rest of what a seeked render never sees', () => {
    const onUpdate = component('war-elephant', { script: 'var s={p:0};tl.to(s,{p:1,duration:6,onUpdate:function(){root.style.opacity=s.p}},0);' });
    expect(componentProblems(onUpdate, 'war-elephant', wanted)).toEqual([expect.stringContaining('onUpdate')]);
    const loose = component('war-elephant', { script: 'tl.to(root,{x:Math.random()*10,repeat:-1,duration:duration},0);setTimeout(function(){},10);' });
    const problems = componentProblems(loose, 'war-elephant', wanted).join('\n');
    expect(problems).toMatch(/Math\.random/);
    expect(problems).toMatch(/repeat: -1/);
    expect(problems).toMatch(/timers/);
    expect(componentProblems(component('war-elephant', { role: 'scene' }), 'war-elephant', wanted)).toEqual([expect.stringContaining('data-role="scene"')]);
    expect(componentProblems(component('war-elephant').replace('<rect', '<text>🐘</text><rect'), 'war-elephant', wanted)).toEqual([expect.stringContaining('emoji')]);
  });

  it('flags a bare duration, which a component does not have', () => {
    const bare = component('war-elephant').replace("var len=(typeof duration!=='undefined'?duration:6);", 'var len=duration;');
    expect(componentProblems(bare, 'war-elephant', wanted)).toEqual([expect.stringContaining('no `duration` variable')]);
  });
});

describe('the still page', () => {
  it('is the component alone, its root sized, over the film background, wearing the shell tokens', () => {
    const files = { 'index.html': SHELL };
    expect(themeTokens(files)[0]).toEqual(['--bg', '#050302']);
    const page = stillPage(files, component('war-elephant'), stillBox(1920, 1080), 6);
    expect(stillBox(1080, 1920)).toEqual({ width: 540, height: 960 });
    expect(page).not.toContain('<template');
    expect(page).toContain('background: #050302');
    expect(page).toContain('--brand: #d9a556;');
    expect(page).toMatch(/data-composition-id="war-elephant" data-duration="6" data-width="960" data-height="540" data-start="0"/);
    expect(sampleValuesOf(component('war-elephant'))).toEqual({ count: 3, facing: 'right' });
  });

  it('carries a description a storyboard writer reads', () => {
    expect(withDescription(component('x1'), 'An "elephant"')).toContain('<meta name="description" content="An &quot;elephant&quot;" />');
  });
});

describe('the plan', () => {
  it('takes generic, parameterized needs', () => {
    const plan = PlanSchema.parse({
      needs: [{ name: 'war-elephant', description: 'A war elephant', why: 'the battle', variables: [{ id: 'count', type: 'number', label: 'How many', labelVi: 'Bao nhiêu', sample: 3 }] }],
    });
    expect(plan.needs[0]!.variables[0]!.sample).toBe(3);
    expect(PlanSchema.parse({}).needs).toEqual([]);
  });

  it('refuses a name tied to one film, a sample of the wrong type, and names twice', () => {
    expect(PlanSchema.safeParse({ needs: [{ name: 'elephant-40ad-hbt', description: 'x' }] }).success).toBe(true);
    expect(PlanSchema.safeParse({ needs: [{ name: 'hai-ba-trung-elephant-0040', description: 'x' }] }).success).toBe(false);
    expect(PlanSchema.safeParse({ needs: [{ name: 'War Elephant', description: 'x' }] }).success).toBe(false);
    expect(PlanSchema.safeParse({ needs: [{ name: 'war-elephant', description: 'x', variables: [{ id: 'count', type: 'number', label: 'n', sample: 'three' }] }] }).success).toBe(false);
    // A number written as text is taken as the number; a number for a text value as its text.
    const coerced = PlanSchema.parse({
      needs: [
        {
          name: 'war-elephant',
          description: 'x',
          variables: [
            { id: 'count', type: 'number', label: 'n', sample: '3' },
            { id: 'banner', type: 'string', label: 'b', sample: 7 },
          ],
        },
      ],
    });
    expect(coerced.needs[0]!.variables.map((v) => v.sample)).toEqual([3, '7']);
    expect(
      PlanSchema.safeParse({
        needs: [
          { name: 'a-b', description: 'x' },
          { name: 'a-b', description: 'y' },
        ],
      }).success,
    ).toBe(false);
  });

  it('tells the planner the kit, the film and the limit', () => {
    const prompt = planPrompt({
      brief: { about: 'Hai Bà Trưng rise against the Han', language: 'vi' },
      blocks: [{ name: 'history-diorama', role: 'feature', description: 'setting keywords: river, citadel', variables: [] }],
      components: [{ name: 'portrait-disc', role: 'piece', description: 'A portrait', variables: [{ id: 'picture', type: 'string', label: 'The portrait' } as never] }],
      max: 2,
      attempt: 0,
    });
    expect(prompt).toContain('at most 2');
    expect(prompt).toContain('block history-diorama [feature]: setting keywords: river, citadel');
    expect(prompt).toContain('component portrait-disc [piece]');
    expect(prompt).toContain('GENERIC');
  });
});

// ——— run(), with the model and the services faked ———

const composition = (): Composition => ({
  engine: 'hyperframes',
  width: 1920,
  height: 1080,
  fps: 30,
  files: { 'index.html': SHELL, 'compositions/components/portrait-disc.html': component('portrait-disc', { variables: '[]' }).padEnd(1200, ' ') },
  media: {},
  variables: [],
  values: {},
});

const STILL = `/api/assets/${'a'.repeat(40)}.png`;
const NEEDS = {
  needs: [
    {
      name: 'war-elephant',
      description: 'A war elephant, count and facing as values',
      why: 'the battle on elephants',
      variables: [
        { id: 'count', type: 'number', label: 'How many', labelVi: 'Bao nhiêu', sample: 3 },
        { id: 'facing', type: 'string', label: 'Facing', labelVi: 'Hướng', sample: 'right' },
      ],
    },
    { name: 'portrait-disc', description: 'A portrait', why: 'faces', variables: [] },
    { name: 'signal-fire', description: 'A beacon fire on a tower', why: 'the call to arms', variables: [] },
  ],
};

function forging(
  answers: { html: (prompt: string, n: number) => string | Promise<string>; verdict?: (n: number) => { ok: boolean; problems: string[] }; plan?: unknown; onWrite?: (name: string) => void },
  params: Record<string, unknown> = {},
) {
  const controller = new AbortController();
  const prompts: string[] = [];
  const written: unknown[][] = [];
  const invoked: string[] = [];
  let patched: Record<string, unknown> = {};
  const logs: string[] = [];
  let authored = 0;
  let judged = 0;
  const services = {
    probeLLM: async () => ({
      providerId: 'fake',
      displayName: 'Fake',
      transport: 'cli',
      settings: {},
      capabilities: { installed: { status: 'ready' }, authenticated: { status: 'ready' }, structuredOutput: { status: 'ready' }, vision: { status: 'ready' } },
    }),
    complete: async (_ref: unknown, prompt: string, _schema: unknown, _signal: unknown, opts?: { images?: string[] }) => {
      prompts.push(prompt);
      if (prompt.includes('Decide which reusable visual components')) return answers.plan ?? NEEDS;
      if (opts?.images?.length) return answers.verdict ? answers.verdict(judged++) : { ok: true, problems: [] };
      const html = await answers.html(prompt, authored++);
      if (html === 'TIMEOUT') throw new Error('claude did not answer within 600s');
      return { html };
    },
    invoke: async (id: string, args: unknown[]) => {
      invoked.push(id);
      if (id === 'composition/inspect') return { findings: [] };
      if (id === 'forge/still') return { url: STILL, width: 960, height: 540 };
      if (id === 'library/write') {
        written.push(args);
        answers.onWrite?.(args[1] as string);
        return { scope: args[0], name: args[1] };
      }
      throw new Error(`unknown ${id}`);
    },
  };
  const run = (extra: Record<string, unknown> = {}, input: Composition = composition()) =>
    forge.run({
      nodeId: 'forge',
      params: forge.paramsSchema.parse({ llmProvider: 'fake', scope: 'history-story', max: 2, ...params, ...patched, ...extra }),
      inputs: { composition: { type: 'Composition', payload: input }, brief: { type: 'Brief', payload: { about: 'Hai Bà Trưng', language: 'vi' } } },
      lists: {},
      signal: controller.signal,
      fresh: false,
      services,
      log: (level: string, message: string) => logs.push(`${level} ${message}`),
      progress: () => {},
      patchParams: (p: Record<string, unknown>) => {
        patched = { ...patched, ...p };
      },
    } as never) as Promise<{ composition: Composition }>;
  return { run, prompts, written, invoked, logs, controller, patched: () => patched };
}

const authorFor = (prompt: string) => /name: ([a-z-]+)/.exec(prompt)![1]!;

describe('the forge running', () => {
  it('passes the composition through when it may forge nothing', async () => {
    const f = forging({ html: () => '' }, { max: 0 });
    const out = await f.run();
    expect(out.composition).toEqual(composition());
    expect(f.prompts).toEqual([]);
  });

  it('forges what the kit lacks, puts it on the shelf and into the composition, and says what it reused', async () => {
    const f = forging({ html: (prompt) => component(authorFor(prompt)) });
    const out = await f.run();
    expect(Object.keys(out.composition.files)).toEqual(expect.arrayContaining(['compositions/components/war-elephant.html', 'compositions/components/signal-fire.html']));
    expect(out.composition.files['compositions/components/war-elephant.html']).toContain('<meta name="description" content="A war elephant, count and facing as values" />');
    expect(f.written.map((w) => [w[0], w[1], (w[3] as { from: string }).from])).toEqual([
      ['history-story', 'war-elephant', 'forge'],
      ['history-story', 'signal-fire', 'forge'],
    ]);
    expect(f.logs).toEqual(expect.arrayContaining(['info portrait-disc: reused, the kit already has it', 'info war-elephant: forged', 'info signal-fire: forged']));
    // Each was linted, drawn and looked at.
    expect(f.invoked.filter((id) => id === 'forge/still')).toHaveLength(2);
    expect(f.prompts.filter((p) => p.includes('attached picture'))).toHaveLength(2);
    expect((f.patched().forged as { name: string; still: string }[]).map((x) => [x.name, x.still])).toEqual([
      ['war-elephant', STILL],
      ['signal-fire', STILL],
    ]);
  });

  it('hands back what is wrong to be fixed, and drops a component that still fails', async () => {
    const f = forging({
      // The elephant breaks the contract every time; the fire is fixed on its second draft.
      html: (prompt) => (authorFor(prompt) === 'war-elephant' ? component('war-elephant', { script: 'tl.to(root,{x:1,duration:1,onUpdate:function(){}},0);' }) : component('signal-fire')),
      verdict: (n) => (n === 0 ? { ok: false, problems: ['the fire is tiny in a corner'] } : { ok: true, problems: [] }),
    });
    const out = await f.run();
    expect(out.composition.files['compositions/components/war-elephant.html']).toBeUndefined();
    expect(out.composition.files['compositions/components/signal-fire.html']).toBeDefined();
    expect(f.logs.find((l) => l.startsWith('warn war-elephant: dropped'))).toMatch(/onUpdate/);
    expect(f.logs).toContain('info signal-fire: forged after 1 round of fixes');
    expect(f.prompts.some((p) => p.includes('- looking at the still: the fire is tiny in a corner'))).toBe(true);
    // Three drafts of the elephant (the first and two fixes), two of the fire.
    expect(f.prompts.filter((p) => p.includes('Write one reusable HyperFrames component') && p.includes('name: war-elephant'))).toHaveLength(3);
    expect(f.written.map((w) => w[1])).toEqual(['signal-fire']);
  });

  it('does not forge again for the same film, even once the shelf brings its components back', async () => {
    const f = forging({ html: (prompt) => component(authorFor(prompt)) });
    const first = await f.run();
    const asked = f.prompts.length;
    // The Library node now reads them off the shelf, so the Composition hands them in.
    const again = await f.run({}, first.composition);
    expect(f.prompts.length).toBe(asked);
    expect(f.written).toHaveLength(2);
    expect(again.composition.files['compositions/components/signal-fire.html']).toBeDefined();
    expect(f.logs).toContain('info war-elephant: reused from the last forging');
    // Other films' components, lent by a shelf that grew, do not make it a different film.
    const lent = { ...again.composition, files: { ...again.composition.files, 'compositions/components/ship-portage.html': component('ship-portage'), 'library.json': JSON.stringify({ scope: 'history-story', components: ['ship-portage'] }) } };
    await f.run({}, lent);
    expect(f.prompts.length).toBe(asked);
    // "Forge again" asks anew.
    await f.run({ attempt: 1 });
    expect(f.prompts.length).toBeGreaterThan(asked);
  });

  it('asks once more for a smaller page when the model runs out of time', async () => {
    const f = forging({ html: (prompt, n) => (n === 0 ? 'TIMEOUT' : component(authorFor(prompt))), plan: { needs: [NEEDS.needs[0]] } });
    const out = await f.run();
    expect(out.composition.files['compositions/components/war-elephant.html']).toBeDefined();
    expect(f.logs).toContain('info war-elephant: the model ran out of time; asking again for a smaller page');
    expect(f.prompts.some((p) => p.includes('Write a smaller page this time'))).toBe(true);
  });

  it('forges one component at most unless told otherwise', () => {
    expect(forge.defaultParams.max).toBe(1);
  });

  it("puts what it forges on the shelf the film reads, whatever its own setting says", async () => {
    const f = forging({ html: (prompt) => component(authorFor(prompt)), plan: { needs: [NEEDS.needs[0]] } }, { scope: "somewhere-else" });
    const base = composition();
    await f.run({}, { ...base, files: { ...base.files, "library.json": JSON.stringify({ scope: "history-story", components: [] }) } });
    expect(f.written.map((w) => w[0])).toEqual(["history-story"]);
  });

  describe('with several to draw', () => {
    afterEach(() => vi.restoreAllMocks());
    const three = { needs: [NEEDS.needs[0], NEEDS.needs[2], { ...NEEDS.needs[2], name: 'siege-tower', description: 'A siege tower' }] };
    const later = (ms: number) => new Promise((r) => setTimeout(r, ms));

    it('draws ${FORGE_AT_ONCE} at a time, not one after another', async () => {
      let busy = 0;
      let most = 0;
      const f = forging(
        {
          plan: three,
          html: async (prompt) => {
            most = Math.max(most, ++busy);
            await later(5);
            busy--;
            return component(authorFor(prompt));
          },
        },
        { max: 3 },
      );
      const out = await f.run();
      expect(most).toBe(FORGE_AT_ONCE);
      // In the plan's order, whichever finished first.
      expect(Object.keys(out.composition.files).filter((k) => k.includes('/components/') && !k.includes('portrait'))).toEqual(
        expect.arrayContaining(['compositions/components/war-elephant.html', 'compositions/components/signal-fire.html', 'compositions/components/siege-tower.html']),
      );
    });

    it('puts each on the shelf the moment it passes, so stopping part-way loses nothing made', async () => {
      const f = forging(
        {
          plan: { needs: [NEEDS.needs[0], NEEDS.needs[2]] },
          // The elephant is quick; the fire takes long enough for the run to be stopped meanwhile.
          html: async (prompt) => {
            const name = authorFor(prompt);
            if (name === 'signal-fire') {
              await later(30);
              // A model call stops with the run, the way a provider honours its signal.
              if (f.controller.signal.aborted) throw new Error('aborted');
            }
            return component(name);
          },
          onWrite: (name) => {
            if (name === 'war-elephant') f.controller.abort();
          },
        },
        { max: 2 },
      );
      await expect(f.run()).rejects.toThrow();
      expect(f.written.map((w) => w[1])).toEqual(['war-elephant']);
    });

    it('leaves out what it has not started once its time is spent, and makes the film with the rest', async () => {
      const t0 = Date.now();
      let clock = t0;
      vi.spyOn(Date, 'now').mockImplementation(() => clock);
      const f = forging(
        {
          plan: three,
          html: async (prompt) => {
            // The first two take the whole budget between them.
            clock += FORGE_BUDGET_MS / 2 + 1;
            return component(authorFor(prompt));
          },
        },
        { max: 3 },
      );
      const out = await f.run();
      expect(f.logs.find((l) => l.startsWith('warn siege-tower: skipped'))).toBeDefined();
      expect(out.composition.files['compositions/components/siege-tower.html']).toBeUndefined();
      expect(out.composition.files['compositions/components/war-elephant.html']).toBeDefined();
    });
  });
});
