import { MediaStream, mediaDevices, type MediaStreamTrack } from 'react-native-webrtc';
import InCallManager from 'react-native-incall-manager';
import { setIsAudioActiveAsync } from 'expo-audio';
import { sleep } from '@stage-labs/client/timing';
import { nativeCalls } from '../modules/stage-calls';
import { acquireCallAudio, callOwnsAudio, releaseCallAudio } from './calls.audio.core';
import { NO_ROUTES, type AudioRoutes } from './calls.route.core';
import { ignore, ignored, report } from './errorPolicy';
import { makeValue } from './storeCore';
import { stopMedia, stopTrack, type CallStream, type CallToken, type CallTrack, type CapturedMedia } from './calls.types';

const AUDIO_RELEASE_MS = 150;
const CAMERA = { width: 640, height: 360, frameRate: 24, facingMode: 'user' };
let audioStarted = false;
let preparing: Promise<void> | null = null;

export const audioRoutes = makeValue<AudioRoutes>(NO_ROUTES);

export function deviceAudioStarted(): boolean {
  return audioStarted;
}

function track(value: MediaStreamTrack | undefined): CallTrack | null {
  return value ? { platform: 'native', value } : null;
}

export async function userMedia(video: boolean, audio: boolean): Promise<CapturedMedia | null> {
  try {
    const stream = await mediaDevices.getUserMedia({ audio, video: video ? CAMERA : false });
    const media = { audio: track(stream.getAudioTracks()[0]), video: track(stream.getVideoTracks()[0]) };
    stream.release(false);
    if (audio && !media.audio) {
      stopMedia(media);
      return null;
    }
    return media;
  } catch (error) {
    report('calls.media', error);
    return null;
  }
}

export async function captureScreen(token: CallToken): Promise<CallTrack | null> {
  const stream = await mediaDevices.getDisplayMedia({}).catch(ignored<MediaStream | null>(null, 'optional'));
  if (!stream) return null;
  const video = track(stream.getVideoTracks()[0]);
  stream.release(false);
  if (!token.live() || !video) {
    stopTrack(video);
    return null;
  }
  return video;
}

export function keptScreen(video: CallTrack, token: CallToken): CallTrack | null {
  if (token.live() && !video.ended && video.value.readyState !== 'ended') return video;
  stopTrack(video);
  return null;
}

export function previewOf(video: CallTrack): CallStream {
  if (video.platform !== 'native') throw new Error('Invalid native preview');
  return { platform: 'native', value: new MediaStream([video.value]) };
}

export function watchTrackEnd(video: CallTrack, ended: () => void, also: ((onEnd: () => void) => { remove: () => void }) | null): void {
  if (video.platform !== 'native') return;
  video.cleanup?.();
  const onEnd = (): void => {
    video.ended = true;
    ended();
  };
  const subscription = also?.(onEnd) ?? null;
  video.value.addEventListener('ended', onEnd, { once: true });
  video.cleanup = () => {
    subscription?.remove();
    video.value.removeEventListener('ended', onEnd);
  };
  if (video.ended || video.value.readyState === 'ended') onEnd();
}

export function prepareDeviceAudio(token: CallToken, permit?: () => Promise<unknown>): Promise<void> {
  preparing = acquireCallAudio().then(async () => {
    await setIsAudioActiveAsync(false);
    await sleep(AUDIO_RELEASE_MS);
    if (!token.live()) throw new Error('Call was canceled');
    if (permit) await permit();
  });
  return preparing;
}

export async function startDeviceAudio(video: boolean, token: CallToken, watchRoutes: (video: boolean) => void): Promise<void> {
  await preparing;
  if (!token.live()) throw new Error('Call was canceled');
  await nativeCalls.start(video);
  if (!token.live()) {
    await nativeCalls.stop();
    throw new Error('Call was canceled');
  }
  if (!audioStarted) {
    watchRoutes(video);
    InCallManager.start({ media: video ? 'video' : 'audio' });
    audioStarted = true;
  }
}

export function stopDeviceAudio(unwatchRoutes: () => void): void {
  const owned = callOwnsAudio();
  if (audioStarted) InCallManager.stop();
  audioStarted = false;
  unwatchRoutes();
  audioRoutes.set(NO_ROUTES);
  releaseCallAudio();
  ignore(nativeCalls.stop(), 'cleanup');
  if (owned) ignore(restoreAudio(), 'cleanup');
}

async function restoreAudio(): Promise<void> {
  await preparing?.catch(ignored<undefined>(undefined, 'cleanup'));
  if (!callOwnsAudio()) await setIsAudioActiveAsync(true);
}

export function startRingtone(): () => void {
  InCallManager.startRingtone('_BUNDLE_', [0, 350, 1_700], 'default', 0);
  return () => {
    InCallManager.stopRingtone();
  };
}
