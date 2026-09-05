import { registerSystemTts } from './system-tts';
import { registerPiper } from './piper';
import { registerClaudeCode } from './claude-code';
import { registerOllama } from './ollama';

/** Server-side half: the factories that spawn processes. Kept apart from the descriptors. */
export function installProviders(): void {
  registerSystemTts();
  registerPiper();
  registerClaudeCode();
  registerOllama();
}
