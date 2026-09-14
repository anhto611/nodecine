import { z } from 'zod';
import { ErrorCode } from '../errors';
import type { Graph, NodeInstance } from '../engine/graph';
import type { NodeServices } from '../engine/services';
import { registerNodeType, type AnyNodeDefinition } from '../nodes/definition';
import { registerPortType, type PortType } from '../types/ports';

/**
 * Nodes that do nothing but move text along, for testing the runtime on its own.
 *
 * The runtime's tests used to run the shipped video pipeline — a script, a voice, the assembler, a
 * player — so a question about the cache was answered by counting how often a voice was synthesized,
 * and deleting a video node broke the executor's tests. These nodes know no video: every piece of
 * work goes through `services.invoke`, where a test can count it, fail it, or slow it down.
 */

/** The kit's text wire. Its own name, so a registry that also holds the video contracts cannot collide. */
export const TEXT = 'TestText' as PortType;
const TextSchema = z.object({ text: z.string() }).passthrough();
/** A second type, so a wire between ports that do not agree can be drawn and refused. */
export const NUMBER = 'TestNumber' as PortType;

const at = { x: 0, y: 0 };
const port = (name: string, extra: Record<string, unknown> = {}) => ({ name, type: TEXT, ...extra });

const define = (def: Record<string, unknown>) => registerNodeType(def as unknown as AnyNodeDefinition);

export function registerTestKit(): void {
  registerPortType(TEXT, { labelKey: 'port.testText', schema: TextSchema });
  registerPortType(NUMBER, { labelKey: 'port.testNumber', schema: z.object({ value: z.number() }) });

  define({
    type: 'test/count', version: 1, kind: 'source', inputs: [], outputs: [{ name: 'count', type: NUMBER }],
    paramsSchema: z.object({}), defaultParams: {},
    run: async () => ({ count: { value: 3 } }),
  });

  const SourceParams = z.object({ value: z.string().default('hello') });
  define({
    type: 'test/source', version: 1, kind: 'source', inputs: [], outputs: [port('out')],
    paramsSchema: SourceParams, defaultParams: { value: 'hello' },
    validate: (p: z.infer<typeof SourceParams>) => (p.value.trim() ? [] : [{ code: ErrorCode.INPUT_EMPTY, message: 'nothing typed' }]),
    run: async ({ params }: { params: z.infer<typeof SourceParams> }) => ({ out: { text: params.value } }),
  });

  /** One unit of paid work: what a voice, a model or a render is to the runtime. */
  const VoiceParams = z.object({ speed: z.number().positive().default(1) });
  define({
    type: 'test/voice', version: 1, kind: 'process', inputs: [port('in')], outputs: [port('out')],
    paramsSchema: VoiceParams, defaultParams: { speed: 1 },
    run: async ({ inputs, params, services }: { inputs: Record<string, { payload: { text: string } }>; params: z.infer<typeof VoiceParams>; services: NodeServices }) =>
      ({ out: { text: await services.invoke<string>('voice', [inputs.in!.payload.text, params.speed]) } }),
  });

  /** Joins what reaches it; warns when told to expect a second input that is not wired. */
  const JoinParams = z.object({ fps: z.number().int().min(1).default(30), wantsExtra: z.boolean().default(false) });
  define({
    type: 'test/join', version: 1, kind: 'process', inputs: [port('in'), port('extra', { required: false })], outputs: [port('out')],
    paramsSchema: JoinParams, defaultParams: { fps: 30, wantsExtra: false },
    run: async ({ inputs, params, log }: { inputs: Record<string, { payload: { text: string } } | undefined>; params: z.infer<typeof JoinParams>; log: (l: string, m: string, c?: string) => void }) => {
      if (params.wantsExtra && !inputs.extra) log('warn', 'nothing is wired into extra', 'EXTRA_NOT_CONNECTED');
      return { out: { text: [inputs.in!.payload.text, inputs.extra?.payload.text].filter(Boolean).join('+') } };
    },
  });

  define({
    type: 'test/sink', version: 1, kind: 'sink', inputs: [port('in')], outputs: [],
    paramsSchema: z.object({}), defaultParams: {},
    run: async ({ inputs, services }: { inputs: Record<string, { payload: { text: string } }>; services: NodeServices }) => {
      await services.invoke('show', [inputs.in!.payload.text]);
      return {};
    },
  });

  define({
    type: 'test/export', version: 1, kind: 'ondemand', defaultBypassed: true, inputs: [port('in')], outputs: [],
    paramsSchema: z.object({}), defaultParams: {},
    run: async ({ inputs, services }: { inputs: Record<string, { payload: { text: string } }>; services: NodeServices }) =>
      services.invoke<Record<string, unknown>>('export', [inputs.in!.payload.text]),
  });

  /** A part a node needs, reported the way a probe reports one: capabilities on the payload. */
  const PartParams = z.object({ ready: z.boolean().default(true) });
  define({
    type: 'test/part', version: 1, kind: 'source', inputs: [], outputs: [port('part')],
    paramsSchema: PartParams, defaultParams: { ready: true },
    run: async ({ params }: { params: z.infer<typeof PartParams> }) => ({
      part: { text: 'part', capabilities: { render: params.ready ? { status: 'ready' } : { status: 'unavailable', reason: 'no renderer', fix: 'install one' } } },
    }),
  });
  define({
    type: 'test/uses-part', version: 1, kind: 'sink', inputs: [port('in'), port('part', { requires: ['render'] })], outputs: [],
    paramsSchema: z.object({}), defaultParams: {},
    run: async () => ({}),
  });
}

/**
 * Only the core's two calls are real. The contracts widen `NodeServices` with a model, a voice and an
 * engine; no kit node asks for those, so they are left out rather than faked.
 */
export type TestServices = NodeServices & {
  calls: { name: string; args: unknown[] }[];
  /** Make a service throw this until cleared with `null`. */
  fail: (serviceId: string, error: Error | null) => void;
  /** Make a service take this long, honouring nothing: a slow provider. */
  delay: (serviceId: string, ms: number) => void;
};

export function testServices(): TestServices {
  const calls: { name: string; args: unknown[] }[] = [];
  const failures = new Map<string, Error>();
  const delays = new Map<string, number>();
  let clock = 1_000_000;
  return {
    calls,
    fail: (id: string, error: Error | null) => { if (error) failures.set(id, error); else failures.delete(id); },
    delay: (id: string, ms: number) => { delays.set(id, ms); },
    now: () => (clock += 7),
    async invoke<T>(serviceId: string, args: unknown[]): Promise<T> {
      calls.push({ name: serviceId, args });
      const ms = delays.get(serviceId);
      if (ms) await new Promise((r) => setTimeout(r, ms));
      const failure = failures.get(serviceId);
      if (failure) throw failure;
      if (serviceId === 'voice') return `${String(args[0])}@${String(args[1])}` as T;
      if (serviceId === 'export') return { fileName: 'film.mp4', bytes: 4800 } as T;
      return null as T;
    },
  } as unknown as TestServices;
}

const node = (id: string, type: string, params: Record<string, unknown> = {}, bypassed = false): NodeInstance => ({ id, type, params, bypassed, position: at });

/**
 * source → voice → join → sink, and an on-demand export hanging off the join, the way a saved graph
 * keeps it: bypassed.
 */
export function pipeline(): Graph {
  return {
    nodes: [
      node('source', 'test/source', { value: 'hello' }),
      node('voice', 'test/voice', { speed: 1 }),
      node('join', 'test/join', { fps: 30, wantsExtra: false }),
      node('sink', 'test/sink'),
      node('export', 'test/export', {}, true),
    ],
    edges: [
      { id: 'e1', source: 'source', sourcePort: 'out', target: 'voice', targetPort: 'in' },
      { id: 'e2', source: 'voice', sourcePort: 'out', target: 'join', targetPort: 'in' },
      { id: 'e3', source: 'join', sourcePort: 'out', target: 'sink', targetPort: 'in' },
      { id: 'e4', source: 'join', sourcePort: 'out', target: 'export', targetPort: 'in' },
    ],
  };
}
