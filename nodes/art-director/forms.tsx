'use client';
import React from 'react';
import type { BlockDef, BlockField, StageDef } from '@/core/types/payloads';
import { useT, stopFlow } from '@/components/ui';
import { Icon } from '@/components/icons';

/**
 * Form editors for the structured parts of a stage and a block, so nobody types JSON into a node:
 * palette colours with a picker, fonts, tones as overrides of palette keys, scene fields with their
 * rule, and block props with a type. Each section folds; the header carries the count.
 *
 * Keys are edited in a draft and committed on blur or Enter, and only when valid and unique, so a
 * half-typed name never reaches the graph (where the schema would reject the whole node).
 */

const IDENT = /^[a-zA-Z][a-zA-Z0-9_]*$/;
const KEY = /^[a-z][a-z0-9-]*$/i;
const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

export const Section: React.FC<{ title: string; count?: number; open: boolean; onToggle: () => void; children: React.ReactNode }> = ({ title, count, open, onToggle, children }) => (
  <div style={{ border: '1px solid var(--line)', borderRadius: 3, padding: 4, display: 'flex', flexDirection: 'column', gap: 3 }}>
    <div className="nc-k" style={{ cursor: 'pointer', color: open ? 'var(--accent-2)' : undefined, display: 'flex', gap: 6 }} onClick={onToggle}>
      <span>{open ? '▾' : '▸'} {title}</span>
      {count !== undefined && <span style={{ marginLeft: 'auto', color: 'var(--tx-3)' }}>{count}</span>}
    </div>
    {open && children}
  </div>
);

/** A key input that commits on blur/Enter, and refuses an invalid or duplicate name. */
const KeyInput: React.FC<{ value: string; taken: string[]; pattern?: RegExp; placeholder?: string; onCommit: (next: string) => void; style?: React.CSSProperties }> = ({ value, taken, pattern = IDENT, placeholder, onCommit, style }) => {
  const [draft, setDraft] = React.useState(value);
  React.useEffect(() => { setDraft(value); }, [value]);
  const bad = draft !== value && (!pattern.test(draft) || taken.includes(draft));
  const commit = () => { if (!bad && draft !== value && draft) onCommit(draft); else setDraft(value); };
  return <input className={`nc-input ${stopFlow}`} style={{ ...style, ...(bad ? { borderColor: 'var(--err)' } : {}) }} value={draft} placeholder={placeholder} spellCheck={false} onChange={(e) => setDraft(e.target.value)} onBlur={commit} onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); if (e.key === 'Escape') setDraft(value); }} />;
};

const RemoveBtn: React.FC<{ onClick: () => void; title: string }> = ({ onClick, title }) => (
  <button className={`nc-chip ${stopFlow}`} style={{ padding: '0 4px', flex: 'none' }} onClick={onClick} title={title}><Icon.x size={9} /></button>
);

/** Colour as a picker when it is a hex, and as text always (a palette may hold `color-mix(...)`). */
const ColorInput: React.FC<{ value: string; onChange: (v: string) => void }> = ({ value, onChange }) => {
  const hex = HEX.test(value);
  return (
    <span style={{ display: 'flex', gap: 4, alignItems: 'center', flex: 1, minWidth: 0 }}>
      <input type="color" className={`nc-color ${stopFlow}`} value={hex ? (value.length === 4 ? `#${value[1]}${value[1]}${value[2]}${value[2]}${value[3]}${value[3]}` : value) : '#000000'} title={value} onChange={(e) => onChange(e.target.value)} style={hex ? undefined : { background: value }} />
      <input className={`nc-input ${stopFlow}`} style={{ flex: 1, minWidth: 0 }} value={value} spellCheck={false} onChange={(e) => onChange(e.target.value)} />
    </span>
  );
};

/** `data-field="name"` anywhere in the stage code. */
export const isFieldDrawn = (code: string, name: string): boolean => new RegExp(`data-field=["']${name}["']`).test(code);
/** `var(--name)` anywhere in the code (captions and blocks may use a colour the stage itself does not; this is only a hint). */
export const isVarUsed = (code: string, name: string): boolean => new RegExp(`var\\(--${name}[,)]`).test(code);

/**
 * Adds a place for a scene field to a stage's code: a rule before </style> and an element before the
 * root's closing tag (or at the end of the markup). Positioned under the kicker, inside the safe zone,
 * so it shows at once; the author moves it from there.
 */
export function drawFieldInCode(code: string, name: string): string {
  if (isFieldDrawn(code, name)) return code;
  const cls = name.replace(/[^a-zA-Z0-9_-]/g, '-');
  const rule = `  .stage .${cls} { position: absolute; left: 72px; right: 168px; top: 236px; font: 500 30px/1.3 var(--font-body); color: var(--muted); }\n`;
  const el = `  <div class="${cls}" data-field="${name}"></div>\n`;
  let out = code;
  const styleEnd = out.indexOf('</style>');
  out = styleEnd >= 0 ? out.slice(0, styleEnd) + rule + out.slice(styleEnd) : `<style>\n${rule}</style>\n` + out;
  const scriptAt = out.indexOf('<script');
  const head = scriptAt >= 0 ? out.slice(0, scriptAt) : out;
  const tail = scriptAt >= 0 ? out.slice(scriptAt) : '';
  const lastClose = head.lastIndexOf('</div>');
  const markup = lastClose >= 0 ? head.slice(0, lastClose) + el + head.slice(lastClose) : head + el;
  return markup + tail;
}

const renameKey = <T,>(rec: Record<string, T>, from: string, to: string): Record<string, T> => Object.fromEntries(Object.entries(rec).map(([k, v]) => [k === from ? to : k, v]));
const without = <T,>(rec: Record<string, T>, key: string): Record<string, T> => Object.fromEntries(Object.entries(rec).filter(([k]) => k !== key));
const freshKey = (base: string, taken: string[]): string => { let i = 1; let k = base; while (taken.includes(k)) k = `${base}${++i}`; return k; };

/* ---------- Stage: tokens ---------- */

export const PaletteEditor: React.FC<{ palette: Record<string, string>; code?: string; onChange: (p: Record<string, string>) => void }> = ({ palette, code = '', onChange }) => {
  const t = useT();
  const keys = Object.keys(palette);
  return (
    <>
      {keys.map((k) => (
        <div key={k} style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          <KeyInput value={k} taken={keys} style={{ width: 64, flex: 'none' }} onCommit={(next) => onChange(renameKey(palette, k, next))} />
          <ColorInput value={palette[k]!} onChange={(v) => onChange({ ...palette, [k]: v })} />
          <span className="nc-k" style={{ flex: 'none', width: 14, textAlign: 'center' }} title={isVarUsed(code, k) ? t('look.colorUsed') : t('look.colorUnused')}>{isVarUsed(code, k) ? '' : '·'}</span>
          <RemoveBtn title={t('look.remove')} onClick={() => onChange(without(palette, k))} />
        </div>
      ))}
      <button className={`nc-chip ${stopFlow}`} style={{ alignSelf: 'flex-start' }} onClick={() => onChange({ ...palette, [freshKey('color', keys)]: '#888888' })}>+ {t('look.addColor')}</button>
    </>
  );
};

const FONT_PRESETS = ['"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace', 'Inter, system-ui, -apple-system, "Segoe UI", sans-serif', 'Georgia, "Times New Roman", serif', '"Playfair Display", Georgia, serif', 'system-ui, -apple-system, sans-serif'];

export const FontsEditor: React.FC<{ fonts: Record<string, string>; onChange: (f: Record<string, string>) => void }> = ({ fonts, onChange }) => {
  const t = useT();
  const keys = Object.keys(fonts);
  return (
    <>
      {keys.map((k) => (
        <div key={k} style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          <KeyInput value={k} taken={keys} style={{ width: 64, flex: 'none' }} onCommit={(next) => onChange(renameKey(fonts, k, next))} />
          <input className={`nc-input ${stopFlow}`} list="nc-font-presets" style={{ flex: 1, minWidth: 0, fontFamily: fonts[k] }} value={fonts[k]} spellCheck={false} onChange={(e) => onChange({ ...fonts, [k]: e.target.value })} />
          <RemoveBtn title={t('look.remove')} onClick={() => onChange(without(fonts, k))} />
        </div>
      ))}
      <datalist id="nc-font-presets">{FONT_PRESETS.map((f) => <option key={f} value={f} />)}</datalist>
      <button className={`nc-chip ${stopFlow}`} style={{ alignSelf: 'flex-start' }} onClick={() => onChange({ ...fonts, [freshKey('font', keys)]: FONT_PRESETS[1]! })}>+ {t('look.addFont')}</button>
    </>
  );
};

/* ---------- Stage: the video's own values ---------- */

/**
 * What the stage draws the same way in every scene: a date, an episode, a channel. `date` and
 * `time` are filled from the run unless they are set here, so a daily bulletin needs no edit.
 */
export const VarsEditor: React.FC<{ vars: Record<string, string>; onChange: (v: Record<string, string>) => void }> = ({ vars, onChange }) => {
  const t = useT();
  const keys = Object.keys(vars);
  return (
    <>
      {keys.map((k) => (
        <div key={k} style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          <KeyInput value={k} taken={keys} style={{ width: 76, flex: 'none' }} onCommit={(next) => onChange(renameKey(vars, k, next))} />
          <input className={`nc-input ${stopFlow}`} style={{ flex: 1, minWidth: 0 }} value={vars[k]} onChange={(e) => onChange({ ...vars, [k]: e.target.value })} />
          <RemoveBtn title={t('look.remove')} onClick={() => onChange(without(vars, k))} />
        </div>
      ))}
      <button className={`nc-chip ${stopFlow}`} style={{ alignSelf: 'flex-start' }} onClick={() => onChange({ ...vars, [freshKey('var', keys)]: '' })}>+ {t('look.addVar')}</button>
    </>
  );
};

/* ---------- Stage: tones ---------- */

export const TonesEditor: React.FC<{ tones: StageDef['tones']; palette: Record<string, string>; onChange: (t: StageDef['tones']) => void }> = ({ tones, palette, onChange }) => {
  const t = useT();
  const names = Object.keys(tones);
  const [open, setOpen] = React.useState<string | null>(null);
  const paletteKeys = Object.keys(palette);
  return (
    <>
      {names.map((name) => {
        const overrides = tones[name]!;
        const free = paletteKeys.filter((k) => !(k in overrides));
        const isOpen = open === name;
        return (
          <div key={name} style={{ display: 'flex', flexDirection: 'column', gap: 3, paddingLeft: 4, borderLeft: `2px solid ${overrides.accent ?? palette.accent ?? 'var(--line)'}` }}>
            <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
              <span className="nc-k" style={{ cursor: 'pointer', flex: 'none' }} onClick={() => setOpen(isOpen ? null : name)}>{isOpen ? '▾' : '▸'}</span>
              <KeyInput value={name} taken={names} pattern={KEY} style={{ flex: 1, minWidth: 0 }} onCommit={(next) => onChange(renameKey(tones, name, next))} />
              <span className="nc-k" style={{ flex: 'none' }}>{Object.keys(overrides).length}</span>
              <RemoveBtn title={t('look.remove')} onClick={() => onChange(without(tones, name))} />
            </div>
            {isOpen && (
              <>
                {Object.keys(overrides).map((k) => (
                  <div key={k} style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                    <span className="nc-k" style={{ width: 64, flex: 'none', overflow: 'hidden', textOverflow: 'ellipsis' }}>{k}</span>
                    <ColorInput value={overrides[k]!} onChange={(v) => onChange({ ...tones, [name]: { ...overrides, [k]: v } })} />
                    <RemoveBtn title={t('look.remove')} onClick={() => onChange({ ...tones, [name]: without(overrides, k) })} />
                  </div>
                ))}
                {free.length > 0 && (
                  <select className={`nc-select ${stopFlow}`} value="" onChange={(e) => { if (e.target.value) onChange({ ...tones, [name]: { ...overrides, [e.target.value]: palette[e.target.value]! } }); }}>
                    <option value="">+ {t('look.override')}</option>
                    {free.map((k) => <option key={k} value={k}>{k}</option>)}
                  </select>
                )}
              </>
            )}
          </div>
        );
      })}
      <button className={`nc-chip ${stopFlow}`} style={{ alignSelf: 'flex-start' }} onClick={() => { const n = freshKey('tone', names); onChange({ ...tones, [n]: { accent: palette.accent ?? '#7c5cff' } }); setOpen(n); }}>+ {t('look.addTone')}</button>
    </>
  );
};

/* ---------- Block: props ---------- */

const PROP_TYPES: BlockField['type'][] = ['string', 'text', 'number', 'boolean', 'color', 'string[]', 'image'];

export const PropsEditor: React.FC<{ props: BlockDef['props']; onChange: (p: BlockDef['props']) => void }> = ({ props, onChange }) => {
  const t = useT();
  const keys = Object.keys(props);
  const [open, setOpen] = React.useState<string | null>(null);
  const update = (k: string, patch: Partial<BlockField>) => onChange({ ...props, [k]: { ...props[k]!, ...patch } });
  return (
    <>
      {keys.map((k) => {
        const f = props[k]!;
        const isOpen = open === k;
        return (
          <div key={k} style={{ display: 'flex', flexDirection: 'column', gap: 3, paddingLeft: 4, borderLeft: '2px solid var(--line-2)' }}>
            <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
              <span className="nc-k" style={{ cursor: 'pointer', flex: 'none' }} onClick={() => setOpen(isOpen ? null : k)}>{isOpen ? '▾' : '▸'}</span>
              <KeyInput value={k} taken={keys} style={{ flex: 1, minWidth: 0 }} onCommit={(next) => onChange(renameKey(props, k, next))} />
              <select className={`nc-select ${stopFlow}`} style={{ width: 'auto', flex: 'none' }} value={f.type} onChange={(e) => update(k, { type: e.target.value as BlockField['type'] })}>
                {PROP_TYPES.map((x) => <option key={x} value={x}>{x}</option>)}
              </select>
              <RemoveBtn title={t('look.remove')} onClick={() => onChange(without(props, k))} />
            </div>
            {isOpen && (
              <>
                <input className={`nc-input ${stopFlow}`} placeholder={t('look.propHint')} value={f.hint ?? ''} onChange={(e) => update(k, { hint: e.target.value || undefined })} />
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                  <label className="nc-k" style={{ display: 'flex', gap: 4, alignItems: 'center', cursor: 'pointer' }}><input type="checkbox" className={stopFlow} checked={f.required !== false} onChange={(e) => update(k, { required: e.target.checked })} /> {t('look.required')}</label>
                  {(f.type === 'string' || f.type === 'text' || f.type === 'string[]') && <label className="nc-k" style={{ display: 'flex', gap: 4, alignItems: 'center' }}>{t('look.max')} <input className={`nc-input ${stopFlow}`} type="number" min={1} style={{ width: 56 }} value={f.max ?? ''} onChange={(e) => update(k, { max: e.target.value ? Number(e.target.value) : undefined })} /></label>}
                  {f.type === 'number' && <label className="nc-k" style={{ display: 'flex', gap: 4, alignItems: 'center' }}>{t('look.min')} <input className={`nc-input ${stopFlow}`} type="number" style={{ width: 56 }} value={f.min ?? ''} onChange={(e) => update(k, { min: e.target.value ? Number(e.target.value) : undefined })} /></label>}
                </div>
              </>
            )}
          </div>
        );
      })}
      <button className={`nc-chip ${stopFlow}`} style={{ alignSelf: 'flex-start' }} onClick={() => { const n = freshKey('prop', keys); onChange({ ...props, [n]: { type: 'string', required: true } }); setOpen(n); }}>+ {t('look.addProp')}</button>
    </>
  );
};
