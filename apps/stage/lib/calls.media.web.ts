import { ignore, ignored, report } from './errorPolicy';
import type { CallStream, CallTrack, CapturedMedia } from './calls.types';

export const callsSupported = typeof RTCPeerConnection === 'function' && typeof navigator.mediaDevices?.getUserMedia === 'function';
export const screenShareSupported = typeof navigator.mediaDevices?.getDisplayMedia === 'function';
const CAMERA: MediaTrackConstraints = { width: { ideal: 640 }, height: { ideal: 360 }, frameRate: { ideal: 24 } };

function track(value: MediaStreamTrack | undefined): CallTrack | null {
  return value ? { platform: 'web', value } : null;
}

export async function userMedia(video: boolean, audio: boolean): Promise<CapturedMedia | null> {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio, video: video ? CAMERA : false });
    return { audio: track(stream.getAudioTracks()[0]), video: track(stream.getVideoTracks()[0]) };
  } catch (error) {
    report('calls.media', error);
    return null;
  }
}

export async function displayMedia(): Promise<CallTrack | null> {
  const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false }).catch(ignored<MediaStream | null>(null, 'optional'));
  return track(stream?.getVideoTracks()[0]);
}

export function previewOf(video: CallTrack): CallStream {
  if (video.platform !== 'web') throw new Error('Invalid web preview');
  return { platform: 'web', value: new MediaStream([video.value]) };
}

export function watchScreenEnd(video: CallTrack, ended: () => void): void {
  if (video.platform !== 'web') return;
  video.value.addEventListener('ended', ended, { once: true });
  video.cleanup = () => { video.value.removeEventListener('ended', ended); };
  if (video.value.readyState === 'ended') ended();
}

export function watchCallLifecycle(leave: () => void): () => void {
  window.addEventListener('pagehide', leave);
  return () => { window.removeEventListener('pagehide', leave); };
}

export function prepareAudio(): Promise<void> { return Promise.resolve(); }
export function startAudio(video: boolean): Promise<void> { void video; return Promise.resolve(); }
export function stopAudio(): void { return; }

const TONE_HZ = [480, 620] as const;
const TONE_S = 0.35;
const EVERY_MS = 2_000;

export function startRingtone(): () => void {
  if (typeof AudioContext !== 'function') return () => undefined;
  const ctx = new AudioContext();
  const ring = (): void => {
    TONE_HZ.forEach((hz, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const at = ctx.currentTime + i * TONE_S;
      osc.frequency.value = hz;
      gain.gain.value = 0.06;
      osc.connect(gain).connect(ctx.destination);
      osc.start(at);
      osc.stop(at + TONE_S);
    });
  };
  ring();
  const timer = setInterval(ring, EVERY_MS);
  return () => {
    clearInterval(timer);
    ignore(ctx.close(), 'cleanup');
  };
}
