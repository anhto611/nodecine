'use client';
import React from 'react';
import dynamic from 'next/dynamic';
import { html } from '@codemirror/lang-html';
import { oneDark } from '@codemirror/theme-one-dark';
import { EditorView, keymap } from '@codemirror/view';
import { Prec } from '@codemirror/state';

// CodeMirror touches the DOM at import time; load it on the client only, when the modal opens.
const CodeMirror = dynamic(() => import('@uiw/react-codemirror'), { ssr: false, loading: () => <div style={{ flex: 1, padding: 12, color: 'var(--tx-3)' }}>…</div> });

/** The editor in the app's own type and colours; one-dark supplies the token palette. */
const editorTheme = EditorView.theme({
  '&': { height: '100%', fontSize: 'var(--fs-label)', backgroundColor: 'var(--bg-sunk)' },
  '.cm-scroller': { fontFamily: 'var(--mono)', lineHeight: '1.55' },
  '.cm-content': { padding: '12px 0' },
  '.cm-gutters': { backgroundColor: 'var(--bg-sunk)', borderRight: '1px solid var(--line)', color: 'var(--tx-3)' },
  '.cm-activeLine': { backgroundColor: 'color-mix(in srgb, var(--accent) 8%, transparent)' },
  '.cm-activeLineGutter': { backgroundColor: 'transparent', color: 'var(--tx)' },
  '&.cm-focused': { outline: 'none' },
  '.cm-selectionBackground, &.cm-focused .cm-selectionBackground': { backgroundColor: 'color-mix(in srgb, var(--accent) 28%, transparent) !important' },
});

/** HTML with the CSS and JS inside it highlighted; Ctrl+S / Ctrl+Enter save, Esc closes, at highest precedence. */
export const CodeTab: React.FC<{ value: string; onChange: (v: string) => void; onSave: () => void; onClose: () => void }> = ({ value, onChange, onSave, onClose }) => {
  const extensions = React.useMemo(() => [
    html(),
    editorTheme,
    EditorView.lineWrapping,
    Prec.highest(keymap.of([
      { key: 'Mod-Enter', run: () => { onSave(); return true; } },
      { key: 'Mod-s', run: () => { onSave(); return true; } },
      { key: 'Escape', run: () => { onClose(); return true; } },
    ])),
  ], [onSave, onClose]);
  return (
    <div style={{ flex: 1, minHeight: 0 }}>
      <CodeMirror
        value={value}
        height="100%"
        theme={oneDark}
        extensions={extensions}
        basicSetup={{ lineNumbers: true, foldGutter: true, highlightActiveLine: true, bracketMatching: true, closeBrackets: true, autocompletion: true, indentOnInput: true, tabSize: 2 }}
        onChange={onChange}
        autoFocus
        style={{ height: '100%' }}
      />
    </div>
  );
};
