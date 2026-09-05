/**
 * The providers this build ships, described in a form both sides can read.
 *
 * The factories themselves are server-only: they spawn processes and touch the filesystem. But the
 * Studio needs to render the list and the fields of whichever provider is selected, so the shape of
 * each provider lives here, in a module with no Node imports, and the heavy half stays in
 * `installed.server.ts`. One node per port type then covers every provider, the way ComfyUI's Load
 * Checkpoint covers every checkpoint.
 */

export type SettingField =
  /** `label` and `placeholder` are dictionary keys, not literals. */
  | { name: string; label: string; type: 'number'; min?: number; max?: number; step?: number }
  | { name: string; label: string; type: 'text'; placeholder?: string }
  | { name: string; label: string; type: 'select'; options: { value: string; label: string }[] };

export interface ProviderDescriptor {
  id: string;
  kind: 'tts' | 'llm';
  /** Dictionary key for the name shown in the picker; the id is the fallback. */
  nameKey: string;
  /** Dictionary key for the line under the picker: what this provider needs to work. */
  noteKey?: string;
  fields: SettingField[];
  defaultSettings: Record<string, unknown>;
  /**
   * Settings that hold a credential. Empty everywhere today — v0.1 ships without API keys — but the
   * field is here so the providers that need one later have somewhere to declare it.
   */
  secretSettings?: string[];
}

const RATE_FIELD: SettingField = { name: 'rate', label: 'node.rate', type: 'number', min: 0.5, max: 2, step: 0.05 };

export const PROVIDERS: ProviderDescriptor[] = [
  {
    id: 'system-tts',
    kind: 'tts',
    nameKey: 'provider.system-tts',
    noteKey: 'provider.system-tts.note',
    fields: [RATE_FIELD],
    defaultSettings: { rate: 1 },
  },
  {
    id: 'piper',
    kind: 'tts',
    nameKey: 'provider.piper',
    noteKey: 'provider.piper.note',
    fields: [RATE_FIELD],
    defaultSettings: { rate: 1 },
  },
  {
    id: 'claude-code',
    kind: 'llm',
    nameKey: 'provider.claude-code',
    noteKey: 'provider.claude-code.note',
    fields: [{ name: 'model', label: 'node.model', type: 'text', placeholder: 'default' }],
    defaultSettings: {},
  },
  {
    id: 'ollama',
    kind: 'llm',
    nameKey: 'provider.ollama',
    noteKey: 'provider.ollama.note',
    fields: [{ name: 'model', label: 'node.model', type: 'text', placeholder: 'llama3.2' }],
    defaultSettings: { model: 'llama3.2' },
  },
];

export const providersOfKind = (kind: 'tts' | 'llm'): ProviderDescriptor[] => PROVIDERS.filter((p) => p.kind === kind);
export const findProvider = (id: string): ProviderDescriptor | undefined => PROVIDERS.find((p) => p.id === id);
/** What a freshly dropped node should select. */
export const defaultProviderId = (kind: 'tts' | 'llm'): string => providersOfKind(kind)[0]?.id ?? '';
