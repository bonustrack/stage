/** @file Decodes a voice clip's PCM on-device via react-native-audio-api's decodeAudioData and buckets it into true waveform bar heights, rejecting defensively so callers fall back to synthetic bars. */

import type { decodeAudioData as DecodeAudioData } from 'react-native-audio-api';

/** Resampling the decode to a low rate keeps the native→JS Float32 copy small (waveform only needs amplitude shape, not fidelity). 8 kHz mono is plenty for ~40 bars and roughly an order of magnitude less data than 44.1 kHz. */
const DECODE_SAMPLE_RATE = 8000;

/** Lazily and optionally require the native react-native-audio-api inside a try/catch, memoizing the fn (or null when unavailable) so a missing native module never throws at module-eval and callers fall back to synthetic bars. */
let loaded = false;
let decodeAudioDataFn: typeof DecodeAudioData | null = null;
/** Get the Decode Audio Data. */
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

/** Resolves a voice-note source into a decodable form: file/http pass through, but data:/blob: (which the native decoder rejects) are fetched into an ArrayBuffer for the decoder's memory-block path. */
async function toDecodableInput(uri: string): Promise<string | ArrayBuffer> {
  if (
    uri.startsWith('file://') || uri.startsWith('/') ||
    uri.startsWith('http://') || uri.startsWith('https://')
  ) {
    return uri;
  }
  return await (await fetch(uri)).arrayBuffer();
}

/** Decode `uri` to Float32 mono PCM, then bucket into `count` normalized bar heights (0..1) using per-bucket RMS (smoother + more speech-like than peak, which spikes on transients). Throws on any decode failure — caller falls back to synthetic bars. */
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
    /** One-line dev breadcrumb so the next on-device test reveals the exact native error (codec/path/permission) behind a synthetic-bar fallback. */
    if (__DEV__) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[VoiceMessage] decode failed for ${uri.slice(0, 48)}: ${msg}`);
    }
    throw err;
  }
}

/** Splits `pcm` into `count` contiguous buckets, normalizing each bucket's RMS to 0..1 against the loudest with a 0.06 floor so quiet clips still fill the track and silent gaps stay visible. */
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
