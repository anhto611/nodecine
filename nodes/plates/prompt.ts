import { CONTENT_KEYS, type ContentKey, type LayerSpec, type SceneScript, type StyleSheet } from '@/contracts/types/payloads';
import { codeRules, lintSceneSource } from '@/contracts/visual/scene-rules';
import { describeFrame } from '@/contracts/visual/frame';
import { signatureKey } from '@/contracts/visual/plates';

/**
 * What a plate is, spelled out for the model, and the check on its answer.
 *
 * A plate is a scene's layout with the words taken out: the same rules a drawn scene follows, plus
 * one — every value it carries goes in a hole named after its content key, because the whole reason
 * it exists is that somebody else fills it later without asking anybody.
 */

/** Two scenes of this shape, so the model draws for real words rather than for a shape name. */
function examples(script: SceneScript, keys: ContentKey[]): string[] {
  const want = signatureKey(keys);
  const of = (c: Record<string, unknown>) => keys.map((k) => `- ${k}: ${JSON.stringify(c[k])}`).join('\n');
  return script.scenes
    .filter((s) => signatureKey(CONTENT_KEYS.filter((k) => (s.content as Record<string, unknown>)[k] !== undefined)) === want)
    .slice(0, 2)
    .map((s) => of(s.content as Record<string, unknown>));
}

/**
 * What the film already puts on screen over every scene, and the room it takes.
 *
 * Only a layer that says where it lives counts. A plate is drawn once and poured into many times,
 * so it cannot know where a thing will be in one particular scene — it can only avoid everywhere
 * that thing might go. Told to avoid a whole lane, which on a portrait frame is the whole safe
 * area, the model has nowhere legal to put a word and puts it below the safe area instead, straight
 * into the band the spoken words are written in. That is not the model being careless; it is being
 * given an impossible instruction, and it is why a headline was drawn across the captions.
 *
 * So: a home, or nothing. A layer with no home is named as something the plate shares the frame
 * with, and no space is reserved — better an overlap the person can see than a layout squeezed out
 * of the frame.
 */
function roomToLeave(b: { sheet: StyleSheet; layers?: LayerSpec[]; box?: unknown }): string[] {
  const over = (b.layers ?? []).filter((l) => l.placement === 'over');
  if (!over.length) return [];
  // With a pose there is nothing to work out: the box and the thing's place in this scene were both
  // written by the same hand, so the box is already clear. Naming the things is still worth it —
  // otherwise the model draws its own phone inside the box it was given.
  if (b.box) {
    return [
      ``,
      `This film already draws ${over.length === 1 ? 'one thing' : `${over.length} things`} over every scene — ${over.map((l) => (l.brief ?? '').trim() || l.id || 'a drawing').join('; ')} — and ${over.length === 1 ? 'it is' : 'they are'} not yours to draw. The box below is already clear of ${over.length === 1 ? 'it' : 'them'}.`,
    ];
  }
  const homed = over.filter((l) => l.home);
  const loose = over.filter((l) => !l.home);
  return [
    ``,
    `This film draws ${over.length === 1 ? 'one thing' : `${over.length} things`} OVER every scene, for the whole film, and ${over.length === 1 ? 'it is' : 'they are'} not yours to draw:`,
    ...homed.map((l) => `- ${l.id ? `"${l.id}": ` : ''}${(l.brief ?? '').trim() || 'a drawing'} — it lives in ${l.home!.width}×${l.home!.height} px at ${l.home!.x},${l.home!.y} from the frame's top-left`),
    ...loose.map((l) => `- ${l.id ? `"${l.id}": ` : ''}${(l.brief ?? '').trim() || 'a drawing'} — it moves about the frame; keep your layout compact so it has somewhere to be`),
    ...(homed.length
      ? [`Keep your layout entirely out of ${homed.length === 1 ? 'that rectangle' : 'those rectangles'}: what you draw there is covered in every video made with this plate.`]
      : []),
  ];
}

export function buildPlatePrompt(b: { keys: ContentKey[]; box?: { x: number; y: number; width: number; height: number }; sheet: StyleSheet; script: SceneScript; layers?: LayerSpec[] }, feedback?: string): string {
  const { frame } = b.sheet;
  const lists = b.keys.filter((k) => k === 'points' || k === 'entries');
  const files = b.keys.filter((k) => k === 'image' || k === 'clip');
  const shown = examples(b.script, b.keys);
  return [
    `You are the illustrator of a short video. Draw ONE layout that every scene of a given shape will be poured into — not one scene, but the shape they share.`,
    ``,
    `The shape is these content keys, and only these: ${b.keys.join(', ')}.`,
    ...(shown.length ? [``, `Scenes of this shape in the film being made:`, ...shown.map((e, i) => `${i + 1}.\n${e}`)] : []),
    ``,
    `Style "${b.sheet.style.name}" — the guide:`,
    b.sheet.guide.trim(),
    `Its style sheet is already on the page; use its variables and classes, do not repeat it.`,
    ...roomToLeave(b),
    ``,
    `Rules:`,
    ...codeRules(frame).map((r) => `- ${r}`),
    `- Every value goes in a hole named after its key: put \`data-slot="<key>"\` on the element that shows it, and leave a short placeholder inside so the layout can be looked at empty. One hole per key, no key twice.`,
    ...(lists.length ? [`- A list is one row repeated: mark the row element with \`data-item\`. Draw exactly one row; whoever fills it repeats that row per item, so a second row drawn here becomes a second row per item.`] : []),
    ...(files.length ? [`- A file is an <img data-slot="${files[0]}" src="…"> with a fixed box in px and object-fit: cover. Leave any src; it is replaced.`] : []),
    `- Write NO words of your own into the holes beyond a placeholder: the film's words arrive later, and a word drawn here would be in every video made with this plate.`,
    `- The layout has to hold a value longer than the example without breaking: let text wrap or shrink rather than run off the frame.`,
    ...(b.box
      ? [
          // The box is the whole safety argument: a rectangle a person wrote cannot sit on the
          // captions or on the film's own furniture, so nothing the model draws inside it can either.
          `- Draw INSIDE a box ${b.box.width}×${b.box.height} px whose top-left corner is at ${b.box.x},${b.box.y} in the frame, and nowhere else. Position your outermost element absolutely at exactly that place and size, and lay everything out within it. Do not use the rest of the frame: the film has other things there.`,
        ]
      : []),
    ...(feedback ? [``, `Your previous attempt was rejected: ${feedback}. Fix that.`] : []),
    ``,
    `Return ONLY a JSON object, no prose, no markdown fence: { "source": "<the fragment>", "budget": { ${b.keys.map((k) => `"${k}": <characters this layout holds>`).join(', ')} } }`,
  ].join('\n');
}

/** What a plate must do that a scene need not: carry a hole for every key, and no words of its own. */
export function lintPlate(source: string, keys: ContentKey[]): string[] {
  const bad = [...lintSceneSource(source).hard];
  for (const key of keys) {
    const holes = source.split(new RegExp(`data-slot=["']${key}["']`)).length - 1;
    if (holes === 0) bad.push(`no hole for "${key}": put data-slot="${key}" on the element that shows it`);
    // Said as the mistake rather than as the count: a model handed "2 holes" twice in a row drew
    // the same two holes twice, because nothing told it which of them to lose.
    if (holes > 1) bad.push(`"${key}" is drawn ${holes} times; a scene's value is shown once, so keep exactly one data-slot="${key}" and delete the rest — do not draw the same block twice`);
  }
  if ((keys.includes('points') || keys.includes('entries')) && !/\bdata-item\b/.test(source)) {
    bad.push('a list needs one row marked data-item');
  }
  return bad;
}
