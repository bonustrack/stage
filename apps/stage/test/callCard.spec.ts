import { describe, expect, test } from 'bun:test';
import type { HistoryEntry } from '@stage-labs/client/types';
import { EMPTY_CALLS, type CallsState } from '@stage-labs/client/xmtp/callMachine';
import { callCardModel, callLiveOf, callRecordsOf, type CallRecord } from '../components/bubble/callCard.model';

const ME = 'xmtp:user:me';
const PEER = 'xmtp:user:peer';
const CONV = 'conv-1';
const T0 = Date.parse('2026-10-02T00:00:00.000Z');

function at(sec: number): string {
  return new Date(T0 + sec * 1_000).toISOString();
}

function invite(id: string, from: string, sec: number, callId = 'call-0001', video = false): HistoryEntry {
  return {
    id, ts: at(sec), station: 'xmtp', line: 'l', from, to: 'l', text: '📞 Voice call',
    payload: { contentType: 'callInvite', callInvite: { callId, from: `peer-${from.slice(-4)}`, video } },
  };
}

function signal(id: string, from: string, sec: number, kind: 'join' | 'leave', callId = 'call-0001'): HistoryEntry {
  return {
    id, ts: at(sec), station: 'xmtp', line: 'l', from, to: 'l',
    payload: { contentType: 'callSignal', callSignal: { kind, callId, from: `peer-${from.slice(-4)}` } },
  };
}

const IDLE = { mine: null, joinable: false, busy: false };

describe('call card', () => {
  test('records an answered call from its invite and signals', () => {
    const events = [
      signal('s3', ME, 245, 'leave'), signal('s2', PEER, 240, 'leave'), signal('s1', PEER, 5, 'join'), invite('m1', ME, 0),
    ];
    const record = callRecordsOf(events, true, ME).get('m1');
    expect(record).toEqual({
      callId: 'call-0001', video: false, dm: true, outgoing: true, startMs: T0, answeredMs: T0 + 5_000, endMs: T0 + 245_000,
    });
    expect(record && callCardModel(record, IDLE, T0 + 300_000)).toEqual({ title: 'Voice call', status: 'Ended · 4:00', tone: 'ended', action: null });
  });

  test('an unanswered call is missed for the callee and unanswered for the caller', () => {
    const events = [signal('s1', PEER, 45, 'leave'), invite('m1', PEER, 0, 'call-0001', true)];
    const record = callRecordsOf(events, true, ME).get('m1');
    expect(record?.answeredMs).toBeNull();
    expect(record && callCardModel(record, IDLE, T0 + 60_000)).toEqual({ title: 'Video call', status: 'Missed', tone: 'missed', action: null });
    const mine = callRecordsOf(events, true, PEER).get('m1');
    expect(mine && callCardModel(mine, IDLE, T0 + 60_000).status).toBe('No answer');
  });

  test('a live call rings, then counts from the answer in a DM and from the start in a channel', () => {
    const dm: CallRecord = { callId: 'c', video: false, dm: true, outgoing: false, startMs: T0, answeredMs: null, endMs: null };
    expect(callCardModel(dm, { mine: null, joinable: true, busy: false }, T0 + 3_000)).toEqual({ title: 'Voice call', status: 'Ringing', tone: 'live', action: 'join' });
    const answered = { ...dm, answeredMs: T0 + 10_000 };
    expect(callCardModel(answered, { mine: 'joined', joinable: false, busy: true }, T0 + 75_000)).toMatchObject({ status: 'Ongoing · 1:05', action: 'open' });
    const channel = { ...dm, dm: false };
    expect(callCardModel(channel, { mine: null, joinable: true, busy: true }, T0 + 75_000)).toMatchObject({ status: 'Ongoing · 1:15', action: null });
  });

  test('only the current call of a conversation is live and joinable', () => {
    const calls: CallsState = {
      ...EMPTY_CALLS,
      calls: { [CONV]: { convId: CONV, callId: 'call-0002', video: false, callerInboxId: 'peer', roster: { 'peer-a': 'peer' }, lastMs: T0 } },
    };
    const base: CallRecord = { callId: 'call-0002', video: false, dm: false, outgoing: false, startMs: T0, answeredMs: null, endMs: null };
    expect(callLiveOf(calls, CONV, base, T0 + 1_000)).toEqual({ mine: null, joinable: true, busy: false });
    expect(callLiveOf(calls, CONV, { ...base, callId: 'call-0001' }, T0 + 1_000).joinable).toBe(false);
    expect(callLiveOf(calls, CONV, { ...base, dm: true }, T0 + 60_000).joinable).toBe(false);
  });
});
