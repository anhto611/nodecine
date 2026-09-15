import { languageName } from '@/contracts/text/languages';
import type { Brief } from '@/contracts/types/brief';
import type { LinkedPage } from '@/contracts/types/web';

/**
 * The prompt Research sends. Instructions in English, where models follow them most closely; the
 * findings are written in the brief's language, since a person reads and corrects them. Research gathers:
 * what the video must or must not say, and how long it runs, are the writer's to apply, not a filter here.
 */


export interface ResearchMaterial {
  brief: Brief;
  pages: LinkedPage[];
  /** Links the brief gave that could not be read, and why. */
  unread: { url: string; why: string }[];
  /** What this workflow's films need found out. */
  guide: string;
  web: boolean;
}

export function researchPrompt(m: ResearchMaterial, attempt: number): string {
  const language = languageName(m.brief.language);
  return `You research the subject of a short video before anyone writes it. Find out what the video needs to say, and say where each thing comes from.

What the person wrote about the video (the brief; follow it over any source when they differ):
${m.brief.about}
${m.pages.map((p) => `\nA page the brief links to (${p.url}):\n${p.title}\n${p.text.slice(0, 8000)}`).join('\n')}${m.unread.length ? `\n\nLinks that could not be read: ${m.unread.map((u) => `${u.url} (${u.why})`).join('; ')}` : ''}
${m.guide.trim() ? `\nWhat this workflow's films need found out:\n${m.guide.trim()}\n` : ''}
${m.web
  ? 'You can search the web and read pages. Do: look up what the brief and the pages leave open, prefer the maker\'s own pages and first-hand sources, and check numbers against a second source when you can.'
  : 'Do not look anything up: use only the brief and the pages above.'}

Rules:
- Write the subject, the summary and the points in ${language}.
- "subject" names what the video is about exactly as its sources name it.
- "summary" says in two to four sentences what it is and why it matters, for someone who has never heard of it.
- "points" are the facts worth saying in the video, most important first, one fact each, at most 12. Keep numbers, names and versions exactly as the source gives them. "source" is the address the point was read at, or null for what only the brief says.
- Never invent a fact, a number or a source. When the sources disagree, say so in the point.
- "sources" lists every page you used, with its title.
${attempt > 0 ? `\nThis is look number ${attempt + 1}: look further than an obvious first pass would.\n` : ''}
Answer with the JSON object only, no commentary, no code fence, in this shape:
{
  "language": "<the language code you wrote in>",
  "subject": "<name>",
  "summary": "<two to four sentences>",
  "points": [ { "text": "<one fact>", "source": "<address>" or null } ],
  "sources": [ { "url": "<address>", "title": "<title>" } ]
}`;
}
