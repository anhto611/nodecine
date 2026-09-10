'use client';
import React from 'react';
import { listTemplates, localized } from '@/core/templates/registry';
import { useStudio, type TemplateId } from '@/store/useStudio';
import { Icon } from '../icons';
import { Btn, Dialog, useT } from '../ui';
import { shapeOfTemplate } from './TemplatePlayer';

type Card = { id: string; name: string; description: string; nodes: number; category: string; shape: { ratio: string; fps: number } | null };

/**
 * Cards share the row and always use all of it: a readable floor, then they grow to fill. Capping
 * their width instead would leave whatever the cap refused as dead space on the right.
 */
const CARD = { flex: '1 1 240px', display: 'flex', flexDirection: 'column' } as const;

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

/**
 * ComfyUI-style template browser (USER_FLOWS §1.3): the graphs that ship with the app, and nothing else.
 * The user's own workflows are files, listed in the Workflows panel; opening a template here starts a
 * new draft, and saving that draft is how it becomes one of theirs.
 */
export const TemplateBrowser: React.FC = () => {
  const t = useT();
  const locale = useStudio((s) => s.locale);
  const close = useStudio((s) => s.setTemplatesOpen);
  const load = useStudio((s) => s.loadTemplate);
  const [cat, setCat] = React.useState('all');
  // Only consulted under the breakpoint; above it the CSS shows the list whatever this says.
  const [sideOpen, setSideOpen] = React.useState(false);
  const pick = (id: string) => { setCat(id); setSideOpen(false); };
  // Nothing chosen until the person chooses: a preselected first card is one Enter away from a template nobody asked for.
  const [sel, setSel] = React.useState<string>('');
  const all = React.useMemo<Card[]>(() => listTemplates().map((tpl) => ({
    id: tpl.id,
    name: localized(tpl.name, locale, tpl.id),
    description: localized(tpl.description, locale),
    nodes: tpl.graph.nodes.length,
    category: tpl.category,
    shape: shapeOfTemplate(tpl.graph),
  })), [locale]);
  // A category nobody has a template for would open onto an empty grid, so it is not offered.
  const cats = React.useMemo(() => CATS.filter(([id]) => all.some((c) => c.category === id)), [all]);
  const CARDS = React.useMemo(() => all.filter((c) => cat === 'all' || c.category === cat), [all, cat]);
  const selected = CARDS.find((c) => c.id === sel);
  const canOpen = !!selected;
  const open = () => { if (selected) load(selected.id as TemplateId); };
  return (
    // Grows with the window and stays inside it. The app's floor is a 1280×800 screen; the card row adapts to whatever width this lands on.
    <Dialog
      width="min(1400px, 94vw)"
      height="min(820px, 90vh)"
      lead={<button className="nc-chip nc-tpl-sidebtn" style={{ border: 0, padding: '5px 7px' }} onClick={() => setSideOpen((v) => !v)} title={t('templates.categories')}><Icon.layers size={13} /></button>}
      icon={<Icon.tpl size={15} />}
      title={t('templates.title')}
      titleExtra={<span style={{ fontSize: 'var(--fs-body)', color: 'var(--tx-3)' }}>{t('templates.subtitle')}</span>}
      onClose={() => close(false)}
      footer={<><span style={{ fontSize: 'var(--fs-body)', color: 'var(--tx-3)' }}>{t('templates.warning')}</span><div style={{ flex: 1 }} /><Btn onClick={() => close(false)}>{t('templates.cancel')}</Btn><Btn primary disabled={!canOpen} onClick={open}>{selected ? t('templates.open', { name: selected.name }) : t('templates.pickOne')}</Btn></>}
    >
        <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
          <div className={`nc-tpl-side ${sideOpen ? 'open' : ''}`}>
            {[['all', 'templates.all'] as const, ...cats].map(([id, key]) => (
              <button key={id} className={`nc-chip ${cat === id ? 'on' : ''}`} style={{ textAlign: 'left', padding: '7px 12px', fontSize: 'var(--fs-label)', border: 0 }} onClick={() => pick(id)}>{key.startsWith('templates.') ? t(key) : key}</button>
            ))}
          </div>
          {/* Columns follow the width instead of always being three: cards keep a readable floor
              and share out whatever is left. Flex rather than grid, because a grid row is sized
              from its items' content and does not count a height that `aspect-ratio` derived — a
              square picture ended up taller than its row and the card, stretched to that row,
              clipped it. A flex line has no such height to agree on. */}
          {/* Cards in one row share its height: the square stays square, the text box below takes the
              difference, and the node-count line sits on the same baseline across the row. */}
          <div style={{ flex: 1, padding: 12, overflowY: 'auto', display: 'flex', flexWrap: 'wrap', alignItems: 'stretch', alignContent: 'flex-start', gap: 14 }} onClick={() => sideOpen && setSideOpen(false)}>
            {CARDS.map((c) => {
              const name = c.name;
              return (
                <div key={c.id} className={`nc-card ${sel === c.id ? 'on' : ''}`} style={CARD} onClick={() => setSel(c.id)} onDoubleClick={() => load(c.id as TemplateId)}>
                  {/* `overflow: hidden` keeps this square: without it a long template name wraps to
                      an extra line and pushes the box past the height aspect-ratio gave it. */}
                  <div style={{ aspectRatio: '1 / 1', width: '100%', maxHeight: PICTURE_MAX_HEIGHT, alignSelf: 'center', flexShrink: 0, overflow: 'hidden', background: '#08090c', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {/* The frame the template renders, edge to edge in the square. Sized relative
                        to it rather than in pixels, so it keeps filling it whatever the column width
                        becomes. */}
                    <div style={{ height: '100%', aspectRatio: (c.shape?.ratio ?? '9:16').replace(':', ' / '), overflow: 'hidden', background: '#0b0c10', borderLeft: '1px solid #23262c', borderRight: '1px solid #23262c', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '0 8px' }}>
                        <div style={{ width: 24, height: 2, background: '#a78bfa' }} />
                        <div style={{ fontSize: 'var(--fs-body)', color: '#fff', fontWeight: 700, textAlign: 'center', lineHeight: 1.35 }}>{name.split(' ').slice(0, 3).join('\n')}</div>
                      </div>
                  </div>
                  <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}>
                    <div title={name} style={{ fontSize: 'var(--fs-label)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</div>
                    {/* Two lines at most; the rest is in the tooltip, so every card's text box is the same height. */}
                    {c.description && <div title={c.description} style={{ fontSize: 'var(--fs-body)', color: 'var(--tx-2)', lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{c.description}</div>}
                    {c.nodes > 0 && <div style={{ fontSize: 'var(--fs-hint)', color: 'var(--tx-3)', marginTop: 'auto', paddingTop: 4 }}>{c.shape ? t('templates.meta', { n: c.nodes, ratio: c.shape.ratio, fps: c.shape.fps }) : t('templates.metaNodes', { n: c.nodes })}</div>}
                  </div>
                </div>
              );
            })}
            {/* A short last row would otherwise share the leftover width among its own cards and
                come out wider than the rows above. These take that width instead and draw nothing. */}
            {SPACERS.map((_, i) => <div key={`spacer-${i}`} style={{ ...CARD, height: 0 }} aria-hidden />)}
          </div>
        </div>
    </Dialog>
  );
};
