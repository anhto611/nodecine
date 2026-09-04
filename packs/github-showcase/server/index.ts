import { registerPackHandler } from '@/core/packs/handlers';
import { PACK_ID } from '../constants';
import { FETCH_REPO_OP } from '../nodes/github-fetcher';
import { fetchRepo } from './fetch-repo';

let done = false;
/** Register the pack's server handlers; called from server/register.ts. */
export function registerGithubShowcaseServer(): void {
  if (done) return;
  done = true;
  registerPackHandler(PACK_ID, FETCH_REPO_OP, (input, signal) => fetchRepo(input, signal));
}
