import { clipAudio, readClip, webClip } from '@/server/contracts/video';

/** What this capsule asks of the machine: reading a clip, and pulling its sound out as one file. */
export const footageServices = {
  'footage/read': readClip,
  'footage/sound': clipAudio,
  'footage/playable': webClip,
};
