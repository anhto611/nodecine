'use client';
import React from 'react';
import { useReactFlow } from '@xyflow/react';
import { listNodeTypes, type AnyNodeDefinition } from '@/core/nodes/definition';
import { portLabelKey } from '@/core/types/ports';
import { GROUP_ORDER, NODE_META, type LibraryGroup } from '@/lib/node-meta';
import { useStudio } from '@/store/useStudio';
import { Icon } from '../icons';
import { useT } from '../ui';

/** Node library (USER_FLOWS §1.6): grouped, searchable, drag onto the canvas or double-click to drop at center. */
export const LibraryPanel: React.FC = () => {
  const t = useT();
  const [q, setQ] = React.useState('');
  const addNode = useStudio((s) => s.addNode);
  const setPanel = useStudio((s) => s.setPanel);
  const defs = listNodeTypes();
  const groups = new Map<LibraryGroup, AnyNodeDefinition[]>();
  for (const d of defs) {
    // A node with no meta still has to be reachable, so it lands in Other rather than vanishing.
    const g = NODE_META[d.type]?.group ?? 'other';
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g)!.push(d);
  }
  const match = (d: AnyNodeDefinition) => !q || t(`node.${d.type}`).toLowerCase().includes(q.toLowerCase()) || d.type.includes(q.toLowerCase());

  return (
    <aside className="nc-panel">
      <div className="nc-pn-h">{t('rail.library')}<button className="nc-chip" style={{ marginLeft: 'auto', border: 0 }} onClick={() => setPanel('library')}><Icon.x size={12} /></button></div>
      <div style={{ margin: '10px 12px 4px', height: 28, background: 'var(--bg-sunk)', border: '1px solid var(--line-2)', borderRadius: 4, display: 'flex', alignItems: 'center', gap: 7, padding: '0 12px', color: 'var(--tx-3)' }}>
        <Icon.search /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('library.search')} style={{ background: 'none', border: 0, outline: 'none', color: 'var(--tx)', font: 'inherit', fontSize: 'var(--fs-body)', width: '100%' }} />
      </div>
      <div style={{ overflowY: 'auto', flex: 1 }}>
        {GROUP_ORDER.map((g) => {
          const items = (groups.get(g) ?? []).filter(match);
          if (!items.length) return null;
          return (
            <div key={g}>
              <div className="nc-grp">{t(`library.group.${g}`)}</div>
              {items.map((d) => <LibraryItem key={d.type} def={d} onAdd={addNode} />)}
            </div>
          );
        })}
      </div>
      <div style={{ padding: '10px 12px', borderTop: '1px solid var(--line)', fontSize: 'var(--fs-hint)', color: 'var(--tx-3)', lineHeight: 1.55 }}>{t('library.hint')}</div>
    </aside>
  );
};

const LibraryItem: React.FC<{ def: AnyNodeDefinition; onAdd: (type: string, pos: { x: number; y: number }) => void }> = ({ def, onAdd }) => {
  const t = useT();
  const meta = NODE_META[def.type];
  const IconC = meta ? Icon[meta.icon] : Icon.chip;
  const rf = safeReactFlow();
  const ports = `${def.inputs.map((p) => t(portLabelKey(p.type))).join(' · ') || '—'} → ${def.outputs.map((p) => t(portLabelKey(p.type))).join(' · ') || '—'}`;
  const drop = () => {
    const center = rf ? rf.screenToFlowPosition({ x: window.innerWidth / 2, y: window.innerHeight / 2 }) : { x: 200, y: 200 };
    onAdd(def.type, center);
  };
  return (
    <div className="nc-li" draggable onDragStart={(e) => { e.dataTransfer.setData('application/nodecine-node', def.type); e.dataTransfer.effectAllowed = 'copy'; }} onDoubleClick={drop}>
      <span className="nc-lic"><IconC size={12} /></span>
      <div>
        <div className="nc-lin">{t(`node.${def.type}`)}</div>
        <div className="nc-lid">{t(`node.desc.${def.type}`)}</div>
        <div className="nc-lip">{ports}</div>
      </div>
    </div>
  );
};

/** The library sits outside the ReactFlowProvider; fall back gracefully when no flow context exists. */
function safeReactFlow() {
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    return useReactFlow();
  } catch {
    return null;
  }
}
