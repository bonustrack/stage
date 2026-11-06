import { openRtcPeer, type Peer, type PeerHooks } from './calls.peer.core';
import type { CallTrack } from './calls.types';

function webTrack(track: CallTrack | null): MediaStreamTrack | null {
  if (track === null) return null;
  if (track.platform !== 'web') throw new Error('Invalid web call track');
  return track.value;
}

export function openPeer(hooks: PeerHooks): Peer {
  return openRtcPeer(
    {
      connect: (config) => new RTCPeerConnection(config),
      remote: () => {
        const stream = new MediaStream();
        return {
          stream: { platform: 'web', value: stream },
          add: (track) => {
            stream.addTrack(track);
          },
          release: () => {
            for (const track of stream.getTracks()) track.stop();
          },
        };
      },
      track: webTrack,
    },
    hooks,
  );
}
