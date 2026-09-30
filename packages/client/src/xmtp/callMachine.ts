import {
  CALL_RING_TIMEOUT_MS, CALL_SIGNAL_MAX_AGE_MS, CALL_STALE_MS, MAX_CALL_PARTICIPANTS,
  type CallInvite, type CallSignal,
} from './call';

export type CallEndReason = 'left' | 'ended' | 'declined' | 'no-answer' | 'missed' | 'elsewhere' | 'full';

export interface CallInfo {
  convId: string;
  callId: string;
  video: boolean;
  callerInboxId: string;
  roster: Record<string, string>;
  lastMs: number;
}

export interface CallSession {
  convId: string;
  callId: string;
  dm: boolean;
  video: boolean;
  phase: 'ringing' | 'joined';
  selfPeerId: string | null;
  startedMs: number;
  answered: boolean;
  links: Record<string, 'offered' | 'open'>;
}

export interface CallsState {
  calls: Record<string, CallInfo>;
  session: CallSession | null;
}

export type CallEffect =
  | { type: 'invite'; convId: string; invite: CallInvite }
  | { type: 'send'; convId: string; signal: CallSignal }
  | { type: 'offer'; peerId: string }
  | { type: 'answer'; peerId: string; sdp: string }
  | { type: 'accept'; peerId: string; sdp: string }
  | { type: 'close'; peerId: string }
  | { type: 'end'; reason: CallEndReason };

interface Inbound { convId: string; senderInboxId: string; selfInboxId: string; sentMs: number; nowMs: number }

export type CallEvent =
  | { type: 'start'; convId: string; dm: boolean; video: boolean; callId: string; peerId: string; selfInboxId: string; nowMs: number }
  | { type: 'join'; convId: string; dm: boolean; peerId: string; selfInboxId: string; nowMs: number }
  | { type: 'decline' }
  | { type: 'leave' }
  | { type: 'tick'; nowMs: number }
  | (Inbound & { type: 'invite'; dm: boolean; allowed: boolean; invite: CallInvite })
  | (Inbound & { type: 'signal'; signal: CallSignal });

interface CallStep { state: CallsState; effects: CallEffect[] }

export const EMPTY_CALLS: CallsState = { calls: {}, session: null };

function step(state: CallsState, effects: CallEffect[] = []): CallStep {
  return { state, effects };
}

function withCall(state: CallsState, info: CallInfo): CallsState {
  return { ...state, calls: { ...state.calls, [info.convId]: info } };
}

function omit<T>(record: Record<string, T>, key: string): Record<string, T> {
  return Object.fromEntries(Object.entries(record).filter(([k]) => k !== key));
}

function withRoster(state: CallsState, info: CallInfo, roster: Record<string, string>, lastMs: number): CallsState {
  if (Object.keys(roster).length > 0) return withCall(state, { ...info, roster, lastMs: Math.max(info.lastMs, lastMs) });
  return { ...state, calls: omit(state.calls, info.convId) };
}

function withSession(state: CallsState, session: CallSession | null): CallsState {
  return { ...state, session };
}

function sessionFor(state: CallsState, convId: string, callId: string): CallSession | null {
  const s = state.session;
  return s !== null && s.convId === convId && s.callId === callId ? s : null;
}

function isCallFull(info: CallInfo | undefined): boolean {
  return info !== undefined && Object.keys(info.roster).length >= MAX_CALL_PARTICIPANTS;
}

export function activeCall(state: CallsState, convId: string, nowMs: number): CallInfo | null {
  const info = state.calls[convId];
  if (info === undefined || nowMs - info.lastMs > CALL_STALE_MS) return null;
  return Object.keys(info.roster).length > 0 ? info : null;
}

function start(state: CallsState, e: Extract<CallEvent, { type: 'start' }>): CallStep {
  if (state.session !== null) return step(state);
  if (activeCall(state, e.convId, e.nowMs) !== null) return join(state, { ...e, type: 'join' });
  const info: CallInfo = {
    convId: e.convId, callId: e.callId, video: e.video, callerInboxId: e.selfInboxId,
    roster: { [e.peerId]: e.selfInboxId }, lastMs: e.nowMs,
  };
  const session: CallSession = {
    convId: e.convId, callId: e.callId, dm: e.dm, video: e.video, phase: 'joined',
    selfPeerId: e.peerId, startedMs: e.nowMs, answered: false, links: {},
  };
  const invite = { callId: e.callId, from: e.peerId, video: e.video };
  return step(withSession(withCall(state, info), session), [{ type: 'invite', convId: e.convId, invite }]);
}

function join(state: CallsState, e: Extract<CallEvent, { type: 'join' }>): CallStep {
  const info = state.calls[e.convId];
  const ringing = state.session?.phase === 'ringing' && state.session.convId === e.convId ? state.session : null;
  if (info === undefined || (state.session !== null && ringing === null)) return step(state);
  if (isCallFull(info)) return step(withSession(state, null), [{ type: 'end', reason: 'full' }]);
  const session: CallSession = {
    convId: e.convId, callId: info.callId, dm: e.dm, video: info.video, phase: 'joined',
    selfPeerId: e.peerId, startedMs: e.nowMs, answered: false, links: {},
  };
  const next = withRoster(state, info, { ...info.roster, [e.peerId]: e.selfInboxId }, e.nowMs);
  const signal: CallSignal = { kind: 'join', callId: info.callId, from: e.peerId };
  return step(withSession(next, session), [{ type: 'send', convId: e.convId, signal }]);
}

function decline(state: CallsState): CallStep {
  const s = state.session;
  if (s?.phase !== 'ringing') return s === null ? step(state) : leave(state);
  const effects: CallEffect[] = s.dm ? [{ type: 'send', convId: s.convId, signal: { kind: 'decline', callId: s.callId } }] : [];
  return step(withSession(state, null), [...effects, { type: 'end', reason: 'left' }]);
}

function hangUp(state: CallsState, reason: CallEndReason): CallStep {
  const s = state.session;
  if (s?.phase !== 'joined' || s.selfPeerId === null) return step(state);
  const info = state.calls[s.convId];
  const mine = info?.callId === s.callId ? info : null;
  const next = mine === null ? state
    : reason === 'no-answer' ? { ...state, calls: omit(state.calls, s.convId) }
      : withRoster(state, mine, omit(mine.roster, s.selfPeerId), mine.lastMs);
  const signal: CallSignal = { kind: 'leave', callId: s.callId, from: s.selfPeerId };
  return step(withSession(next, null), [{ type: 'send', convId: s.convId, signal }, { type: 'end', reason }]);
}

function leave(state: CallsState): CallStep {
  return state.session?.phase === 'ringing' ? decline(state) : hangUp(state, 'left');
}

function tick(state: CallsState, nowMs: number): CallStep {
  const s = state.session;
  if (s === null || s.answered || nowMs - s.startedMs < CALL_RING_TIMEOUT_MS) return step(state);
  if (s.phase === 'ringing') return step(withSession(state, null), [{ type: 'end', reason: 'missed' }]);
  return hangUp(state, 'no-answer');
}

function onInvite(state: CallsState, e: Extract<CallEvent, { type: 'invite' }>): CallStep {
  const existing = state.calls[e.convId];
  const roster = existing?.callId === e.invite.callId ? existing.roster : {};
  const info: CallInfo = {
    convId: e.convId, callId: e.invite.callId, video: e.invite.video, callerInboxId: e.senderInboxId,
    roster: { ...roster, [e.invite.from]: e.senderInboxId }, lastMs: Math.max(existing?.lastMs ?? 0, e.sentMs),
  };
  const next = withCall(state, info);
  const rings = state.session === null && e.allowed && e.senderInboxId !== e.selfInboxId
    && e.nowMs - e.sentMs < CALL_SIGNAL_MAX_AGE_MS;
  if (!rings) return step(next);
  return step(withSession(next, {
    convId: e.convId, callId: e.invite.callId, dm: e.dm, video: e.invite.video, phase: 'ringing',
    selfPeerId: null, startedMs: e.nowMs, answered: false, links: {},
  }));
}

type SignalEvent = Extract<CallEvent, { type: 'signal' }>;
type SignalOf<K extends CallSignal['kind']> = Extract<CallSignal, { kind: K }>;

function knownCall(state: CallsState, e: SignalEvent, callId: string): CallInfo | null {
  const info = state.calls[e.convId];
  return info?.callId === callId ? info : null;
}

function spoofed(info: CallInfo | null, peerId: string, senderInboxId: string): boolean {
  const owner = info?.roster[peerId];
  return owner !== undefined && owner !== senderInboxId;
}

function onJoin(state: CallsState, e: SignalEvent, s: SignalOf<'join'>): CallStep {
  const known = knownCall(state, e, s.callId);
  if (spoofed(known, s.from, e.senderInboxId)) return step(state);
  const info = known ?? { convId: e.convId, callId: s.callId, video: false, callerInboxId: e.senderInboxId, roster: {}, lastMs: e.sentMs };
  const next = withRoster(state, info, { ...info.roster, [s.from]: e.senderInboxId }, e.sentMs);
  const session = sessionFor(next, e.convId, s.callId);
  if (session === null) return step(next);
  if (session.phase === 'ringing') {
    return e.senderInboxId === e.selfInboxId ? step(withSession(next, null), [{ type: 'end', reason: 'elsewhere' }]) : step(next);
  }
  if (s.from === session.selfPeerId || session.links[s.from] !== undefined) return step(next);
  const links = { ...session.links, [s.from]: 'offered' as const };
  return step(withSession(next, { ...session, answered: true, links }), [{ type: 'offer', peerId: s.from }]);
}

function peerLeft(state: CallsState, session: CallSession, peerId: string): CallStep {
  const remaining = Object.keys(state.calls[session.convId]?.roster ?? {});
  if (session.phase === 'ringing') {
    return remaining.length === 0 ? step(withSession(state, null), [{ type: 'end', reason: 'missed' }]) : step(state);
  }
  const closed = step(
    withSession(state, { ...session, links: omit(session.links, peerId) }),
    session.links[peerId] ? [{ type: 'close', peerId }] : [],
  );
  if (!session.dm || remaining.some((id) => id !== session.selfPeerId)) return closed;
  const ended = hangUp(closed.state, 'ended');
  return step(ended.state, [...closed.effects, ...ended.effects]);
}

function onLeave(state: CallsState, e: SignalEvent, s: SignalOf<'leave'>): CallStep {
  const known = knownCall(state, e, s.callId);
  if (known === null || spoofed(known, s.from, e.senderInboxId)) return step(state);
  const next = withRoster(state, known, omit(known.roster, s.from), e.sentMs);
  const session = sessionFor(next, e.convId, s.callId);
  return session === null || s.from === session.selfPeerId ? step(next) : peerLeft(next, session, s.from);
}

function onDecline(state: CallsState, e: SignalEvent, s: SignalOf<'decline'>): CallStep {
  const session = sessionFor(state, e.convId, s.callId);
  if (session === null) return step(state);
  if (session.phase === 'ringing') {
    return e.senderInboxId === e.selfInboxId ? step(withSession(state, null), [{ type: 'end', reason: 'elsewhere' }]) : step(state);
  }
  return session.dm && !session.answered && e.senderInboxId !== e.selfInboxId ? hangUp(state, 'declined') : step(state);
}

function addressed(state: CallsState, e: SignalEvent, s: SignalOf<'offer' | 'answer'>): CallSession | null {
  const session = sessionFor(state, e.convId, s.callId);
  if (session?.phase !== 'joined' || s.to !== session.selfPeerId || s.from === session.selfPeerId) return null;
  return spoofed(knownCall(state, e, s.callId), s.from, e.senderInboxId) ? null : session;
}

function onOffer(state: CallsState, e: SignalEvent, s: SignalOf<'offer'>): CallStep {
  const session = addressed(state, e, s);
  const selfPeerId = session?.selfPeerId;
  if (!session || !selfPeerId || (session.links[s.from] === 'offered' && selfPeerId < s.from)) return step(state);
  const info = knownCall(state, e, s.callId);
  const next = info ? withRoster(state, info, { ...info.roster, [s.from]: e.senderInboxId }, e.sentMs) : state;
  const links = { ...session.links, [s.from]: 'open' as const };
  return step(withSession(next, { ...session, answered: true, links }), [{ type: 'answer', peerId: s.from, sdp: s.sdp }]);
}

function onAnswer(state: CallsState, e: SignalEvent, s: SignalOf<'answer'>): CallStep {
  const session = addressed(state, e, s);
  if (session?.links[s.from] !== 'offered') return step(state);
  const links = { ...session.links, [s.from]: 'open' as const };
  return step(withSession(state, { ...session, answered: true, links }), [{ type: 'accept', peerId: s.from, sdp: s.sdp }]);
}

function onSignal(state: CallsState, e: SignalEvent): CallStep {
  const s = e.signal;
  switch (s.kind) {
    case 'join': return onJoin(state, e, s);
    case 'leave': return onLeave(state, e, s);
    case 'decline': return onDecline(state, e, s);
    case 'offer': return onOffer(state, e, s);
    case 'answer': return onAnswer(state, e, s);
  }
}

export function reduceCall(state: CallsState, e: CallEvent): CallStep {
  switch (e.type) {
    case 'start': return start(state, e);
    case 'join': return join(state, e);
    case 'decline': return decline(state);
    case 'leave': return leave(state);
    case 'tick': return tick(state, e.nowMs);
    case 'invite': return onInvite(state, e);
    case 'signal': return onSignal(state, e);
  }
}
