import { CALL_ICE_GATHER_MS } from '@stage-labs/client/xmtp/call';
import { NO_MEDIA, type CallLinkStatus, type CallMedia } from './calls.store';
import type { CallStream, Outgoing } from './calls.types';

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

export interface PeerHooks { onChange: () => void; mine: () => CallMedia; onLost: () => void }

export function parseMedia(data: unknown): CallMedia | null {
  if (typeof data !== 'string') return null;
  try {
    const m: unknown = JSON.parse(data);
    if (!m || typeof m !== 'object') return null;
    return { audio: 'audio' in m && m.audio === true, video: 'video' in m && m.video === true, screen: 'screen' in m && m.screen === true };
  } catch {
    return null;
  }
}

export function makePeer(transport: PeerTransport, { onChange, mine, onLost }: PeerHooks): Peer {
  const peer: Peer = { ...transport, media: NO_MEDIA, status: 'connecting', closed: false };
  let wasUp = false;
  const lost = (): void => { if (wasUp && !peer.closed) { peer.closed = true; onLost(); } };
  transport.bind({
    track: onChange,
    state: state => {
      peer.status = state === 'connected' ? 'connected' : state === 'failed' || state === 'closed' ? 'failed' : 'connecting';
      if (state === 'connected') wasUp = true;
      if (state === 'failed') lost();
      onChange();
    },
    open: () => { wasUp = true; sendMedia(peer, mine()); },
    close: lost,
    message: data => {
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
  return new Promise(resolve => {
    const done = (): void => { clearTimeout(timer); pc.removeEventListener('icegatheringstatechange', check); resolve(); };
    const check = (): void => { if (pc.iceGatheringState === 'complete') done(); };
    const timer = setTimeout(done, CALL_ICE_GATHER_MS);
    pc.addEventListener('icegatheringstatechange', check);
  });
}

export async function negotiateSdp<Track>(pc: Connection<Track>, out: () => { audio: Track | null; video: Track | null }, offer?: string): Promise<string> {
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
