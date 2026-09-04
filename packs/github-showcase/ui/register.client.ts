'use client';
import { registerNodeBody } from '@/components/nodes/bodies';
import { registerNodeMeta } from '@/lib/node-meta';
import { PACK_ID } from '../constants';
import { GITHUB_FETCHER } from '../nodes/github-fetcher';
import { AI_DIRECTOR } from '../nodes/ai-director';
import { FetcherBody } from './FetcherBody';
import { DirectorBody } from './DirectorBody';

/** Studio-side registration: node bodies and library metadata for this pack. */
export function registerGithubShowcaseUi(): void {
  registerNodeMeta(GITHUB_FETCHER, { icon: 'branch', group: PACK_ID });
  registerNodeBody(GITHUB_FETCHER, FetcherBody);
  registerNodeMeta(AI_DIRECTOR, { icon: 'bot', group: PACK_ID });
  registerNodeBody(AI_DIRECTOR, DirectorBody);
}
