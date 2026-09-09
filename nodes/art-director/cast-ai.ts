import { z } from 'zod';
import type { LLMRef, LookDef, SceneScript } from '@/core/types/payloads';
import type { NodeServices } from '@/core/engine/services';
import { sceneCandidates, type Casting, type Pick } from './cast';

/**
 * Casting by a model (CORE_CONTRACTS §5.9). The rule has already said which blocks can show each
 * scene; the model chooses among those — it reads the narration and the content, and each block's
 * own "when to use me" — and may set a tone. It never chooses a block that cannot show the scene,
 * and the user's casting table still wins. One call for the whole video; one retry on a bad shape;
 * any other failure falls back to the rule with a warning, never a blocked run.
 *
 * It may also answer `none`: not "nothing can show this" — the rule already catches that — but "none
 * of these is right for this beat". A card can hold a number and still be the wrong frame for the
 * one line the whole video turns on. Answering `none` sends the scene to be drawn a block of its
 * own, which is what an art director does when the folder has nothing that fits.
 */

const AnswerSchema = z.object({
  scenes: z.array(z.object({ block: z.string(), tone: z.string().optional() })),
}).strip();

/** What the model writes when it wants a block drawn for a scene instead of picking one. */
export const NONE = 'none';

export function buildCastingPrompt(script: SceneScript, look: LookDef, casting: Casting, opts: { mayDraw?: boolean } = {}): { prompt: string; candidates: ReturnType<typeof sceneCandidates> } | null {
  const candidates = sceneCandidates(script, look, casting);
  const offered = candidates.map((c) => (c.candidates.length ? c.candidates : c.partial.map((p) => p.id)));
  // Nothing to decide when every scene is pinned or has a single choice — unless a block can be
  // drawn, in which case "the only block that fits is the wrong one" is itself a decision.
  if (!opts.mayDraw && candidates.every((c, i) => c.pinned || offered[i]!.length <= 1)) return null;
  const used = new Set(candidates.flatMap((c, i) => (c.pinned ? [c.pinned] : offered[i]!)));
  const blocks = look.blocks.filter((b) => used.has(b.id));
  const tones = Object.keys(look.tones);
  const lines = script.scenes.map((s, i) => {
    const c = candidates[i]!;
    const on = Object.entries(s.content).filter(([, v]) => v !== undefined && v !== '').map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(' / ') : String(v)}`).join(' · ');
    const choice = c.candidates.length ? c.candidates.join(' | ') : c.partial.map((p) => `${p.id} (loses ${p.dropped.join(', ')})`).join(' | ');
    return `  ${i + 1}. ${s.role} — says: "${s.narration}" — shows: ${on || '(nothing)'}${c.pinned ? ` → fixed: ${c.pinned}` : ` → choose one of: ${choice}`}`;
  });
  const prompt = [
    `You are the art director of a short video. The script is written; for each scene, pick the block (a scene layout) that shows its content best, from the blocks allowed for that scene.`,
    ``,
    `Blocks:`,
    ...blocks.map((b) => `- ${b.id}: ${b.doc.when.trim() || b.name}`),
    ``,
    tones.length ? `Tones (colour variants of the stage): ${tones.join(', ')}. Set one per scene when it helps the rhythm — a run of scenes in one tone reads calm, a change marks a turn — or leave it out.` : `The stage has no tones; do not set any.`,
    ``,
    `Scenes, in order (what the voice says, what is on screen, and the allowed blocks):`,
    ...lines,
    ``,
    `Rules: vary the blocks across neighbouring scenes when the content allows; the opening and the closing may repeat a block only if nothing else fits; never pick a block outside a scene's list.`,
    ...(opts.mayDraw
      ? [`If a scene's beat deserves a frame none of its blocks gives it — the block would show the words but read wrong for this moment — answer "${NONE}" for that scene and a block will be drawn for it. Use it sparingly: an ordinary scene an existing block shows well is not worth a new block, and a catalogue that grows every video stops being a look.`]
      : []),
    `Return ONLY a JSON object, no prose, no markdown fence: { "scenes": [ { "block": "<id>${opts.mayDraw ? ` or ${NONE}` : ''}"${tones.length ? ', "tone": "<tone or omit>"' : ''} }, … ] } with exactly ${script.scenes.length} entries in order.`,
  ].join('\n');
  return { prompt, candidates };
}

/** The model's picks, validated against the candidates; `undefined` for a scene it got wrong. */
export function picksFromAnswer(answer: z.infer<typeof AnswerSchema>, candidates: ReturnType<typeof sceneCandidates>): (Pick | undefined)[] {
  return candidates.map((c, i) => {
    const a = answer.scenes[i];
    if (!a) return undefined;
    const allowed = c.candidates.length ? c.candidates : c.partial.map((p) => p.id);
    // A pinned scene is the user's decision and outranks the model, `none` included.
    if (!c.pinned && a.block.trim().toLowerCase() === NONE) return { none: true, ...(a.tone ? { tone: a.tone } : {}) };
    const block = c.pinned ?? (allowed.includes(a.block) ? a.block : undefined);
    return { ...(block ? { block } : {}), ...(a.tone ? { tone: a.tone } : {}) };
  });
}

export async function pickWithModel(
  services: Pick_<NodeServices, 'complete'>,
  ref: LLMRef,
  script: SceneScript,
  look: LookDef,
  casting: Casting,
  signal: AbortSignal,
  log: (level: 'info' | 'warn', message: string, code?: string) => void,
  mayDraw = false,
): Promise<(Pick | undefined)[]> {
  const built = buildCastingPrompt(script, look, casting, { mayDraw });
  if (!built) return [];
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const answer = await services.complete(ref, built.prompt, AnswerSchema, signal);
      if (answer.scenes.length !== script.scenes.length) throw new Error(`${answer.scenes.length} choices for ${script.scenes.length} scenes`);
      const picks = picksFromAnswer(answer, built.candidates);
      log('info', `model cast ${picks.filter((p) => p?.block).length}/${script.scenes.length} scenes · ${picks.map((p) => (p?.none ? NONE : p?.block) ?? '·').join(', ')}`);
      return picks;
    } catch (e) {
      if (signal.aborted) throw e;
      const msg = e instanceof Error ? e.message : String(e);
      if (attempt === 1) { log('warn', `model casting: ${msg.slice(0, 160)} · retrying once`); continue; }
      log('warn', `model casting failed twice (${msg.slice(0, 160)}); casting by content instead`, (e as { code?: string }).code);
    }
  }
  return [];
}
type Pick_<T, K extends keyof T> = { [P in K]: T[P] };
