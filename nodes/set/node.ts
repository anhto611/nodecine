import { z } from 'zod';
import { AssetUrlSchema, SCENE_SOURCE_MAX, type LayerSheet, type LayerSpec, type StyleSheet } from '@/contracts/types/payloads';
import { getForm } from '@/contracts/forms/registry';
import { ErrorCode, NodeError } from '@/contracts/errors';
import type { NodeDefinition } from '@/core/nodes/definition';
import { FRAME_PRESETS } from '@/contracts/visual/frame';
import { resolveLLM } from '@/contracts/resources';
import { drawStyle } from '@/contracts/visual/style-drawing';
import { drawSpanning } from '@/contracts/visual/spanning';
import { captionBandBox } from '@/contracts/visual/scene-markup';

export const SET = 'core/set';

const Member = z.object({
  /** The stage key the scenes write and this member's own script reads. */
  id: z.string().regex(/^[a-z][a-z0-9_-]{0,39}$/),
  brief: z.string().max(600).default(''),
  placement: z.enum(['under', 'over']).default('over'),
  /** Both above zero: something else draws it and this node only announces it. Zero: it is drawn here. */
  width: z.number().int().min(0).max(8192).default(0),
  height: z.number().int().min(0).max(8192).default(0),
  /** A drawing written by hand rather than by the model; `width` and `height` then say how big it is. */
  source: z.string().max(SCENE_SOURCE_MAX).default(''),
  /**
   * The rectangle in the frame this thing lives in. All four at zero means it has none, and then
   * nothing drawn per scene can leave room for it: a layout drawn once cannot avoid a thing that
   * may be anywhere.
   */
  homeX: z.number().int().min(0).max(8192).default(0),
  homeY: z.number().int().min(0).max(8192).default(0),
  homeWidth: z.number().int().min(0).max(8192).default(0),
  homeHeight: z.number().int().min(0).max(8192).default(0),
});

const Params = z.object({
  /** The language model this node draws with (§1.3). */
  llmProvider: z.string().max(60).default(''),
  llmSettings: z.record(z.string(), z.unknown()).default({}),
  /** The film's visual direction in the user's words. */
  brief: z.string().max(600).default(''),
  frame: z.enum(['9:16', '16:9', '1:1', '4:5']).default('9:16'),
  /** A picture fixed for the whole film — a character, a logo — that every scene makes room for. */
  character: z.union([z.literal(''), AssetUrlSchema]).default(''),
  /** `transparent` when something plays under the scenes: no ground, the picture stays visible. */
  ground: z.enum(['solid', 'transparent']).default('solid'),
  /** The form whose classes the sheet should serve (§6). Empty draws to no form in particular. */
  form: z.string().max(40).default(''),
  /** The language the film will be written in, for the sheet's own type choices. `auto` says nothing. */
  language: z.string().min(2).max(35).default('auto'),
  /** The things that stay on screen while the scenes change, each answering to its own name. */
  members: z.array(Member).max(8).default([]),
});

/**
 * The set the film is shot on (CORE_CONTRACTS §5.22): everything that does not change.
 *
 * The style sheet every scene shares, and the things that stay on screen while the scenes come and
 * go. They were two nodes until 2026-09-12, and being two was the mistake: both are drawn once, both
 * are pinned, both belong to the channel rather than to the video, and one without the other is half
 * an answer — a thing beside the scenes is drawn in the film's style and to its frame, so the sheet
 * always came first anyway.
 *
 * Two ports out rather than one payload, because two different readers want different halves: the
 * Plate Maker wants the style to draw in and the layers to leave room for, while the Assembler wants
 * only the layers, gathered on one port with whatever the Layer nodes add.
 */
export const set: NodeDefinition<typeof Params> = {
  type: SET,
  version: 4,
  kind: 'process',
  /**
   * No inputs at all, on purpose.
   *
   * This node reads a script until 2026-09-12: the form it was written for, its language, and how
   * many scenes a member had to travel. All three made a channel's look depend on one video's
   * script — so it could not be drawn before a script existed, and pinning it froze a decision made
   * from one particular film. In `t03` that same port also closed the only cycle in the graph. The
   * form and the language are settings here now, and the count was never worth having: a member's
   * script reads `nodecine.beats` at mount and travels the scenes the film really has.
   */
  inputs: [],
  outputs: [
    { name: 'style', type: 'StyleSheet' },
    // The same payload a Layer node emits: a thing beside the scenes is one idea, whether a model
    // drew it or a file holds it (§5.22).
    { name: 'layers', type: 'LayerSheet' },
  ],
  paramsSchema: Params,
  defaultParams: { llmProvider: '', llmSettings: {}, brief: '', frame: '9:16', character: '', ground: 'solid', form: '', language: 'auto', members: [] },
  run: async ({ params, services, signal, log, progress }) => {
    const ref = await resolveLLM(services, params);
    const formId = params.form.trim();
    const form = getForm(formId || undefined);
    // A member the form's poses place is moved by the scenes, so its home is a size, not a cage.
    const placedByScenes = (id: string) => (form?.poses ?? []).some((p) => p.stage[id]);
    if (formId && !form) throw new NodeError(ErrorCode.NODE_PARAMS_INVALID, `no film form named "${formId}"`, false).withFix('leave the form empty, or name one this build ships');
    const preset = FRAME_PRESETS.find((f) => f.id === params.frame) ?? FRAME_PRESETS[0]!;
    const frame = { width: preset.width, height: preset.height };
    const wanted = params.members.filter((m) => m.brief.trim() || m.source.trim());
    // A member placed under the scenes is the film's ground, so the scenes must stop painting one.
    const transparent = params.ground === 'transparent' || wanted.some((m) => m.placement === 'under');

    progress(0.05, 'drawing the style');
    const drawn = await drawStyle(services, ref, { brief: params.brief, frame, language: params.language, character: !!params.character, transparent, ...(form ? { form: { guidance: form.draw.guidance } } : {}) }, signal);
    for (const w of drawn.warnings) log('warn', w);
    log('info', `style "${drawn.style.name}"${drawn.attempts > 1 ? ' on the second try' : ''}${form ? ` · form "${form.id}"` : ''}${transparent ? ' · transparent ground' : ''}`);
    const sheet: StyleSheet = { style: drawn.style, guide: drawn.guide, frame, transparent, ...(params.character ? { character: params.character } : {}), ...(form ? { form: form.id } : {}) };

    const seen = new Set<string>();
    for (const m of wanted) {
      if (seen.has(m.id)) throw new NodeError(ErrorCode.NODE_PARAMS_INVALID, `two members are both called "${m.id}"`, false).withFix('give every member its own name: the scenes address them by it');
      seen.add(m.id);
    }
    // A member travels whatever scenes the film turns out to have; its script reads them at mount.
    // This is only what the drawing is told to expect, and four is as good a guess as any.
    const beats = 4;
    const members: LayerSpec[] = [];
    const homeOf = (m: z.infer<typeof Member>) =>
      m.homeWidth > 0 && m.homeHeight > 0 ? { x: m.homeX, y: m.homeY, width: m.homeWidth, height: m.homeHeight } : undefined;
    // The band is only known once the style is drawn, which is why the check lives here and not in
    // the schema: a home that reads fine on its own can still sit on the words the voice says.
    const band = captionBandBox(frame.width, frame.height, drawn.style.captions);
    const overlapsBand = (h: { x: number; y: number; width: number; height: number }) =>
      h.x < band.x + band.width && h.x + h.width > band.x && h.y < band.y + band.height && h.y + h.height > band.y;
    for (const [i, m] of wanted.entries()) {
      progress(0.2 + (0.8 * i) / wanted.length, `drawing "${m.id}"`);
      // Given a size, the drawing belongs to somebody else and this node only passes the news on.
      if (m.width > 0 && m.height > 0) {
        // No drawing of its own: announced to the scenes, laid down by whoever owns the drawing.
        members.push({ kind: 'code', id: m.id, brief: m.brief, placement: m.placement, width: m.width, height: m.height, source: m.source, startSeconds: 0, ...(homeOf(m) ? { home: homeOf(m) } : {}) });
        log('info', `"${m.id}" ${m.width}×${m.height}px ${m.placement} the scenes${m.source ? '' : ', drawn elsewhere'}`);
        continue;
      }
      const home = homeOf(m);
      // Said once, on the node that could have fixed it: without a home the scenes cannot leave
      // room, and this is the only place a person can give it one.
      if (!home && m.placement === 'over') log('warn', `"${m.id}" has no home, so no scene can leave room for it; give it one to stop the words being covered`);
      if (home && overlapsBand(home) && !placedByScenes(m.id)) log('warn', `"${m.id}" lives at ${home.x},${home.y} ${home.width}×${home.height}, which runs into the caption band at ${band.x},${band.y} ${band.width}×${band.height}; it will sit on the spoken words`);
      const thing = await drawSpanning(services, ref, { brief: m.brief, style: drawn.style, guide: drawn.guide, frame, placement: m.placement, beats, band: drawn.style.captions, stageKey: m.id, ...(home ? { home } : {}), ...(placedByScenes(m.id) ? { placedByScenes: true } : {}) }, signal);
      for (const w of thing.warnings) log('warn', `"${m.id}": ${w}`);
      log('info', `"${m.id}" ${thing.width}×${thing.height}px ${m.placement} the scenes${thing.attempts > 1 ? ' on the second try' : ''}`);
      members.push({ kind: 'code', id: m.id, brief: m.brief, placement: m.placement, width: thing.width, height: thing.height, source: thing.source, startSeconds: 0, ...(home ? { home } : {}) });
    }
    if (!members.length) log('info', 'nothing beside the scenes: the film is scenes alone');
    return { style: sheet, layers: { layers: members } as LayerSheet };
  },
};

export type SetParams = z.infer<typeof Params>;
export const DEFAULT_SET: SetParams = set.defaultParams;
