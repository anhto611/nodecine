'use client';
import React from 'react';
import { useStudio } from '@/store/useStudio';
import { translate } from '@/lib/i18n';
import { Icon } from './icons';

/** `t()` bound to the current locale. */
export function useT() {
  const locale = useStudio((s) => s.locale);
  return React.useCallback((key: string, vars?: Record<string, string | number>) => translate(locale, key, vars), [locale]);
}

export const Btn: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement> & { primary?: boolean; danger?: boolean; small?: boolean }> = ({ primary, danger, small, className, ...rest }) => (
  <button
    {...rest}
    className={`nc-btn ${primary ? 'nc-btn-pri' : ''} ${danger ? 'nc-btn-danger' : ''} ${small ? 'nc-btn-sm' : ''} ${className ?? ''}`}
  />
);

export const Kv: React.FC<{ k: React.ReactNode; v: React.ReactNode; dim?: boolean }> = ({ k, v, dim }) => (
  <div className="nc-kv">
    <span className="nc-k">{k}</span>
    <span className={`nc-v ${dim ? 'nc-dim' : ''}`}>{v}</span>
  </div>
);

export const Dot: React.FC<{ color: string }> = ({ color }) => <span className="nc-dot" style={{ background: color }} />;

/** Inputs inside nodes must not start a React Flow drag or pan (ARCHITECTURE §8.1). */
export const stopFlow = 'nodrag nopan nowheel';

/**
 * The one modal shell (USER_FLOWS §1.6, §1.9): a dimmed ground that closes on click, a panel that
 * does not, a title row with an icon and a close button, the body, an optional footer. It owns the
 * keys every dialog needs the same way — Escape closes; Delete and Backspace outside a field stop
 * here, so they never reach the canvas and remove the node the dialog was opened from — and hands
 * any other key outside a field to `onKey`, for a dialog with keys of its own (previous/next).
 */
export const Dialog: React.FC<{
  title: React.ReactNode;
  icon?: React.ReactNode;
  /** Before the icon: a sidebar toggle, say. */
  lead?: React.ReactNode;
  /** After the title, on the same row: a subtitle, a field. */
  titleExtra?: React.ReactNode;
  width: string | number;
  height?: string | number;
  onClose: () => void;
  footer?: React.ReactNode;
  onKey?: (e: React.KeyboardEvent) => void;
  closeTitle?: string;
  children: React.ReactNode;
}> = ({ title, icon, lead, titleExtra, width, height, onClose, footer, onKey, closeTitle, children }) => (
  <div className="nc-modal-bg" onClick={onClose}>
    <div
      className="nc-modal"
      role="dialog"
      style={{ width, height }}
      onClick={(e) => e.stopPropagation()}
      onKeyDownCapture={(e) => {
        if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); onClose(); return; }
        const inField = !!(e.target as HTMLElement | null)?.closest?.('input, textarea, select, [contenteditable="true"]');
        if (inField) return;
        if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); e.stopPropagation(); return; }
        onKey?.(e);
      }}
    >
      <div className="nc-modal-head">
        {lead}
        {icon && <span className="nc-modal-icon">{icon}</span>}
        <span className="nc-modal-title">{title}</span>
        {titleExtra}
        <div style={{ flex: 1 }} />
        <button className="nc-chip" style={{ border: 0 }} onClick={onClose} title={closeTitle}><Icon.x /></button>
      </div>
      {children}
      {footer && <div className="nc-modal-foot">{footer}</div>}
    </div>
  </div>
);
