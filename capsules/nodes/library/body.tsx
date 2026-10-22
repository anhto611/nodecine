'use client';
import React, { useEffect, useState } from 'react';
import { useT, stopFlow } from '@/capsules/sdk/ui';
import { useGraph, useHost, useParams, useRun, type BodyProps } from '@/capsules/sdk/host';
import { FormBody } from '@/capsules/sdk/form-body';
import { frameBox, Player, Thumbnail, type PartPreview } from '@/capsules/sdk/part-thumbnail';
import { libraryComponentPath, type LibraryItem } from '@/contracts/types/library';

type Shelf = { scope: string; count: number };

/** A page to host the shelf's parts on when no Composition is wired: no theme, so each wears its fallbacks. */
const BARE_ENTRY =
  '<!doctype html><html><head><meta charset="UTF-8" /></head><body><div id="shelf" data-composition-id="shelf" data-start="0" data-width="1920" data-height="1080" style="position:relative;width:1920px;height:1080px;background:#16130f"></div></body></html>';

/**
 * The shelf to read, picked from the shelves there are, and what is on it now — each component drawn
 * the way the Composition draws its parts, in the film the shelf feeds when one is wired, so it wears
 * that film's fonts and theme — with what this video took from it and what is newer.
 */
export const LibraryBody: React.FC<BodyProps> = ({ nodeId }) => {
  const t = useT();
  const { action } = useHost();
  const graph = useGraph();
  const [p, set] = useParams<{ scope: string; shared: boolean; pinned: string[] | null }>(nodeId);
  const { running, runNode } = useRun();
  const [shelves, setShelves] = useState<Shelf[]>([]);
  const [items, setItems] = useState<LibraryItem[] | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [big, setBig] = useState<PartPreview | null>(null);
  const scope = p.scope || 'shared';

  useEffect(() => {
    action<Shelf[]>('library/shelves', []).then(setShelves, () => setShelves([]));
  }, [action, running]);
  useEffect(() => {
    action<LibraryItem[]>('library/browse', [scope, p.shared !== false]).then(setItems, () => setItems([]));
  }, [action, scope, p.shared, running]);

  // The film the shelf feeds: its entry carries the fonts and the theme tokens the parts paint with.
  const fed = graph.edges.find((e) => e.source === nodeId && e.sourcePort === 'library');
  const entry = (graph.nodes.find((n) => n.id === fed?.target)?.params as { files?: Record<string, string> } | undefined)?.files?.['index.html'] || BARE_ENTRY;
  const project = React.useMemo(() => ({ files: { 'index.html': entry, ...Object.fromEntries((items ?? []).map((i) => [libraryComponentPath(i.name), i.html])) }, media: {} }), [entry, items]);

  useEffect(() => {
    setBig(null);
    if (!open) return;
    action<PartPreview>('composition/preview-part', [{ ...project, engine: 'hyperframes' }, libraryComponentPath(open)]).then(setBig, () => setBig(null));
  }, [action, open, project]);

  const options = [...shelves, ...(shelves.some((s) => s.scope === scope) ? [] : [{ scope, count: 0 }])].map((s) => ({
    value: s.scope,
    label: s.scope === 'shared' ? t('node.libraryShared', { count: s.count }) : t('node.libraryShelf', { scope: s.scope, count: s.count }),
  }));
  const pinned = p.pinned ? new Set(p.pinned) : null;
  const newer = pinned && items ? items.filter((i) => !pinned.has(i.name)).length : 0;
  const refresh = () => {
    set({ pinned: null });
    setTimeout(() => runNode(nodeId), 0);
  };

  return (
    <div className={stopFlow} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ fontSize: 12, opacity: 0.7, lineHeight: 1.4 }}>{t('node.libraryHint')}</div>
      <FormBody nodeId={nodeId} fields={['scope', 'shared']} widgets={{ scope: options.length ? { options } : { placeholder: 'history-story' } }} />
      {items && !items.length && <div style={{ fontSize: 12, opacity: 0.7 }}>{t('node.libraryEmpty')}</div>}
      {open && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={frameBox(big ?? { width: 16, height: 9 }, '220px')}>{big && <Player preview={big} loop />}</div>
          <div style={{ fontSize: 11, opacity: 0.7, lineHeight: 1.4 }}>{items?.find((i) => i.name === open)?.description}</div>
        </div>
      )}
      {items && items.length > 0 && (
        <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 4 }}>
          {items.map((i) => {
            const taken = !pinned || pinned.has(i.name);
            return (
              <Thumbnail
                key={`${i.shelf}-${i.name}`}
                path={libraryComponentPath(i.name)}
                project={project}
                engine="hyperframes"
                width="132px"
                height="74px"
                selected={open === i.name}
                title={i.description}
                onOpen={() => setOpen(open === i.name ? null : i.name)}
              >
                <span style={{ fontSize: 11, fontWeight: 600, opacity: taken ? 1 : 0.55, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{i.name}</span>
                {(i.shelf === 'shared' || !taken) && (
                  <span style={{ fontSize: 10, color: taken ? undefined : '#e3b65a', opacity: taken ? 0.6 : 1 }}>{taken ? t('node.libraryFromShared') : t('node.libraryNew')}</span>
                )}
              </Thumbnail>
            );
          })}
        </div>
      )}
      {pinned && (
        <button className="nc-chip" style={{ alignSelf: 'flex-start' }} disabled={running || !newer} onClick={refresh} title={t('node.libraryRefreshHint')}>
          {newer ? t('node.libraryRefreshCount', { count: newer }) : t('node.libraryUpToDate')}
        </button>
      )}
    </div>
  );
};
