'use client';
import React from 'react';
import { useStudio } from '@/store/useStudio';
import { LOCALES, type Locale } from '@/lib/i18n';
import { Icon } from '@/capsules/sdk/icons';
import { Btn, Dialog, useT } from '@/capsules/sdk/ui';

/** Settings: no API keys in v0.1 — locale plus read-only tool information. */
export const SettingsDialog: React.FC = () => {
  const t = useT();
  const close = useStudio((s) => s.setSettingsOpen);
  const locale = useStudio((s) => s.locale);
  const setLocale = useStudio((s) => s.setLocale);
  const names: Record<Locale, string> = { en: 'English', vi: 'Tiếng Việt' };
  const field = (label: string, value: React.ReactNode, hint?: string) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
      <span style={{ fontSize: 'var(--fs-body)', textTransform: 'uppercase', letterSpacing: '.11em', color: 'var(--tx-3)' }}>{label}</span>
      {value}
      {hint && <span style={{ fontSize: 'var(--fs-body)', color: 'var(--tx-3)', lineHeight: 1.6 }}>{hint}</span>}
    </div>
  );
  return (
    <Dialog
      width={620}
      icon={<Icon.gear />}
      title={t('settings.title')}
      onClose={() => close(false)}
      footer={
        <>
          <span style={{ fontSize: 'var(--fs-body)', color: 'var(--tx-3)' }}>{t('settings.footer')}</span>
          <div style={{ flex: 1 }} />
          <Btn onClick={() => close(false)}>{t('settings.close')}</Btn>
        </>
      }
    >
      <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div
          style={{
            background: 'var(--bg-sunk)',
            border: '1px solid var(--line)',
            borderRadius: 5,
            padding: '12px',
            display: 'flex',
            gap: 11,
            fontSize: 'var(--fs-label)',
            color: 'var(--tx-2)',
            lineHeight: 1.65,
          }}
        >
          <span style={{ color: 'var(--ok)', flex: '0 0 auto', marginTop: 2 }}>
            <Icon.check size={14} />
          </span>
          <span>{t('settings.noKeys')}</span>
        </div>
        {field(
          t('settings.locale'),
          <select className="nc-select" style={{ width: 200, height: 34, fontSize: 'var(--fs-label)' }} value={locale} onChange={(e) => setLocale(e.target.value as Locale)}>
            {LOCALES.map((l) => (
              <option key={l} value={l}>
                {names[l]}
              </option>
            ))}
          </select>,
        )}
        {field(t('settings.claudeBin'), <code style={{ fontSize: 'var(--fs-body)', color: 'var(--tx-2)' }}>NODECINE_CLAUDE_BIN · PATH</code>)}
        {field(t('settings.ffmpegBin'), <code style={{ fontSize: 'var(--fs-body)', color: 'var(--tx-2)' }}>NODECINE_FFMPEG_BIN · PATH</code>)}
        {field(t('settings.tmpDir'), <code style={{ fontSize: 'var(--fs-body)', color: 'var(--tx-2)' }}>NODECINE_TMP_DIR · .nodecine/tmp</code>, t('settings.envHint'))}
      </div>
    </Dialog>
  );
};
