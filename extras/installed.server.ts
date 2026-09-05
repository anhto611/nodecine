import { registerGithubShowcaseServer } from './github/server';

/** Server operations the extras register; called once from server/register.ts. */
export function installServerExtras(): void {
  registerGithubShowcaseServer();
}
