'use client';
import React from 'react';
import { useT, stopFlow } from '@/capsules/sdk/ui';
import { useLocale, useParams, type BodyProps } from '@/capsules/sdk/host';
import { DURATIONS, TONES } from '@/contracts/types/brief';

type Params = { about: string; durationSeconds: number; tone: (typeof TONES)[number]; language: string; notes: string; hint: Record<string, string> };
const LANGUAGES = ['vi', 'en'] as const;

/** The form: what the video is about in one box, its length beside it, the rest folded away. */
export const BriefBody: React.FC<BodyProps> = ({ nodeId }) => {
  const t = useT();
  const locale = useLocale();
  const [p, set] = useParams<Params>(nodeId);
  const [more, setMore] = React.useState(false);
  const hint = p.hint?.[locale] ?? p.hint?.[locale.split('-')[0]!] ?? t('node.briefAboutHint');
  const fid = (field: string) => `${nodeId}-brief-${field}`;
  const label = { fontSize: 'var(--fs-hint)', color: 'var(--tx-3)' };
  return (
    <div className={stopFlow} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <label htmlFor={fid('about')} style={{ display: 'grid', gap: 3 }}>
        <span style={label}>{t('node.briefAbout')}</span>
        <textarea id={fid('about')} className="nc-textarea" style={{ minHeight: 64 }} maxLength={3000} placeholder={hint} value={p.about ?? ''} onChange={(e) => set({ about: e.target.value })} />
      </label>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
        <label htmlFor={fid('duration')} style={label}>{t('node.briefDuration')}</label>
        <select id={fid('duration')} className="nc-select" value={p.durationSeconds ?? 30} onChange={(e) => set({ durationSeconds: Number(e.target.value) })}>
          {DURATIONS.map((d) => <option key={d} value={d}>{d} s</option>)}
        </select>
        <button className="nc-chip" aria-expanded={more} onClick={() => setMore(!more)}>{more ? t('node.briefLess') : t('node.briefMore')}</button>
      </div>
      {more && (
        <div style={{ display: 'grid', gap: 6, padding: 6, border: '1px solid var(--line)', borderRadius: 6 }}>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            <label htmlFor={fid('tone')} style={label}>{t('node.briefTone')}</label>
            <select id={fid('tone')} className="nc-select" value={p.tone ?? 'energetic'} onChange={(e) => set({ tone: e.target.value as Params['tone'] })}>
              {TONES.map((tone) => <option key={tone} value={tone}>{t(`node.briefTone.${tone}`)}</option>)}
            </select>
            <label htmlFor={fid('language')} style={label}>{t('node.briefLanguage')}</label>
            <select id={fid('language')} className="nc-select" value={p.language ?? 'vi'} onChange={(e) => set({ language: e.target.value })}>
              {LANGUAGES.map((l) => <option key={l} value={l}>{t(`node.language.${l}`)}</option>)}
            </select>
          </div>
          <label htmlFor={fid('notes')} style={{ display: 'grid', gap: 3 }}>
            <span style={label}>{t('node.briefNotes')}</span>
            <textarea id={fid('notes')} className="nc-textarea" style={{ minHeight: 40 }} maxLength={1000} value={p.notes ?? ''} onChange={(e) => set({ notes: e.target.value })} />
          </label>
        </div>
      )}
    </div>
  );
};
