import type { HistoryEntry } from '@stage-labs/client/types';
import { parseCallInvite, parseCallSignal, type CallInvite, type CallSignal } from '@stage-labs/client/xmtp/call';
import { joinableCall, type CallsState } from '@stage-labs/client/xmtp/callMachine';
import { clockLabel } from './audioCard.model';

export interface CallRecord {
  callId: string;
  video: boolean;
  dm: boolean;
  outgoing: boolean;
  startMs: number;
  answeredMs: number | null;
  endMs: number | null;
}

interface CallLive {
  mine: 'ringing' | 'joined' | null;
  joinable: boolean;
  busy: boolean;
}

type CallCardAction = 'join' | 'open' | null;

export interface CallCardModel {
  title: string;
  status: string;
  tone: 'live' | 'ended' | 'missed';
  action: CallCardAction;
}

function callInviteOf(entry: HistoryEntry): CallInvite | null {
  return parseCallInvite((entry.payload as { callInvite?: unknown } | undefined)?.callInvite);
}

function callSignalOf(entry: HistoryEntry): CallSignal | null {
  return parseCallSignal((entry.payload as { callSignal?: unknown } | undefined)?.callSignal);
}

interface InviteSeen { messageId: string; callerUri: string; record: CallRecord }

function invitesOf(events: readonly HistoryEntry[], dm: boolean, myUri: string): Map<string, InviteSeen> {
  const byCall = new Map<string, InviteSeen>();
  for (const e of events) {
    const invite = callInviteOf(e);
    const startMs = Date.parse(e.ts);
    const known = invite ? byCall.get(invite.callId) : undefined;
    if (!invite || (known && known.record.startMs <= startMs)) continue;
    byCall.set(invite.callId, {
      messageId: e.id, callerUri: e.from,
      record: { callId: invite.callId, video: invite.video, dm, outgoing: e.from === myUri, startMs, answeredMs: null, endMs: null },
    });
  }
  return byCall;
}

function withSignal(record: CallRecord, signal: CallSignal, ms: number, answered: boolean): CallRecord {
  const endMs = Math.max(record.endMs ?? ms, ms);
  if (signal.kind !== 'join' || !answered) return { ...record, endMs };
  return { ...record, endMs, answeredMs: Math.min(record.answeredMs ?? ms, ms) };
}

export function callRecordsOf(events: readonly HistoryEntry[], dm: boolean, myUri: string): Map<string, CallRecord> {
  const byCall = invitesOf(events, dm, myUri);
  for (const e of events) {
    const signal = callSignalOf(e);
    const seen = signal ? byCall.get(signal.callId) : undefined;
    if (!signal || !seen) continue;
    seen.record = withSignal(seen.record, signal, Date.parse(e.ts), e.from !== seen.callerUri);
  }
  return new Map([...byCall.values()].map(seen => [seen.messageId, seen.record]));
}

export function callLiveOf(state: CallsState, convId: string, record: CallRecord, nowMs: number): CallLive {
  const s = state.session;
  const mine = s !== null && s.convId === convId && s.callId === record.callId ? s.phase : null;
  const joinable = joinableCall(state, convId, nowMs, record.dm)?.callId === record.callId;
  return { mine, joinable, busy: s !== null };
}

function liveAction(live: CallLive): CallCardAction {
  if (live.mine === 'joined') return 'open';
  return live.mine === 'ringing' || !live.busy ? 'join' : null;
}

export function callCardModel(record: CallRecord, live: CallLive, nowMs: number): CallCardModel {
  const title = record.video ? 'Video call' : 'Voice call';
  const since = record.dm ? record.answeredMs : record.startMs;
  if (live.mine !== null || live.joinable) {
    const status = since === null ? 'Ringing' : `Ongoing · ${clockLabel(nowMs - since)}`;
    return { title, status, tone: 'live', action: liveAction(live) };
  }
  if (record.answeredMs !== null) {
    const endMs = record.endMs ?? record.answeredMs;
    return { title, status: `Ended · ${clockLabel(endMs - (since ?? endMs))}`, tone: 'ended', action: null };
  }
  return record.outgoing
    ? { title, status: 'No answer', tone: 'ended', action: null }
    : { title, status: 'Missed', tone: 'missed', action: null };
}
