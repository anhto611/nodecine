'use client';
import type { Graph } from '@/core/engine/graph';
import type { Locale } from './i18n';

/** Three separate localStorage keys (EXECUTION_ENGINE §7.1). API keys slot exists but is unused in v0.1. */
const PROJECT_KEY = 'nodecine.project';
const UI_KEY = 'nodecine.ui';
export const PROJECT_SCHEMA_VERSION = 2;

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

/** One node per provider became one node per port type; a saved graph is rewritten on load. */
const PROVIDER_NODE_V2: Record<string, { type: string; providerId: string }> = {
  'core/system-tts-provider': { type: 'core/tts-provider', providerId: 'system-tts' },
  'core/piper-provider': { type: 'core/tts-provider', providerId: 'piper' },
  'core/claude-code-provider': { type: 'core/llm-provider', providerId: 'claude-code' },
};

function migrateProject(doc: ProjectDoc): ProjectDoc {
  let graph = doc.graph;
  if (doc.schemaVersion < 2) {
    graph = {
      ...graph,
      nodes: graph.nodes.map((n) => {
        const moved = PROVIDER_NODE_V2[n.type];
        if (!moved) return n;
        const { defaultVoice, rate, model, ...rest } = n.params as Record<string, unknown>;
        void rest;
        const settings = moved.providerId === 'claude-code' ? { ...(model !== undefined ? { model } : {}) } : { rate: (rate as number) ?? 1 };
        return { ...n, type: moved.type, params: { providerId: moved.providerId, settings, ...(defaultVoice !== undefined ? { defaultVoice } : {}) } };
      }),
    };
  }
  return { ...doc, graph, schemaVersion: PROJECT_SCHEMA_VERSION };
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
