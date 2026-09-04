'use client';
import React from 'react';
import { useStudio, type TemplateId } from '@/store/useStudio';
import { Icon } from '../icons';
import { Btn, useT } from '../ui';

type Card = { id: string; nameKey: string; descKey: string; nodes: number; category: string; status: 'ready' | 'phaseB' | 'soon' };
const CARDS: Card[] = [
  { id: 'static-script', nameKey: 'templates.staticScript', descKey: 'templates.staticScriptDesc', nodes: 7, category: 'core', status: 'ready' },
  { id: 'github-showcase', nameKey: 'templates.github', descKey: 'templates.githubDesc', nodes: 10, category: 'tech', status: 'phaseB' },
  { id: 'mobile-app', nameKey: 'Mobile App Promo', descKey: '', nodes: 0, category: 'tech', status: 'soon' },
  { id: 'changelog', nameKey: 'Product Changelog', descKey: '', nodes: 0, category: 'tech', status: 'soon' },
  { id: 'reddit', nameKey: 'Reddit Storytelling', descKey: '', nodes: 0, category: 'faceless', status: 'soon' },
  { id: 'facts', nameKey: 'Daily Facts & Trivia', descKey: '', nodes: 0, category: 'faceless', status: 'soon' },
  { id: 'quotes', nameKey: 'Motivational Quotes', descKey: '', nodes: 0, category: 'faceless', status: 'soon' },
  { id: 'sale', nameKey: 'Flash Sale Alert', descKey: '', nodes: 0, category: 'commerce', status: 'soon' },
  { id: 'compare', nameKey: 'Product Comparison', descKey: '', nodes: 0, category: 'commerce', status: 'soon' },
  { id: 'market', nameKey: 'Market Recap & Movers', descKey: '', nodes: 0, category: 'data', status: 'soon' },
  { id: 'crypto', nameKey: 'Crypto Trends', descKey: '', nodes: 0, category: 'data', status: 'soon' },
];
const CATS = [['all', 'templates.all'], ['core', 'templates.core'], ['tech', 'templates.cat.tech'], ['faceless', 'templates.cat.faceless'], ['commerce', 'templates.cat.commerce'], ['data', 'templates.cat.data']] as const;

/** ComfyUI-style template browser (USER_FLOWS §1.3). Only Static Script and Blank work in Phase A. */
export const TemplateBrowser: React.FC = () => {
  const t = useT();
  const close = useStudio((s) => s.setTemplatesOpen);
  const load = useStudio((s) => s.loadTemplate);
  const [cat, setCat] = React.useState('all');
  const [sel, setSel] = React.useState<string>('static-script');
  const cards = CARDS.filter((c) => cat === 'all' || c.category === cat);
  const selected = CARDS.find((c) => c.id === sel);
  const canOpen = selected?.status === 'ready' || sel === 'blank';
  const open = () => { if (sel === 'blank') load('blank'); else if (selected?.status === 'ready') load(selected.id as TemplateId); };
  return (
    <div className="nc-modal-bg" onClick={() => close(false)}>
      <div className="nc-modal" style={{ width: 1000, height: 640 }} onClick={(e) => e.stopPropagation()}>
        <div style={{ height: 52, display: 'flex', alignItems: 'center', gap: 12, padding: '0 18px', borderBottom: '1px solid var(--line)' }}>
          <span style={{ color: 'var(--accent-2)' }}><Icon.tpl size={15} /></span>
          <span style={{ fontWeight: 700, fontSize: 13 }}>{t('templates.title')}</span>
          <span style={{ fontSize: 9, color: 'var(--tx-3)' }}>{t('templates.subtitle')}</span>
          <button className="nc-chip" style={{ marginLeft: 'auto', border: 0 }} onClick={() => close(false)}><Icon.x /></button>
        </div>
        <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
          <div style={{ width: 200, borderRight: '1px solid var(--line)', padding: '12px 10px', display: 'flex', flexDirection: 'column', gap: 2 }}>
            {CATS.map(([id, key]) => (
              <button key={id} className={`nc-chip ${cat === id ? 'on' : ''}`} style={{ textAlign: 'left', padding: '7px 10px', fontSize: 11, border: 0 }} onClick={() => setCat(id)}>{key.startsWith('templates.') ? t(key) : key}</button>
            ))}
            <div style={{ height: 1, background: 'var(--line)', margin: '9px 2px' }} />
            <button className={`nc-chip ${sel === 'blank' ? 'on' : ''}`} style={{ textAlign: 'left', padding: '7px 10px', fontSize: 11, border: 0 }} onClick={() => setSel('blank')}><Icon.plus size={10} /> {t('templates.blank')}</button>
          </div>
          <div style={{ flex: 1, padding: 16, overflowY: 'auto', display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 14, alignContent: 'start' }}>
            {cards.map((c) => {
              const name = c.nameKey.startsWith('templates.') ? t(c.nameKey) : c.nameKey;
              return (
                <div key={c.id} className={`nc-card ${sel === c.id ? 'on' : ''} ${c.status === 'soon' ? 'off' : ''}`} onClick={() => c.status !== 'soon' && setSel(c.id)} onDoubleClick={() => c.status === 'ready' && load(c.id as TemplateId)}>
                  <div style={{ height: 120, background: '#08090c', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ width: 66, height: 118, background: '#0b0c10', borderLeft: '1px solid #23262c', borderRight: '1px solid #23262c', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
                      <div style={{ width: 14, height: 2, background: c.status === 'ready' ? '#a78bfa' : '#39404d' }} />
                      <div style={{ fontSize: 6, color: c.status === 'ready' ? '#fff' : '#39404d', fontWeight: 700, textAlign: 'center', lineHeight: 1.3 }}>{name.split(' ').slice(0, 3).join('\n')}</div>
                    </div>
                  </div>
                  <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <div style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 6 }}>{name}{c.status !== 'ready' && <span className="nc-soon" style={{ marginLeft: 'auto' }}>{c.status === 'phaseB' ? t('templates.phaseB') : t('templates.soon')}</span>}</div>
                    {c.descKey && <div style={{ fontSize: 10, color: 'var(--tx-2)', lineHeight: 1.5 }}>{t(c.descKey)}</div>}
                    {c.nodes > 0 && <div style={{ fontSize: 8.5, color: 'var(--tx-3)' }}>{t('templates.meta', { n: c.nodes })}</div>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        <div style={{ borderTop: '1px solid var(--line)', padding: '13px 18px', display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 9, color: 'var(--tx-3)' }}>{t('templates.warning')}</span>
          <div style={{ flex: 1 }} />
          <Btn onClick={() => close(false)}>{t('templates.cancel')}</Btn>
          <Btn primary disabled={!canOpen} onClick={open}>{t('templates.open', { name: sel === 'blank' ? t('templates.blank') : (selected?.nameKey.startsWith('templates.') ? t(selected.nameKey) : selected?.nameKey ?? '') })}</Btn>
        </div>
      </div>
    </div>
  );
};
