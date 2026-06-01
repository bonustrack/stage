/** TRUE waveform extraction for voice messages. XMTP audio attachments carry no
 *  amplitude sidecar, so instead of synthesizing bars we decode the clip's PCM
 *  on-device and bucket it into bar heights — the cross-client, XMTP-standard
 *  approach (no protocol extension).
 *
 *  Decoding uses react-native-audio-api's `decodeAudioData` (Software Mansion):
 *  a Web-Audio `AudioContext.decodeAudioData`-equivalent that accepts a local
 *  file path / uri (or remote url) and returns an `AudioBuffer` whose
 *  `getChannelData(0)` is Float32 PCM (-1..1). It's a NATIVE module → needs a
 *  dev-client build; it decodes m4a/aac/mp3/wav on both iOS + Android.
 *
 *  Everything here is defensive: any failure (unsupported codec, missing file,
 *  native error) rejects and the caller falls back to synthetic bars — never a
 *  crash. The bars cache lives in VoiceMessage.barsCache.ts. */

import { decodeAudioData } from 'react-native-audio-api';

/** Resampling the decode to a low rate keeps the native→JS Float32 copy small
 *  (waveform only needs amplitude shape, not fidelity). 8 kHz mono is plenty
 *  for ~40 bars and roughly an order of magnitude less data than 44.1 kHz. */
const DECODE_SAMPLE_RATE = 8000;

/** Decode `uri` to Float32 mono PCM, then bucket into `count` normalized bar
 *  heights (0..1) using per-bucket RMS (smoother + more speech-like than peak,
 *  which spikes on transients). Throws on any decode failure — caller falls
 *  back to synthetic bars. */
export async function decodeWaveformBars(uri: string, count: number): Promise<number[]> {
  const buffer = await decodeAudioData(uri, DECODE_SAMPLE_RATE);
  const pcm = buffer.getChannelData(0);
  if (!pcm || pcm.length === 0) throw new Error('empty PCM');
  return bucketRms(pcm, count);
}

/** Split `pcm` into `count` contiguous buckets, take each bucket's RMS, then
 *  normalize to 0..1 against the loudest bucket so quiet clips still fill the
 *  track. A 0.06 floor keeps silent gaps visible as a thin line (matches the
 *  synthetic fallback's minimum-height feel). */
function bucketRms(pcm: Float32Array, count: number): number[] {
  const per = Math.max(1, Math.floor(pcm.length / count));
  const out: number[] = new Array<number>(count).fill(0);
  let max = 0;
  for (let b = 0; b < count; b++) {
    const start = b * per;
    const end = b === count - 1 ? pcm.length : Math.min(pcm.length, start + per);
    let sum = 0;
    let n = 0;
    for (let i = start; i < end; i++) { const s = pcm[i]; sum += s * s; n++; }
    const rms = n > 0 ? Math.sqrt(sum / n) : 0;
    out[b] = rms;
    if (rms > max) max = rms;
  }
  if (max <= 0) throw new Error('silent PCM');
  for (let b = 0; b < count; b++) out[b] = Math.max(0.06, Math.min(1, out[b] / max));
  return out;
}
