export interface VoiceFile {
  uri: string;
  mime: string;
  extension: string;
}

export function voiceFileMeta(mime: string): Pick<VoiceFile, 'mime' | 'extension'> {
  const type = mime.split(';')[0]?.trim().toLowerCase();
  const extensions: Record<string, string> = {
    'audio/webm': 'webm',
    'audio/ogg': 'ogg',
    'audio/mp4': 'm4a',
    'audio/m4a': 'm4a',
    'audio/x-m4a': 'm4a',
    'audio/wav': 'wav',
    'audio/aac': 'aac',
  };
  const extension = type === undefined ? undefined : extensions[type];
  if (extension === undefined) throw new Error('The browser recorded an unsupported audio format.');
  return { mime, extension };
}

export function hasAudioSignal(channels: readonly Float32Array[]): boolean {
  return channels.some(channel => channel.some(sample => sample !== 0));
}
