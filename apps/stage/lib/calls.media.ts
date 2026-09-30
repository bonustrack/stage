import { Platform, PermissionsAndroid } from 'react-native';
import { MediaStream, mediaDevices, type MediaStreamTrack } from 'react-native-webrtc';
import InCallManager from 'react-native-incall-manager';
import { setIsAudioActiveAsync } from 'expo-audio';
import { nativeCalls } from '../modules/stage-calls';
import { acquireCallAudio, callOwnsAudio, releaseCallAudio } from './calls.audio.core';
import { cancelScreenPicker, startScreenPicker } from './calls.screen';
import { ignore, ignored, report } from './errorPolicy';
import { stopTrack, type CallStream, type CallTrack, type CapturedMedia } from './calls.types';

export const callsSupported = true;
export const screenShareSupported = true;
const CAMERA = { width: 640, height: 360, frameRate: 24, facingMode: 'user' };
let audioStarted = false;
let captureEpoch = 0;
let preparing: Promise<void> | null = null;

function track(value: MediaStreamTrack | undefined): CallTrack | null {
  return value ? { platform: 'native', value } : null;
}

export async function userMedia(video: boolean, audio: boolean): Promise<CapturedMedia | null> {
  try {
    const stream = await mediaDevices.getUserMedia({ audio, video: video ? CAMERA : false });
    const media = { audio: track(stream.getAudioTracks()[0]), video: track(stream.getVideoTracks()[0]) };
    stream.release(false);
    return media;
  } catch (error) { report('calls.media', error); return null; }
}

export async function displayMedia(): Promise<CallTrack | null> {
  const epoch = captureEpoch;
  const stream = await mediaDevices.getDisplayMedia({}).catch(ignored<MediaStream | null>(null, 'optional'));
  if (!stream) return null;
  const video = track(stream.getVideoTracks()[0]);
  stream.release(false);
  if (epoch !== captureEpoch || !video) { stopTrack(video); return null; }
  try {
    if (Platform.OS === 'ios' && !await startScreenPicker()) { stopTrack(video); return null; }
    if (epoch !== captureEpoch) { stopTrack(video); return null; }
    return video;
  } catch (error) { stopTrack(video); report('calls.screen', error); return null; }
}

export function previewOf(video: CallTrack): CallStream {
  if (video.platform !== 'native') throw new Error('Invalid native preview');
  return { platform: 'native', value: new MediaStream([video.value]) };
}

export function watchScreenEnd(video: CallTrack, ended: () => void): void {
  if (video.platform !== 'native') return;
  const subscription = Platform.OS === 'ios' ? nativeCalls.addListener('onScreenShare', event => { if (!event.started) ended(); }) : null;
  video.value.addEventListener('ended', ended, { once: true });
  video.cleanup = () => { subscription?.remove(); video.value.removeEventListener('ended', ended); };
}

export function watchCallLifecycle(leave: () => void): () => void { void leave; return () => undefined; }

export function prepareAudio(): Promise<void> {
  const epoch = captureEpoch;
  preparing = acquireCallAudio().then(async () => {
    await setIsAudioActiveAsync(false);
    await new Promise(resolve => { setTimeout(resolve, 150); });
    if (epoch !== captureEpoch) throw new Error('Call was canceled');
    if (Platform.OS === 'android' && Platform.Version >= 31) {
      await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT);
    }
  });
  return preparing;
}

export async function startAudio(video: boolean): Promise<void> {
  const epoch = captureEpoch;
  await preparing;
  if (epoch !== captureEpoch) throw new Error('Call was canceled');
  await nativeCalls.start(video);
  if (epoch !== captureEpoch) { await nativeCalls.stop(); throw new Error('Call was canceled'); }
  if (!audioStarted) {
    InCallManager.start({ media: video ? 'video' : 'audio' });
    audioStarted = true;
  }
}

export function stopAudio(): void {
  captureEpoch += 1;
  cancelScreenPicker();
  const owned = callOwnsAudio();
  if (audioStarted) InCallManager.stop();
  audioStarted = false;
  releaseCallAudio();
  ignore(nativeCalls.stop(), 'cleanup');
  if (owned) ignore(restoreAudio(), 'cleanup');
}

async function restoreAudio(): Promise<void> {
  await preparing?.catch(ignored<undefined>(undefined, 'cleanup'));
  if (!callOwnsAudio()) await setIsAudioActiveAsync(true);
}
