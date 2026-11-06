import { afterEach, beforeEach, describe, expect, setSystemTime, test } from 'bun:test';
import { CALL_RING_TIMEOUT_MS, type CallSignal } from '@stage-labs/client/xmtp/call';
import { EMPTY_CALLS, type CallEvent } from '@stage-labs/client/xmtp/callMachine';
import { CALL_INVITE_CODEC } from '@stage-labs/client/xmtp/jsonCodecs';
import { NO_MEDIA, type CallView } from '../lib/calls.store';
import type { CallInboundHooks } from '../lib/calls.machine.core';
import { acquire, makeCallSession } from '../lib/calls.session.core';
import { fakeMedia, fakePeers, fakeTimers, FakeTrack } from './callsFakes';

const SELF = 'self-inbox';
const PEER = 'peer-inbox';
const NOW = 1_700_000_000_000;

let media = fakeMedia();
let peers = fakePeers();
let timers = fakeTimers();
let sent: { kind: string; content: unknown }[] = [];
let toasts: string[] = [];
let ids = 0;
let inboundResets = 0;

function harness() {
  let view: CallView = { calls: EMPTY_CALLS, selfInboxId: null, preview: null, media: NO_MEDIA, peers: [] };
  let hooks: CallInboundHooks | null = null;
  const session = makeCallSession({
    media,
    openPeer: peers.openPeer,
    view: {
      get: () => view,
      set: (patch) => {
        view = { ...view, ...patch };
      },
    },
    inbound: (bound) => {
      hooks = bound;
      return {
        onMessage: () => undefined,
        reload: async () => undefined,
        reset: () => {
          inboundResets += 1;
        },
      };
    },
    clientInboxId: async () => {
      await media.pass('self');
      return SELF;
    },
    sendJson: async (_convId, codec, content) => {
      sent.push({ kind: codec === CALL_INVITE_CODEC ? 'invite' : 'signal', content });
    },
    toast: (message) => {
      toasts.push(message);
    },
    newId: () => {
      ids += 1;
      return `call-id-${ids}`;
    },
    now: () => Date.now(),
    every: timers.every,
  });
  return {
    start: session.startCall,
    join: session.joinCall,
    decline: session.declineCall,
    leave: session.leaveCall,
    toggleMic: session.toggleMic,
    toggleCamera: session.toggleCamera,
    toggleScreen: session.toggleScreen,
    view: () => view,
    dispatch: (event: CallEvent) => hooks?.dispatch(event),
    generation: () => hooks?.generation() ?? -1,
    reset: session.reset,
  };
}

let h = harness();

beforeEach(() => {
  media = fakeMedia();
  peers = fakePeers();
  timers = fakeTimers();
  sent = [];
  toasts = [];
  ids = 0;
  inboundResets = 0;
  setSystemTime(NOW);
  h = harness();
});

afterEach(() => {
  h.reset();
  setSystemTime();
});

function invite(convId: string, callId: string, from: string): CallEvent {
  return {
    type: 'invite',
    convId,
    senderInboxId: PEER,
    selfInboxId: SELF,
    sentMs: NOW,
    nowMs: NOW,
    dm: true,
    allowed: true,
    invite: { callId, from, video: false },
  };
}

function signal(convId: string, s: CallSignal): CallEvent {
  return { type: 'signal', convId, senderInboxId: PEER, selfInboxId: SELF, sentMs: NOW, nowMs: NOW, signal: s };
}

function flush(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}

function stopCounts(): number[] {
  return media.tracks.map((t) => t.stops);
}

function previewTrack(): MediaStreamTrack | undefined {
  const preview = h.view().preview;
  return preview?.platform === 'web' ? preview.value.getVideoTracks()[0] : undefined;
}

describe('starting and answering', () => {
  test('starting a call opens the microphone, then invites the chat', async () => {
    await h.start('c1', true, false);
    expect(media.log).toEqual(['prepare', 'mic', 'start audio']);
    expect(sent).toEqual([{ kind: 'invite', content: { callId: 'call-id-1', from: 'call-id-2', video: false } }]);
    expect(h.view().calls.session).toMatchObject({ convId: 'c1', phase: 'joined', selfPeerId: 'call-id-2' });
    expect(h.view().media).toEqual({ audio: true, video: false, screen: false });
    expect(h.view().selfInboxId).toBe(SELF);
    expect(timers.running.size).toBe(1);
  });

  test('a video call falls back to the microphone when the camera is refused', async () => {
    media.settings.cameraRefused = true;
    await h.start('c1', true, true);
    expect(media.log).toEqual(['prepare', 'camera+mic', 'mic', 'start audio']);
    expect(sent).toEqual([{ kind: 'invite', content: { callId: 'call-id-1', from: 'call-id-2', video: true } }]);
    expect(h.view().media.video).toBe(false);
  });

  test('without the microphone nothing is sent and the audio session is let go', async () => {
    media.settings.micRefused = true;
    await h.start('c1', true, false);
    expect(media.log).toEqual(['prepare', 'mic', 'stop audio']);
    expect(toasts).toEqual(['Allow microphone access to join the call']);
    expect(sent).toEqual([]);
    expect(h.view().calls.session).toBeNull();
  });

  test('an invite rings until it is accepted, then the join is signalled', async () => {
    h.dispatch(invite('c1', 'remote-call-1', 'remote-peer-1'));
    expect(h.view().calls.session?.phase).toBe('ringing');
    await h.join('c1', true);
    expect(media.log).toEqual(['ring', 'ring stop', 'prepare', 'mic', 'start audio']);
    expect(sent).toEqual([{ kind: 'signal', content: { kind: 'join', callId: 'remote-call-1', from: 'call-id-1' } }]);
    expect(h.view().calls.session).toMatchObject({ callId: 'remote-call-1', phase: 'joined' });
  });

  test('declining stops the ring and tells the caller', () => {
    h.dispatch(invite('c1', 'remote-call-1', 'remote-peer-1'));
    h.decline();
    expect(media.log).toEqual(['ring', 'stop audio', 'ring stop']);
    expect(sent).toEqual([{ kind: 'signal', content: { kind: 'decline', callId: 'remote-call-1' } }]);
    expect(h.view().calls.session).toBeNull();
    expect(toasts).toEqual([]);
  });

  test('an unanswered call hangs up once the ring times out', async () => {
    await h.start('c1', true, false);
    setSystemTime(NOW + CALL_RING_TIMEOUT_MS);
    timers.fire();
    expect(toasts).toEqual(['No answer']);
    expect(sent.at(-1)).toEqual({ kind: 'signal', content: { kind: 'leave', callId: 'call-id-1', from: 'call-id-2' } });
    expect(h.view().calls.session).toBeNull();
    expect(timers.running.size).toBe(0);
  });
});

describe('media that arrives too late', () => {
  test('a microphone that opens after the caller hung up is stopped', async () => {
    h.dispatch(invite('c1', 'remote-call-1', 'remote-peer-1'));
    const mic = media.hold('user');
    const joining = h.join('c1', true);
    await mic.reached;
    h.dispatch(signal('c1', { kind: 'leave', callId: 'remote-call-1', from: 'remote-peer-1' }));
    expect(toasts).toEqual(['Missed call']);
    mic.open();
    await joining;
    expect(media.log).toEqual(['ring', 'ring stop', 'prepare', 'mic', 'stop audio', 'stop audio']);
    expect(stopCounts()).toEqual([1]);
    expect(sent).toEqual([]);
    expect(h.view().calls.session).toBeNull();
  });

  test('an account switch while audio starts drops the call before it is announced', async () => {
    const starting = media.hold('start');
    const call = h.start('c1', true, false);
    await starting.reached;
    h.reset();
    starting.open();
    await call;
    expect(media.log).toEqual(['prepare', 'mic', 'start audio', 'stop audio', 'stop audio']);
    expect(stopCounts()).toEqual([1]);
    expect(sent).toEqual([]);
    expect(h.view().calls.session).toBeNull();
  });

  test('a call that starts ringing while the microphone opens wins', async () => {
    const mic = media.hold('user');
    const call = h.start('c1', true, false);
    await mic.reached;
    h.dispatch(invite('c2', 'remote-call-2', 'remote-peer-2'));
    mic.open();
    await call;
    expect(media.log).toEqual(['prepare', 'mic', 'stop audio', 'ring']);
    expect(stopCounts()).toEqual([1]);
    expect(sent).toEqual([]);
    expect(h.view().calls.session).toMatchObject({ convId: 'c2', phase: 'ringing' });
  });

  test('a ring that arrives while audio starts lets the start finish, then releases it', async () => {
    const starting = media.hold('start');
    const call = h.start('c1', true, false);
    await starting.reached;
    h.dispatch(invite('c2', 'remote-call-2', 'remote-peer-2'));
    starting.open();
    await call;
    expect(media.log).toEqual(['prepare', 'mic', 'start audio', 'stop audio', 'ring']);
    expect(stopCounts()).toEqual([1]);
    expect(sent).toEqual([]);
    expect(h.view().calls.session).toMatchObject({ convId: 'c2', phase: 'ringing' });
  });

  test('the inbox id that resolves after an account switch is not shown', async () => {
    const self = media.hold('self');
    const call = h.start('c1', true, false);
    await self.reached;
    h.reset();
    self.open();
    await call;
    expect(media.log).toEqual(['stop audio']);
    expect(h.view().selfInboxId).toBeNull();
    expect(sent).toEqual([]);
  });

  test('a camera that opens after the call ended is stopped', async () => {
    await h.start('c1', true, false);
    const camera = media.hold('user');
    const toggling = h.toggleCamera();
    await camera.reached;
    h.leave();
    camera.open();
    await toggling;
    expect(media.log).toEqual(['prepare', 'mic', 'start audio', 'camera', 'stop audio']);
    expect(stopCounts()).toEqual([1, 1]);
  });

  test('one capture at a time: other actions are ignored while it runs', async () => {
    const mic = media.hold('user');
    const first = h.start('c1', true, false);
    await mic.reached;
    await h.start('c2', true, false);
    await h.toggleCamera();
    mic.open();
    await first;
    expect(media.log).toEqual(['prepare', 'mic', 'start audio']);
    expect(h.view().calls.session?.convId).toBe('c1');
  });
});

describe('in a call', () => {
  test('a joining peer gets an offer, and hanging up closes it and tells the others', async () => {
    await h.start('c1', false, false);
    h.dispatch(signal('c1', { kind: 'join', callId: 'call-id-1', from: 'remote-peer-1' }));
    await flush();
    expect(peers.opened).toHaveLength(1);
    expect(h.view().peers.map((p) => p.inboxId)).toEqual([PEER]);
    expect(sent.at(-1)).toEqual({
      kind: 'signal',
      content: { kind: 'offer', callId: 'call-id-1', from: 'call-id-2', to: 'remote-peer-1', sdp: 'offer sdp' },
    });
    h.leave();
    expect(sent.at(-1)).toEqual({ kind: 'signal', content: { kind: 'leave', callId: 'call-id-1', from: 'call-id-2' } });
    expect(peers.opened[0]?.closed).toBe(1);
    expect(stopCounts()).toEqual([1]);
    expect(media.log.at(-1)).toBe('stop audio');
    expect(h.view().peers).toEqual([]);
    expect(timers.running.size).toBe(0);
    expect(toasts).toEqual([]);
  });

  test('the other side hanging up a DM ends the call with a notice', async () => {
    await h.start('c1', true, false);
    h.dispatch(signal('c1', { kind: 'join', callId: 'call-id-1', from: 'remote-peer-1' }));
    await flush();
    h.dispatch(signal('c1', { kind: 'leave', callId: 'call-id-1', from: 'remote-peer-1' }));
    expect(toasts).toEqual(['Call ended']);
    expect(peers.opened[0]?.closed).toBe(1);
    expect(h.view().calls.session).toBeNull();
  });

  test('muting tells every peer', async () => {
    await h.start('c1', false, false);
    h.dispatch(signal('c1', { kind: 'join', callId: 'call-id-1', from: 'remote-peer-1' }));
    await flush();
    peers.opened[0]?.open();
    h.toggleMic();
    await flush();
    expect(peers.opened[0]?.sent).toEqual([
      JSON.stringify({ audio: true, video: false, screen: false }),
      JSON.stringify({ audio: false, video: false, screen: false }),
    ]);
    expect(peers.opened[0]?.replaced).toBe(1);
    expect(h.view().media.audio).toBe(false);
  });

  test('the camera swaps the preview and the audio route on and off', async () => {
    await h.start('c1', true, false);
    await h.toggleCamera();
    const camera = media.tracks[1];
    expect(media.log.slice(3)).toEqual(['camera', 'start video']);
    expect(h.view().media).toEqual({ audio: true, video: true, screen: false });
    expect(previewTrack()).toBe(camera);
    await h.toggleCamera();
    expect(media.log.slice(5)).toEqual(['start audio']);
    expect(h.view().media.video).toBe(false);
    expect(h.view().preview).toBeNull();
    expect(camera?.stops).toBe(1);
  });

  test('a refused camera says so', async () => {
    await h.start('c1', true, false);
    media.settings.cameraRefused = true;
    await h.toggleCamera();
    expect(toasts).toEqual(['Allow camera access to turn on video']);
    expect(h.view().media.video).toBe(false);
  });

  test('a shared screen shows until the system ends the share', async () => {
    await h.start('c1', true, false);
    await h.toggleScreen(null);
    const screen = media.tracks[1];
    expect(media.log.slice(3)).toEqual(['display', `watch ${screen?.id ?? ''}`]);
    expect(h.view().media).toEqual({ audio: true, video: true, screen: true });
    expect(previewTrack()).toBe(screen);
    media.screenEnds[0]?.();
    await flush();
    expect(h.view().media.screen).toBe(false);
    expect(h.view().preview).toBeNull();
    expect(screen?.stops).toBe(1);
  });

  test('a screen share that ended before it started is dropped', async () => {
    await h.start('c1', true, false);
    media.settings.screenEnded = true;
    await h.toggleScreen(null);
    expect(media.log.slice(3)).toEqual(['display']);
    expect(media.tracks[1]).toBeInstanceOf(FakeTrack);
    expect(stopCounts()).toEqual([0, 1]);
    expect(h.view().media.screen).toBe(false);
  });

  test('an account switch ends the call without a word and resets the view', async () => {
    await h.start('c1', true, false);
    const generation = h.generation();
    h.reset();
    expect(h.view()).toMatchObject({ calls: EMPTY_CALLS, selfInboxId: null, preview: null, peers: [] });
    expect(h.view().media).toEqual({ audio: false, video: false, screen: false });
    expect(h.generation()).toBe(generation + 1);
    expect(inboundResets).toBe(1);
    expect(stopCounts()).toEqual([1]);
    expect(sent).toHaveLength(1);
    expect(timers.running.size).toBe(0);
  });
});

describe('the capture token', () => {
  test('the platform holds a token that goes stale when the call ends, and the next call gets a new one', async () => {
    await h.start('c1', true, false);
    const [preparing, starting] = media.tokens;
    expect([preparing?.live(), starting?.live()]).toEqual([true, true]);
    h.leave();
    expect([preparing?.live(), starting?.live()]).toEqual([false, false]);
    await h.start('c1', true, false);
    expect(media.tokens.slice(2).map((t) => t.live())).toEqual([true, true]);
  });

  test('an account switch cancels the token of a capture in progress', async () => {
    const preparing = media.hold('prepare');
    const call = h.start('c1', true, false);
    await preparing.reached;
    h.reset();
    expect(media.tokens[0]?.live()).toBe(false);
    preparing.open();
    await call;
    expect(media.log).toEqual(['prepare', 'stop audio', 'mic', 'stop audio']);
    expect(stopCounts()).toEqual([1]);
  });

  test('sharing the screen hands the screen picker to the platform', async () => {
    await h.start('c1', true, false);
    const picker = { show: () => undefined };
    await h.toggleScreen(picker);
    expect(media.pickers).toEqual([picker]);
  });

  test('acquire keeps what arrives while the token is live and the media is still wanted', async () => {
    const disposed: string[] = [];
    const dispose = (media: string): void => {
      disposed.push(media);
    };
    const live = { live: () => true };
    const stale = { live: () => false };
    expect(await acquire(live, async () => 'kept', dispose)).toBe('kept');
    expect(await acquire(stale, async () => 'late', dispose)).toBeNull();
    expect(
      await acquire(
        live,
        async () => 'unwanted',
        dispose,
        (media) => media !== 'unwanted',
      ),
    ).toBeNull();
    expect(await acquire(stale, async () => null, dispose)).toBeNull();
    expect(disposed).toEqual(['late', 'unwanted']);
  });
});
