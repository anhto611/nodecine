'use client';
import React from 'react';
import { stopFlow } from '@/components/ui';

export type AudioLibrary = 'music' | 'voice';

/** What this machine's folder holds, asked for once per library and shared by every node that picks from it. */
export function useAudioLibrary(library: AudioLibrary): { files: string[]; folder: string; loading: boolean } {
  const [state, setState] = React.useState<{ files: string[]; folder: string; loading: boolean }>({ files: [], folder: '', loading: true });
  React.useEffect(() => {
    let alive = true;
    fetch(`/api/audio/${library}`)
      .then((r) => r.json())
      .then((d: { files?: string[]; folder?: string }) => alive && setState({ files: d.files ?? [], folder: d.folder ?? '', loading: false }))
      .catch(() => alive && setState({ files: [], folder: '', loading: false }));
    return () => { alive = false; };
  }, [library]);
  return state;
}

/** A file chosen by name. One picked on another machine stays selectable, so opening a workflow never silently drops it. */
export const AudioPicker: React.FC<{ files: string[]; value: string; empty?: string; onChange: (v: string) => void }> = ({ files, value, empty, onChange }) => {
  const options = value && !files.includes(value) ? [value, ...files] : files;
  return (
    <select className={`nc-select ${stopFlow}`} value={value ?? ''} onChange={(e) => onChange(e.target.value)}>
      {empty !== undefined && <option value="">{empty}</option>}
      {options.map((f) => <option key={f} value={f}>{f}</option>)}
    </select>
  );
};
