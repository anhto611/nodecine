'use client';
import React from 'react';
import { Kv, useT, stopFlow } from '@/capsules/sdk/ui';
import { useOutputPayload, useOverlay, useParams, type BodyProps } from '@/capsules/sdk/host';
import type { Composition } from '@/contracts/types/composition';
import { kindOf, nameOf, readPart, roleOf, ROLES, type Kind, type Project } from './parts';
import { Thumbnail } from './thumbnail';
import type { PartsDialogData } from './parts-dialog';

export { PartsDialog } from './parts-dialog';

/** How many of each kind the card shows before "see all"; the wall of pictures shows the rest. */
const SHOWN: Record<Kind, number> = { block: 6, component: 5 };

/**
 * How many pictures of each kind fit across the card: a half one at the edge says the row scrolls.
 * Components are the smaller parts, so more of them fit.
 */
const ACROSS: Record<Kind, number> = { block: 2.5, component: 3.5 };
const GAP = 4;
const cardWidth = (kind: Kind) => `calc((100% - ${Math.floor(ACROSS[kind]) * GAP}px) / ${ACROSS[kind]})`;

/**
 * A HyperFrames project on the canvas, shown the way a person who cannot code reads it: what it is,
 * and a few of its blocks and components as pictures, with the way in to the wall where all of them
 * are watched and written; the files and their code are edited there, not here.
 */
export const CompositionBody: React.FC<BodyProps> = ({ nodeId }) => {
  const t = useT();
  const overlay = useOverlay();
  const [p] = useParams<Project>(nodeId);
  const out = useOutputPayload<Composition>(nodeId, 'composition');
  const files = React.useMemo(() => p.files ?? {}, [p.files]);
  const media = React.useMemo(() => p.media ?? {}, [p.media]);
  const project: Project = React.useMemo(() => ({ files, media }), [files, media]);
  const names = Object.keys(files);

  // Parts in the order a film goes: the roles as declared, hooks before features before the close.
  const ofKind = (kind: Kind) => {
    const order: readonly string[] = ROLES[kind];
    return names.filter((n) => kindOf(n) === kind).sort((a, b) => order.indexOf(roleOf(files, a)) - order.indexOf(roleOf(files, b)) || a.localeCompare(b));
  };
  const openWall = (kind: Kind, path?: string) => overlay.open(nodeId, { kind, ...(path ? { path } : {}) } satisfies PartsDialogData);

  const strip = (kind: Kind) => {
    const all = ofKind(kind);
    if (!all.length) return null;
    const shown = all.slice(0, SHOWN[kind]);
    return (
      <div style={{ display: 'grid', gap: 4 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, fontSize: 'var(--fs-hint)', color: 'var(--tx-3)' }}>
          <span>{t(`node.compositionKind.${kind}`)} · {all.length}</span>
          <button className="nc-chip" style={{ marginLeft: 'auto', border: 0 }} onClick={() => openWall(kind)}>{t('node.compositionSeeAll')}</button>
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: GAP, overflowX: 'auto', paddingBottom: 2 }}>
          {shown.map((path) => (
            <Thumbnail key={path} path={path} project={project} engine={out?.engine} width={cardWidth(kind)} onOpen={() => openWall(kind, path)} title={`${nameOf(path)} · ${t(`node.compositionRole.${roleOf(files, path)}`)}\n${readPart(files[path] ?? '').variables.length} ${t('node.compositionVariables')}`}>
              <div style={{ color: 'var(--tx-2)', fontSize: 'var(--fs-hint)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{nameOf(path)}</div>
            </Thumbnail>
          ))}
          {all.length > shown.length && (
            <button className="nc-chip" style={{ flex: `0 0 ${cardWidth(kind)}`, minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: 6, padding: 6 }} onClick={() => openWall(kind)}>
              <div style={{ aspectRatio: out ? `${out.width} / ${out.height}` : '9 / 16', borderRadius: 4, background: 'var(--bg-sunk, #0002)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 'var(--fs-body)' }}>+{all.length - shown.length}</div>
              <div style={{ fontSize: 'var(--fs-hint)', color: 'var(--tx-3)' }}>{t('node.compositionSeeAll')}</div>
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className={stopFlow} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {out && <Kv k={t('node.compositionSize')} v={`${out.width}×${out.height} · ${out.fps}fps`} dim />}
      <Kv k={t('node.compositionMedia')} v={String(Object.keys(media).length)} dim />
      {strip('block')}
      {strip('component')}
    </div>
  );
};
