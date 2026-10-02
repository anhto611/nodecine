'use client';
import React from 'react';
import { useStudio } from '@/store/useStudio';
import { localized } from '@/core/engine/document';
import { templatesApi, type TemplateSummary } from '@/lib/workflows.client';
import { Icon } from '@/capsules/sdk/icons';
import { Dialog, useT } from '@/capsules/sdk/ui';

/** Browse shipped workflow templates in a modal; selecting a card opens an independent draft. */
export const TemplatesDialog: React.FC = () => {
  const t = useT();
  const locale = useStudio((state) => state.locale);
  const setTemplatesOpen = useStudio((state) => state.setTemplatesOpen);
  const createFromTemplate = useStudio((state) => state.createFromTemplate);
  const [templates, setTemplates] = React.useState<TemplateSummary[] | null>(null);
  const [query, setQuery] = React.useState('');
  const [category, setCategory] = React.useState<'all' | 'video'>('all');
  const [loadingId, setLoadingId] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let alive = true;
    void templatesApi.list().then((items) => {
      if (alive) { setTemplates(items); setError(null); }
    }).catch((cause) => {
      if (alive) { setTemplates([]); setError(cause instanceof Error ? cause.message : String(cause)); }
    });
    return () => { alive = false; };
  }, []);

  const open = async (item: TemplateSummary) => {
    if (loadingId) return;
    setLoadingId(item.id);
    try {
      const template = await templatesApi.read(item.id);
      createFromTemplate(template);
      setTemplatesOpen(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setLoadingId(null);
    }
  };

  const visible = templates?.filter((item) => {
    if (category === 'video' && item.group !== 'video') return false;
    const text = `${localized(item.name, locale, item.id)} ${localized(item.description, locale)}`.toLocaleLowerCase();
    return text.includes(query.trim().toLocaleLowerCase());
  });

  return (
    <Dialog width="min(90vw, 1100px)" height="min(80vh, 720px)" icon={<Icon.layers />} title={t('templates.title')} onClose={() => setTemplatesOpen(false)}>
      <div className="nc-template-browser">
        <nav className="nc-template-nav" aria-label={t('templates.categories')}>
          <button className={category === 'all' ? 'on' : ''} onClick={() => setCategory('all')}>{t('templates.all')}</button>
          <button className={category === 'video' ? 'on' : ''} onClick={() => setCategory('video')}>{t('templates.video')}</button>
        </nav>
        <div className="nc-template-main">
          <div className="nc-template-toolbar">
            <strong>{t(category === 'all' ? 'templates.all' : 'templates.video')}</strong>
            <input className="nc-input" autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t('templates.search')} aria-label={t('templates.search')} />
          </div>
          {error && <div className="nc-template-error" role="alert">{t('templates.error', { why: error })}</div>}
          <div className="nc-template-grid" data-testid="template-gallery">
            {visible === null && <div className="nc-template-empty">{t('templates.loading')}</div>}
            {visible?.length === 0 && <div className="nc-template-empty">{t('templates.empty')}</div>}
            {visible?.map((item) => (
              <button className="nc-template-card" key={item.id} disabled={loadingId !== null} onClick={() => void open(item)}>
                {/* One tile shape for every template: a square, holding a still of any aspect ratio —
                    9:16, 16:9 or square — fitted whole over a blurred fill of itself, never cropped. */}
                <span className="nc-template-art">
                  <span className="nc-template-art-fill" style={{ backgroundImage: `url(${item.thumbnail})` }} aria-hidden="true" />
                  <img src={item.thumbnail} alt="" />
                </span>
                <span className="nc-template-copy">
                  <span className="nc-template-eyebrow"><Icon.film size={13} />{t('templates.ready')}</span>
                  <strong>{localized(item.name, locale, item.id)}</strong>
                  <span className="nc-template-tagline">{localized(item.tagline, locale)}</span>
                  <span className="nc-template-tags">{item.tags.map((tag, index) => <span key={index}>{localized(tag, locale)}</span>)}</span>
                  <span className="nc-template-action">{t('templates.open')} <span aria-hidden="true">→</span></span>
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </Dialog>
  );
};
