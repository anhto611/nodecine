import { registerServerOp } from '@/core/server-ops';
import { FETCH_REPO_OP } from '../nodes/github-fetcher';
import { fetchRepo } from './fetch-repo';

let done = false;
/** Register the server ops these nodes call; called once from server/register.ts. */
export function registerGithubShowcaseServer(): void {
  if (done) return;
  done = true;
  registerServerOp(FETCH_REPO_OP, (input, signal) => fetchRepo(input, signal));
}
