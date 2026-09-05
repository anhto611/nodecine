import { describe, expect, it } from 'vitest';
import { buildFetchedFacts, buildPassthroughFacts, inferInstallCommand, readmeInstallCommand, stripMarkdown, type RepoData } from '@/nodes/github/facts';
import { FactSheetSchema } from '@/core/types/payloads';

const base: RepoData = {
  owner: 'acme',
  name: 'widget',
  description: 'A widget.',
  stars: 1234,
  topics: ['cli', 'video'],
  language: 'TypeScript',
  defaultBranch: 'main',
  readme: '# Widget\n\nMakes **widgets**. See [docs](https://x.y).\n\n```sh\nnpm i widget\n```\n',
  rootFiles: ['README.md', 'package.json'],
  manifests: { 'package.json': JSON.stringify({ name: '@acme/widget', version: '1.0.0' }) },
};

describe('stripMarkdown', () => {
  it('removes headings, emphasis, links, code fences and html', () => {
    expect(stripMarkdown(base.readme)).toBe('Widget\n\nMakes widgets. See docs.');
    expect(stripMarkdown('<p align="center"><img src="x.png"></p>\n\n- one\n- two\n\n> quote')).toBe('one\ntwo\n\nquote');
  });

  it('caps at a word boundary with an ellipsis', () => {
    const long = Array.from({ length: 2000 }, (_, i) => `word${i}`).join(' ');
    const out = stripMarkdown(long, 100);
    expect(out.length).toBeLessThanOrEqual(101);
    expect(out.endsWith('…')).toBe(true);
    expect(out.slice(0, -1).endsWith(' ')).toBe(false);
  });
});

describe('inferInstallCommand', () => {
  const coords = { owner: 'acme', name: 'widget' };
  it('prefers a published npm package name', () => {
    // The README says `npm i widget`, and the README is what people actually run.
    expect(inferInstallCommand(base, coords)).toBe('npm i widget');
    expect(inferInstallCommand({ ...base, readme: '' }, coords)).toBe('npm install @acme/widget');
  });
  it('skips private packages and falls through in spec order', () => {
    const pkg = JSON.stringify({ name: 'internal', private: true });
    expect(inferInstallCommand({ rootFiles: ['package.json', 'pyproject.toml'], manifests: { 'package.json': pkg, 'pyproject.toml': '[project]\nname = "widgetpy"\nversion = "1"\n' } }, coords)).toBe('pip install widgetpy');
    expect(inferInstallCommand({ rootFiles: ['setup.py'], manifests: {} }, coords)).toBe('pip install widget');
    expect(inferInstallCommand({ rootFiles: ['go.mod'], manifests: { 'go.mod': 'module github.com/acme/widget\n\ngo 1.22\n' } }, coords)).toBe('go install github.com/acme/widget@latest');
    expect(inferInstallCommand({ rootFiles: ['Cargo.toml'], manifests: { 'Cargo.toml': '[package]\nname = "widget-rs"\nedition = "2021"\n\n[dependencies]\nname = "not-this"\n' } }, coords)).toBe('cargo install widget-rs');
  });
  it('trusts the README over the manifest, preferring a line that names the project', () => {
    const readme = '# ComfyUI\n\n```\npip install torch torchvision --index-url https://x\n```\n\n```\npip install comfy-cli\n```\n';
    expect(readmeInstallCommand(readme, ['comfyui'])).toBe('pip install comfy-cli');
    expect(readmeInstallCommand('$ npm install express\n$ npm install -g something', ['express'])).toBe('npm install express');
    expect(readmeInstallCommand('nothing here', ['x'])).toBeNull();
    expect(inferInstallCommand({ ...base, readme: 'Run `git clone https://github.com/acme/widget` first.\n\n    git clone https://github.com/acme/widget\n' }, coords)).toBe('git clone https://github.com/acme/widget');
    expect(inferInstallCommand({ ...base, readme: 'no commands' }, coords)).toBe('npm install @acme/widget');
  });

  it('falls back to git clone, or nothing without coordinates', () => {
    expect(inferInstallCommand({ rootFiles: [], manifests: {} }, coords)).toBe('git clone https://github.com/acme/widget');
    expect(inferInstallCommand({ rootFiles: [], manifests: {} }, null)).toBe('');
  });
});

describe('facts', () => {
  it('fetched facts carry every key from spec §2.2 and validate as a FactSheet', () => {
    const facts = buildFetchedFacts(base);
    expect(facts).toEqual({
      owner: 'acme',
      name: 'widget',
      url: 'github.com/acme/widget',
      description: 'A widget.',
      stars: 1234,
      topics: ['cli', 'video'],
      primaryLanguage: 'TypeScript',
      readmeExcerpt: 'Widget\n\nMakes widgets. See docs.',
      installCommand: 'npm i widget',
    });
    expect(FactSheetSchema.safeParse({ facts, sourceLabel: 'github.com/acme/widget', fetchedAt: '2026-09-05T00:00:00.000Z', mode: 'fetched' }).success).toBe(true);
  });

  it('passthrough keeps the text verbatim and leaves the rest empty', () => {
    const facts = buildPassthroughFacts('hello world');
    expect(facts.readmeExcerpt).toBe('hello world');
    expect(facts.stars).toBeNull();
    expect(facts.url).toBe('');
    expect(Object.keys(facts).sort()).toEqual(Object.keys(buildFetchedFacts(base)).sort());
  });
});
