import { baseMime, extensionForMime } from '@stage-labs/client/files';

export interface VoiceFile {
  uri: string;
  mime: string;
  extension: string;
}

export function voiceFileMeta(mime: string): Pick<VoiceFile, 'mime' | 'extension'> {
  const extension = extensionForMime(baseMime(mime), 'record');
  if (extension === undefined) throw new Error('The browser recorded an unsupported audio format.');
  return { mime, extension };
}

export function hasAudioSignal(channels: readonly Float32Array[]): boolean {
  return channels.some((channel) => channel.some((sample) => sample !== 0));
}
