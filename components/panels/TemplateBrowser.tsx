'use client';
import React from 'react';
import { listTemplates } from '@/core/templates/registry';
import { useStudio, type TemplateId } from '@/store/useStudio';
import { Icon } from '../icons';
import { Btn, useT } from '../ui';

type Card = { id: string; nameKey: string; descKey: string; nodes: number; category: string };

/**
 * Cards share the row and always use all of it: a readable floor, then they grow to fill. Capping
 * their width instead would leave whatever the cap refused as dead space on the right.
 */
const CARD = { flex: '1 1 240px' } as const;

/**
 * The height budget belongs to the picture, not the card. A square picture is as tall as the card
 * is wide, so on a short window a full-width card scrolls taller than the area holding it and never
 * shows whole. Capped here, the picture narrows and centres while the card still fills its row;
 * 250px covers the modal's own chrome and the caption underneath.
 */
const PICTURE_MAX_HEIGHT = 'calc(90vh - 250px)';
const SPACERS = Array.from({ length: 5 });

/** Every category the app can name; which of them appear is decided by what is installed. */
const CATS = [['core', 'templates.core'], ['tech', 'templates.cat.tech'], ['faceless', 'templates.cat.faceless'], ['commerce', 'templates.cat.commerce'], ['data', 'templates.cat.data']] as const;

/** ComfyUI-style template browser (USER_FLOWS §1.3). It lists templates that exist, and nothing else. */
export const TemplateBrowser: React.FC = () => {
  const t = useT();
  const close = useStudio((s) => s.setTemplatesOpen);
  const load = useStudio((s) => s.loadTemplate);
  const [cat, setCat] = React.useState('all');
  // Only consulted under the breakpoint; above it the CSS shows the list whatever this says.
  const [sideOpen, setSideOpen] = React.useState(false);
  const pick = (id: string) => { setCat(id); setSideOpen(false); };
  const [sel, setSel] = React.useState<string>('static-script');
  const all = React.useMemo<Card[]>(() => listTemplates().map((tpl) => ({
    id: tpl.id,
    nameKey: tpl.nameKey,
    descKey: tpl.descriptionKey ?? '',
    nodes: tpl.nodeCount,
    category: tpl.category,
  })), []);
  // A category nobody has a template for would open onto an empty grid, so it is not offered.
  const cats = React.useMemo(() => CATS.filter(([id]) => all.some((c) => c.category === id)), [all]);
  const CARDS = React.useMemo(() => all.filter((c) => cat === 'all' || c.category === cat), [all, cat]);
  const selected = CARDS.find((c) => c.id === sel);
  const canOpen = !!selected || sel === 'blank';
  const open = () => { if (sel === 'blank') load('blank'); else if (selected) load(selected.id as TemplateId); };
  return (
    <div className="nc-modal-bg" onClick={() => close(false)}>
      {/* Grows with the window and stays inside it. The app's floor is a 1280×800 screen; the
          card row adapts to whatever width this lands on. */}
      <div className="nc-modal" style={{ width: 'min(1400px, 94vw)', height: 'min(820px, 90vh)' }} onClick={(e) => e.stopPropagation()}>
        <div style={{ height: 52, display: 'flex', alignItems: 'center', gap: 12, padding: '0 18px', borderBottom: '1px solid var(--line)' }}>
          <button className="nc-chip nc-tpl-sidebtn" style={{ border: 0, padding: '5px 7px' }} onClick={() => setSideOpen((v) => !v)} title={t('templates.categories')}><Icon.layers size={13} /></button>
          <span style={{ color: 'var(--accent-2)' }}><Icon.tpl size={15} /></span>
          <span style={{ fontWeight: 700, fontSize: 13 }}>{t('templates.title')}</span>
          <span style={{ fontSize: 9, color: 'var(--tx-3)' }}>{t('templates.subtitle')}</span>
          <button className="nc-chip" style={{ marginLeft: 'auto', border: 0 }} onClick={() => close(false)}><Icon.x /></button>
        </div>
        <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
          <div className={`nc-tpl-side ${sideOpen ? 'open' : ''}`}>
            {[['all', 'templates.all'] as const, ...cats].map(([id, key]) => (
              <button key={id} className={`nc-chip ${cat === id ? 'on' : ''}`} style={{ textAlign: 'left', padding: '7px 10px', fontSize: 11, border: 0 }} onClick={() => pick(id)}>{key.startsWith('templates.') ? t(key) : key}</button>
            ))}
            <div style={{ height: 1, background: 'var(--line)', margin: '9px 2px' }} />
            <button className={`nc-chip ${sel === 'blank' ? 'on' : ''}`} style={{ textAlign: 'left', padding: '7px 10px', fontSize: 11, border: 0 }} onClick={() => { setSel('blank'); setSideOpen(false); }}><Icon.plus size={10} /> {t('templates.blank')}</button>
          </div>
          {/* Columns follow the width instead of always being three: cards keep a readable floor
              and share out whatever is left. Flex rather than grid, because a grid row is sized
              from its items' content and does not count a height that `aspect-ratio` derived — a
              square picture ended up taller than its row and the card, stretched to that row,
              clipped it. A flex line has no such height to agree on. */}
          <div style={{ flex: 1, padding: 16, overflowY: 'auto', display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', alignContent: 'flex-start', gap: 14 }} onClick={() => sideOpen && setSideOpen(false)}>
            {CARDS.map((c) => {
              const name = c.nameKey.startsWith('templates.') ? t(c.nameKey) : c.nameKey;
              return (
                <div key={c.id} className={`nc-card ${sel === c.id ? 'on' : ''}`} style={CARD} onClick={() => setSel(c.id)} onDoubleClick={() => load(c.id as TemplateId)}>
                  {/* `overflow: hidden` keeps this square: without it a long template name wraps to
                      an extra line and pushes the box past the height aspect-ratio gave it. */}
                  <div style={{ aspectRatio: '1 / 1', width: '100%', maxHeight: PICTURE_MAX_HEIGHT, alignSelf: 'center', flexShrink: 0, overflow: 'hidden', background: '#08090c', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {/* The 9:16 frame the template renders, edge to edge in the square. Sized
                        relative to it rather than in pixels, so it keeps filling it whatever the
                        column width becomes. */}
                    <div style={{ height: '100%', aspectRatio: '9 / 16', overflow: 'hidden', background: '#0b0c10', borderLeft: '1px solid #23262c', borderRight: '1px solid #23262c', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '0 8px' }}>
                      <div style={{ width: 24, height: 2, background: '#a78bfa' }} />
                      <div style={{ fontSize: 10, color: '#fff', fontWeight: 700, textAlign: 'center', lineHeight: 1.35 }}>{name.split(' ').slice(0, 3).join('\n')}</div>
                    </div>
                  </div>
                  <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <div style={{ fontSize: 11 }}>{name}</div>
                    {c.descKey && <div style={{ fontSize: 10, color: 'var(--tx-2)', lineHeight: 1.5 }}>{t(c.descKey)}</div>}
                    {c.nodes > 0 && <div style={{ fontSize: 8.5, color: 'var(--tx-3)' }}>{t('templates.meta', { n: c.nodes })}</div>}
                  </div>
                </div>
              );
            })}
            {/* A short last row would otherwise share the leftover width among its own cards and
                come out wider than the rows above. These take that width instead and draw nothing. */}
            {SPACERS.map((_, i) => <div key={`spacer-${i}`} style={{ ...CARD, height: 0 }} aria-hidden />)}
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
