import type { MediaStream as NativeStream, MediaStreamTrack as NativeTrack } from 'react-native-webrtc';
import type { AudioRoutes } from './calls.route.core';

export type CallStream = { platform: 'web'; value: MediaStream } | { platform: 'native'; value: NativeStream };

export type CallTrack = ({ platform: 'web'; value: MediaStreamTrack } | { platform: 'native'; value: NativeTrack }) & {
  cleanup?: () => void;
  ended?: boolean;
};

export interface Outgoing {
  audio: CallTrack | null;
  video: CallTrack | null;
}

export interface CapturedMedia {
  audio: CallTrack | null;
  video: CallTrack | null;
}

export interface CallToken {
  live: () => boolean;
}

export interface ScreenPicker {
  show: () => void;
}

export interface CallMediaPort {
  userMedia: (video: boolean, audio: boolean) => Promise<CapturedMedia | null>;
  displayMedia: (token: CallToken, picker: ScreenPicker | null) => Promise<CallTrack | null>;
  previewOf: (video: CallTrack) => CallStream;
  watchScreenEnd: (video: CallTrack, ended: () => void) => void;
  prepareAudio: (token: CallToken) => Promise<void>;
  startAudio: (video: boolean, token: CallToken) => Promise<void>;
  stopAudio: () => void;
  startRingtone: () => () => void;
}

export interface CallMediaSeam extends CallMediaPort {
  callsSupported: boolean;
  screenShareSupported: boolean;
  watchCallLifecycle: (leave: () => void) => () => void;
  useAudioRoutes: () => AudioRoutes;
  toggleSpeaker: () => void;
}

export function stopTrack(track: CallTrack | null): null {
  if (track) {
    track.cleanup?.();
    track.value.stop();
    if (track.platform === 'native') track.value.release();
  }
  return null;
}

export function stopMedia(media: CapturedMedia): void {
  stopTrack(media.audio);
  stopTrack(media.video);
}

export function releaseStream(stream: CallStream | null): void {
  if (stream?.platform === 'native') stream.value.release(false);
}
