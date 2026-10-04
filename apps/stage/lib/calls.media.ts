import { DeviceEventEmitter, Platform, PermissionsAndroid, type EmitterSubscription } from 'react-native';
import { MediaStream, mediaDevices, type MediaStreamTrack } from 'react-native-webrtc';
import InCallManager from 'react-native-incall-manager';
import { setIsAudioActiveAsync } from 'expo-audio';
import { nativeCalls } from '../modules/stage-calls';
import { acquireCallAudio, callOwnsAudio, releaseCallAudio } from './calls.audio.core';
import { NO_ROUTES, joinedHeadset, parseAudioRoutes, speakerTarget, type AudioRoutes } from './calls.route.core';
import { cancelScreenPicker, startScreenPicker } from './calls.screen';
import { ignore, ignored, report } from './errorPolicy';
import { makeValue } from './storeCore';
import { stopMedia, stopTrack, type CallStream, type CallTrack, type CapturedMedia } from './calls.types';

export const callsSupported = true;
export const screenShareSupported = true;
const CAMERA = { width: 640, height: 360, frameRate: 24, facingMode: 'user' };
let audioStarted = false;
let captureEpoch = 0;
let preparing: Promise<void> | null = null;
let routeEvents: EmitterSubscription | null = null;
const routes = makeValue<AudioRoutes>(NO_ROUTES);

export const useAudioRoutes = routes.use;

function track(value: MediaStreamTrack | undefined): CallTrack | null {
  return value ? { platform: 'native', value } : null;
}

export async function userMedia(video: boolean, audio: boolean): Promise<CapturedMedia | null> {
  try {
    const stream = await mediaDevices.getUserMedia({ audio, video: video ? CAMERA : false });
    const media = { audio: track(stream.getAudioTracks()[0]), video: track(stream.getVideoTracks()[0]) };
    stream.release(false);
    if (audio && !media.audio) { stopMedia(media); return null; }
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
  watchScreenEnd(video, () => { video.ended = true; });
  try {
    if (Platform.OS === 'ios' && !await startScreenPicker()) { stopTrack(video); return null; }
    if (epoch !== captureEpoch || video.ended || video.value.readyState === 'ended') { stopTrack(video); return null; }
    return video;
  } catch (error) { stopTrack(video); report('calls.screen', error); return null; }
}

export function previewOf(video: CallTrack): CallStream {
  if (video.platform !== 'native') throw new Error('Invalid native preview');
  return { platform: 'native', value: new MediaStream([video.value]) };
}

export function watchScreenEnd(video: CallTrack, ended: () => void): void {
  if (video.platform !== 'native') return;
  video.cleanup?.();
  const onEnd = (): void => { video.ended = true; ended(); };
  const subscription = Platform.OS === 'ios' ? nativeCalls.addListener('onScreenShare', event => { if (!event.started) onEnd(); }) : null;
  video.value.addEventListener('ended', onEnd, { once: true });
  video.cleanup = () => { subscription?.remove(); video.value.removeEventListener('ended', onEnd); };
  if (video.ended || video.value.readyState === 'ended') onEnd();
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
    watchRoutes(video);
    InCallManager.start({ media: video ? 'video' : 'audio' });
    audioStarted = true;
  }
}

function watchRoutes(video: boolean): void {
  if (Platform.OS === 'ios') {
    routes.set({ available: Platform.isPad ? ['SPEAKER_PHONE'] : ['EARPIECE', 'SPEAKER_PHONE'], selected: video ? 'SPEAKER_PHONE' : 'EARPIECE' });
    return;
  }
  routeEvents ??= DeviceEventEmitter.addListener('onAudioDeviceChanged', (status: unknown) => {
    const before = routes.get();
    routes.set(parseAudioRoutes(status));
    const headset = joinedHeadset(before, routes.get());
    if (headset) ignore(InCallManager.chooseAudioRoute(headset), 'optional');
  });
}

export function toggleSpeaker(): void {
  const target = speakerTarget(routes.get());
  if (!audioStarted || target === null) return;
  if (Platform.OS === 'ios') {
    InCallManager.setForceSpeakerphoneOn(target === 'SPEAKER_PHONE');
    routes.set({ ...routes.get(), selected: target });
    return;
  }
  ignore(InCallManager.chooseAudioRoute(target).then((status: unknown) => { if (audioStarted) routes.set(parseAudioRoutes(status)); }), 'ui');
}

export function stopAudio(): void {
  captureEpoch += 1;
  cancelScreenPicker();
  const owned = callOwnsAudio();
  if (audioStarted) InCallManager.stop();
  audioStarted = false;
  routeEvents?.remove();
  routeEvents = null;
  routes.set(NO_ROUTES);
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
  return () => { InCallManager.stopRingtone(); };
}
