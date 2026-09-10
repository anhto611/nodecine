'use client';
import React from 'react';
import { useStudio } from '@/store/useStudio';
import { Header } from './Header';
import { Rail } from './Rail';
import { Canvas } from './Canvas';
import { WorkflowTabs } from './WorkflowTabs';
import { StatusBar } from './StatusBar';
import { WorkflowsPanel } from './panels/WorkflowsPanel';
import { LibraryPanel } from './panels/LibraryPanel';
import { HistoryPanel } from './panels/HistoryPanel';
import { LogsPanel } from './panels/LogsPanel';
import { TemplateBrowser } from './panels/TemplateBrowser';
import { SettingsDialog } from './panels/SettingsDialog';
import { SceneEditorDialog } from '@/nodes/script/SceneEditorDialog';

/** Studio shell: header, rail, optional left panel, canvas, optional bottom logs, modals. */
export const Studio: React.FC = () => {
  const ready = useStudio((s) => s.ready);
  const init = useStudio((s) => s.init);
  const panel = useStudio((s) => s.panel);
  const logsOpen = useStudio((s) => s.logsOpen);
  const templatesOpen = useStudio((s) => s.templatesOpen);
  const settingsOpen = useStudio((s) => s.settingsOpen);
  const sceneEditor = useStudio((s) => s.sceneEditor);

  React.useEffect(() => {
    init();
    // Dev-only handle for debugging from the browser console.
    if (process.env.NODE_ENV !== 'production') (window as unknown as { __nodecine?: unknown }).__nodecine = useStudio;
  }, [init]);

  // Keyboard shortcuts (USER_FLOWS §4). Ctrl means Cmd on macOS.
  // Keyed on `init` so a hot-reloaded store never leaves the listener bound to a stale module.
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const s = useStudio.getState();
      // `e.target` can be `window` (synthetic events) and browser extensions may stamp
      // `contenteditable` on <body>, so check the element itself rather than an ancestor query.
      const target = e.target instanceof Element ? e.target : null;
      const inField = !!target && (!!target.closest('input, textarea, select') || (target as HTMLElement).isContentEditable);
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key === 'Enter') { e.preventDefault(); if (!s.running) void s.run({ force: e.shiftKey }); return; }
      if (mod && e.key.toLowerCase() === 'j') { e.preventDefault(); s.toggleLogs(); return; }
      if (mod && e.key === ',') { e.preventDefault(); s.setSettingsOpen(true); return; }
      if (mod && e.key.toLowerCase() === 'b' && s.selectedNodeId) { e.preventDefault(); s.toggleBypass(s.selectedNodeId); return; }
      if (e.key === 'Escape') { s.setTemplatesOpen(false); s.setSettingsOpen(false); s.setSceneEditor(null); if (s.panel) s.setPanel(s.panel); return; }
      if (inField || mod) return;
      if (e.key.toLowerCase() === 'w') s.setPanel('workflows');
      if (e.key.toLowerCase() === 'n') s.setPanel('library');
      if (e.key.toLowerCase() === 'h') s.setPanel('history');
      if (e.key.toLowerCase() === 't') s.setTemplatesOpen(true);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [init]);

  if (!ready) return null;
  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <Header />
      <WorkflowTabs />
      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        <Rail />
        {panel === 'workflows' && <WorkflowsPanel />}
        {panel === 'library' && <LibraryPanel />}
        {panel === 'history' && <HistoryPanel />}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, minHeight: 0 }}>
          <Canvas />
          <StatusBar />
          {logsOpen && <LogsPanel />}
        </div>
      </div>
      {templatesOpen && <TemplateBrowser />}
      {settingsOpen && <SettingsDialog />}
      {sceneEditor && <SceneEditorDialog />}
    </div>
  );
};
