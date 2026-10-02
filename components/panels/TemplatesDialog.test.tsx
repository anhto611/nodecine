import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { NodeHostProvider, type NodeHost } from '@/capsules/sdk/host';
import { templatesApi } from '@/lib/workflows.client';
import { useStudio } from '@/store/useStudio';
import { TemplatesDialog } from './TemplatesDialog';

const host = {
  useLocale: () => 'en',
  translate: (_locale: string, key: string) => key,
} as NodeHost;

afterEach(() => vi.restoreAllMocks());

describe('workflow template gallery', () => {
  it('opens as a dialog and loads a card into an independent draft', async () => {
    useStudio.setState({ templatesOpen: true, tabs: [], activeTab: '', executor: null, locale: 'en' });
    vi.spyOn(templatesApi, 'list').mockResolvedValue([
      {
        id: 'sample',
        name: 'Sample',
        description: 'Example',
        category: 'template',
        group: 'link',
        updatedAt: '',
        nodes: 1,
        thumbnail: '/api/templates/article-summary/thumbnail',
        tagline: 'A useful result',
        tags: ['9:16'],
      },
    ]);
    vi.spyOn(templatesApi, 'read').mockResolvedValue({
      id: 'sample',
      name: 'Sample',
      category: 'template',
      graph: { nodes: [], edges: [] },
    });

    render(
      <NodeHostProvider host={host}>
        <TemplatesDialog />
      </NodeHostProvider>,
    );
    expect(screen.getByRole('dialog')).not.toBeNull();
    expect(screen.queryByText('templates.save')).toBeNull();
    fireEvent.click(await screen.findByRole('button', { name: /Sample/ }));
    await waitFor(() => expect(useStudio.getState().templatesOpen).toBe(false));
    expect(useStudio.getState().tabs[0]).toMatchObject({ fileId: null, name: 'Sample', dirty: true });
  });

  it('keeps one template a tile in the grid, with a square frame that fits any still whole', async () => {
    useStudio.setState({ templatesOpen: true, tabs: [], activeTab: '', executor: null, locale: 'en' });
    vi.spyOn(templatesApi, 'list').mockResolvedValue([
      {
        id: 'sample',
        name: 'Sample',
        description: 'Example',
        category: 'template',
        group: 'link',
        updatedAt: '',
        nodes: 1,
        // A portrait still: the case that used to be cropped into a wide, single featured row.
        thumbnail: '/api/templates/sample/thumbnail',
        tagline: 'A useful result',
        tags: ['9:16'],
      },
    ]);

    render(
      <NodeHostProvider host={host}>
        <TemplatesDialog />
      </NodeHostProvider>,
    );
    const gallery = screen.getByTestId('template-gallery');
    expect(gallery.className).not.toContain('featured');
    // Grouped by what a person brings, not by the medium: every template here is a video.
    expect(screen.getByRole('button', { name: 'templates.group.link' })).not.toBeNull();
    expect(screen.getByRole('button', { name: 'templates.group.idea' })).not.toBeNull();
    expect(screen.getByRole('button', { name: 'templates.group.recording' })).not.toBeNull();
    const card = (await screen.findByRole('button', { name: /Sample/ })).closest('.nc-template-card');
    expect(card).not.toBeNull();
    expect(card!.querySelector('.nc-template-art')).not.toBeNull();
    expect(card!.querySelector('.nc-template-art img')?.getAttribute('src')).toBe('/api/templates/sample/thumbnail');
  });
});
