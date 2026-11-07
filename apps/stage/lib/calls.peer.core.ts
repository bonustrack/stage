import { CALL_ICE_GATHER_MS, CALL_ICE_SERVERS } from '@stage-labs/client/xmtp/call';
import { NO_MEDIA, type CallLinkStatus, type CallMedia } from './calls.store';
import type { CallStream, CallTrack, Outgoing } from './calls.types';
import { z } from 'zod';
import { jsonWith } from './storeCore';

interface TransportHooks {
  track: () => void;
  state: (state: string) => void;
  open: () => void;
  close: () => void;
  message: (data: unknown) => void;
}

export interface PeerTransport {
  stream: CallStream;
  bind: (hooks: TransportHooks) => void;
  replace: (out: Outgoing) => Promise<void>;
  offer: (out: () => Outgoing) => Promise<string>;
  answer: (sdp: string, out: () => Outgoing) => Promise<string>;
  accept: (sdp: string) => Promise<void>;
  send: (data: string) => void;
  close: () => void;
}

export interface Peer extends PeerTransport {
  media: CallMedia;
  status: CallLinkStatus;
  closed: boolean;
}

export interface PeerHooks {
  onChange: () => void;
  mine: () => CallMedia;
  onLost: () => void;
}

const callMediaSchema = z
  .custom<{ audio?: unknown; video?: unknown; screen?: unknown }>((value) => value !== null && typeof value === 'object')
  .transform((m): CallMedia => ({ audio: m.audio === true, video: m.video === true, screen: m.screen === true }));

const parseMediaJson = jsonWith(callMediaSchema);

export function parseMedia(data: unknown): CallMedia | null {
  return typeof data === 'string' ? (parseMediaJson(data) ?? null) : null;
}

export function makePeer(transport: PeerTransport, { onChange, mine, onLost }: PeerHooks): Peer {
  const peer: Peer = { ...transport, media: NO_MEDIA, status: 'connecting', closed: false };
  let wasUp = false;
  const lost = (): void => {
    if (wasUp && !peer.closed) {
      peer.closed = true;
      onLost();
    }
  };
  transport.bind({
    track: onChange,
    state: (state) => {
      peer.status = state === 'connected' ? 'connected' : state === 'failed' || state === 'closed' ? 'failed' : 'connecting';
      if (state === 'connected') wasUp = true;
      if (state === 'failed') lost();
      onChange();
    },
    open: () => {
      wasUp = true;
      sendMedia(peer, mine());
    },
    close: lost,
    message: (data) => {
      const media = parseMedia(data);
      if (!media) return;
      peer.media = media;
      onChange();
    },
  });
  return peer;
}

export function sendMedia(peer: Peer, media: CallMedia): void {
  peer.send(JSON.stringify(media));
}

export function closePeer(peer: Peer): void {
  peer.closed = true;
  peer.close();
}

interface Transceiver<Track> {
  receiver: { track: { kind: string } | null | undefined };
  sender: { replaceTrack: (track: Track | null) => Promise<void> };
  direction: string;
}

interface Connection<Track> {
  addTransceiver: (kind: 'audio' | 'video', init: { direction: 'sendrecv' }) => unknown;
  getTransceivers: () => Transceiver<Track>[];
  setLocalDescription: () => Promise<void>;
  setRemoteDescription: (sdp: { type: 'offer' | 'answer'; sdp: string }) => Promise<void>;
  iceGatheringState: string;
  localDescription: { sdp: string } | null;
  addEventListener: (event: 'icegatheringstatechange', listener: () => void) => void;
  removeEventListener: (event: 'icegatheringstatechange', listener: () => void) => void;
}

export async function replaceOutgoing<Track>(pc: Connection<Track>, out: { audio: Track | null; video: Track | null }): Promise<void> {
  for (const t of pc.getTransceivers()) {
    const kind = t.receiver.track?.kind;
    if (kind === 'audio' || kind === 'video') await t.sender.replaceTrack(out[kind]);
  }
}

function gathered<Track>(pc: Connection<Track>): Promise<void> {
  if (pc.iceGatheringState === 'complete') return Promise.resolve();
  return new Promise((resolve) => {
    const done = (): void => {
      clearTimeout(timer);
      pc.removeEventListener('icegatheringstatechange', check);
      resolve();
    };
    const check = (): void => {
      if (pc.iceGatheringState === 'complete') done();
    };
    const timer = setTimeout(done, CALL_ICE_GATHER_MS);
    pc.addEventListener('icegatheringstatechange', check);
  });
}

export async function negotiateSdp<Track>(
  pc: Connection<Track>,
  out: () => { audio: Track | null; video: Track | null },
  offer?: string,
): Promise<string> {
  if (offer === undefined) {
    for (const kind of ['audio', 'video'] as const) pc.addTransceiver(kind, { direction: 'sendrecv' });
  } else {
    await pc.setRemoteDescription({ type: 'offer', sdp: offer });
    for (const t of pc.getTransceivers()) t.direction = 'sendrecv';
  }
  await replaceOutgoing(pc, out());
  await pc.setLocalDescription();
  await gathered(pc);
  const sdp = pc.localDescription?.sdp;
  if (!sdp) throw new Error('No local description');
  return sdp;
}

interface RtcChannel {
  readonly readyState: string;
  send(data: string): void;
  close(): void;
  addEventListener(type: 'open' | 'close', listener: () => void): void;
  addEventListener(type: 'message', listener: (event: { data: unknown }) => void): void;
}

interface RtcConnection<Track> extends Connection<Track> {
  readonly connectionState: string;
  createDataChannel(label: string, init: { negotiated: boolean; id: number }): RtcChannel;
  addEventListener(type: 'track', listener: (event: { track: Track | null }) => void): void;
  addEventListener(type: 'connectionstatechange' | 'icegatheringstatechange', listener: () => void): void;
  close(): void;
}

export interface RtcPlatform<Track> {
  connect: (config: { iceServers: { urls: string[] }[]; bundlePolicy: 'max-bundle' }) => RtcConnection<Track>;
  remote: () => { stream: CallStream; add: (track: Track) => void; release: () => void };
  track: (track: CallTrack | null) => Track | null;
}

export function openRtcPeer<Track>(platform: RtcPlatform<Track>, hooks: PeerHooks): Peer {
  const pc = platform.connect({ iceServers: CALL_ICE_SERVERS.map((s) => ({ urls: [...s.urls] })), bundlePolicy: 'max-bundle' });
  const channel = pc.createDataChannel('media', { negotiated: true, id: 0 });
  const remote = platform.remote();
  const tracks = (out: Outgoing): { audio: Track | null; video: Track | null } => ({
    audio: platform.track(out.audio),
    video: platform.track(out.video),
  });
  return makePeer(
    {
      stream: remote.stream,
      bind: (events) => {
        pc.addEventListener('track', (event) => {
          if (event.track) remote.add(event.track);
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
        remote.release();
      },
    },
    hooks,
  );
}
