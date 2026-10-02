import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { NodeHostProvider, type NodeHost } from '@/capsules/sdk/host';
import { Rail } from '../Rail';

const host = {
  useLocale: () => 'en',
  translate: (_locale: string, key: string) => key,
} as NodeHost;

describe('the rail', () => {
  it('links out to the source once, in a new tab that cannot touch this window', () => {
    render(<NodeHostProvider host={host}><Rail /></NodeHostProvider>);
    const link = screen.getByRole('link');
    expect(link.getAttribute('href')).toBe('https://github.com/anhto611/nodecine');
    expect(link.getAttribute('target')).toBe('_blank');
    // The opened page gets no handle back into the Studio's window.
    expect(link.getAttribute('rel')).toBe('noreferrer');
    expect(link.textContent).toBe('rail.github');
    expect(screen.getAllByRole('link')).toHaveLength(1);
  });
});
