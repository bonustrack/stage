import { Platform } from 'react-native';
import InCallManager from 'react-native-incall-manager';
import { nativeCalls } from '../modules/stage-calls';
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
import { speakerTarget } from './calls.route.core';
import { report } from './errorPolicy';
import { stopTrack, type CallMediaSeam, type CallToken, type CallTrack, type ScreenPicker } from './calls.types';

const PICKER_TIMEOUT_MS = 30_000;
let cancelPicker: (() => void) | null = null;

function pickScreen(picker: ScreenPicker | null): Promise<boolean> {
  if (!picker) return Promise.resolve(false);
  cancelPicker?.();
  return new Promise((resolve) => {
    let finished = false;
    const finish = (started: boolean): void => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      subscription.remove();
      cancelPicker = null;
      resolve(started);
    };
    const subscription = nativeCalls.addListener('onScreenShare', (event) => {
      finish(event.started);
    });
    const timer = setTimeout(() => {
      finish(false);
    }, PICKER_TIMEOUT_MS);
    cancelPicker = () => {
      finish(false);
    };
    try {
      picker.show();
    } catch (error) {
      finish(false);
      report('calls.picker', error);
    }
  });
}

function watchScreenEnd(video: CallTrack, ended: () => void): void {
  watchTrackEnd(video, ended, (onEnd) =>
    nativeCalls.addListener('onScreenShare', (event) => {
      if (!event.started) onEnd();
    }),
  );
}

async function displayMedia(token: CallToken, picker: ScreenPicker | null): Promise<CallTrack | null> {
  const video = await captureScreen(token);
  if (!video) return null;
  watchScreenEnd(video, () => {
    video.ended = true;
  });
  try {
    if (!(await pickScreen(picker))) {
      stopTrack(video);
      return null;
    }
    return keptScreen(video, token);
  } catch (error) {
    stopTrack(video);
    report('calls.screen', error);
    return null;
  }
}

function watchRoutes(video: boolean): void {
  const pad = Platform.OS === 'ios' && Platform.isPad;
  audioRoutes.set({ available: pad ? ['SPEAKER_PHONE'] : ['EARPIECE', 'SPEAKER_PHONE'], selected: video ? 'SPEAKER_PHONE' : 'EARPIECE' });
}

function toggleSpeaker(): void {
  const target = speakerTarget(audioRoutes.get());
  if (!deviceAudioStarted() || target === null) return;
  InCallManager.setForceSpeakerphoneOn(target === 'SPEAKER_PHONE');
  audioRoutes.set({ ...audioRoutes.get(), selected: target });
}

export const callMedia: CallMediaSeam = {
  callsSupported: true,
  screenShareSupported: true,
  userMedia,
  displayMedia,
  previewOf,
  watchScreenEnd,
  watchCallLifecycle: () => () => undefined,
  prepareAudio: (token) => prepareDeviceAudio(token),
  startAudio: (video, token) => startDeviceAudio(video, token, watchRoutes),
  stopAudio: () => {
    cancelPicker?.();
    stopDeviceAudio(() => undefined);
  },
  useAudioRoutes: audioRoutes.use,
  toggleSpeaker,
  startRingtone,
};
