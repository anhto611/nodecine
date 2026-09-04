import { describe, expect, it } from 'vitest';
import { parseGithubSource, repoUrl } from '../parse-source';

describe('parseGithubSource', () => {
  it('accepts the common GitHub link forms', () => {
    const want = { owner: 'remotion-dev', name: 'remotion' };
    expect(parseGithubSource('https://github.com/remotion-dev/remotion')).toEqual(want);
    expect(parseGithubSource('  https://github.com/remotion-dev/remotion/  ')).toEqual(want);
    expect(parseGithubSource('http://www.github.com/remotion-dev/remotion.git')).toEqual(want);
    expect(parseGithubSource('github.com/remotion-dev/remotion?tab=readme-ov-file#install')).toEqual(want);
    expect(parseGithubSource('https://github.com/remotion-dev/remotion/tree/main/packages/player')).toEqual(want);
    expect(parseGithubSource('https://github.com/remotion-dev/remotion/blob/main/README.md')).toEqual(want);
    expect(parseGithubSource('remotion-dev/remotion')).toEqual(want);
  });

  it('treats everything else as free text (passthrough)', () => {
    expect(parseGithubSource('')).toBeNull();
    expect(parseGithubSource('Build short videos from a node graph.')).toBeNull();
    expect(parseGithubSource('https://gitlab.com/owner/name')).toBeNull();
    expect(parseGithubSource('https://github.com/owner')).toBeNull();
    expect(parseGithubSource('owner/name and some words')).toBeNull();
    expect(parseGithubSource('https://github.com/owner/name/settings')).toBeNull();
  });

  it('rejects path-traversal look-alikes', () => {
    expect(parseGithubSource('../../etc')).toBeNull();
    expect(parseGithubSource('https://github.com/owner/..')).toBeNull();
  });

  it('builds the canonical label', () => {
    expect(repoUrl({ owner: 'a', name: 'b' })).toBe('github.com/a/b');
  });
});
