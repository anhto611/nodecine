import { z } from 'zod';
import { LocalizedTextSchema } from '@/core/templates/registry';
import { CONTENT_KEYS, TransitionSchema } from '../types/payloads';

/**
 * Film forms (CORE_CONTRACTS §6): what kind of video this is, as data.
 *
 * Until now the only thing that told the model what sort of film it was making was a sentence about
 * colours and type. So every film came out the same shape — a headline, a line of body text, both
 * fading in as the voice reached them — and thirteen workflows built to cover thirteen genres
 * differed only in what was behind the text. The genre was never in the data; it was in my head.
 *
 * A form is a package of instructions and defaults, nothing more: what the Screenwriter is asked to
 * write, how the Illustrator composes the frame, **what moves and why**, whether the film has a thing
 * that spans it, how one scene gives way to the next. It is data, like a template, so a new kind of
 * film is a file rather than a change to the program.
 *
 * A form never reaches the IR. It shapes the questions put to the model and then it is done, so the
 * core keeps knowing nothing about kinds of scene (§4) and an engine never learns a form's name.
 */

const RectSchema = z.object({
  x: z.number().int().min(0).max(8192),
  y: z.number().int().min(0).max(8192),
  width: z.number().int().positive().max(8192),
  height: z.number().int().positive().max(8192),
});

/**
 * One arrangement of the frame, written by hand (CORE_CONTRACTS §6.1).
 *
 * A pose says **where**: the rectangle the scene's own words live in, and where each thing that
 * spans the film sits while that scene is up. A layout drawn by a model says **how it looks** inside
 * that rectangle. Splitting the two is what makes a frame that cannot go wrong: geometry a person
 * wrote once cannot put a headline on the captions, and a model asked only to fill a box cannot
 * either. Asking a model for both is how a headline ended up across the spoken words.
 *
 * Few and named, like camera set-ups: a film cycles them so consecutive scenes do not sit still.
 */
export const PoseSchema = z.object({
  id: z.string().regex(/^[a-z0-9][a-z0-9-]{0,39}$/),
  /** Where the scene's own words go. Nothing a scene draws may leave it. */
  text: RectSchema,
  /**
   * Where each thing that spans the film sits in a scene of this pose, by its name: the centre in
   * frame pixels, `scale` 1 its natural size, `rot` degrees clockwise. This becomes the scene's
   * `stage`, which is how a phone moves from scene to scene without anybody asking a model.
   */
  stage: z.record(z.string().regex(/^[a-z][a-z0-9_-]{0,39}$/), z.object({
    x: z.number().int().min(-8192).max(8192),
    y: z.number().int().min(-8192).max(8192),
    scale: z.number().min(0.05).max(8).default(1),
    rot: z.number().min(-180).max(180).default(0),
  })).default({}),
});
export type Pose = z.infer<typeof PoseSchema>;

export const FilmFormSchema = z.object({
  id: z.string().regex(/^[a-z0-9][a-z0-9-]{0,39}$/),
  name: LocalizedTextSchema,
  description: LocalizedTextSchema.optional(),

  /** What the Screenwriter writes for this form. */
  script: z.object({
    guidance: z.string().min(1).max(1500),
    /**
     * The content keys this form is made of. The Screenwriter is told to stay inside them, so a form
     * of big numbers does not come back with paragraphs it has nowhere to put.
     */
    keys: z.array(z.enum(CONTENT_KEYS)).max(16).optional(),
    /**
     * How many words a scene of weight 1 says. A scene's length is how long its narration takes to
     * read, so this is the only place a form can ask for short scenes — and a form of four-word
     * phrases inheriting the budget of a paragraph is a form that cannot be itself.
     */
    words: z.object({ min: z.number().int().min(1).max(200), max: z.number().int().min(2).max(300) }).optional(),
  }),

  /** How the Illustrator draws it. */
  draw: z.object({
    /** How the frame is composed: where things sit, how much of it they take, what the eye lands on. */
    guidance: z.string().min(1).max(2500),
    /**
     * What moves, and why. These replace the default vocabulary — a point appearing as the voice
     * reaches it — which is the single reason every film looked alike. A form that leaves this empty
     * keeps the default.
     */
    motion: z.array(z.string().min(1).max(500)).max(12).default([]),
  }),

  /**
   * The arrangements this form cycles through, in order. A film with none is laid out by the
   * layouts alone, as before; a film with them gets a different frame every scene for free.
   */
  poses: z.array(PoseSchema).max(12).default([]),

  /** A thing on screen for the whole film, drawn once by the Illustrator (§5.9b). */
  spanning: z.object({ brief: z.string().min(1).max(600), placement: z.enum(['under', 'over']) }).optional(),

  /** How one scene gives way to the next, when the node has not been told otherwise. */
  transition: TransitionSchema.optional(),
});
export type FilmForm = z.infer<typeof FilmFormSchema>;

const forms = new Map<string, FilmForm>();

/** Registers a form; the shape is checked here so a bad file fails at startup, not mid-run. */
export function registerForm(input: unknown): FilmForm {
  const form = FilmFormSchema.parse(input);
  forms.set(form.id, form);
  return form;
}

export function getForm(id: string | undefined): FilmForm | undefined {
  return id ? forms.get(id) : undefined;
}

export function listForms(): FilmForm[] {
  return [...forms.values()];
}

/** Test-only. */
export function _resetForms(): void {
  forms.clear();
}
