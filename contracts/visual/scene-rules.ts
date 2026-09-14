import { describeSafeZones, safeZonesFor } from '@/contracts/visual/safe-zones';
import { describeFrame, type FrameSize } from '@/contracts/visual/frame';
import { ASSET_TOKEN_PREFIX, STYLE_VARS } from '@/contracts/visual/contract';
import { STYLE_RULES, lintStyleCss } from '@/contracts/visual/style-rules';

export { STYLE_VARS, STYLE_RULES, lintStyleCss };

/**
 * The rules a drawn scene must follow (CORE_CONTRACTS §2.8), spelled out for the model, and the
 * lint that checks its answer against them. One list for the prompt and one function for the
 * check, so the two can never disagree about what a scene is.
 */

/**
 * What a scene does when no form says otherwise: things arrive as the voice reaches them, and
 * something drifts underneath so no frame is dead. It is one vocabulary among many — and being the
 * only one is why every film this app made looked the same until forms arrived (CORE_CONTRACTS §6).
 */
export const DEFAULT_MOTION = [
  'A scene lasts as long as its narration (nodecine.duration seconds), often five to ten seconds: keep something moving for the whole length — a slow drift or zoom of a background glow — so no frame is dead; make it last nodecine.duration.',
  'A point the voice mentions should appear when it is said: position its tween at nodecine.when("the words of that point"). Without word timings the engine spreads the points over the scene in the order asked, so call it once per point, in order.',
] as const;

/** The rules any scene code must follow. `motion` is the form's vocabulary, or the default one. */
export const codeRules = (frame: FrameSize, motion: readonly string[] = DEFAULT_MOTION): string[] => [
  'Output format: one HTML fragment containing markup, optional <style>, and optional <script>. No <html>, <head> or <body>.',
  'Styles are scoped to this scene by the engine and win over the shared sheet; write plain selectors, never !important. Use the style sheet\'s classes and variables first; add a <style> for what this scene alone needs — its layout, and any shared class it wants otherwise.',
  `The frame is ${describeFrame(frame)}. Safe zones: keep content inside ${describeSafeZones(safeZonesFor(frame.width, frame.height))} (the platform UI covers the rest). Position everything in px on that frame; the scene root (.nc-scene) fills it.`,
  'Animation uses the gsap that the script receives, scoped to this scene: register with nodecine.timeline(gsap.timeline().fromTo(...)). Use fromTo only, never from (from desyncs on seek). Time 0 is the start of the scene.',
  'gsap, nodecine and root are already variables in scope where your <script> runs — they are arguments, not globals. Never read them off window: window.nodecine does not exist, and a script that falls back to a default when it is missing will run every time on the default and never follow the film.',
  ...motion,
  'A number that should count up: tl.add(nodecine.count("<selector of the number element>", { duration: 1.2 }), <time>) counts it from zero to the value shown, keeping its grouping.',
  'A phrase to emphasise goes in <em class="nc-emph">: the accent colour, upright.',
  'When the film carries an analysed sound, nodecine.audio("<track id>") returns { at(t), bands(frame) }: at(t) gives { level, bass, mid, high } in 0..1 at t seconds into this scene, so tl.call or a per-frame tween can breathe with the music; it returns null when there is no analysis, so guard it.',
  'The script also sees the whole film: nodecine.beats is the list of scenes ({ index, start, duration, clipId, stage }) in seconds, and nodecine.beat is this scene\'s own entry. A drawing that spans the film (a layer, not a scene) reads nodecine.beats to move between scenes; a scene uses nodecine.beat.stage only to agree with such a layer about where it is. By convention a stage entry is { x, y, scale, rot }: x and y are the CENTRE of the thing in frame pixels from the top-left, scale 1 its natural size, rot degrees clockwise — a layer that reads stage must place it at that absolute point, not treat the numbers as an offset.',
  'No network, no external files: fonts come from the style sheet, pictures only from the src values given below.',
];

/** How the scene's content and the video's values go into the markup. */
export const SCENE_RULES = [
  'Write the scene\'s text into the markup verbatim, in the scene\'s language — every key of the content listed below appears on screen once, nothing is invented and nothing is dropped. Points are a list; entries are several things of one kind, laid out alike.',
  'A picture or a clip is given as a token: write it verbatim as the src (<img src="asset:image">, <video src="asset:entries.2.clip">) with a fixed box (width and height in px, object-fit: cover); the engine puts the file in. Never write a src that is not given, and never spell out a data URL.',
  'A key marked as bound to verified data is filled in at assembly: put data-fact="<fact key>" on the element that shows it, with the text given here as the placeholder. The engine replaces the text (or the src of an img) with the verified value.',
  'A value of the whole video is bound with data-var="<name>" (the text, or the src of an img); the element is removed when the value is missing.',
] as const;

/** Things the rules forbid that a model still does. The `hard` ones make the answer unusable; the rest are said and kept. */
export function lintSceneSource(source: string, o: { facts?: string[]; assets?: Record<string, string> } = {}): { hard: string[]; soft: string[] } {
  const hard: string[] = [];
  const soft: string[] = [];
  const markup = source.replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '').trim();
  if (/<(html|body|head)\b/i.test(source)) hard.push('contains <html>/<head>/<body>; only a fragment belongs here');
  if (markup.length < 10) hard.push('has no markup');
  for (const f of o.facts ?? []) if (!new RegExp(`data-fact=["']${f.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["']`).test(source)) hard.push(`no element carries data-fact="${f}"`);
  const left = [...new Set([...source.matchAll(new RegExp(`${ASSET_TOKEN_PREFIX}([a-z]+(?:\\.\\d+\\.[a-z]+)?)`, 'g'))].map((m) => m[1]!))];
  if (left.length) hard.push(`names ${left.map((t) => `${ASSET_TOKEN_PREFIX}${t}`).join(', ')}, which the scene does not have`);
  // The tokens have been swapped for the files by now: a picture the scene was given and does not show is content dropped.
  for (const [path, url] of Object.entries(o.assets ?? {})) if (!source.includes(url)) soft.push(`the ${path.endsWith('clip') ? 'clip' : 'picture'} ${path} is not shown`);
  if (/window\s*\.\s*nodecine/.test(source)) hard.push('reads window.nodecine, which does not exist; nodecine is an argument already in scope');
  if (/\.from\(/.test(source)) soft.push('uses gsap .from(); use fromTo so seeking stays in sync');
  if (/!important/.test(source)) soft.push('uses !important');
  if (/https?:\/\//i.test(source) && /\b(src|href)=["']https?:/i.test(source)) soft.push('loads something from the network, which a render cannot');
  return { hard, soft };
}

/** The style sheet's own checks: the variables every scene relies on must be there. */
