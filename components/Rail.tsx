'use client';
import React from 'react';
import { useStudio } from '@/store/useStudio';
import { Icon } from '@/capsules/sdk/icons';
import { useT } from '@/capsules/sdk/ui';

/** Left rail, ComfyUI-style: Workflows, Library, History … Settings pinned at the bottom. Logs toggle from the strip under the canvas. */
export const Rail: React.FC = () => {
  const t = useT();
  const panel = useStudio((s) => s.panel);
  const setPanel = useStudio((s) => s.setPanel);
  const setSettingsOpen = useStudio((s) => s.setSettingsOpen);
  const settingsOpen = useStudio((s) => s.settingsOpen);
  return (
    <nav className="nc-rail">
      <button className={`nc-rt ${panel === 'workflows' ? 'on' : ''}`} title={`${t('rail.workflows')} (W)`} onClick={() => setPanel('workflows')}><Icon.doc /><span className="nc-rt-l">{t('rail.workflows')}</span></button>
      <button className={`nc-rt ${panel === 'library' ? 'on' : ''}`} title={`${t('rail.library')} (N)`} onClick={() => setPanel('library')}><Icon.lib /><span className="nc-rt-l">{t('rail.library')}</span></button>
      <button className={`nc-rt ${panel === 'history' ? 'on' : ''}`} title={`${t('rail.history')} (H)`} onClick={() => setPanel('history')}><Icon.hist /><span className="nc-rt-l">{t('rail.history')}</span></button>
      <div style={{ flex: 1 }} />
      <button className={`nc-rt ${settingsOpen ? 'on' : ''}`} title={`${t('rail.settings')} (Ctrl+,)`} onClick={() => setSettingsOpen(true)}><Icon.gear /><span className="nc-rt-l">{t('rail.settings')}</span></button>
    </nav>
  );
};
