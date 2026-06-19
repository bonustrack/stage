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

import type { decodeAudioData as DecodeAudioData } from 'react-native-audio-api';

/** Resampling the decode to a low rate keeps the native→JS Float32 copy small
 *  (waveform only needs amplitude shape, not fidelity). 8 kHz mono is plenty
 *  for ~40 bars and roughly an order of magnitude less data than 44.1 kHz. */
const DECODE_SAMPLE_RATE = 8000;

/** react-native-audio-api is a NATIVE module: a top-level import throws at
 *  module-eval time ("native module could not be found") on any APK built
 *  without it, crashing the whole feed before render. So we resolve it LAZILY
 *  + OPTIONALLY via require inside a try/catch, memoizing the result (the fn,
 *  or null when unavailable). null → decode rejects → caller falls back to
 *  synthetic bars. The eval is never allowed to throw uncaught. */
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

/** Resolve any voice-note source into a form `decodeAudioData` can actually
 *  decode on-device. The native decoder accepts three input shapes but rejects
 *  most string sources outright:
 *   - `file://…` / bare path → decoded directly off disk (works).
 *   - `http(s)://…`          → fetched then decoded (works).
 *   - `data:audio/…;base64,` → THROWN by `isBase64Source` ("Base64 source
 *                              decoding is not currently supported").
 *   - `blob:…`               → THROWN by `isDataBlobString`.
 *  Inline XMTP voice notes (StaticAttachment) render as `data:audio/m4a;base64,`
 *  and the sender's own optimistic echo can be `blob:`/`data:` — both hit the
 *  reject branches, so the decode always failed and the player fell back to the
 *  synthetic waveform. We sidestep every string-source rejection by fetching
 *  non-file/non-http sources into an ArrayBuffer (the `data:`/`blob:` fetch is a
 *  cheap in-memory read) and handing that to the decoder's memory-block path,
 *  which decodes m4a/aac/mp3/wav uniformly. `file://`/`http(s)` pass through so
 *  remote decrypted clips still decode straight off disk / the network. */
async function toDecodableInput(uri: string): Promise<string | ArrayBuffer> {
  if (
    uri.startsWith('file://') || uri.startsWith('/') ||
    uri.startsWith('http://') || uri.startsWith('https://')
  ) {
    return uri;
  }
  return await (await fetch(uri)).arrayBuffer();
}

/** Decode `uri` to Float32 mono PCM, then bucket into `count` normalized bar
 *  heights (0..1) using per-bucket RMS (smoother + more speech-like than peak,
 *  which spikes on transients). Throws on any decode failure — caller falls
 *  back to synthetic bars. */
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
    /** One-line dev breadcrumb so the next on-device test reveals the exact
     *  native error (codec/path/permission) behind a synthetic-bar fallback. */
    if (__DEV__) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[VoiceMessage] decode failed for ${uri.slice(0, 48)}: ${msg}`);
    }
    throw err;
  }
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
    for (let i = start; i < end; i++) { const s = pcm[i] ?? 0; sum += s * s; n++; }
    const rms = n > 0 ? Math.sqrt(sum / n) : 0;
    out[b] = rms;
    if (rms > max) max = rms;
  }
  if (max <= 0) throw new Error('silent PCM');
  for (let b = 0; b < count; b++) out[b] = Math.max(0.06, Math.min(1, (out[b] ?? 0) / max));
  return out;
}
