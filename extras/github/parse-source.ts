/**
 * Decide whether an Input Trigger value names a GitHub repository (github-showcase spec §2.1).
 *
 * Accepted forms, surrounding whitespace ignored:
 *   https://github.com/owner/name            (optional .git, trailing slash, or /tree/..., /blob/...)
 *   github.com/owner/name
 *   owner/name                               (the whole value, nothing else)
 * Anything else is free text and the fetcher passes it through untouched.
 */

export interface RepoCoords {
  owner: string;
  name: string;
}

const OWNER = '[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})';
const NAME = '[A-Za-z0-9._-]{1,100}';

const URL_FORM = new RegExp(`^(?:https?:\\/\\/)?(?:www\\.)?github\\.com\\/(${OWNER})\\/(${NAME}?)(?:\\.git)?(?:\\/(?:tree|blob|commits?|releases|issues|pulls?|wiki)(?:\\/.*)?|\\/)?(?:[?#].*)?$`, 'i');
const BARE_FORM = new RegExp(`^(${OWNER})\\/(${NAME})$`);

export function parseGithubSource(value: string): RepoCoords | null {
  const v = value.trim();
  if (!v || /\s/.test(v)) return null;
  const m = URL_FORM.exec(v) ?? BARE_FORM.exec(v);
  if (!m) return null;
  const owner = m[1]!;
  let name = m[2]!;
  if (name.toLowerCase().endsWith('.git')) name = name.slice(0, -4);
  if (!name || name === '.' || name === '..') return null;
  return { owner, name };
}

/** The canonical label used for `FactSheet.sourceLabel` and `facts.url`. */
export function repoUrl({ owner, name }: RepoCoords): string {
  return `github.com/${owner}/${name}`;
}
