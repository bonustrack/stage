import {
  VIDEO_OFF_ABOVE, isCallInviteType, isCallSignalType, parseCallInvite, parseCallSignal,
  type CallInvite, type CallSignal,
} from '@stage-labs/client/xmtp/call';
import { reduceCall, type CallEffect, type CallEndReason, type CallEvent } from '@stage-labs/client/xmtp/callMachine';
import { subscribeAllMessages } from './xmtp.stream';
import { xmtpSendJson } from './xmtp.messages';
import { convOfLine, sdk } from './xmtp.sdk';
import { lineOfConv, type StreamMsg } from './xmtp.types';
import { CALL_INVITE_CODEC, CALL_SIGNAL_CODEC, type JsonCodec } from './xmtpJsonCodecs';
import { capabilities } from './capabilities';
import { callView, setCallView, type CallMedia, type CallPeerView } from './calls.store';
import { closePeer, createAnswer, createOffer, openPeer, sendMedia, setOutgoing, type Peer } from './calls.peer.web';
import { startRingtone } from './calls.ring.web';
import { ignore, ignored, report, reported } from './errorPolicy';

export const callsSupported = typeof RTCPeerConnection === 'function' && typeof navigator.mediaDevices?.getUserMedia === 'function';

export const screenShareSupported = typeof navigator.mediaDevices?.getDisplayMedia === 'function';

const CAMERA: MediaTrackConstraints = { width: { ideal: 640 }, height: { ideal: 360 }, frameRate: { ideal: 24 } };
const HISTORY_LIMIT = 100;
const SEEN_MAX = 2_000;

const END_TOASTS: Partial<Record<CallEndReason, string>> = {
  'ended': 'Call ended',
  'declined': 'Call declined',
  'no-answer': 'No answer',
  'missed': 'Missed call',
  'full': 'This call is full',
};

const peers = new Map<string, Peer>();
const seen = new Set<string>();
let mic: MediaStreamTrack | null = null;
let camera: MediaStreamTrack | null = null;
let screen: MediaStreamTrack | null = null;
let ticker: ReturnType<typeof setInterval> | null = null;
let stopRing: (() => void) | null = null;
let ingestQueue: Promise<void> = Promise.resolve();

function state(): ReturnType<typeof callView>['calls'] {
  return callView().calls;
}

function myMedia(): CallMedia {
  return { audio: mic?.enabled === true, video: (screen ?? camera) !== null, screen: screen !== null };
}

function outgoing(): { audio: MediaStreamTrack | null; video: MediaStreamTrack | null } {
  return { audio: mic, video: screen ?? camera };
}

function peerViews(): CallPeerView[] {
  const s = state().session;
  const roster = s ? state().calls[s.convId]?.roster ?? {} : {};
  return [...peers.entries()].map(([peerId, p]) => ({
    peerId, inboxId: roster[peerId] ?? '', stream: p.stream, media: p.media, status: p.status,
  }));
}

function publish(): void {
  const video = screen ?? camera;
  const current = callView().preview?.getVideoTracks()[0] ?? null;
  const preview = video === current ? callView().preview : video ? new MediaStream([video]) : null;
  setCallView({ media: myMedia(), peers: peerViews(), preview });
}

function syncTimers(): void {
  const s = state().session;
  if (s && !ticker) ticker = setInterval(() => { dispatch({ type: 'tick', nowMs: Date.now() }); }, 1_000);
  if (!s && ticker) { clearInterval(ticker); ticker = null; }
  const ringing = s?.phase === 'ringing';
  if (ringing && !stopRing) stopRing = startRingtone();
  if (!ringing && stopRing) { stopRing(); stopRing = null; }
}

function dispatch(event: CallEvent): void {
  const { state: next, effects } = reduceCall(state(), event);
  if (next !== state()) setCallView({ calls: next });
  for (const effect of effects) runEffect(effect).catch(reported('calls.effect'));
  syncTimers();
  publish();
}

async function send<T>(convId: string, codec: JsonCodec<T>, content: T): Promise<void> {
  try {
    await xmtpSendJson(lineOfConv(convId), codec, content);
  } catch (err) {
    report('calls.send', err);
    capabilities.toast('Call message could not be sent');
  }
}

function replacePeer(peerId: string): Peer {
  const old = peers.get(peerId);
  if (old) closePeer(old);
  const peer = openPeer(publish, myMedia);
  peers.set(peerId, peer);
  return peer;
}

async function offerTo(peerId: string): Promise<void> {
  const s = state().session;
  if (!s?.selfPeerId) return;
  const peer = replacePeer(peerId);
  const sdp = await createOffer(peer.pc, outgoing());
  if (peers.get(peerId) !== peer) return;
  const signal: CallSignal = { kind: 'offer', callId: s.callId, from: s.selfPeerId, to: peerId, sdp };
  await send(s.convId, CALL_SIGNAL_CODEC, signal);
}

async function answerTo(peerId: string, offer: string): Promise<void> {
  const s = state().session;
  if (!s?.selfPeerId) return;
  const peer = replacePeer(peerId);
  const sdp = await createAnswer(peer.pc, offer, outgoing());
  if (peers.get(peerId) !== peer) return;
  const signal: CallSignal = { kind: 'answer', callId: s.callId, from: s.selfPeerId, to: peerId, sdp };
  await send(s.convId, CALL_SIGNAL_CODEC, signal);
}

function dropPeer(peerId: string): void {
  const peer = peers.get(peerId);
  if (peer) closePeer(peer);
  peers.delete(peerId);
}

function stopTrack(track: MediaStreamTrack | null): null {
  track?.stop();
  return null;
}

function endCall(reason: CallEndReason): void {
  for (const peerId of [...peers.keys()]) dropPeer(peerId);
  mic = stopTrack(mic);
  camera = stopTrack(camera);
  screen = stopTrack(screen);
  const toast = END_TOASTS[reason];
  if (toast) capabilities.toast(toast);
}

async function runEffect(effect: CallEffect): Promise<void> {
  switch (effect.type) {
    case 'invite': return send(effect.convId, CALL_INVITE_CODEC, effect.invite);
    case 'send': return send(effect.convId, CALL_SIGNAL_CODEC, effect.signal);
    case 'offer': return offerTo(effect.peerId);
    case 'answer': return answerTo(effect.peerId, effect.sdp);
    case 'accept': return peers.get(effect.peerId)?.pc.setRemoteDescription({ type: 'answer', sdp: effect.sdp });
    case 'close': dropPeer(effect.peerId); return;
    case 'end': endCall(effect.reason);
  }
}

async function selfInboxId(): Promise<string> {
  const id = (await sdk.client()).inboxId;
  if (callView().selfInboxId !== id) setCallView({ selfInboxId: id });
  return id;
}

async function convContext(convId: string): Promise<{ dm: boolean; allowed: boolean }> {
  const conv = await convOfLine(lineOfConv(convId));
  if (!conv) return { dm: false, allowed: false };
  return { dm: !sdk.isGroup(conv), allowed: (await sdk.consentOf(conv)) === 'allowed' };
}

async function ingest(convId: string, m: StreamMsg['msg'], invite: CallInvite | null, signal: CallSignal | null): Promise<void> {
  const base = {
    convId, senderInboxId: m.senderInboxId, selfInboxId: await selfInboxId(),
    sentMs: Math.floor(m.sentNs / 1_000_000), nowMs: Date.now(),
  };
  if (signal) dispatch({ ...base, type: 'signal', signal });
  if (invite) dispatch({ ...base, type: 'invite', invite, ...(await convContext(convId)) });
}

function firstSight(id: string): boolean {
  if (seen.has(id)) return false;
  seen.add(id);
  if (seen.size > SEEN_MAX) {
    const oldest = seen.values().next().value;
    if (oldest !== undefined) seen.delete(oldest);
  }
  return true;
}

function onMessage({ convId, msg }: StreamMsg): void {
  const invite = isCallInviteType(msg.contentTypeId) ? parseCallInvite(msg.content) : null;
  const signal = isCallSignalType(msg.contentTypeId) ? parseCallSignal(msg.content) : null;
  if (!convId || (!invite && !signal) || !firstSight(msg.id)) return;
  ingestQueue = ingestQueue.then(() => ingest(convId, msg, invite, signal)).catch(reported('calls.ingest'));
}

export function startCallService(): () => void {
  if (!callsSupported) return () => undefined;
  const unsubscribe = subscribeAllMessages(onMessage);
  const onHide = (): void => { if (state().session) dispatch({ type: 'leave' }); };
  window.addEventListener('pagehide', onHide);
  return () => {
    unsubscribe();
    window.removeEventListener('pagehide', onHide);
  };
}

export async function loadCallHistory(convId: string): Promise<void> {
  if (!callsSupported) return;
  const conv = await convOfLine(lineOfConv(convId));
  if (!conv) return;
  const recent = await sdk.messages(conv, { limit: HISTORY_LIMIT, order: 'desc' });
  for (const m of recent.reverse()) onMessage({ convId, msg: sdk.rowOf(m) });
}

async function userMedia(constraints: MediaStreamConstraints): Promise<MediaStream | null> {
  try {
    return await navigator.mediaDevices.getUserMedia(constraints);
  } catch (err) {
    report('calls.media', err);
    return null;
  }
}

async function openMedia(video: boolean): Promise<boolean> {
  const stream = (video ? await userMedia({ audio: true, video: CAMERA }) : null) ?? await userMedia({ audio: true });
  if (!stream) {
    capabilities.toast('Allow microphone access to join the call');
    return false;
  }
  mic = stream.getAudioTracks()[0] ?? null;
  camera = stream.getVideoTracks()[0] ?? null;
  return true;
}

function newId(): string {
  return crypto.randomUUID();
}

export async function startCall(convId: string, dm: boolean, video: boolean): Promise<void> {
  if (state().session || !(await openMedia(video))) return;
  dispatch({ type: 'start', convId, dm, video, callId: newId(), peerId: newId(), selfInboxId: await selfInboxId(), nowMs: Date.now() });
  if (state().session?.convId !== convId) endCall('left');
}

export async function joinCall(convId: string, dm: boolean): Promise<void> {
  const info = state().calls[convId];
  const crowded = Object.keys(info?.roster ?? {}).length >= VIDEO_OFF_ABOVE;
  if (!info || !(await openMedia(info.video && !crowded))) return;
  dispatch({ type: 'join', convId, dm, peerId: newId(), selfInboxId: await selfInboxId(), nowMs: Date.now() });
  if (state().session?.phase !== 'joined') endCall('left');
}

export function declineCall(): void {
  dispatch({ type: 'decline' });
}

export function leaveCall(): void {
  dispatch({ type: 'leave' });
}

async function pushMedia(): Promise<void> {
  const out = outgoing();
  await Promise.all([...peers.values()].map((p) => setOutgoing(p.pc, out)));
  for (const p of peers.values()) sendMedia(p, myMedia());
  publish();
}

export function toggleMic(): void {
  if (!mic) return;
  mic.enabled = !mic.enabled;
  ignore(pushMedia(), 'ui');
}

export async function toggleCamera(): Promise<void> {
  if (camera) {
    camera = stopTrack(camera);
  } else {
    const stream = await userMedia({ video: CAMERA });
    if (!stream) { capabilities.toast('Allow camera access to turn on video'); return; }
    camera = stream.getVideoTracks()[0] ?? null;
  }
  await pushMedia();
}

export async function toggleScreen(): Promise<void> {
  if (screen) {
    screen = stopTrack(screen);
  } else {
    const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false })
      .catch(ignored<MediaStream | null>(null, 'optional'));
    const track = stream?.getVideoTracks()[0] ?? null;
    if (!track) return;
    track.addEventListener('ended', () => {
      if (screen !== track) return;
      screen = null;
      ignore(pushMedia(), 'ui');
    });
    screen = track;
  }
  await pushMedia();
}
