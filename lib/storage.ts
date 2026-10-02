'use client';
import type { Graph } from '@/core/engine/graph';
import type { Locale } from './i18n';

/**
 * The saved-document format lives with the migrations that move between versions, so the browser and
 * the server read the same number and the same chain (core/engine/migrate).
 */
export { PROJECT_SCHEMA_VERSION } from '@/core/engine/migrate';
import { migrateDoc, PROJECT_SCHEMA_VERSION } from '@/core/engine/migrate';

export interface ProjectDoc {
  schemaVersion: number;
  name: string;
  graph: Graph;
}

const UI_KEY = 'nodecine.ui';
/** The workflows open in the tab bar, drafts included, so a reload puts the same tabs back (ComfyUI keeps its open workflows the same way). */
const TABS_KEY = 'nodecine.tabs';
export interface UiPrefs {
  locale: Locale;
  panel: 'workflows' | 'library' | 'history' | null;
  logsOpen: boolean;
}

function safeGet(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}
function safeSet(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* quota or private mode */
  }
}

export interface TabsDoc {
  schemaVersion: number;
  active: string;
  tabs: { key: string; fileId: string | null; name: string; graph: Graph; dirty: boolean; savedHash?: string }[];
}

export function loadTabs(): TabsDoc | null {
  const raw = safeGet(TABS_KEY);
  if (!raw) return null;
  try {
    const doc = JSON.parse(raw) as TabsDoc;
    if (!Array.isArray(doc.tabs)) return null;
    // The tabs somebody left open are saved graphs like any other, so an upgrade brings them
    // forward instead of throwing the session away. A format with no way forward still starts clean.
    return {
      ...doc,
      schemaVersion: PROJECT_SCHEMA_VERSION,
      tabs: doc.tabs.map((tab) => {
        const { doc: forward, notes } = migrateDoc({ schemaVersion: doc.schemaVersion, graph: tab.graph });
        // A tab whose graph had to change is no longer the file it came from, so it loses the hash
        // that says "saved"; the dot comes back and Ctrl+S writes the brought-forward version.
        return notes.length ? { ...tab, graph: forward.graph, savedHash: undefined } : tab;
      }),
    };
  } catch {
    return null;
  }
}

export function saveTabs(doc: TabsDoc): void {
  safeSet(TABS_KEY, JSON.stringify(doc));
}

export function loadUiPrefs(): Partial<UiPrefs> {
  const raw = safeGet(UI_KEY);
  if (!raw) return {};
  try {
    return JSON.parse(raw) as Partial<UiPrefs>;
  } catch {
    return {};
  }
}

export function saveUiPrefs(prefs: UiPrefs): void {
  safeSet(UI_KEY, JSON.stringify(prefs));
}
