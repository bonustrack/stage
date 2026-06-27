import type { decodeAudioData as DecodeAudioData } from 'react-native-audio-api';
import { voiceBucketRms } from '@stage-labs/client/xmtp/voice';

const DECODE_SAMPLE_RATE = 8000;

let loaded = false;
let decodeAudioDataFn: typeof DecodeAudioData | null = null;

function getDecodeAudioData(): typeof DecodeAudioData | null {
  if (loaded) return decodeAudioDataFn;
  loaded = true;
  try {
    const mod = require('react-native-audio-api') as {
      decodeAudioData?: typeof DecodeAudioData;
    };
    decodeAudioDataFn =
      typeof mod.decodeAudioData === 'function' ? mod.decodeAudioData : null;
  } catch {
    decodeAudioDataFn = null;
  }
  return decodeAudioDataFn;
}

async function toDecodableInput(uri: string): Promise<string | ArrayBuffer> {
  if (
    uri.startsWith('file://') ||
    uri.startsWith('/') ||
    uri.startsWith('http://') ||
    uri.startsWith('https://')
  ) {
    return uri;
  }
  return await (await fetch(uri)).arrayBuffer();
}

export async function decodeWaveformBars(uri: string, count: number): Promise<number[]> {
  const decodeAudioData = getDecodeAudioData();
  if (!decodeAudioData) throw new Error('react-native-audio-api unavailable');
  try {
    const input = await toDecodableInput(uri);
    const buffer = await decodeAudioData(input, DECODE_SAMPLE_RATE);
    const pcm = buffer.getChannelData(0);
    if (!pcm || pcm.length === 0) throw new Error('empty PCM');
    return voiceBucketRms(pcm, count);
  } catch (err) {
    if (__DEV__) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[VoiceMessage] decode failed for ${uri.slice(0, 48)}: ${msg}`);
    }
    throw err;
  }
}
