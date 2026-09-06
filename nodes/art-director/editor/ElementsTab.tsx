'use client';
import React from 'react';
import type { StageDef } from '@/core/types/payloads';
import { Btn, useT } from '@/components/ui';
import type { MeasuredRect } from '@/core/look/layout-edit';
import { applyBoxToCode } from '@/core/look/layout-edit';
import { STAGE_ROLES, addRoleToCode, elementKindOf, elementTextOf, fieldNameOf, rolesIn, setElementText } from '@/core/look/stage-elements';
import { uploadImage } from './assets.client';
import { removeElementDraft, type Commit, type DraftParts } from './draft';

/**
 * The stage as a list of things: what can still be added from the role catalogue, what is on the
 * stage (measured by the preview), and the selected element's own settings — its words, its
 * scene-field rule, its box in design pixels. Every change goes through `commit`, so it is undoable.
 */
export const ElementsTab: React.FC<{
  source: string;
  parts: DraftParts;
  stage: StageDef;
  rects: MeasuredRect[];
  selected: string | null;
  onSelect: (key: string | null) => void;
  commit: Commit;
  frame: { w: number; h: number };
}> = ({ source, parts, stage, rects, selected, onSelect, commit, frame }) => {
  const t = useT();
  const fileRef = React.useRef<HTMLInputElement>(null);
  const [uploadNote, setUploadNote] = React.useState<string | null>(null);
  const roleName = (key: string) => (STAGE_ROLES.some((x) => x.id === key) ? t(`code.role.${key}`) : key);

  const addImage = async (file: File) => {
    setUploadNote(null);
    try {
      const url = await uploadImage(file);
      commit((cur) => ({ source: rolesIn(cur.source).includes('logo') ? cur.source.replace(/(<img\s+class="logo"[^>]*\ssrc=")[^"]*(")/, `$1${url}$2`) : addRoleToCode(cur.source, 'logo', { src: url }) }));
      onSelect('logo');
    } catch (e) {
      setUploadNote(e instanceof Error ? e.message : String(e));
    }
  };
  /** Adds a catalogue role: fields are declared on the stage as well, the logo asks for a file first. */
  const addRole = (roleId: string) => {
    const role = STAGE_ROLES.find((r) => r.id === roleId);
    if (!role) return;
    if (role.kind === 'image') { fileRef.current?.click(); return; }
    commit((cur) => {
      const fields = cur.parts.sceneFields ?? stage.sceneFields;
      const declare = role.kind === 'field' && !fields.some((f) => f.name === role.id);
      return {
        source: addRoleToCode(cur.source, roleId, { text: role.kind === 'text' ? t('code.role.signature.default') : undefined }),
        ...(declare ? { parts: { ...cur.parts, sceneFields: [...fields, { name: role.id, rule: role.fieldRule ?? '' }] } } : {}),
      };
    });
    onSelect(roleId);
  };
  const remove = () => { if (!selected) return; commit((cur) => removeElementDraft(cur, selected, stage)); onSelect(null); };

  const present = rolesIn(source);
  const missing = STAGE_ROLES.filter((r) => !present.includes(r.id));
  const sel = selected ? rects.find((x) => x.key === selected) : undefined;
  const kind = selected ? elementKindOf(source, selected) : 'other';
  const selectedText = selected ? elementTextOf(source, selected) : null;
  const num = (label: string, value: number, apply: (v: number) => { x: number; y: number; w: number; h: number }, resized: boolean) => (
    <label className="nc-k" style={{ display: 'flex', gap: 4, alignItems: 'center' }}>{label}<input className="nc-input" type="number" step={2} style={{ width: 64 }} value={Math.round(value)} onChange={(e) => { const v = Number(e.target.value); if (Number.isFinite(v) && selected) commit((cur) => ({ source: applyBoxToCode(cur.source, selected, apply(v), frame, { resized }) }), `box:${selected}:${label}`); }} /></label>
  );

  return (
    <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 12, fontSize: 'var(--fs-body)' }}>
      <div>
        <div className="nc-pn-sub" style={{ padding: '0 0 6px' }}>{t('code.addSection')}</div>
        {missing.length === 0 ? <div className="nc-hint">{t('code.allRolesPresent')}</div> : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {missing.map((r) => (
              <button key={r.id} className="nc-wf" style={{ padding: '6px 8px', gap: 8, alignItems: 'center', border: 0, background: 'none', color: 'inherit', font: 'inherit', textAlign: 'left', width: '100%' }} title={t(`code.role.${r.id}.hint`)} onClick={() => addRole(r.id)}>
                <span style={{ color: 'var(--accent-2)' }}>+</span>
                <span className="nc-wf-name" style={{ flex: 1 }}>{t(`code.role.${r.id}`)}</span>
                <span className="nc-tag">{t(`code.kind.${r.kind}`)}</span>
              </button>
            ))}
          </div>
        )}
        <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void addImage(f); }} />
        {uploadNote && <div style={{ color: 'var(--err)', fontSize: 'var(--fs-hint)', marginTop: 6 }}>{uploadNote}</div>}
      </div>

      <div>
        <div className="nc-pn-sub" style={{ padding: '0 0 6px' }}>{t('code.elementsSection')} · {rects.length}</div>
        {rects.length === 0 && <div className="nc-hint">{t('code.elementsEmpty')}</div>}
        {rects.map((r) => {
          const on = selected === r.key;
          return (
            <div key={r.key} className={`nc-wf ${on ? 'open' : ''}`} style={{ padding: '6px 8px', gap: 8, alignItems: 'center', background: on ? 'var(--accent-sunk)' : undefined }} onClick={() => onSelect(on ? null : r.key)}>
              <span className="nc-wf-name" style={{ flex: 1 }}>{roleName(r.key)}</span>
              <span className="nc-tag">{t(`code.kind.${elementKindOf(source, r.key)}`)}</span>
              <span className="nc-wf-meta" style={{ marginTop: 0 }}>{Math.round(r.x)},{Math.round(r.y)} · {Math.round(r.w)}×{Math.round(r.h)}</span>
            </div>
          );
        })}
      </div>

      {selected && (
        <div style={{ borderTop: '1px solid var(--line)', paddingTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ fontWeight: 700 }}>{roleName(selected)}</span>
            <span className="nc-tag">{t(`code.kind.${kind}`)}</span>
            {kind === 'image' && <button className="nc-chip" onClick={() => fileRef.current?.click()}>{t('code.swapImage')}</button>}
            <span style={{ flex: 1 }} />
            <Btn small danger disabled={kind === 'slot'} title={kind === 'slot' ? t('code.cannotRemoveSlot') : 'Delete'} onClick={remove}>{t('code.removeElement')}</Btn>
          </div>
          {selectedText !== null && <input className="nc-input" value={selectedText} placeholder={t('code.elementText')} onChange={(e) => { const v = e.target.value; commit((cur) => ({ source: setElementText(cur.source, selected, v) }), `text:${selected}`); }} />}
          {kind === 'field' && (() => {
            const name = fieldNameOf(source, selected);
            const fields = parts.sceneFields ?? stage.sceneFields;
            const f = fields.find((x) => x.name === name);
            const update = (patch: Partial<StageDef['sceneFields'][number]>) => commit((cur) => ({ parts: { ...cur.parts, sceneFields: (cur.parts.sceneFields ?? fields).map((x) => (x.name === name ? { ...x, ...patch } : x)) } }), `field:${name}`);
            if (!name) return null;
            if (!f) return <div className="nc-hint" style={{ color: 'var(--warn)' }}>{t('code.fieldOrphan', { name })} <button className="nc-chip on" onClick={() => commit((cur) => ({ parts: { ...cur.parts, sceneFields: [...(cur.parts.sceneFields ?? fields), { name, rule: '' }] } }))}>{t('code.fieldAdopt')}</button></div>;
            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div className="nc-hint">{t('code.fieldHint', { name })}</div>
                <textarea className="nc-textarea" rows={2} placeholder={t('look.fieldRule')} value={f.rule} onChange={(e) => update({ rule: e.target.value })} />
                <input className="nc-input" placeholder={t('look.fieldOptions')} value={(f.options ?? []).join(', ')} onChange={(e) => { const opts = e.target.value.split(',').map((x) => x.trim()).filter(Boolean); update(opts.length ? { options: opts } : { options: undefined }); }} />
              </div>
            );
          })()}
          {sel && (
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {num('x', sel.x, (v) => ({ x: v, y: sel.y, w: sel.w, h: sel.h }), false)}
              {num('y', sel.y, (v) => ({ x: sel.x, y: v, w: sel.w, h: sel.h }), false)}
              {num('w', sel.w, (v) => ({ x: sel.x, y: sel.y, w: v, h: sel.h }), true)}
              {num('h', sel.h, (v) => ({ x: sel.x, y: sel.y, w: sel.w, h: v }), true)}
            </div>
          )}
          <div className="nc-hint">{STAGE_ROLES.some((x) => x.id === selected) ? t(`code.role.${selected}.hint`) : t('code.selectedHint')}</div>
        </div>
      )}
    </div>
  );
};
