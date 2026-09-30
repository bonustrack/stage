import type { VoiceFile } from './voice.model';

export function recordedVoiceFile(uri: string): Promise<VoiceFile> {
  return Promise.resolve({ uri, mime: 'audio/m4a', extension: 'm4a' });
}
