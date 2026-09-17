import React from 'react';
import type { IconKey } from './meta';

type P = { size?: number; className?: string };
const base = (size: number) => ({ width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const });

/** Stroke icons on a 24-grid. No emoji anywhere in the UI. */
export const Icon: Record<IconKey | 'lib' | 'hist' | 'logs' | 'gear' | 'play' | 'stop' | 'plus' | 'minus' | 'fit' | 'check' | 'warn' | 'spin' | 'retry' | 'x' | 'search' | 'star' | 'copy' | 'trash' | 'undo' | 'redo' | 'pin', React.FC<P>> = {
  bolt: ({ size = 14, className }) => <svg {...base(size)} className={className}><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></svg>,
  doc: ({ size = 14, className }) => <svg {...base(size)} className={className}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="8" y1="13" x2="16" y2="13" /><line x1="8" y1="17" x2="13" y2="17" /></svg>,
  term: ({ size = 14, className }) => <svg {...base(size)} className={className}><polyline points="4 17 10 11 4 5" /><line x1="12" y1="19" x2="20" y2="19" /></svg>,
  mic: ({ size = 14, className }) => <svg {...base(size)} className={className}><rect x="9" y="2" width="6" height="12" rx="3" /><path d="M5 10a7 7 0 0 0 14 0" /><line x1="12" y1="17" x2="12" y2="22" /><line x1="8" y1="22" x2="16" y2="22" /></svg>,
  wave: ({ size = 14, className }) => <svg {...base(size)} className={className}><line x1="3" y1="10" x2="3" y2="14" /><line x1="7.5" y1="6" x2="7.5" y2="18" /><line x1="12" y1="3" x2="12" y2="21" /><line x1="16.5" y1="7" x2="16.5" y2="17" /><line x1="21" y1="10" x2="21" y2="14" /></svg>,
  layers: ({ size = 14, className }) => <svg {...base(size)} className={className}><polygon points="12 2 2 7 12 12 22 7 12 2" /><polyline points="2 17 12 22 22 17" /><polyline points="2 12 12 17 22 12" /></svg>,
  chip: ({ size = 14, className }) => <svg {...base(size)} className={className}><rect x="5" y="5" width="14" height="14" rx="2" /><rect x="9.5" y="9.5" width="5" height="5" /><line x1="9" y1="2" x2="9" y2="5" /><line x1="15" y1="2" x2="15" y2="5" /><line x1="9" y1="19" x2="9" y2="22" /><line x1="15" y1="19" x2="15" y2="22" /><line x1="2" y1="9" x2="5" y2="9" /><line x1="2" y1="15" x2="5" y2="15" /><line x1="19" y1="9" x2="22" y2="9" /><line x1="19" y1="15" x2="22" y2="15" /></svg>,
  screen: ({ size = 14, className }) => <svg {...base(size)} className={className}><rect x="2" y="3" width="20" height="14" rx="2" /><polygon points="10 7.5 15 10 10 12.5 10 7.5" fill="currentColor" stroke="none" /><line x1="8" y1="21" x2="16" y2="21" /></svg>,
  down: ({ size = 14, className }) => <svg {...base(size)} className={className}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>,
  branch: ({ size = 14, className }) => <svg {...base(size)} className={className}><line x1="6" y1="3" x2="6" y2="15" /><circle cx="18" cy="6" r="3" /><circle cx="6" cy="18" r="3" /><path d="M18 9a9 9 0 0 1-9 9" /></svg>,
  bot: ({ size = 14, className }) => <svg {...base(size)} className={className}><rect x="4" y="9" width="16" height="11" rx="2" /><line x1="12" y1="3" x2="12" y2="9" /><circle cx="12" cy="3" r="1" fill="currentColor" /><line x1="9" y1="14" x2="9" y2="15" /><line x1="15" y1="14" x2="15" y2="15" /></svg>,
  lib: ({ size = 17, className }) => <svg {...base(size)} className={className}><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><line x1="17.5" y1="14" x2="17.5" y2="21" /><line x1="14" y1="17.5" x2="21" y2="17.5" /></svg>,
  hist: ({ size = 17, className }) => <svg {...base(size)} className={className}><circle cx="12" cy="12" r="9" /><polyline points="12 7 12 12 15.5 14" /></svg>,
  logs: ({ size = 17, className }) => <svg {...base(size)} className={className}><polyline points="4 17 10 11 4 5" /><line x1="12" y1="19" x2="20" y2="19" /></svg>,
  gear: ({ size = 16, className }) => <svg {...base(size)} className={className}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1 1.56V21a2 2 0 1 1-4 0v-.09A1.7 1.7 0 0 0 9 19.4a1.7 1.7 0 0 0-1.88.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.7 1.7 0 0 0 .34-1.88 1.7 1.7 0 0 0-1.56-1H3a2 2 0 1 1 0-4h.09A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.34-1.88l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-1.56V3a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 1 1.56 1.7 1.7 0 0 0 1.88-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.34 1.88V9a1.7 1.7 0 0 0 1.56 1H21a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.51 1z" /></svg>,
  play: ({ size = 12, className }) => <svg {...base(size)} className={className} fill="currentColor" stroke="none"><polygon points="6 4 20 12 6 20 6 4" /></svg>,
  // A flat brush: the handle, the ferrule, and the bristles that lay down the film's style.
  brush: ({ size = 12, className }) => <svg {...base(size)} className={className}><path d="M4 20c0-3 2-4 4-4s4 1 4 4H4z" /><path d="M9 16 19 6a2 2 0 0 0-3-3L6 13" /></svg>,
  // A strip of film: the frame it shows, with sprocket holes down both sides.
  film: ({ size = 14, className }) => <svg {...base(size)} className={className}><rect x="2" y="4" width="20" height="16" rx="2" /><line x1="7" y1="4" x2="7" y2="20" /><line x1="17" y1="4" x2="17" y2="20" /><line x1="2" y1="9" x2="7" y2="9" /><line x1="2" y1="15" x2="7" y2="15" /><line x1="17" y1="9" x2="22" y2="9" /><line x1="17" y1="15" x2="22" y2="15" /></svg>,
  // A picture: its frame, the sun, and the hills it shows.
  image: ({ size = 14, className }) => <svg {...base(size)} className={className}><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" /></svg>,
  // A drawing pin seen head-on: the disc, and the tack behind it.
  pin: ({ size = 10, className }) => <svg {...base(size)} className={className}><path d="M12 17v4" /><path d="M9 3h6l-1 6 3 3v2H7v-2l3-3z" /></svg>,
  stop: ({ size = 10, className }) => <svg {...base(size)} className={className} fill="currentColor" stroke="none"><rect x="5" y="5" width="14" height="14" rx="2" /></svg>,
  plus: ({ size = 13, className }) => <svg {...base(size)} className={className}><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>,
  minus: ({ size = 13, className }) => <svg {...base(size)} className={className}><line x1="5" y1="12" x2="19" y2="12" /></svg>,
  fit: ({ size = 12, className }) => <svg {...base(size)} className={className}><path d="M3 8V5a2 2 0 0 1 2-2h3" /><path d="M16 3h3a2 2 0 0 1 2 2v3" /><path d="M21 16v3a2 2 0 0 1-2 2h-3" /><path d="M8 21H5a2 2 0 0 1-2-2v-3" /></svg>,
  check: ({ size = 12, className }) => <svg {...base(size)} className={className} strokeWidth={3}><polyline points="20 6 9 17 4 12" /></svg>,
  warn: ({ size = 12, className }) => <svg {...base(size)} className={className}><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>,
  spin: ({ size = 12, className }) => <svg {...base(size)} className={`nc-spin ${className ?? ''}`} strokeWidth={2.4}><path d="M12 3a9 9 0 0 1 9 9" /><circle cx="12" cy="12" r="9" opacity=".18" /></svg>,
  retry: ({ size = 11, className }) => <svg {...base(size)} className={className} strokeWidth={2.2}><polyline points="1 4 1 10 7 10" /><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" /></svg>,
  undo: ({ size = 12, className }) => <svg {...base(size)} className={className}><path d="M9 14 4 9l5-5" /><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" /></svg>,
  redo: ({ size = 12, className }) => <svg {...base(size)} className={className}><path d="m15 14 5-5-5-5" /><path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13" /></svg>,
  x: ({ size = 14, className }) => <svg {...base(size)} className={className}><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>,
  search: ({ size = 12, className }) => <svg {...base(size)} className={className}><circle cx="11" cy="11" r="7" /><line x1="16.5" y1="16.5" x2="21" y2="21" /></svg>,
  star: ({ size = 10, className }) => <svg {...base(size)} className={className} fill="currentColor" stroke="none"><polygon points="12 2 15.09 8.6 22 9.6 17 14.5 18.2 21.5 12 18.2 5.8 21.5 7 14.5 2 9.6 8.91 8.6 12 2" /></svg>,
  copy: ({ size = 12, className }) => <svg {...base(size)} className={className}><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>,
  trash: ({ size = 12, className }) => <svg {...base(size)} className={className}><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>,
};
