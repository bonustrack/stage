import { describe, expect, test } from 'bun:test';
import {
  CALL_RING_TIMEOUT_MS, CALL_STALE_MS, MAX_CALL_PARTICIPANTS, callPreviewText, isCallInviteType, isCallSignalType,
  parseCallInvite, parseCallSignal, type CallSignal,
} from '../src/xmtp/call';
import {
  EMPTY_CALLS, activeCall, joinableCall, reduceCall, type CallEffect, type CallEvent, type CallsState,
} from '../src/xmtp/callMachine';

const CONV = 'conv-1';
const T0 = 1_700_000_000_000;

interface Device { inboxId: string; peerId: string; state: CallsState; effects: CallEffect[] }

function device(inboxId: string, peerId: string): Device {
  return { inboxId, peerId, state: EMPTY_CALLS, effects: [] };
}

interface Wire { from: Device; kind: 'invite' | 'signal'; payload: unknown }

class Net {
  queue: Wire[] = [];
  links: string[] = [];
  constructor(readonly devices: Device[], readonly dm: boolean, readonly allowed = true) {}

  apply(d: Device, e: CallEvent): void {
    const { state, effects } = reduceCall(d.state, e);
    d.state = state;
    d.effects.push(...effects);
    for (const effect of effects) this.route(d, effect);
  }

  route(d: Device, effect: CallEffect): void {
    const callId = d.state.session?.callId ?? 'none';
    if (effect.type === 'invite') this.queue.push({ from: d, kind: 'invite', payload: effect.invite });
    if (effect.type === 'send') this.queue.push({ from: d, kind: 'signal', payload: effect.signal });
    if (effect.type === 'offer') this.signal(d, { kind: 'offer', callId, from: d.peerId, to: effect.peerId, sdp: `offer:${d.peerId}` });
    if (effect.type === 'answer') this.signal(d, { kind: 'answer', callId, from: d.peerId, to: effect.peerId, sdp: `answer:${d.peerId}` });
    if (effect.type === 'accept') this.links.push([d.peerId, effect.peerId].sort().join('<>'));
  }

  signal(d: Device, signal: CallSignal): void {
    this.queue.push({ from: d, kind: 'signal', payload: signal });
  }

  deliver(sentMs = T0, nowMs = sentMs): void {
    while (this.queue.length > 0) {
      const wire = this.queue.shift();
      if (!wire) return;
      for (const d of this.devices) this.receive(d, wire, sentMs, nowMs);
    }
  }

  receive(d: Device, wire: Wire, sentMs: number, nowMs: number): void {
    const base = { convId: CONV, senderInboxId: wire.from.inboxId, selfInboxId: d.inboxId, sentMs, nowMs };
    const invite = parseCallInvite(wire.payload);
    const signal = parseCallSignal(wire.payload);
    if (wire.kind === 'invite' && invite) this.apply(d, { ...base, type: 'invite', dm: this.dm, allowed: this.allowed, invite });
    if (wire.kind === 'signal' && signal) this.apply(d, { ...base, type: 'signal', signal });
  }

  start(d: Device, video = true, callId = 'call-0001'): void {
    this.apply(d, { type: 'start', convId: CONV, dm: this.dm, video, callId, peerId: d.peerId, selfInboxId: d.inboxId, nowMs: T0 });
  }

  join(d: Device): void {
    this.apply(d, { type: 'join', convId: CONV, dm: this.dm, peerId: d.peerId, selfInboxId: d.inboxId, nowMs: T0 });
  }
}

function endReasons(d: Device): string[] {
  return d.effects.flatMap((e) => (e.type === 'end' ? [e.reason] : []));
}

describe('call content', () => {
  test('recognises both content types on native and web shapes', () => {
    expect(isCallInviteType('stage.box/callInvite:1.0')).toBe(true);
    expect(isCallInviteType('callInvite')).toBe(true);
    expect(isCallSignalType('callSignal')).toBe(true);
    expect(isCallSignalType('callInvite')).toBe(false);
    expect(isCallInviteType(undefined)).toBe(false);
  });

  test('rejects malformed payloads', () => {
    expect(parseCallInvite({ callId: 'call-0001', from: 'peer-aaaa', video: true })).not.toBeNull();
    expect(parseCallInvite({ callId: 'x', from: 'peer-aaaa', video: true })).toBeNull();
    expect(parseCallSignal({ kind: 'offer', callId: 'call-0001', from: 'peer-aaaa', to: 'peer-bbbb' })).toBeNull();
    expect(parseCallSignal({ kind: 'ring', callId: 'call-0001' })).toBeNull();
  });

  test('previews an invite by kind and any other call message as a call', () => {
    expect(callPreviewText({ callId: 'call-0001', from: 'peer-aaaa', video: false })).toBe('📞 Voice call');
    expect(callPreviewText({ callId: 'call-0001', from: 'peer-aaaa', video: true })).toBe('📞 Video call');
    expect(callPreviewText({ kind: 'leave' })).toBe('📞 Call');
  });
});

describe('1-1 call', () => {
  test('rings, connects with one offer and one answer, and ends for both when one leaves', () => {
    const a = device('inbox-a', 'peer-aaaa');
    const b = device('inbox-b', 'peer-bbbb');
    const net = new Net([a, b], true);
    net.start(a);
    net.deliver();
    expect(b.state.session?.phase).toBe('ringing');
    expect(a.state.session?.phase).toBe('joined');
    net.join(b);
    net.deliver();
    expect(net.links).toEqual(['peer-aaaa<>peer-bbbb']);
    expect(a.effects.filter((e) => e.type === 'offer')).toHaveLength(1);
    expect(b.effects.filter((e) => e.type === 'answer')).toHaveLength(1);
    net.apply(b, { type: 'leave' });
    net.deliver();
    expect(a.state.session).toBeNull();
    expect(endReasons(a)).toEqual(['ended']);
    expect(activeCall(a.state, CONV, T0)).toBeNull();
  });

  test('never rings for a request, an old invite or my own invite', () => {
    const a = device('inbox-a', 'peer-aaaa');
    const b = device('inbox-b', 'peer-bbbb');
    const request = new Net([a, b], true, false);
    request.start(a);
    request.deliver();
    expect(b.state.session).toBeNull();
    expect(activeCall(b.state, CONV, T0)?.callId).toBe('call-0001');
    const old = reduceCall(EMPTY_CALLS, {
      type: 'invite', convId: CONV, senderInboxId: 'inbox-a', selfInboxId: 'inbox-b', sentMs: T0, nowMs: T0 + 61_000,
      dm: true, allowed: true, invite: { callId: 'call-0001', from: 'peer-aaaa', video: false },
    });
    expect(old.state.session).toBeNull();
  });

  test('a decline ends the caller, a silent ring times out as missed', () => {
    const a = device('inbox-a', 'peer-aaaa');
    const b = device('inbox-b', 'peer-bbbb');
    const net = new Net([a, b], true);
    net.start(a);
    net.deliver();
    net.apply(b, { type: 'decline' });
    net.deliver();
    expect(endReasons(a)).toEqual(['declined']);
    const c = device('inbox-c', 'peer-cccc');
    const d = device('inbox-d', 'peer-dddd');
    const quiet = new Net([c, d], true);
    quiet.start(c);
    quiet.deliver();
    quiet.apply(d, { type: 'tick', nowMs: T0 + CALL_RING_TIMEOUT_MS });
    quiet.apply(c, { type: 'tick', nowMs: T0 + CALL_RING_TIMEOUT_MS });
    quiet.deliver();
    expect(endReasons(d)).toContain('missed');
    expect(endReasons(c)).toEqual(['no-answer']);
  });

  test('two people calling each other at once end up in one call', () => {
    const a = device('inbox-a', 'peer-aaaa');
    const b = device('inbox-b', 'peer-bbbb');
    const net = new Net([a, b], true);
    net.start(a, true, 'call-0001');
    net.start(b, true, 'call-0002');
    net.deliver();
    expect(a.state.session?.callId).toBe('call-0001');
    expect(b.state.session?.callId).toBe('call-0001');
    expect(net.links).toEqual(['peer-aaaa<>peer-bbbb']);
    net.apply(a, { type: 'tick', nowMs: T0 + CALL_RING_TIMEOUT_MS });
    net.apply(b, { type: 'tick', nowMs: T0 + CALL_RING_TIMEOUT_MS });
    expect(endReasons(a)).toEqual([]);
    expect(endReasons(b)).toEqual([]);
  });

  test('a 1-1 call is joinable from the header only while it still rings', () => {
    const a = device('inbox-a', 'peer-aaaa');
    const b = device('inbox-b', 'peer-bbbb');
    const net = new Net([a, b], true, false);
    net.start(a);
    net.deliver();
    expect(joinableCall(b.state, CONV, T0 + 1_000, true)?.callId).toBe('call-0001');
    expect(joinableCall(b.state, CONV, T0 + CALL_RING_TIMEOUT_MS + 1, true)).toBeNull();
    expect(joinableCall(b.state, CONV, T0 + CALL_RING_TIMEOUT_MS + 1, false)?.callId).toBe('call-0001');
    expect(joinableCall(a.state, CONV, T0, true)).toBeNull();
  });

  test('calling again after a 1-1 call died without a leave starts a new call', () => {
    const stale = reduceCall(EMPTY_CALLS, {
      type: 'invite', convId: CONV, senderInboxId: 'inbox-b', selfInboxId: 'inbox-a', sentMs: T0, nowMs: T0,
      dm: true, allowed: false, invite: { callId: 'call-0001', from: 'peer-bbbb', video: false },
    }).state;
    expect(activeCall(stale, CONV, T0 + CALL_RING_TIMEOUT_MS + 1)?.roster).toEqual({ 'peer-bbbb': 'inbox-b' });
    const again = reduceCall(stale, {
      type: 'start', convId: CONV, dm: true, video: false, callId: 'call-0002', peerId: 'peer-aaaa', selfInboxId: 'inbox-a',
      nowMs: T0 + CALL_RING_TIMEOUT_MS + 1,
    });
    expect(again.effects.map((e) => e.type)).toEqual(['invite']);
    expect(again.state.session?.callId).toBe('call-0002');
  });

  test('a link that drops ends a 1-1 call even without a leave message', () => {
    const a = device('inbox-a', 'peer-aaaa');
    const b = device('inbox-b', 'peer-bbbb');
    const net = new Net([a, b], true);
    net.start(a);
    net.deliver();
    net.join(b);
    net.deliver();
    net.apply(a, { type: 'lost', peerId: 'peer-bbbb' });
    expect(a.effects.filter((e) => e.type === 'close')).toEqual([{ type: 'close', peerId: 'peer-bbbb' }]);
    expect(endReasons(a)).toEqual(['ended']);
    expect(reduceCall(EMPTY_CALLS, { type: 'lost', peerId: 'peer-bbbb' }).effects).toEqual([]);
  });

  test('answering on one device stops the ring on my other device', () => {
    const a = device('inbox-a', 'peer-aaaa');
    const phone = device('inbox-b', 'peer-phone');
    const laptop = device('inbox-b', 'peer-laptop');
    const net = new Net([a, phone, laptop], true);
    net.start(a);
    net.deliver();
    net.join(laptop);
    net.deliver();
    expect(phone.state.session).toBeNull();
    expect(endReasons(phone)).toEqual(['elsewhere']);
    expect(net.links).toEqual(['peer-aaaa<>peer-laptop']);
  });
});

describe('channel mesh', () => {
  test('three people connect every pair exactly once', () => {
    const [a, b, c] = [device('inbox-a', 'peer-aaaa'), device('inbox-b', 'peer-bbbb'), device('inbox-c', 'peer-cccc')];
    const net = new Net([a, b, c], false);
    net.start(a);
    net.deliver();
    net.join(b);
    net.deliver();
    net.join(c);
    net.deliver();
    expect([...net.links].sort()).toEqual(['peer-aaaa<>peer-bbbb', 'peer-aaaa<>peer-cccc', 'peer-bbbb<>peer-cccc']);
    net.apply(a, { type: 'leave' });
    net.deliver();
    expect(b.state.session?.phase).toBe('joined');
    expect(Object.keys(b.state.session?.links ?? {})).toEqual(['peer-cccc']);
  });

  test('two people joining at once settle on one offer per pair', () => {
    const [a, b, c] = [device('inbox-a', 'peer-aaaa'), device('inbox-b', 'peer-bbbb'), device('inbox-c', 'peer-cccc')];
    const net = new Net([a, b, c], false);
    net.start(a);
    net.deliver();
    net.join(b);
    net.join(c);
    net.deliver();
    expect([...new Set(net.links)].sort()).toEqual(['peer-aaaa<>peer-bbbb', 'peer-aaaa<>peer-cccc', 'peer-bbbb<>peer-cccc']);
    expect(c.effects.filter((e) => e.type === 'answer' && e.peerId === 'peer-bbbb')).toHaveLength(1);
    expect(b.effects.filter((e) => e.type === 'answer' && e.peerId === 'peer-cccc')).toHaveLength(0);
  });

  test('late join works from the replayed history, and a stale call is not joinable', () => {
    const a = device('inbox-a', 'peer-aaaa');
    const late = device('inbox-z', 'peer-zzzz');
    const net = new Net([a], false);
    net.start(a);
    net.devices.push(late);
    net.deliver(T0 - 10 * 60_000, T0);
    expect(late.state.session).toBeNull();
    expect(activeCall(late.state, CONV, T0)?.roster).toEqual({ 'peer-aaaa': 'inbox-a' });
    expect(activeCall(late.state, CONV, T0 + CALL_STALE_MS)).toBeNull();
    net.join(late);
    net.deliver();
    expect(net.links).toEqual(['peer-aaaa<>peer-zzzz']);
  });

  test('joining a call everyone already left ends alone and forgets it', () => {
    const [a, b] = [device('inbox-a', 'peer-aaaa'), device('inbox-b', 'peer-bbbb')];
    const net = new Net([a, b], false);
    net.start(a);
    net.deliver();
    net.queue.length = 0;
    a.state = EMPTY_CALLS;
    net.join(b);
    net.deliver();
    expect(b.state.session?.phase).toBe('joined');
    net.apply(b, { type: 'tick', nowMs: T0 + CALL_RING_TIMEOUT_MS });
    expect(endReasons(b)).toEqual(['no-answer']);
    expect(activeCall(b.state, CONV, T0)).toBeNull();
  });

  test('a full call refuses one more person', () => {
    const people = Array.from({ length: MAX_CALL_PARTICIPANTS + 1 }, (_, i) => device(`inbox-${i}`, `peer-000${i}`));
    const net = new Net(people, false);
    const [first, ...rest] = people;
    if (!first) throw new Error('no people');
    net.start(first);
    net.deliver();
    for (const p of rest) { net.join(p); net.deliver(); }
    const last = rest.at(-1);
    expect(last?.state.session).toBeNull();
    expect(last ? endReasons(last) : []).toEqual(['full']);
  });

  test('declining on one device stops the ring on my other devices', () => {
    const a = device('inbox-a', 'peer-aaaa');
    const phone = device('inbox-b', 'peer-phone');
    const laptop = device('inbox-b', 'peer-laptop');
    const net = new Net([a, phone, laptop], false);
    net.start(a);
    net.deliver();
    net.apply(phone, { type: 'decline' });
    net.deliver();
    expect(laptop.state.session).toBeNull();
    expect(endReasons(laptop)).toEqual(['elsewhere']);
    expect(a.state.session?.phase).toBe('joined');
  });

  test('an older call replayed late never replaces the current one', () => {
    const base = { convId: CONV, senderInboxId: 'inbox-a', selfInboxId: 'inbox-b', nowMs: T0 };
    const current = reduceCall(EMPTY_CALLS, {
      ...base, type: 'invite', sentMs: T0, dm: false, allowed: false, invite: { callId: 'call-new0', from: 'peer-aaaa', video: false },
    }).state;
    const replayed = reduceCall(current, {
      ...base, type: 'invite', sentMs: T0 - 60_000, dm: false, allowed: false, invite: { callId: 'call-old0', from: 'peer-old0', video: false },
    }).state;
    expect(replayed.calls[CONV]?.callId).toBe('call-new0');
    const join = reduceCall(current, {
      ...base, type: 'signal', sentMs: T0 - 60_000, signal: { kind: 'join', callId: 'call-old0', from: 'peer-old1' },
    }).state;
    expect(join.calls[CONV]?.callId).toBe('call-new0');
  });

  test('a forged invite cannot take over another member peer id', () => {
    const [a, b] = [device('inbox-a', 'peer-aaaa'), device('inbox-b', 'peer-bbbb')];
    const net = new Net([a, b], false);
    net.start(a);
    net.deliver();
    net.join(b);
    net.deliver();
    const forged = reduceCall(a.state, {
      type: 'invite', convId: CONV, senderInboxId: 'inbox-evil', selfInboxId: 'inbox-a', sentMs: T0, nowMs: T0,
      dm: false, allowed: true, invite: { callId: 'call-0001', from: 'peer-bbbb', video: false },
    });
    expect(forged.state).toBe(a.state);
    expect(a.state.calls[CONV]?.callerInboxId).toBe('inbox-a');
  });

  test('a member cannot speak for another member peer id', () => {
    const [a, b] = [device('inbox-a', 'peer-aaaa'), device('inbox-b', 'peer-bbbb')];
    const net = new Net([a, b], false);
    net.start(a);
    net.deliver();
    net.join(b);
    net.deliver();
    const forged = reduceCall(b.state, {
      type: 'signal', convId: CONV, senderInboxId: 'inbox-evil', selfInboxId: 'inbox-b', sentMs: T0, nowMs: T0,
      signal: { kind: 'leave', callId: 'call-0001', from: 'peer-aaaa' },
    });
    expect(forged.state).toBe(b.state);
    expect(forged.effects).toEqual([]);
  });
});
