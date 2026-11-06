import { MediaStream, RTCPeerConnection, type MediaStreamTrack } from 'react-native-webrtc';
import { openRtcPeer, type Peer, type PeerHooks } from './calls.peer.core';
import type { CallTrack } from './calls.types';

function nativeTrack(track: CallTrack | null): MediaStreamTrack | null {
  if (track === null) return null;
  if (track.platform !== 'native') throw new Error('Invalid native call track');
  return track.value;
}

export function openPeer(hooks: PeerHooks): Peer {
  return openRtcPeer(
    {
      connect: (config) => new RTCPeerConnection(config),
      remote: () => {
        const stream = new MediaStream();
        return {
          stream: { platform: 'native', value: stream },
          add: (track) => {
            stream.addTrack(track);
          },
          release: () => {
            stream.release(false);
          },
        };
      },
      track: nativeTrack,
    },
    hooks,
  );
}
