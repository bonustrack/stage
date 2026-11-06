import { reduceCall, type CallEffect, type CallEndReason, type CallEvent, type CallsState } from '@stage-labs/client/xmtp/callMachine';
import { CALL_INVITE_CODEC, CALL_SIGNAL_CODEC } from '@stage-labs/client/xmtp/jsonCodecs';
import type { JsonCodec } from '@stage-labs/client/xmtp/jsonCodec';
import type { CallMedia, CallPeerView, CallView } from './calls.store';
import { closePeer, sendMedia, type Peer, type PeerHooks } from './calls.peer.core';
import { releaseStream, stopTrack, type CallMediaPort, type CallToken, type CallTrack, type Outgoing } from './calls.types';
import type { StreamMsg } from './xmtp.types';
import { report, reported } from './errorPolicy';

const TICK_MS = 1_000;
const END_TOASTS: Partial<Record<CallEndReason, string>> = {
  ended: 'Call ended',
  declined: 'Call declined',
  'no-answer': 'No answer',
  missed: 'Missed call',
  full: 'This call is full',
};

export interface CallInboundHooks {
  generation: () => number;
  selfInboxId: (epoch: number) => Promise<string>;
  dispatch: (event: CallEvent) => void;
}

export interface CallInbound {
  onMessage: (message: StreamMsg) => void;
  reload: (convId: string) => Promise<void>;
  reset: () => void;
}

export interface CallSessionDeps {
  media: CallMediaPort;
  openPeer: (hooks: PeerHooks) => Peer;
  view: { get: () => CallView; set: (patch: Partial<CallView>) => void };
  inbound: (hooks: CallInboundHooks) => CallInbound;
  clientInboxId: () => Promise<string>;
  sendJson: <T>(convId: string, codec: JsonCodec<T>, content: T) => Promise<unknown>;
  toast: (message: string) => void;
  newId: () => string;
  now: () => number;
  every: (ms: number, run: () => void) => () => void;
}

export interface CallState {
  readonly deps: CallSessionDeps;
  readonly peers: Map<string, Peer>;
  mic: CallTrack | null;
  camera: CallTrack | null;
  screen: CallTrack | null;
  stopTicker: (() => void) | null;
  stopRing: (() => void) | null;
  busy: boolean;
  generation: number;
  capture: number;
}

export function newCallState(deps: CallSessionDeps): CallState {
  return {
    deps,
    peers: new Map(),
    mic: null,
    camera: null,
    screen: null,
    stopTicker: null,
    stopRing: null,
    busy: false,
    generation: 0,
    capture: 0,
  };
}

export function captureToken(s: CallState): CallToken {
  const capture = s.capture;
  return { live: () => s.capture === capture };
}

export function callsOf(s: CallState): CallsState {
  return s.deps.view.get().calls;
}

export function joinedCallId(s: CallState): string | null {
  const session = callsOf(s).session;
  return session?.phase === 'joined' ? session.callId : null;
}

function myMedia(s: CallState): CallMedia {
  return { audio: s.mic?.value.enabled === true, video: (s.screen ?? s.camera) !== null, screen: s.screen !== null };
}

function outgoing(s: CallState): Outgoing {
  return { audio: s.mic, video: s.screen ?? s.camera };
}

function peerViews(s: CallState): CallPeerView[] {
  const session = callsOf(s).session;
  const roster = session ? (callsOf(s).calls[session.convId]?.roster ?? {}) : {};
  return [...s.peers.entries()].map(([peerId, p]) => ({
    peerId,
    inboxId: roster[peerId] ?? '',
    stream: p.stream,
    media: p.media,
    status: p.status,
  }));
}

function publish(s: CallState): void {
  const { view, media } = s.deps;
  const video = s.screen ?? s.camera;
  const current = view.get().preview?.value.getVideoTracks()[0] ?? null;
  if (video?.value !== current) releaseStream(view.get().preview);
  const preview = video?.value === current ? view.get().preview : video ? media.previewOf(video) : null;
  view.set({ media: myMedia(s), peers: peerViews(s), preview });
}

export function syncTimers(s: CallState): void {
  const session = callsOf(s).session;
  if (session && !s.stopTicker)
    s.stopTicker = s.deps.every(TICK_MS, () => {
      dispatch(s, { type: 'tick', nowMs: s.deps.now() });
    });
  if (!session && s.stopTicker) {
    s.stopTicker();
    s.stopTicker = null;
  }
  syncRingtone(s, session?.phase === 'ringing' && !s.busy);
}

function syncRingtone(s: CallState, ringing: boolean): void {
  if (ringing && !s.stopRing) s.stopRing = s.deps.media.startRingtone();
  if (!ringing) stopRingtone(s);
}

export function stopRingtone(s: CallState): void {
  if (s.stopRing) {
    s.stopRing();
    s.stopRing = null;
  }
}

export function dispatch(s: CallState, event: CallEvent): void {
  const { state: next, effects } = reduceCall(callsOf(s), event);
  if (next !== callsOf(s)) s.deps.view.set({ calls: next });
  for (const effect of effects) runEffect(s, effect).catch(reported('calls.effect'));
  syncTimers(s);
  publish(s);
}

async function send<T>(s: CallState, convId: string, codec: JsonCodec<T>, content: T): Promise<void> {
  try {
    await s.deps.sendJson(convId, codec, content);
  } catch (err) {
    report('calls.send', err);
    s.deps.toast('Call message could not be sent');
  }
}

function replacePeer(s: CallState, peerId: string): Peer {
  const old = s.peers.get(peerId);
  if (old) closePeer(old);
  const peer = s.deps.openPeer({
    onChange: () => {
      publish(s);
    },
    mine: () => myMedia(s),
    onLost: () => {
      if (s.peers.get(peerId) === peer) dispatch(s, { type: 'lost', peerId });
    },
  });
  s.peers.set(peerId, peer);
  return peer;
}

async function negotiate(s: CallState, peerId: string, kind: 'offer' | 'answer', offer?: string): Promise<void> {
  const session = callsOf(s).session;
  if (!session?.selfPeerId) return;
  const peer = replacePeer(s, peerId);
  const out = (): Outgoing => outgoing(s);
  const sdp = offer === undefined ? await peer.offer(out) : await peer.answer(offer, out);
  if (s.peers.get(peerId) !== peer) return;
  await send(s, session.convId, CALL_SIGNAL_CODEC, { kind, callId: session.callId, from: session.selfPeerId, to: peerId, sdp });
}

function dropPeer(s: CallState, peerId: string): void {
  const peer = s.peers.get(peerId);
  if (peer) closePeer(peer);
  s.peers.delete(peerId);
}

export function releaseVideo(s: CallState, track: CallTrack): void {
  const preview = s.deps.view.get().preview;
  if (preview?.value.getVideoTracks()[0] === track.value) {
    releaseStream(preview);
    s.deps.view.set({ preview: null });
  }
  stopTrack(track);
}

export function releaseMedia(s: CallState): void {
  s.capture += 1;
  for (const peerId of [...s.peers.keys()]) dropPeer(s, peerId);
  releaseStream(s.deps.view.get().preview);
  s.deps.view.set({ preview: null });
  s.mic = stopTrack(s.mic);
  s.camera = stopTrack(s.camera);
  s.screen = stopTrack(s.screen);
  s.deps.media.stopAudio();
}

function endCall(s: CallState, reason: CallEndReason): void {
  releaseMedia(s);
  const toast = END_TOASTS[reason];
  if (toast) s.deps.toast(toast);
}

async function runEffect(s: CallState, effect: CallEffect): Promise<void> {
  switch (effect.type) {
    case 'invite':
      return send(s, effect.convId, CALL_INVITE_CODEC, effect.invite);
    case 'send':
      return send(s, effect.convId, CALL_SIGNAL_CODEC, effect.signal);
    case 'offer':
      return negotiate(s, effect.peerId, 'offer');
    case 'answer':
      return negotiate(s, effect.peerId, 'answer', effect.sdp);
    case 'accept':
      return s.peers.get(effect.peerId)?.accept(effect.sdp);
    case 'close':
      dropPeer(s, effect.peerId);
      return;
    case 'end':
      endCall(s, effect.reason);
  }
}

export async function selfInboxId(s: CallState, epoch: number): Promise<string> {
  const id = await s.deps.clientInboxId();
  if (s.generation === epoch && s.deps.view.get().selfInboxId !== id) s.deps.view.set({ selfInboxId: id });
  return id;
}

export async function pushMedia(s: CallState): Promise<void> {
  await Promise.all([...s.peers.values()].map((p) => p.replace(outgoing(s))));
  for (const p of s.peers.values()) sendMedia(p, myMedia(s));
  publish(s);
}
