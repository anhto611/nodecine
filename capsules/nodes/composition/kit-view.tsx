'use client';
import React from 'react';
import { Btn, useT } from '@/capsules/sdk/ui';
import { useHost } from '@/capsules/sdk/host';
import { COMPOSITION_ENTRY } from '@/contracts/types/composition';
import { addMedia, GUIDE_FILE, isClip, isSeen, kitColours, nameOf, readPart, removeMedia, replaceMedia, setKitColour, usesMedia, type Project } from './parts';

/**
 * What a kit is made of besides its blocks and components: the pictures its parts draw, the fonts it
 * writes with, the rules the Storyboard Writer follows, and the values a film sets.
 *
 * These belong to the style — the same in every video made with this workflow — which is why they live
 * here and not in the Assets node, where the pictures of one video are found. Code is edited on the
 * parts wall; this is the side a person who does not write code can change.
 */
export const KitView: React.FC<{ project: Project; set: (patch: Partial<Project>) => void }> = ({ project, set }) => {
  const t = useT();
  const { uploadImage, uploadFile } = useHost();
  const [busy, setBusy] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [copied, setCopied] = React.useState<string | null>(null);

  const paths = Object.keys(project.media);
  const shown = paths.filter(isSeen);
  const rest = paths.filter((p) => !isSeen(p));
  const guide = project.files[GUIDE_FILE];
  const shell = project.files[COMPOSITION_ENTRY] ?? '';
  const variables = readPart(shell).variables;
  const colours = kitColours(shell);

  const upload = async (key: string, file: File, then: (url: string) => void) => {
    setBusy(key);
    setError(null);
    // A picture travels as text, a clip as itself: too many megabytes to carry any other way.
    try {
      then(await (/\.(mp4|webm|mov|m4v)$/i.test(file.name) ? uploadFile(file) : uploadImage(file)));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  const picker = (key: string, label: string, onFile: (file: File) => void) => (
    <label className="nc-chip" style={{ cursor: 'pointer' }}>
      {busy === key ? '…' : label}
      <input
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml,video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov,.m4v"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (file) onFile(file);
        }}
      />
    </label>
  );

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: 14, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ color: 'var(--tx-3)', lineHeight: 1.5 }}>{t('node.compositionKitHint')}</div>

      <section style={{ display: 'grid', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <b>
            {t('node.compositionKitPictures')} · {shown.length}
          </b>
          <span style={{ marginLeft: 'auto' }}>{picker('new', t('node.compositionKitAdd'), (file) => void upload('new', file, (url) => set(addMedia(project, file.name, url).project)))}</span>
        </div>
        {shown.length === 0 && <div style={{ color: 'var(--tx-3)' }}>{t('node.compositionNone')}</div>}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 10 }}>
          {shown.map((path) => {
            const used = usesMedia(project, path);
            const box = { width: '100%', aspectRatio: '1 / 1', objectFit: 'contain' as const, background: 'var(--bg-sunk, #0002)', borderRadius: 4 };
            return (
              <div key={path} style={{ display: 'grid', gap: 6, padding: 8, border: '1px solid var(--line)', borderRadius: 6 }}>
                {/* A clip shows itself, quietly and on demand: a wall of cards must not all start playing. */}
                {isClip(path) ? <video src={project.media[path]} style={box} muted playsInline controls preload="metadata" /> : <img src={project.media[path]} alt="" style={box} />}
                <div title={path} style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {nameOf(path)}
                </div>
                <div style={{ color: 'var(--tx-3)', fontSize: 'var(--fs-hint)' }}>
                  {copied === path ? t('node.compositionKitCopied') : used ? t('node.compositionKitUsed') : t('node.compositionKitUnused')}
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {picker(path, t('node.compositionKitReplace'), (file) => void upload(path, file, (url) => set(replaceMedia(project, path, url))))}
                  {/* A picture nothing draws yet is used by writing its path into a part: here it is, to paste. */}
                  <button className="nc-chip" title={path} onClick={() => void navigator.clipboard?.writeText(path).then(() => setCopied(path))}>
                    {t('node.compositionKitCopyPath')}
                  </button>
                  {!used && (
                    <button className="nc-chip" onClick={() => set(removeMedia(project, path))}>
                      {t('node.compositionRemoveFile')}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {rest.length > 0 && (
        <section style={{ display: 'grid', gap: 6 }}>
          <b>
            {t('node.compositionKitFonts')} · {rest.length}
          </b>
          <div style={{ color: 'var(--tx-3)', fontSize: 'var(--fs-hint)', lineHeight: 1.6, overflowWrap: 'anywhere' }}>{rest.join(', ')}</div>
        </section>
      )}

      <section style={{ display: 'grid', gap: 6 }}>
        <b>{t('node.compositionKitGuide')}</b>
        <div style={{ color: 'var(--tx-3)', lineHeight: 1.5 }}>{t('node.compositionKitGuideHint')}</div>
        {guide === undefined ? (
          <div>
            <Btn onClick={() => set({ files: { ...project.files, [GUIDE_FILE]: `# ${t('node.compositionKitGuide')}\n` } })}>{t('node.compositionKitGuideNew')}</Btn>
          </div>
        ) : (
          <textarea
            className="nc-textarea"
            style={{ minHeight: 320, lineHeight: 1.6 }}
            value={guide}
            spellCheck={false}
            onChange={(e) => set({ files: { ...project.files, [GUIDE_FILE]: e.target.value } })}
          />
        )}
      </section>

      {colours.length > 0 && (
        <section style={{ display: 'grid', gap: 6 }}>
          <b>{t('node.compositionKitColours')}</b>
          <div style={{ color: 'var(--tx-3)', lineHeight: 1.5 }}>{t('node.compositionKitColoursHint')}</div>
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
            {colours.map((c) => (
              <label key={c.name} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <input
                  type="color"
                  value={
                    c.value.length === 4
                      ? `#${c.value
                          .slice(1)
                          .split('')
                          .map((h) => h + h)
                          .join('')}`
                      : c.value.slice(0, 7)
                  }
                  onChange={(e) => set({ files: { ...project.files, [COMPOSITION_ENTRY]: setKitColour(shell, c.name, e.target.value) } })}
                />
                <span>{c.name}</span>
              </label>
            ))}
          </div>
        </section>
      )}

      <section style={{ display: 'grid', gap: 6 }}>
        <b>
          {t('node.compositionKitValues')} · {variables.length}
        </b>
        <div style={{ color: 'var(--tx-3)', lineHeight: 1.5 }}>{t('node.compositionKitValuesHint')}</div>
        <div style={{ color: 'var(--tx-2)', fontSize: 'var(--fs-hint)', lineHeight: 1.7, overflowWrap: 'anywhere' }}>
          {variables.length ? variables.map((v) => `${v.id} (${v.type})`).join(', ') : t('node.compositionNone')}
        </div>
      </section>

      {error && <div style={{ color: 'var(--err)', overflowWrap: 'anywhere' }}>{error}</div>}
    </div>
  );
};
