'use client';
import React from 'react';
import { useStudio } from '@/store/useStudio';
import { Icon } from './icons';
import { useT } from './ui';

/** Left rail, ComfyUI-style (USER_FLOWS §1.6): Templates, Library, History, Logs … Settings pinned at the bottom. */
export const Rail: React.FC = () => {
  const t = useT();
  const panel = useStudio((s) => s.panel);
  const logsOpen = useStudio((s) => s.logsOpen);
  const unread = useStudio((s) => s.unreadErrors);
  const setPanel = useStudio((s) => s.setPanel);
  const toggleLogs = useStudio((s) => s.toggleLogs);
  const setTemplatesOpen = useStudio((s) => s.setTemplatesOpen);
  const setSettingsOpen = useStudio((s) => s.setSettingsOpen);
  const templatesOpen = useStudio((s) => s.templatesOpen);
  const settingsOpen = useStudio((s) => s.settingsOpen);
  return (
    <nav className="nc-rail">
      <button className={`nc-rt ${templatesOpen ? 'on' : ''}`} title={`${t('rail.templates')} (T)`} onClick={() => setTemplatesOpen(true)}><Icon.tpl /></button>
      <button className={`nc-rt ${panel === 'library' ? 'on' : ''}`} title={`${t('rail.library')} (N)`} onClick={() => setPanel('library')}><Icon.lib /></button>
      <button className={`nc-rt ${panel === 'history' ? 'on' : ''}`} title={`${t('rail.history')} (H)`} onClick={() => setPanel('history')}><Icon.hist /></button>
      <button className={`nc-rt ${logsOpen ? 'on' : ''}`} title={`${t('rail.logs')} (Ctrl+J)`} onClick={toggleLogs}><Icon.logs />{unread > 0 && <span className="rd" />}</button>
      <div style={{ flex: 1 }} />
      <button className={`nc-rt ${settingsOpen ? 'on' : ''}`} title={`${t('rail.settings')} (Ctrl+,)`} onClick={() => setSettingsOpen(true)}><Icon.gear /></button>
    </nav>
  );
};
