import { CALL_ICE_GATHER_MS, CALL_ICE_SERVERS } from '@stage-labs/client/xmtp/call';
import { NO_MEDIA, type CallLinkStatus, type CallMedia } from './calls.store';

export interface Outgoing { audio: MediaStreamTrack | null; video: MediaStreamTrack | null }

export interface Peer {
  pc: RTCPeerConnection;
  stream: MediaStream;
  channel: RTCDataChannel;
  media: CallMedia;
  status: CallLinkStatus;
  closed: boolean;
}

interface PeerHooks {
  onChange: () => void;
  mine: () => CallMedia;
  onLost: () => void;
}

const KINDS = ['audio', 'video'] as const;

function statusOf(state: RTCPeerConnectionState): CallLinkStatus {
  if (state === 'connected') return 'connected';
  return state === 'failed' || state === 'closed' ? 'failed' : 'connecting';
}

function parseMedia(data: unknown): CallMedia | null {
  if (typeof data !== 'string') return null;
  try {
    const m = JSON.parse(data) as Partial<CallMedia>;
    return { audio: m.audio === true, video: m.video === true, screen: m.screen === true };
  } catch {
    return null;
  }
}

export function openPeer({ onChange, mine, onLost }: PeerHooks): Peer {
  const pc = new RTCPeerConnection({ iceServers: CALL_ICE_SERVERS.map((s) => ({ urls: [...s.urls] })), bundlePolicy: 'max-bundle' });
  const channel = pc.createDataChannel('media', { negotiated: true, id: 0 });
  const peer: Peer = { pc, stream: new MediaStream(), channel, media: NO_MEDIA, status: 'connecting', closed: false };
  let wasUp = false;
  const lostIfUp = (): void => { if (wasUp && !peer.closed) { peer.closed = true; onLost(); } };
  pc.ontrack = (e) => { peer.stream.addTrack(e.track); onChange(); };
  pc.onconnectionstatechange = () => {
    peer.status = statusOf(pc.connectionState);
    if (pc.connectionState === 'connected') wasUp = true;
    if (pc.connectionState === 'failed') lostIfUp();
    onChange();
  };
  channel.onopen = () => { wasUp = true; sendMedia(peer, mine()); };
  channel.onclose = lostIfUp;
  channel.onmessage = (e: MessageEvent) => {
    const media = parseMedia(e.data);
    if (media === null) return;
    peer.media = media;
    onChange();
  };
  return peer;
}

export function sendMedia(peer: Peer, media: CallMedia): void {
  if (peer.channel.readyState === 'open') peer.channel.send(JSON.stringify(media));
}

export async function setOutgoing(pc: RTCPeerConnection, out: Outgoing): Promise<void> {
  for (const t of pc.getTransceivers()) {
    const kind = t.receiver.track.kind;
    if (kind === 'audio' || kind === 'video') await t.sender.replaceTrack(out[kind]);
  }
}

function gathered(pc: RTCPeerConnection): Promise<void> {
  if (pc.iceGatheringState === 'complete') return Promise.resolve();
  return new Promise((resolve) => {
    const done = (): void => {
      clearTimeout(timer);
      pc.removeEventListener('icegatheringstatechange', check);
      resolve();
    };
    const check = (): void => { if (pc.iceGatheringState === 'complete') done(); };
    const timer = setTimeout(done, CALL_ICE_GATHER_MS);
    pc.addEventListener('icegatheringstatechange', check);
  });
}

async function localSdp(pc: RTCPeerConnection): Promise<string> {
  await pc.setLocalDescription();
  await gathered(pc);
  const sdp = pc.localDescription?.sdp;
  if (!sdp) throw new Error('No local description');
  return sdp;
}

export async function createOffer(pc: RTCPeerConnection, out: () => Outgoing): Promise<string> {
  for (const kind of KINDS) pc.addTransceiver(kind, { direction: 'sendrecv' });
  await setOutgoing(pc, out());
  return localSdp(pc);
}

export async function createAnswer(pc: RTCPeerConnection, offer: string, out: () => Outgoing): Promise<string> {
  await pc.setRemoteDescription({ type: 'offer', sdp: offer });
  for (const t of pc.getTransceivers()) t.direction = 'sendrecv';
  await setOutgoing(pc, out());
  return localSdp(pc);
}

export function closePeer(peer: Peer): void {
  peer.closed = true;
  peer.channel.close();
  peer.pc.close();
  for (const track of peer.stream.getTracks()) track.stop();
}
