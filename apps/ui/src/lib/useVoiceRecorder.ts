
import { ref } from 'vue';
import { voiceMimeAndExt, voiceFilename } from '@stage-labs/client/xmtp/voice';
import { xmtpSendAttachment } from './xmtpSend';

function pickRecorderMime(): string {
  const candidates = ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus'];
  const supported = typeof MediaRecorder !== 'undefined' && typeof MediaRecorder.isTypeSupported === 'function';
  if (supported) {
    for (const c of candidates) if (MediaRecorder.isTypeSupported(c)) return c;
  }
  return '';
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (): void => {
      const r = reader.result;
      if (typeof r !== 'string') { reject(new Error('FileReader returned non-string')); return; }
      const comma = r.indexOf(',');
      resolve(comma === -1 ? r : r.slice(comma + 1));
    };
    reader.onerror = (): void => { reject(reader.error ?? new Error('FileReader failed')); };
    reader.readAsDataURL(blob);
  });
}

function rmsLevel(buf: Uint8Array): number {
  let sum = 0;
  for (const sample of buf) { const v = sample - 128; sum += v * v; }
  const rms = Math.sqrt(sum / buf.length) / 128;
  return Math.max(0.05, Math.min(1, rms * 3));
}

export function useVoiceRecorder(getLine: () => string, onError: (m: string) => void) {
  const recording = ref(false);
  const seconds = ref(0);
  const levels = ref<number[]>([]);

  let media: MediaRecorder | null = null;
  let stream: MediaStream | null = null;
  let chunks: Blob[] = [];
  let timer: ReturnType<typeof setInterval> | null = null;
  let audioCtx: AudioContext | null = null;
  let analyser: AnalyserNode | null = null;
  let raf = 0;
  let cancelled = false;

  function stopMeter(): void {
    if (raf) { cancelAnimationFrame(raf); raf = 0; }
    void audioCtx?.close().catch(() => undefined);
    audioCtx = null;
    analyser = null;
  }

  function startMeter(src: MediaStream): void {
    try {
      audioCtx = new window.AudioContext();
      const node = audioCtx.createMediaStreamSource(src);
      analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      node.connect(analyser);
      const buf = new Uint8Array(analyser.frequencyBinCount);
      const tick = (): void => {
        if (!analyser) return;
        analyser.getByteTimeDomainData(buf);
        levels.value = [...levels.value, rmsLevel(buf)].slice(-40);
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    } catch { }
  }

  function teardown(): void {
    if (timer) { clearInterval(timer); timer = null; }
    stopMeter();
    stream?.getTracks().forEach(t => { t.stop(); });
    stream = null;
    media = null;
    recording.value = false;
    seconds.value = 0;
    levels.value = [];
  }

  async function finalize(): Promise<void> {
    const rec = media;
    const wasCancelled = cancelled;
    const recorderMime = rec?.mimeType ?? 'audio/webm';
    const captured = chunks;
    teardown();
    chunks = [];
    if (wasCancelled || captured.length === 0) return;
    const { mime, ext } = voiceMimeAndExt(recorderMime);
    const blob = new Blob(captured, { type: mime });
    const dataB64 = await blobToBase64(blob);
    try {
      await xmtpSendAttachment(getLine(), voiceFilename(Date.now(), ext), mime, dataB64);
    } catch (e) { onError((e as Error).message); }
  }

  async function start(): Promise<void> {
    if (recording.value) return;
    cancelled = false;
    chunks = [];
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      onError('Voice recording is not supported in this browser.');
      return;
    }
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      onError('Microphone permission denied.');
      return;
    }
    const mime = pickRecorderMime();
    media = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
    media.ondataavailable = (ev): void => { if (ev.data.size > 0) chunks.push(ev.data); };
    media.onstop = (): void => { void finalize(); };
    media.start();
    recording.value = true;
    seconds.value = 0;
    levels.value = [];
    startMeter(stream);
    timer = setInterval(() => { seconds.value += 1; }, 1000);
  }

  function stopAndSend(): void {
    if (!media || !recording.value) return;
    cancelled = false;
    media.stop();
  }

  function cancel(): void {
    if (!media || !recording.value) { teardown(); return; }
    cancelled = true;
    media.stop();
  }

  return { recording, seconds, levels, start, stopAndSend, cancel };
}
