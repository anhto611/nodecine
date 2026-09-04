'use client';
import type { Graph } from '@/core/engine/graph';
import type { Locale } from './i18n';

/** Three separate localStorage keys (EXECUTION_ENGINE §7.1). API keys slot exists but is unused in v0.1. */
const PROJECT_KEY = 'nodecine.project';
const UI_KEY = 'nodecine.ui';
export const PROJECT_SCHEMA_VERSION = 1;

export interface ProjectDoc {
  schemaVersion: number;
  name: string;
  graph: Graph;
}

export interface UiPrefs {
  locale: Locale;
  panel: 'library' | 'history' | null;
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

function migrateProject(doc: ProjectDoc): ProjectDoc {
  // Version 1 is the first; future migrations chain here.
  return { ...doc, schemaVersion: PROJECT_SCHEMA_VERSION };
}

export function saveProject(doc: ProjectDoc): void {
  safeSet(PROJECT_KEY, JSON.stringify(doc));
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
