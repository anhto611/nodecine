'use client';
import React from 'react';
import { useStudio } from '@/store/useStudio';
import { Icon } from '../icons';
import { useT } from '../ui';

/** Bottom logs panel (USER_FLOWS §1.7): filter by node, search, copy all, clear. */
export const LogsPanel: React.FC = () => {
  const t = useT();
  const executor = useStudio((s) => s.executor);
  const graph = useStudio((s) => s.graph);
  const toggleLogs = useStudio((s) => s.toggleLogs);
  const markRead = useStudio((s) => s.markLogsRead);
  useStudio((s) => s.logTick);
  const [filter, setFilter] = React.useState<string | null>(null);
  const [q, setQ] = React.useState('');
  const bodyRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => { markRead(); }, [markRead]);
  const entries = executor?.logs.all() ?? [];
  const shown = entries.filter((e) => (!filter || e.nodeId === filter) && (!q || e.message.toLowerCase().includes(q.toLowerCase()) || (e.code ?? '').toLowerCase().includes(q.toLowerCase())));
  React.useEffect(() => { bodyRef.current?.scrollTo({ top: bodyRef.current.scrollHeight }); }, [shown.length]);
  const nodeIds = ['run', ...graph.nodes.map((n) => n.id)];
  const label = (id: string) => (id === 'run' ? 'run' : t(`node.${graph.nodes.find((n) => n.id === id)?.type ?? id}`));
  const color = (level: string) => (level === 'error' ? 'var(--err)' : level === 'warn' ? 'var(--warn)' : 'var(--ok)');
  const copy = () => navigator.clipboard?.writeText(entries.map((e) => `${new Date(e.ts).toISOString()} ${e.nodeId} ${e.level}${e.code ? ` [${e.code}]` : ''} ${e.message}`).join('\n'));
  return (
    <div className="nc-logs">
      <div className="nc-lg-h">
        <span style={{ textTransform: 'uppercase', letterSpacing: '.1em', color: 'var(--tx-2)', marginRight: 6 }}>{t('logs.title')}</span>
        <button className={`nc-chip ${filter === null ? 'on' : ''}`} onClick={() => setFilter(null)}>{t('logs.all')}</button>
        {nodeIds.filter((id) => entries.some((e) => e.nodeId === id)).map((id) => <button key={id} className={`nc-chip ${filter === id ? 'on' : ''}`} onClick={() => setFilter(id)}>{label(id)}</button>)}
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('logs.search')} className="nc-input" style={{ marginLeft: 'auto', width: 170, height: 22 }} />
        <button className="nc-btn nc-btn-sm" onClick={copy}><Icon.copy size={10} /> {t('logs.copy')}</button>
        <button className="nc-btn nc-btn-sm" onClick={() => executor?.logs.clear()}><Icon.trash size={10} /> {t('logs.clear')}</button>
        <button className="nc-chip" style={{ border: 0 }} onClick={toggleLogs}><Icon.x size={12} /></button>
      </div>
      <div ref={bodyRef} style={{ flex: 1, overflowY: 'auto', padding: '6px 0' }}>
        {shown.map((e, i) => (
          <div key={i} className="nc-ll">
            <span className="ts">{new Date(e.ts).toLocaleTimeString([], { hour12: false })}.{String(e.ts % 1000).padStart(3, '0')}</span>
            <span className="nn" style={{ color: color(e.level) }}>{label(e.nodeId)}</span>
            <span className="ms">{e.code ? <span style={{ color: 'var(--tx-3)' }}>[{e.code}] </span> : null}{e.message}</span>
          </div>
        ))}
      </div>
    </div>
  );
};
