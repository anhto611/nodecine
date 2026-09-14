'use client';
import React from 'react';
import { listForms } from '@/contracts/forms/registry';
import { localized } from '@/core/templates/registry';
import { Kv, useT, stopFlow } from '@/components/ui';
import { useParams } from '@/nodes/kit';
import { useStudio } from '@/store/useStudio';

/**
 * Which kind of film this is (CORE_CONTRACTS §6), chosen by name. Shared by the two nodes that need
 * it: the Screenwriter, which writes for a form, and the Set, which draws to one.
 *
 * A picker and not a text field because a form is an id out of a registry: typed from memory, a
 * misspelling is a run-time error where a list would have been a choice the person could see.
 *
 * `fromScript` adds the empty choice that means "whatever the script was written for", for a node
 * with a script on a port — choosing twice is two chances to disagree.
 */
export const FormPicker: React.FC<{ nodeId: string; fromScript?: boolean }> = ({ nodeId, fromScript }) => {
  const t = useT();
  const locale = useStudio((s) => s.locale);
  const [p, set] = useParams<{ form: string }>(nodeId);
  const forms = listForms();
  const current = p.form ?? '';
  // A form named on another machine, or in a build that had it, stays selectable rather than
  // silently turning into something else when the workflow is opened here.
  const known = forms.some((f) => f.id === current);
  return (
    <Kv
      k={t('node.form')}
      v={
        <select className={`nc-select ${stopFlow}`} value={current} onChange={(e) => set({ form: e.target.value })} title={forms.find((f) => f.id === current)?.description ? localized(forms.find((f) => f.id === current)!.description!, locale) : undefined}>
          <option value="">{t(fromScript ? 'node.form.fromScript' : 'node.form.none')}</option>
          {!known && current ? <option value={current}>{current}</option> : null}
          {forms.map((f) => (
            <option key={f.id} value={f.id}>{localized(f.name, locale)}</option>
          ))}
        </select>
      }
    />
  );
};
