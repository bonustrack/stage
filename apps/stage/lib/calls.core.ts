import {
  VIDEO_OFF_ABOVE, isCallInviteType, isCallSignalType, parseCallInvite, parseCallSignal,
  type CallInvite, type CallSignal,
} from '@stage-labs/client/xmtp/call';
import { EMPTY_CALLS, reduceCall, type CallEffect, type CallEndReason, type CallEvent } from '@stage-labs/client/xmtp/callMachine';
import { subscribeAllMessages } from './xmtp.stream';
import { xmtpSendJson } from './xmtp.messages';
import { convOfLine, sdk } from './xmtp.sdk';
import { lineOfConv, type StreamMsg } from './xmtp.types';
import { CALL_INVITE_CODEC, CALL_SIGNAL_CODEC, type JsonCodec } from './xmtpJsonCodecs';
import { capabilities } from './capabilities';
import { NO_MEDIA, callView, setCallView, type CallMedia, type CallPeerView } from './calls.store';
import { openPeer } from './calls.peer';
import { closePeer, sendMedia, type Peer } from './calls.peer.core';
import { stopMedia, stopTrack, releaseStream, type CallTrack, type CapturedMedia, type Outgoing } from './calls.types';
import { callsSupported, displayMedia, previewOf, prepareAudio, startAudio, stopAudio, userMedia, watchCallLifecycle, watchScreenEnd } from './calls.media';
import { startRingtone } from './calls.ring';
import { ignore, report, reported } from './errorPolicy';

const HISTORY_LIMIT = 100;
const SEEN_MAX = 2_000;
const END_TOASTS: Partial<Record<CallEndReason, string>> = {
  ended: 'Call ended', declined: 'Call declined', 'no-answer': 'No answer', missed: 'Missed call', full: 'This call is full',
};
interface CallContent { invite: CallInvite | null; signal: CallSignal | null }
const peers = new Map<string, Peer>();
const seen = new Set<string>();
const histories = new Map<string, Promise<void>>();
let mic: CallTrack | null = null;
let camera: CallTrack | null = null;
let screen: CallTrack | null = null;
let ticker: ReturnType<typeof setInterval> | null = null;
let stopRing: (() => void) | null = null;
let ingestQueue: Promise<void> = Promise.resolve();
let busy = false;
let generation = 0;
let captureVersion = 0;

function captureCurrent(epoch: { generation: number; captureVersion: number }): boolean {
  return epoch.generation === generation && epoch.captureVersion === captureVersion;
}

function state(): ReturnType<typeof callView>['calls'] { return callView().calls; }
function joinedCallId(): string | null {
  const s = state().session;
  return s?.phase === 'joined' ? s.callId : null;
}
function myMedia(): CallMedia {
  return { audio: mic?.value.enabled === true, video: (screen ?? camera) !== null, screen: screen !== null };
}
function outgoing(): Outgoing { return { audio: mic, video: screen ?? camera }; }
function peerViews(): CallPeerView[] {
  const s = state().session;
  const roster = s ? state().calls[s.convId]?.roster ?? {} : {};
  return [...peers.entries()].map(([peerId, p]) => ({ peerId, inboxId: roster[peerId] ?? '', stream: p.stream, media: p.media, status: p.status }));
}
function publish(): void {
  const video = screen ?? camera;
  const current = callView().preview?.value.getVideoTracks()[0] ?? null;
  if (video?.value !== current) releaseStream(callView().preview);
  const preview = video?.value === current ? callView().preview : video ? previewOf(video) : null;
  setCallView({ media: myMedia(), peers: peerViews(), preview });
}
function syncTimers(): void {
  const s = state().session;
  if (s && !ticker) ticker = setInterval(() => { dispatch({ type: 'tick', nowMs: Date.now() }); }, 1_000);
  if (!s && ticker) { clearInterval(ticker); ticker = null; }
  syncRingtone(s?.phase === 'ringing' && !busy);
}
function syncRingtone(ringing: boolean): void {
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
  try { await xmtpSendJson(lineOfConv(convId), codec, content); }
  catch (err) { report('calls.send', err); capabilities.toast('Call message could not be sent'); }
}
function replacePeer(peerId: string): Peer {
  const old = peers.get(peerId);
  if (old) closePeer(old);
  const peer = openPeer({
    onChange: publish, mine: myMedia,
    onLost: () => { if (peers.get(peerId) === peer) dispatch({ type: 'lost', peerId }); },
  });
  peers.set(peerId, peer);
  return peer;
}
async function negotiate(peerId: string, kind: 'offer' | 'answer', offer?: string): Promise<void> {
  const s = state().session;
  if (!s?.selfPeerId) return;
  const peer = replacePeer(peerId);
  const sdp = offer === undefined ? await peer.offer(outgoing) : await peer.answer(offer, outgoing);
  if (peers.get(peerId) !== peer) return;
  await send(s.convId, CALL_SIGNAL_CODEC, { kind, callId: s.callId, from: s.selfPeerId, to: peerId, sdp });
}
function dropPeer(peerId: string): void {
  const peer = peers.get(peerId);
  if (peer) closePeer(peer);
  peers.delete(peerId);
}
function releaseVideo(track: CallTrack): void {
  const preview = callView().preview;
  if (preview?.value.getVideoTracks()[0] === track.value) {
    releaseStream(preview);
    setCallView({ preview: null });
  }
  stopTrack(track);
}
function releaseMedia(): void {
  captureVersion += 1;
  for (const peerId of [...peers.keys()]) dropPeer(peerId);
  releaseStream(callView().preview);
  setCallView({ preview: null });
  mic = stopTrack(mic);
  camera = stopTrack(camera);
  screen = stopTrack(screen);
  stopAudio();
}
function endCall(reason: CallEndReason): void {
  releaseMedia();
  const toast = END_TOASTS[reason];
  if (toast) capabilities.toast(toast);
}
async function runEffect(effect: CallEffect): Promise<void> {
  switch (effect.type) {
    case 'invite': return send(effect.convId, CALL_INVITE_CODEC, effect.invite);
    case 'send': return send(effect.convId, CALL_SIGNAL_CODEC, effect.signal);
    case 'offer': return negotiate(effect.peerId, 'offer');
    case 'answer': return negotiate(effect.peerId, 'answer', effect.sdp);
    case 'accept': return peers.get(effect.peerId)?.accept(effect.sdp);
    case 'close': dropPeer(effect.peerId); return;
    case 'end': endCall(effect.reason);
  }
}
async function selfInboxId(epoch: number): Promise<string> {
  const id = (await sdk.client()).inboxId;
  if (generation === epoch && callView().selfInboxId !== id) setCallView({ selfInboxId: id });
  return id;
}
async function convContext(convId: string): Promise<{ dm: boolean; allowed: boolean }> {
  const conv = await convOfLine(lineOfConv(convId));
  if (!conv) return { dm: false, allowed: false };
  return { dm: !sdk.isGroup(conv), allowed: (await sdk.consentOf(conv)) === 'allowed' };
}
async function ingest(convId: string, m: StreamMsg['msg'], { invite, signal }: CallContent, epoch: number): Promise<void> {
  const base = { convId, senderInboxId: m.senderInboxId, selfInboxId: await selfInboxId(epoch), sentMs: Math.floor(m.sentNs / 1_000_000), nowMs: Date.now() };
  if (generation !== epoch) return;
  if (signal) dispatch({ ...base, type: 'signal', signal });
  if (invite) {
    const context = await convContext(convId);
    if (generation === epoch) dispatch({ ...base, type: 'invite', invite, ...context });
  }
}
function callContentOf(m: StreamMsg['msg']): CallContent | null {
  const invite = isCallInviteType(m.contentTypeId) ? parseCallInvite(m.content) : null;
  const signal = isCallSignalType(m.contentTypeId) ? parseCallSignal(m.content) : null;
  return invite || signal ? { invite, signal } : null;
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
function enqueue(convId: string, m: StreamMsg['msg'], epoch: number): void {
  const call = callContentOf(m);
  if (generation !== epoch || !call || !firstSight(m.id)) return;
  ingestQueue = ingestQueue.then(() => ingest(convId, m, call, epoch)).catch(reported('calls.ingest'));
}
async function replayHistory(convId: string, epoch: number): Promise<void> {
  const conv = await convOfLine(lineOfConv(convId));
  if (!conv) return;
  const recent = await sdk.messages(conv, { limit: HISTORY_LIMIT, order: 'desc' });
  for (const m of recent.reverse()) enqueue(convId, sdk.rowOf(m), epoch);
}
function historyOf(convId: string): Promise<void> {
  const known = histories.get(convId);
  if (known) return known;
  const ready = replayHistory(convId, generation).catch(reported('calls.history'));
  histories.set(convId, ready);
  return ready;
}
function onMessage({ convId, msg }: StreamMsg): void {
  if (!convId || !callContentOf(msg)) return;
  const epoch = generation;
  void historyOf(convId).then(() => { enqueue(convId, msg, epoch); });
}
function resetCalls(): void {
  generation += 1;
  releaseMedia();
  seen.clear();
  histories.clear();
  setCallView({ calls: EMPTY_CALLS, selfInboxId: null, preview: null, media: NO_MEDIA, peers: [] });
  syncTimers();
}
export function startCallService(): () => void {
  if (!callsSupported) return () => undefined;
  const unsubscribe = subscribeAllMessages(onMessage);
  const unwatch = watchCallLifecycle(() => { if (joinedCallId() !== null) dispatch({ type: 'leave' }); });
  return () => { unsubscribe(); unwatch(); resetCalls(); };
}
export function loadCallHistory(convId: string): Promise<void> {
  if (!callsSupported) return Promise.resolve();
  histories.delete(convId);
  return historyOf(convId);
}
async function openMedia(video: boolean): Promise<CapturedMedia | null> {
  if (stopRing) { stopRing(); stopRing = null; }
  try { await prepareAudio(); }
  catch (error) { stopAudio(); throw error; }
  const media = (video ? await userMedia(true, true) : null) ?? await userMedia(false, true);
  if (!media) { stopAudio(); capabilities.toast('Allow microphone access to join the call'); }
  return media;
}
async function exclusive(run: () => Promise<void>): Promise<void> {
  if (busy) return;
  busy = true;
  try { await run(); } finally { busy = false; syncTimers(); }
}
async function adopt(media: CapturedMedia, event: CallEvent, epoch: { generation: number; captureVersion: number }): Promise<void> {
  try { await startAudio(media.video !== null); }
  catch (error) { stopMedia(media); stopAudio(); throw error; }
  if (!captureCurrent(epoch)) { stopMedia(media); stopAudio(); return; }
  mic = media.audio;
  camera = media.video;
  dispatch(event);
  if (joinedCallId() === null) releaseMedia();
}
function canJoin(convId: string): boolean {
  const s = state().session;
  return s === null || (s.phase === 'ringing' && s.convId === convId);
}
function newId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = ((bytes[6] ?? 0) & 15) | 64;
  bytes[8] = ((bytes[8] ?? 0) & 63) | 128;
  const hex = [...bytes].map(byte => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
export function startCall(convId: string, dm: boolean, video: boolean): Promise<void> {
  return exclusive(async () => {
    if (state().session) return;
    const epoch = { generation, captureVersion };
    const self = await selfInboxId(epoch.generation);
    if (!captureCurrent(epoch) || state().session) return;
    const media = await openMedia(video);
    if (!media) return;
    if (!captureCurrent(epoch) || state().session) { stopMedia(media); stopAudio(); return; }
    await adopt(media, { type: 'start', convId, dm, video, callId: newId(), peerId: newId(), selfInboxId: self, nowMs: Date.now() }, epoch);
  });
}
export function joinCall(convId: string, dm: boolean): Promise<void> {
  return exclusive(async () => {
    const info = state().calls[convId];
    if (!info || !canJoin(convId)) return;
    const epoch = { generation, captureVersion };
    const self = await selfInboxId(epoch.generation);
    if (!captureCurrent(epoch) || !canJoin(convId)) return;
    const crowded = Object.keys(info.roster).length >= VIDEO_OFF_ABOVE;
    const media = await openMedia(info.video && !crowded);
    if (!media) return;
    if (!captureCurrent(epoch) || !canJoin(convId)) { stopMedia(media); stopAudio(); return; }
    await adopt(media, { type: 'join', convId, dm, peerId: newId(), selfInboxId: self, nowMs: Date.now() }, epoch);
  });
}
export function declineCall(): void { dispatch({ type: 'decline' }); }
export function leaveCall(): void { dispatch({ type: 'leave' }); }
async function pushMedia(): Promise<void> {
  await Promise.all([...peers.values()].map(p => p.replace(outgoing())));
  for (const p of peers.values()) sendMedia(p, myMedia());
  publish();
}
export function toggleMic(): void {
  if (!mic || joinedCallId() === null) return;
  mic.value.enabled = !mic.value.enabled;
  ignore(pushMedia(), 'ui');
}
export function toggleCamera(): Promise<void> {
  return exclusive(async () => {
    const callId = joinedCallId();
    if (callId === null) return;
    if (camera) {
      const old = camera;
      camera = null;
      try { await pushMedia(); } finally { releaseVideo(old); }
      if (joinedCallId() === callId) await startAudio(false);
      return;
    }
    const media = await userMedia(true, false);
    if (!media) { capabilities.toast('Allow camera access to turn on video'); return; }
    if (joinedCallId() !== callId) { stopMedia(media); return; }
    try { await startAudio(media.video !== null); }
    catch (error) { stopMedia(media); throw error; }
    if (joinedCallId() !== callId) { stopMedia(media); return; }
    camera = media.video;
    await pushMedia();
  });
}
export function toggleScreen(): Promise<void> {
  return exclusive(async () => {
    const callId = joinedCallId();
    if (callId === null) return;
    if (screen) {
      const old = screen;
      screen = null;
      try { await pushMedia(); } finally { releaseVideo(old); }
      return;
    }
    const track = await displayMedia();
    if (!track) return;
    if (joinedCallId() !== callId || track.ended || track.value.readyState === 'ended') { stopTrack(track); return; }
    screen = track;
    watchScreenEnd(track, () => {
      if (screen !== track) return;
      screen = null;
      ignore(pushMedia().finally(() => { releaseVideo(track); }), 'ui');
    });
    await pushMedia();
  });
}
