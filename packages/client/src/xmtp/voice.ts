export const VOICE_BAR_COUNT = 34;

export const VOICE_MIME_M4A = 'audio/m4a';

export function voiceFilename(now: number = Date.now(), ext = 'm4a'): string {
  return `voice-${now}.${ext}`;
}

export function voiceMimeAndExt(recorderMime: string): { mime: string; ext: string } {
  const bare = recorderMime.split(';')[0]?.trim() ?? '';
  const mime = bare.length > 0 ? bare : 'audio/webm';
  if (mime === 'audio/mp4' || mime === 'audio/aac' || mime === 'audio/m4a') {
    return { mime, ext: 'm4a' };
  }
  if (mime === 'audio/ogg') return { mime, ext: 'ogg' };
  if (mime === 'audio/mpeg' || mime === 'audio/mp3') return { mime, ext: 'mp3' };
  return { mime, ext: 'webm' };
}

export function isVoiceAttachment(mime: string | undefined | null): boolean {
  return typeof mime === 'string' && mime.startsWith('audio/');
}

export function formatVoiceDuration(ms: number | undefined): string {
  if (!ms || ms <= 0) return '0:00';
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;
}

function hash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function voiceWaveformBars(key: string, count: number = VOICE_BAR_COUNT): number[] {
  let seed = hash(key) || 1;
  const next = (): number => {
    seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5;
    return ((seed >>> 0) % 1000) / 1000;
  };
  const out: number[] = [];
  for (let i = 0; i < count; i++) {
    const env = 0.45 + 0.5 * Math.sin((i / count) * Math.PI);
    const noise = next();
    out.push(Math.max(0.18, Math.min(1, env * (0.55 + 0.6 * noise))));
  }
  return out;
}

function rmsOfBucket(pcm: Float32Array | number[], start: number, end: number): number {
  let sum = 0;
  let n = 0;
  for (let i = start; i < end; i++) { const s = pcm[i] ?? 0; sum += s * s; n++; }
  return n > 0 ? Math.sqrt(sum / n) : 0;
}

export function voiceBucketRms(pcm: Float32Array | number[], count: number = VOICE_BAR_COUNT): number[] {
  const len = pcm.length;
  if (len === 0) throw new Error('empty PCM');
  const per = Math.max(1, Math.floor(len / count));
  const out: number[] = new Array<number>(count).fill(0);
  let max = 0;
  for (let b = 0; b < count; b++) {
    const start = b * per;
    const end = b === count - 1 ? len : Math.min(len, start + per);
    const rms = rmsOfBucket(pcm, start, end);
    out[b] = rms;
    if (rms > max) max = rms;
  }
  if (max <= 0) throw new Error('silent PCM');
  for (let b = 0; b < count; b++) out[b] = Math.max(0.06, Math.min(1, (out[b] ?? 0) / max));
  return out;
}
