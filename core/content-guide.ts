import type { WrittenKey } from './types/payloads';

/** Shared vocabulary for any node that asks a model to write on-screen content. */
export const CONTENT_GUIDE: Record<WrittenKey, string> = {
  kicker: 'one to three words above the content: a section name, a category',
  title: 'the headline, at most 60 characters; every scene has one; wrap the one phrase that matters most in *asterisks* (at most one per title, never the whole title)',
  body: 'one or two plain sentences, at most 200 characters',
  points: 'two to four short lines, as a JSON array of strings',
  number: 'one figure exactly as it should be shown ("4,321", "3×", "98%")',
  label: 'what the number is, two to five words',
  quote: 'a quotation, verbatim',
  attribution: 'who said the quote',
  code: 'one command or one line of code',
  source: 'where the content comes from: a site, a handle, a name',
  entries: 'several things shown at once, as a JSON array: two to compare, three steps, up to six rows. Each is an object using these same keys (usually title or label, sometimes body or number). Only write it when the scene really shows more than one of a kind.',
};
