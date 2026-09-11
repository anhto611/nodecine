import { importLibraryAudio } from '@/server/audio';

/** Somebody's own recording, brought into a run from the voice folder (CORE_CONTRACTS §5.17). */
export const importAudioOnServer = (fileName: string, signal: AbortSignal) => importLibraryAudio('voice', fileName, signal);

export const audioInputServices = { 'audio-input/import': importAudioOnServer };
