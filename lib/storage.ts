'use client';
import type { Graph } from '@/core/engine/graph';
import type { Locale } from './i18n';
import { PROJECT_SCHEMA_VERSION, migrateProject, type ProjectDoc } from './migrate';

export { PROJECT_SCHEMA_VERSION, migrateProject, type ProjectDoc };

/** The project key is read once to migrate what an older build saved; the open tabs replaced it. */
const PROJECT_KEY = 'nodecine.project';
const UI_KEY = 'nodecine.ui';
/** Templates the user saved from the canvas or pasted in. Data only, same shape as a shipped one. */
const TEMPLATES_KEY = 'nodecine.templates';
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

/** Returns null when nothing is stored or the stored doc is from a newer app (EXECUTION_ENGINE §7.3). */
export function loadProject(): ProjectDoc | null {
  const raw = safeGet(PROJECT_KEY);
  if (!raw) return null;
  try {
    const doc = JSON.parse(raw) as ProjectDoc;
    if (typeof doc.schemaVersion !== 'number' || doc.schemaVersion > PROJECT_SCHEMA_VERSION) return null;
    return migrateProject(doc);
  } catch {
    return null;
  }
}

export interface TabsDoc {
  schemaVersion: number;
  active: string;
  tabs: { key: string; fileId: string | null; name: string; graph: Graph; dirty: boolean }[];
}

export function loadTabs(): TabsDoc | null {
  const raw = safeGet(TABS_KEY);
  if (!raw) return null;
  try {
    const doc = JSON.parse(raw) as TabsDoc;
    if (typeof doc.schemaVersion !== 'number' || doc.schemaVersion > PROJECT_SCHEMA_VERSION || !Array.isArray(doc.tabs)) return null;
    const tabs = doc.tabs.map((t) => ({ ...t, graph: migrateProject({ schemaVersion: doc.schemaVersion, name: t.name, graph: t.graph }).graph }));
    return { ...doc, schemaVersion: PROJECT_SCHEMA_VERSION, tabs };
  } catch {
    return null;
  }
}

export function saveTabs(doc: TabsDoc): void {
  safeSet(TABS_KEY, JSON.stringify(doc));
}

export function loadUserTemplates(): unknown[] {
  try {
    const raw = safeGet(TEMPLATES_KEY);
    const list: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

export function saveUserTemplates(list: unknown[]): void {
  safeSet(TEMPLATES_KEY, JSON.stringify(list));
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
