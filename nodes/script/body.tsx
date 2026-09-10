'use client';
import React from 'react';
import type { SceneContent } from '@/core/types/payloads';
import { Btn, useT, stopFlow } from '@/components/ui';
import { Icon } from '@/components/icons';
import { useParams, type BodyProps } from '@/nodes/kit';
import { useStudio } from '@/store/useStudio';
import { Section } from '@/nodes/kit';
import { SPLIT_RULES, splitScript, type SplitRule } from '@/nodes/script/split';
import { contentChips, moveScene, narrationLead } from '@/nodes/script/summary';
type SceneRow = { role: string; weight: number; narration: string; content: SceneContent };

/**
 * Body of the Static Script (USER_FLOWS §1.9): the scenes, one line each — number, role, the first
 * words the voice says, a chip per thing on screen. Twenty scenes are twenty lines and the node
 * stays a node. A click opens the scene in the editor dialog, where there is room for its content.
 */
export const StaticScriptBody: React.FC<BodyProps> = ({ nodeId }) => {
  const t = useT();
  const [p, set] = useParams<{ scenes: SceneRow[] }>(nodeId);
  const openScene = useStudio((s) => s.setSceneEditor);
  const scenes = p.scenes ?? [];
  const remove = (i: number) => set({ scenes: scenes.filter((_, j) => j !== i) });
  const move = (i: number, to: number) => set({ scenes: moveScene(scenes, i, to) });
  const add = () => {
    set({ scenes: [...scenes, { role: scenes[scenes.length - 1]?.role ?? 'scene', weight: 1, narration: '', content: {} }] });
    openScene({ nodeId, index: scenes.length });
  };
  return (
    <>
      <PasteScript
        onCut={(chunks) => set({ scenes: chunks.map((narration) => ({ role: scenes[0]?.role ?? 'scene', weight: 1, narration, content: {} })) })}
      />
      <div className="nc-k" style={{ display: 'flex', justifyContent: 'space-between' }}><span>{t('node.scenes')}</span><span style={{ color: 'var(--tx-3)' }}>{scenes.length}</span></div>
      {scenes.map((s, i) => (
        <div key={i} className={`nc-scene-line ${stopFlow}`} title={t('script.openHint')} onClick={() => openScene({ nodeId, index: i })}>
          <span className="nc-k" style={{ color: 'var(--accent-2)', flex: 'none', width: 16 }}>{i + 1}</span>
          <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ display: 'flex', gap: 3, flexWrap: 'wrap', alignItems: 'center', minWidth: 0 }}>
              <span className="nc-k" style={{ minWidth: 0 }}>{s.role}</span>
              {contentChips(s.content ?? {}).map((c) => <span key={c.key} className="nc-chip" style={{ cursor: 'inherit' }}>{c.count !== undefined ? t('script.entriesChip', { n: c.count }) : t(`content.${c.key}`)}</span>)}
            </span>
            <span style={{ minWidth: 0, color: s.narration?.trim() ? 'var(--tx)' : 'var(--tx-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.narration?.trim() ? narrationLead(s.narration) : t('script.noNarration')}</span>
          </span>
          <span className="nc-scene-tools" onClick={(e) => e.stopPropagation()}>
            <button className="nc-chip" onClick={() => move(i, i - 1)} disabled={i === 0} title={t('script.up')}>↑</button>
            <button className="nc-chip" onClick={() => move(i, i + 1)} disabled={i >= scenes.length - 1} title={t('script.down')}>↓</button>
            <button className="nc-chip" onClick={() => remove(i)} disabled={scenes.length <= 1} title={t('common.remove')}><Icon.x size={9} /></button>
          </span>
        </div>
      ))}
      <Btn small className={stopFlow} onClick={add} style={{ alignSelf: 'flex-start' }}><Icon.plus size={10} /> {t('node.addScene')}</Btn>
    </>
  );
};

/**
 * A whole script in, one scene per chunk out.
 *
 * A script is written as prose and pasted as prose; typing it back in a scene at a time is work the
 * app should be doing. The cut is mechanical — see `split.ts` — so nothing said is reworded, and the
 * count on the button is the check: it is read before the list is replaced, not after.
 */
const PasteScript: React.FC<{ onCut: (chunks: string[]) => void }> = ({ onCut }) => {
  const t = useT();
  const [open, setOpen] = React.useState(false);
  const [text, setText] = React.useState('');
  const [rule, setRule] = React.useState<SplitRule>('blank-line');
  const chunks = React.useMemo(() => splitScript(text, rule), [text, rule]);
  return (
    <Section title={t('script.paste')} open={open} onToggle={() => setOpen(!open)}>
      <div className="nc-hint">{t('script.pasteHint')}</div>
      <textarea className={`nc-textarea ${stopFlow}`} rows={5} placeholder={t('script.pastePlaceholder')} value={text} onChange={(e) => setText(e.target.value)} />
      <span style={{ display: 'flex', gap: 4, alignItems: 'center', flexWrap: 'wrap' }}>
        <select className={`nc-select ${stopFlow}`} value={rule} onChange={(e) => setRule(e.target.value as SplitRule)}>
          {SPLIT_RULES.map((r) => <option key={r} value={r}>{t(`script.rule.${r}`)}</option>)}
        </select>
        <Btn small className={stopFlow} disabled={chunks.length === 0} onClick={() => { onCut(chunks); setText(''); setOpen(false); }}>
          {t('script.cut')} · {chunks.length}
        </Btn>
      </span>
    </Section>
  );
};
