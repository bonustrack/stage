import type { MediaStream as NativeStream, MediaStreamTrack as NativeTrack } from 'react-native-webrtc';

export type CallStream = { platform: 'web'; value: MediaStream } | { platform: 'native'; value: NativeStream };

export type CallTrack = ({ platform: 'web'; value: MediaStreamTrack } | { platform: 'native'; value: NativeTrack }) & { cleanup?: () => void; ended?: boolean };

export interface Outgoing { audio: CallTrack | null; video: CallTrack | null }

export interface CapturedMedia { audio: CallTrack | null; video: CallTrack | null }

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
