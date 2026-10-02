'use client';
import React from 'react';
import { useStudio } from '@/store/useStudio';
import { Icon } from '@/capsules/sdk/icons';
import { useT } from '@/capsules/sdk/ui';

/**
 * The strip under the canvas: where the logs live, so their toggle sits right where they open,
 * like a terminal drawer — not in the rail among the panels that slide in from the left.
 */
export const StatusBar: React.FC = () => {
  const t = useT();
  const logsOpen = useStudio((s) => s.logsOpen);
  const unread = useStudio((s) => s.unreadErrors);
  const toggleLogs = useStudio((s) => s.toggleLogs);
  const graph = useStudio((s) => s.graph);
  const issues = useStudio((s) => s.issues);
  const errors = issues.filter((i) => i.severity === 'error').length;
  return (
    <div className="nc-status">
      <button className={`nc-status-btn ${logsOpen ? 'on' : ''}`} onClick={toggleLogs} title="Ctrl+J">
        <Icon.logs size={11} /> {t('rail.logs')}
        {unread > 0 && <span className="nc-status-badge">{unread}</span>}
        <span style={{ marginLeft: 4, opacity: 0.7 }}>{logsOpen ? '▾' : '▴'}</span>
      </button>
      <div style={{ flex: 1 }} />
      <span className="nc-status-meta">
        {t('status.nodes', { n: graph.nodes.length, e: graph.edges.length })}
        {errors > 0 ? ` · ${t('status.errors', { n: errors })}` : ''}
      </span>
    </div>
  );
};
