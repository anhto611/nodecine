'use client';
import React from 'react';
import { useStudio } from '@/store/useStudio';
import { batchPlan } from '@/core/engine/batch';
import { Btn, useT } from './ui';
import { Icon } from './icons';

/** Header keeps only what must always be visible: project name and Run (USER_FLOWS §1.1). */
export const Header: React.FC = () => {
  const t = useT();
  const running = useStudio((s) => s.running);
  const allIssues = useStudio((s) => s.issues);
  const issues = React.useMemo(() => allIssues.filter((i) => i.severity === 'error'), [allIssues]);
  const run = useStudio((s) => s.run);
  const graph = useStudio((s) => s.graph);
  const batch = useStudio((s) => s.batch);
  // How many runs the button will queue, so the count is on the button before it is pressed.
  const plan = React.useMemo(() => batchPlan(graph), [graph]);
  const cancel = useStudio((s) => s.cancel);
  const projectName = useStudio((s) => s.projectName);
  const setProjectName = useStudio((s) => s.setProjectName);
  const [editing, setEditing] = React.useState(false);
  const disabled = issues.length > 0;

  return (
    <header style={{ height: 56, flex: '0 0 56px', borderBottom: '1px solid var(--line)', background: 'var(--bg-panel)', display: 'flex', alignItems: 'center', gap: 14, padding: '0 12px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
        <span style={{ width: 22, height: 22, borderRadius: 4, background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><circle cx="6" cy="6" r="2.4" /><circle cx="18" cy="12" r="2.4" /><circle cx="6" cy="18" r="2.4" /><line x1="8.2" y1="7.2" x2="15.8" y2="10.8" /><line x1="8.2" y1="16.8" x2="15.8" y2="13.2" /></svg>
        </span>
        <span style={{ fontWeight: 700, fontSize: 'var(--fs-title)', letterSpacing: '.02em' }}>{t('app.name')}</span>
      </div>
      {editing ? (
        <input className="nc-input" style={{ width: 220, height: 26, fontSize: 'var(--fs-title)' }} autoFocus value={projectName} onChange={(e) => setProjectName(e.target.value)} onBlur={() => setEditing(false)} onKeyDown={(e) => e.key === 'Enter' && setEditing(false)} />
      ) : (
        <span onDoubleClick={() => setEditing(true)} title={t('header.projectName')} style={{ fontSize: 'var(--fs-title)', color: 'var(--tx-2)', padding: '4px 8px', border: '1px solid transparent', borderRadius: 4, cursor: 'text' }}>{projectName}</span>
      )}
      <div style={{ flex: 1 }} />
        {/* Shift skips the signature cache and runs every node again (EXECUTION_ENGINE §4). The
            cache cannot see a reason to re-run that lives outside the graph — a model that would
            answer differently today, a file changed under a path — so a person needs a way to say so. */}
      {running ? (
        <Btn danger onClick={cancel}><Icon.stop /> {t('header.stop')}{batch ? ` ${batch.index}/${batch.total}` : ''}</Btn>
      ) : (
        <Btn primary disabled={disabled} onClick={(e) => void run({ force: e.shiftKey })} title={disabled ? t('header.runDisabled', { n: issues.length }) : `${plan.runs > 1 ? t('header.runBatch', { n: plan.runs }) : 'Ctrl+Enter'} · ${t('header.runForce')}`}>
          <Icon.play /> {t('header.run')}{plan.runs > 1 ? ` · ${plan.runs}` : ''}
        </Btn>
      )}
    </header>
  );
};
