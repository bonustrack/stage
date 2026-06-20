
import type { decodeAudioData as DecodeAudioData } from 'react-native-audio-api';

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
    decodeAudioDataFn = typeof mod.decodeAudioData === 'function' ? mod.decodeAudioData : null;
  } catch {
    decodeAudioDataFn = null;
  }
  return decodeAudioDataFn;
}

async function toDecodableInput(uri: string): Promise<string | ArrayBuffer> {
  if (
    uri.startsWith('file://') || uri.startsWith('/') ||
    uri.startsWith('http://') || uri.startsWith('https://')
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
    return bucketRms(pcm, count);
  } catch (err) {
    if (__DEV__) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[VoiceMessage] decode failed for ${uri.slice(0, 48)}: ${msg}`);
    }
    throw err;
  }
}

function bucketRms(pcm: Float32Array, count: number): number[] {
  const per = Math.max(1, Math.floor(pcm.length / count));
  const out: number[] = new Array<number>(count).fill(0);
  let max = 0;
  for (let b = 0; b < count; b++) {
    const start = b * per;
    const end = b === count - 1 ? pcm.length : Math.min(pcm.length, start + per);
    let sum = 0;
    let n = 0;
    for (let i = start; i < end; i++) { const s = pcm[i] ?? 0; sum += s * s; n++; }
    const rms = n > 0 ? Math.sqrt(sum / n) : 0;
    out[b] = rms;
    if (rms > max) max = rms;
  }
  if (max <= 0) throw new Error('silent PCM');
  for (let b = 0; b < count; b++) out[b] = Math.max(0.06, Math.min(1, (out[b] ?? 0) / max));
  return out;
}
