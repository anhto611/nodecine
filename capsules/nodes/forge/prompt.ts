import { z } from 'zod';
import { COMPONENT_ROLES, type BlockInfo, type ComponentInfo } from '@/contracts/storyboard/blocks';
import { LIBRARY_NAME } from '@/contracts/types/library';
import type { Brief } from '@/contracts/types/brief';
import type { Research } from '@/contracts/types/research';

/**
 * What the forge asks a model: which components a film needs that its kit lacks, then each one written
 * as a HyperFrames component, then whether its still shows what it should. The prompts carry the
 * component contract and the rules a seek-driven render holds a page to, because a component that
 * breaks them renders wrong without any error.
 */

/** Components forged in one run, at most, whatever a workflow asks. */
export const MAX_FORGED = 4;

const VARIABLE_ID = /^[a-zA-Z][a-zA-Z0-9_]{0,30}$/;

export const NeedVariableSchema = z
  .object({
    id: z.string().regex(VARIABLE_ID, 'a variable id is a short camelCase word'),
    type: z.enum(['string', 'number']),
    label: z.string().min(1).max(200),
    labelVi: z.string().max(200).default(''),
    sample: z.union([z.string().max(400), z.number(), z.boolean()]),
  })
  // A model writes "3" for a number as often as 3: the sample is taken in the variable's type when it reads as one.
  .transform((v) => ({ ...v, sample: v.type === 'number' ? Number(v.sample) : String(v.sample) }))
  .refine((v) => typeof v.sample === 'string' || Number.isFinite(v.sample), { message: 'the sample of a number variable is not a number' });
export type NeedVariable = z.infer<typeof NeedVariableSchema>;

export const NeedSchema = z.object({
  name: z
    .string()
    .regex(LIBRARY_NAME, 'a name is kebab-case: lowercase letters, digits and dashes')
    .refine((n) => !/\d{3,}/.test(n), { message: 'a name is generic: no years or numbers in it' })
    .refine((n) => n !== 'seconds', { message: 'not a usable name' }),
  description: z.string().min(1).max(500),
  why: z.string().max(500).default(''),
  variables: z
    .array(NeedVariableSchema)
    .max(12)
    .default([])
    .refine((vs) => new Set(vs.map((v) => v.id)).size === vs.length, { message: 'two variables share an id' }),
});
export type Need = z.infer<typeof NeedSchema>;

export const PlanSchema = z.object({
  needs: z
    .array(NeedSchema)
    .max(8)
    .default([])
    .refine((ns) => new Set(ns.map((n) => n.name)).size === ns.length, { message: 'two needs share a name' }),
});
export type Plan = z.infer<typeof PlanSchema>;

export const AuthoredSchema = z.object({ html: z.string().min(200).max(150_000) });

export const VerdictSchema = z.object({
  ok: z.boolean(),
  problems: z.array(z.string().max(400)).max(12).default([]),
});
export type Verdict = z.infer<typeof VerdictSchema>;

/** What the planner is told about the film. */
export interface PlanMaterial {
  brief?: Brief;
  research?: Research;
  blocks: BlockInfo[];
  components: ComponentInfo[];
  max: number;
  attempt: number;
}

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

/** Research cut down to what tells a planner what will be on screen. */
export function researchSummary(research: Research | undefined): string {
  if (!research) return '';
  const points = research.points
    .slice(0, 12)
    .map((p) => `- ${clip(p.text, 240)}`)
    .join('\n');
  return `${research.subject ? `Subject: ${research.subject}\n` : ''}${clip(research.summary, 1200)}${points ? `\n${points}` : ''}`;
}

const variablesLine = (vs: { id: string; type: string; label?: string }[]) => (vs.length ? vs.map((v) => `${v.id} (${v.type}${v.label ? `: ${clip(v.label, 300)}` : ''})`).join('; ') : 'none');

export function catalogText(blocks: BlockInfo[], components: ComponentInfo[]): string {
  const b = blocks
    .filter((x) => x.role !== 'overlay')
    .map((x) => `- block ${x.name} [${x.role}]: ${clip(x.description, 1500)}\n  values: ${variablesLine(x.variables.filter((v) => v.id !== 'seconds'))}`);
  const c = components.map((x) => `- component ${x.name} [${x.role}]: ${clip(x.description, 800)}\n  values: ${variablesLine(x.variables)}`);
  return [...b, ...c].join('\n');
}

export function planPrompt(m: PlanMaterial): string {
  const research = researchSummary(m.research);
  return `A short film is being made from a template's kit of HyperFrames blocks (whole scenes) and components (pieces mounted inside a scene). Decide which reusable visual components this film needs that the kit does not have yet.

The film (the brief):
${m.brief?.about ?? '(no brief: judge from the research)'}
${research ? `\nWhat research found:\n${research}\n` : ''}
The kit already has:
${catalogText(m.blocks, m.components) || '(nothing)'}

Some blocks draw illustrations from keywords (a setting, a cast, props, an action): the words they understand are listed in their descriptions and value labels above. Something a block can already draw from its keywords is not missing.

Rules:
- Be sparing: every component you name costs many minutes to draw and stays on the shelf for good. Name one only when a moment that matters to this film cannot be shown at all by the kit's blocks, its components, the keywords its illustration blocks understand, or a picture. A diagram, chart, comparison or text card the blocks already set is not missing. Most films need nothing: an empty list is the usual answer. Name at most ${m.max}, the most important first.
- Prefer what many films would reuse (an animal, a vehicle, a weapon, a building type, a crowd, a map style) over what only this film needs.
- Each must be GENERIC and parameterized, so later films on other subjects reuse it: "war-elephant" with values for count, facing, riders and banner colour, not "hai-ba-trung-elephant-40ad". No people's names, places or years in a name; those are values.
- A component is a visual piece: an illustration, a diagram, a prop, an effect, a piece of interface. Not a whole scene, not a caption the kit already sets.
- name: kebab-case, lowercase letters, digits and dashes, 2 to 40 characters.
- description: one or two sentences saying what it shows and which values change it, written for whoever picks it for a scene.
- why: one sentence on what in this film needs it.
- variables: what changes it, at most 8, each { "id": camelCase, "type": "string" or "number", "label": English, "labelVi": Vietnamese, "sample": a value that shows it off for this film }.${m.attempt ? `\n- This is take ${m.attempt + 1}: think again from scratch.` : ''}
Answer with the JSON object only, no commentary, no code fence, in this shape:
{ "needs": [ { "name": "...", "description": "...", "why": "...", "variables": [ { "id": "...", "type": "string", "label": "...", "labelVi": "...", "sample": "..." } ] } ] }`;
}

/** The contract and the runtime's rules, as the author is told them. */
export const COMPONENT_RULES = `The component contract (HyperFrames sub-composition):
- A whole HTML page: <!doctype html>, then <html lang="en" data-composition-duration="<seconds>" data-role="<role>" data-composition-variables='[...]'>, a <head> with <meta charset="UTF-8" />, and a <body> holding one <template>.
- data-role is one of ${COMPONENT_ROLES.filter((r) => r !== 'overlay').join(', ')}: piece (a part of a scene), effect (drawn over something), ui (a piece of interface).
- data-composition-variables is a JSON array, one entry per value: { "id", "type": "string" | "number", "label", "labels": { "vi": "..." }, "default", "sample" }. Write it in single quotes on <html>, or escape its quotes as &quot;.
- Inside <template>: optional <link rel="stylesheet"> for Google Fonts, one <style>, the root element <div id="root" data-composition-id="<name>" data-duration="<seconds>">, and one <script> after it.
- The script is an IIFE: var root=document.getElementById('root'); read the values with var v=window.__hyperframes&&window.__hyperframes.getVariables?window.__hyperframes.getVariables():{}; fall back to each default when a value is missing; build the picture; then build ONE gsap timeline: var tl=gsap.timeline({paused:true}); ...; tl.set({},{},<seconds>); tl.seek(0); window.__timelines=window.__timelines||{}; window.__timelines['<name>']=tl;
- GSAP is already loaded on the page. Load no other script, fetch nothing, use no images unless a value gives one.
- The component paints only itself, no background behind it, and fills the box it is mounted in: #root{position:absolute;inset:0}, sized in % or container units (cqw, cqh, cqmin), never fixed pixels for its layout. Inline SVG with a viewBox and preserveAspectRatio is the best way to draw an illustration that scales.
- Style it from the theme tokens, each with a fallback: var(--bg, ...), var(--fg, ...), var(--brand, ...), var(--font-display, serif), var(--font-body, sans-serif). Text uses var(--font-display) or var(--font-body).
- Prefix every class with a short prefix of the name (war-elephant: .we-...), so it never clashes with a scene's own classes.

The runtime's rules (a component that breaks them renders wrong without any error):
- The renderer seeks the timeline with tl.seek(t, true), events suppressed: onUpdate, onStart, onComplete and onRepeat callbacks never run. Animate properties or attributes directly, or tween a plain object's property whose setter applies the change.
- Repeats are bounded: derive the count from the length (e.g. Math.floor(len/period)). Never repeat: -1.
- Deterministic: no Math.random (use a small seeded generator, e.g. mulberry32, seeded from the values), no Date, no setTimeout, setInterval or requestAnimationFrame.
- Animate transforms and opacity (x, y, scale, rotation, opacity, attr:{...}). Never animate letterSpacing, width, height, top, left or other layout properties.
- No emoji anywhere: the renderer has no emoji font. Draw symbols in SVG.
- GSAP x/y on an SVG <g> that has a transform attribute replaces its translate: place it with an outer <g transform="..."> and animate an inner <g>.
- There is no \`duration\` variable in a component: write var len=(typeof duration!=='undefined'?duration:<seconds>);
- Something moves for the whole length (a slow drift, a sway, a breath), so a still taken at any moment looks alive, and the entrance is over within the first second.`;

export interface AuthorMaterial {
  need: Need;
  tokens: [string, string][];
  /** Components of the film's kit, as examples of its style. */
  examples: { name: string; html: string }[];
  /** The film's shape, e.g. 1920x1080. */
  format: string;
}

const needText = (need: Need) =>
  `name: ${need.name}
description: ${need.description}
values: ${need.variables.length ? need.variables.map((v) => `${v.id} (${v.type}) ${v.label}${v.labelVi ? ` / vi: ${v.labelVi}` : ''}, sample ${JSON.stringify(v.sample)}`).join('; ') : 'none'}`;

export function authorPrompt(m: AuthorMaterial): string {
  return `Write one reusable HyperFrames component for a film kit.

The component:
${needText(m.need)}

It must take exactly those values (more only if they are optional and have defaults), each with its sample in its declaration. Draw it well: it is seen large in a ${m.format} film, so it needs real detail, a clear silhouette and a finished look, in the style of the kit below. Keep it compact: the whole page under about 14,000 characters, shapes built in a loop from a few path definitions rather than written out one by one.

The film's theme tokens (set on the film's shell; read them with var(), each with a fallback):
${m.tokens.map(([k, v]) => `${k}: ${v}`).join('\n') || '(none)'}

${COMPONENT_RULES}

${m.examples.length ? `Components of this kit, as references for its style and its contract:\n${m.examples.map((e) => `--- ${e.name}.html ---\n${e.html}`).join('\n\n')}\n\n` : ''}Answer with the JSON object only, no commentary, no code fence, in this shape:
{ "html": "<the whole component page>" }`;
}

export function fixPrompt(m: AuthorMaterial, html: string, problems: string[]): string {
  return `${authorPrompt(m)}

A draft was written and checked. Fix every problem below and give the whole page again, changed only where it must be.

Problems:
${problems.map((p) => `- ${p}`).join('\n')}

The draft:
${html}`;
}

export function reviewPrompt(need: Need, style: string): string {
  return `The attached picture is a still of a component drawn for a film, taken part way through its animation, in a box of the film's shape over the film's background.

What it should show:
${needText(need)}
${style ? `\nThe film's style: ${style}\n` : ''}
Judge whether it can go in the film, as the film's art director would on a first pass:
- Does it clearly show what the description says, recognisable at a glance?
- Does it fill its box, without being cut off at the edges or left tiny in a corner?
- Is any text legible, and is nothing broken (stray shapes, missing parts, blank areas, rendering artefacts)?
- Does it fit the film's style and colours?
Answer ok: true when all four hold well enough for a few seconds on screen. Details a viewer would not notice in that time (a pose not quite right, a proportion, finer anatomy) are not reasons to refuse it.
When ok is false, list only what makes it unusable, at most 4 problems, each a concrete instruction to fix it.
Answer with the JSON object only, no commentary, no code fence, in this shape:
{ "ok": true, "problems": [] }`;
}
