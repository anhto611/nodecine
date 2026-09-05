'use client';
import { registerNodeBody } from '@/components/nodes/bodies';
import { registerNodeMeta } from '@/lib/node-meta';
import { NS } from '../constants';
import { GITHUB_FETCHER } from '../nodes/github-fetcher';
import { FetcherBody } from './FetcherBody';

/** Studio-side registration: node body and library metadata for the GitHub fetcher. */
export function registerGithubShowcaseUi(): void {
  registerNodeMeta(GITHUB_FETCHER, { icon: 'branch', group: NS });
  registerNodeBody(GITHUB_FETCHER, FetcherBody);
}
