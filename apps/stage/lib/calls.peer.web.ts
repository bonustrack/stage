import { CALL_ICE_SERVERS } from '@stage-labs/client/xmtp/call';
import { makePeer, negotiateSdp, replaceOutgoing, type Peer, type PeerHooks } from './calls.peer.core';
import type { CallTrack, Outgoing } from './calls.types';

function webTrack(track: CallTrack | null): MediaStreamTrack | null {
  if (track === null) return null;
  if (track.platform !== 'web') throw new Error('Invalid web call track');
  return track.value;
}

function tracks(out: Outgoing): { audio: MediaStreamTrack | null; video: MediaStreamTrack | null } {
  return { audio: webTrack(out.audio), video: webTrack(out.video) };
}

export function openPeer(hooks: PeerHooks): Peer {
  const pc = new RTCPeerConnection({ iceServers: CALL_ICE_SERVERS.map((s) => ({ urls: [...s.urls] })), bundlePolicy: 'max-bundle' });
  const channel = pc.createDataChannel('media', { negotiated: true, id: 0 });
  const stream = new MediaStream();
  return makePeer(
    {
      stream: { platform: 'web', value: stream },
      bind: (events) => {
        pc.addEventListener('track', (event) => {
          stream.addTrack(event.track);
          events.track();
        });
        pc.addEventListener('connectionstatechange', () => {
          events.state(pc.connectionState);
        });
        channel.addEventListener('open', events.open);
        channel.addEventListener('close', events.close);
        channel.addEventListener('message', (event) => {
          events.message(event.data);
        });
      },
      replace: (out) => replaceOutgoing(pc, tracks(out)),
      offer: (out) => negotiateSdp(pc, () => tracks(out())),
      answer: (sdp, out) => negotiateSdp(pc, () => tracks(out()), sdp),
      accept: (sdp) => pc.setRemoteDescription({ type: 'answer', sdp }),
      send: (data) => {
        if (channel.readyState === 'open') channel.send(data);
      },
      close: () => {
        channel.close();
        pc.close();
        for (const track of stream.getTracks()) track.stop();
      },
    },
    hooks,
  );
}
