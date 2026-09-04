'use client';
import React from 'react';
import { useStudio } from '@/store/useStudio';
import { translate } from '@/lib/i18n';

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
