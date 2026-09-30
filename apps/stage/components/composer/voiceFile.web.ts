import { hasAudioSignal, voiceFileMeta, type VoiceFile } from './voice.model';

export async function recordedVoiceFile(uri: string): Promise<VoiceFile> {
  const response = await fetch(uri);
  if (!response.ok) throw new Error('The voice recording could not be read.');
  const blob = await response.blob();
  const meta = voiceFileMeta(blob.type);
  const context = new OfflineAudioContext(1, 1, 44100);
  const audio = await context.decodeAudioData(await blob.arrayBuffer());
  const channels = Array.from({ length: audio.numberOfChannels }, (_, index) => audio.getChannelData(index));
  if (!hasAudioSignal(channels)) throw new Error('No microphone sound was recorded. Check your microphone input and mute settings, then try again.');
  return { uri, ...meta };
}
