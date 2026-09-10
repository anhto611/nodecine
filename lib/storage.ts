'use client';
import type { Graph } from '@/core/engine/graph';
import type { Locale } from './i18n';

/**
 * Schema version stamped on every saved document. A document from another version is not read and
 * the app starts clean. Bump this when the saved shape changes.
 */
export const PROJECT_SCHEMA_VERSION = 2;
/** The versions this build reads. */
export const READABLE_SCHEMA_VERSIONS = [PROJECT_SCHEMA_VERSION];

export interface ProjectDoc {
  schemaVersion: number;
  name: string;
  graph: Graph;
}

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
    // Another version's tabs are not read (EXECUTION_ENGINE §7.3): the app starts clean.
    if (!READABLE_SCHEMA_VERSIONS.includes(doc.schemaVersion) || !Array.isArray(doc.tabs)) return null;
    return doc;
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
