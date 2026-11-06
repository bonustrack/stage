import { DeviceEventEmitter, Platform, PermissionsAndroid, type EmitterSubscription } from 'react-native';
import InCallManager from 'react-native-incall-manager';
import {
  audioRoutes,
  captureScreen,
  deviceAudioStarted,
  keptScreen,
  prepareDeviceAudio,
  previewOf,
  startDeviceAudio,
  startRingtone,
  stopDeviceAudio,
  userMedia,
  watchTrackEnd,
} from './calls.device';
import { joinedHeadset, parseAudioRoutes, speakerTarget } from './calls.route.core';
import { ignore } from './errorPolicy';
import type { CallMediaSeam, CallToken, CallTrack } from './calls.types';

let routeEvents: EmitterSubscription | null = null;

const requestBluetooth =
  Platform.OS === 'android' && Platform.Version >= 31
    ? () => PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT)
    : undefined;

function watchRoutes(): void {
  routeEvents ??= DeviceEventEmitter.addListener('onAudioDeviceChanged', (status: unknown) => {
    const before = audioRoutes.get();
    audioRoutes.set(parseAudioRoutes(status));
    const headset = joinedHeadset(before, audioRoutes.get());
    if (headset) ignore(InCallManager.chooseAudioRoute(headset), 'optional');
  });
}

function unwatchRoutes(): void {
  routeEvents?.remove();
  routeEvents = null;
}

function toggleSpeaker(): void {
  const target = speakerTarget(audioRoutes.get());
  if (!deviceAudioStarted() || target === null) return;
  ignore(
    InCallManager.chooseAudioRoute(target).then((status: unknown) => {
      if (deviceAudioStarted()) audioRoutes.set(parseAudioRoutes(status));
    }),
    'ui',
  );
}

function watchScreenEnd(video: CallTrack, ended: () => void): void {
  watchTrackEnd(video, ended, null);
}

async function displayMedia(token: CallToken): Promise<CallTrack | null> {
  const video = await captureScreen(token);
  if (!video) return null;
  watchScreenEnd(video, () => {
    video.ended = true;
  });
  return keptScreen(video, token);
}

export const callMedia: CallMediaSeam = {
  callsSupported: true,
  screenShareSupported: true,
  userMedia,
  displayMedia,
  previewOf,
  watchScreenEnd,
  watchCallLifecycle: () => () => undefined,
  prepareAudio: (token) => prepareDeviceAudio(token, requestBluetooth),
  startAudio: (video, token) => startDeviceAudio(video, token, watchRoutes),
  stopAudio: () => {
    stopDeviceAudio(unwatchRoutes);
  },
  useAudioRoutes: audioRoutes.use,
  toggleSpeaker,
  startRingtone,
};
