import { describe, expect, test } from 'bun:test';
import { closePeer, negotiateSdp, openRtcPeer, parseMedia, replaceOutgoing, type RtcPlatform } from '../lib/calls.peer.core';
import { FakeStream } from './callsFakes';

interface Track {
  kind: string;
}
type Connection = Parameters<typeof negotiateSdp<Track>>[0];

function fakeConnection() {
  const sent: (Track | null)[] = [];
  const listeners = new Set<() => void>();
  const transceivers: ReturnType<Connection['getTransceivers']> = [];
  const add = (kind: string): void => {
    transceivers.push({
      receiver: { track: { kind } },
      direction: 'recvonly',
      sender: {
        replaceTrack: async (track) => {
          sent.push(track);
        },
      },
    });
  };
  const pc: Connection = {
    iceGatheringState: 'new',
    localDescription: null,
    addTransceiver: (kind) => {
      add(kind);
    },
    getTransceivers: () => transceivers,
    setRemoteDescription: async () => {
      add('audio');
      add('video');
    },
    setLocalDescription: async () => {
      pc.localDescription = { sdp: 'before gathering' };
      pc.iceGatheringState = 'gathering';
      setTimeout(() => {
        pc.localDescription = { sdp: 'sdp with direct candidates' };
        pc.iceGatheringState = 'complete';
        for (const listener of listeners) listener();
      }, 0);
    },
    addEventListener: (_, listener) => {
      listeners.add(listener);
    },
    removeEventListener: (_, listener) => {
      listeners.delete(listener);
    },
  };
  return { pc, sent, listeners, transceivers };
}

describe('shared native and web call negotiation', () => {
  test('offer sends the gathered SDP, with audio and video transceivers', async () => {
    const { pc, sent, listeners, transceivers } = fakeConnection();
    const audio = { kind: 'audio' };
    expect(await negotiateSdp(pc, () => ({ audio, video: null }))).toBe('sdp with direct candidates');
    expect(transceivers).toHaveLength(2);
    expect(sent).toEqual([audio, null]);
    expect(listeners.size).toBe(0);
  });

  test('answer changes receivers to sendrecv and supports video replacement without renegotiation', async () => {
    const { pc, sent, transceivers } = fakeConnection();
    const video = { kind: 'video' };
    await negotiateSdp(pc, () => ({ audio: null, video }), 'remote offer');
    expect(transceivers.every((t) => t.direction === 'sendrecv')).toBe(true);
    expect(sent).toEqual([null, video]);
    await replaceOutgoing(pc, { audio: null, video: null });
    expect(sent).toEqual([null, video, null, null]);
  });

  test('only boolean media flags from JSON are enabled', () => {
    expect(parseMedia('{"audio":true,"video":1,"screen":"true"}')).toEqual({ audio: true, video: false, screen: false });
    for (const invalid of ['null', '3', 'bad JSON', 123]) expect(parseMedia(invalid)).toBeNull();
  });
});

describe('the peer connection both platforms open', () => {
  test('adds received tracks, follows the link state, sends our media once open and closes everything', () => {
    type Listener = (event: { track: Track | null; data: unknown }) => void;
    const log: string[] = [];
    const on = new Map<string, Listener>();
    const fire = (type: string, track: Track | null = null): void => {
      on.get(type)?.({ track, data: undefined });
    };
    const channel = {
      readyState: 'connecting',
      send: (data: string) => {
        log.push(`send ${data}`);
      },
      close: () => {
        log.push('channel close');
      },
      addEventListener: (type: string, listener: Listener) => {
        on.set(`channel ${type}`, listener);
      },
    };
    const { pc } = fakeConnection();
    let connectionState = 'new';
    const connection: ReturnType<RtcPlatform<Track>['connect']> = {
      ...pc,
      get connectionState() {
        return connectionState;
      },
      createDataChannel: (label, init) => {
        log.push(`channel ${label} ${init.id}`);
        return channel;
      },
      addEventListener: (type: string, listener: Listener) => {
        on.set(type, listener);
      },
      close: () => {
        log.push('connection close');
      },
    };
    let changes = 0;
    const peer = openRtcPeer<Track>(
      {
        connect: (config) => {
          log.push(`connect ${config.bundlePolicy}`);
          return connection;
        },
        remote: () => ({
          stream: { platform: 'web', value: new FakeStream() },
          add: (track) => {
            log.push(`add ${track.kind}`);
          },
          release: () => {
            log.push('release');
          },
        }),
        track: (track) => (track ? { kind: track.value.kind } : null),
      },
      {
        onChange: () => {
          changes += 1;
        },
        mine: () => ({ audio: true, video: false, screen: false }),
        onLost: () => {
          log.push('lost');
        },
      },
    );
    fire('track');
    fire('track', { kind: 'audio' });
    connectionState = 'connected';
    fire('connectionstatechange');
    channel.readyState = 'open';
    fire('channel open');
    closePeer(peer);
    expect(peer.status).toBe('connected');
    expect(changes).toBe(3);
    expect(log).toEqual([
      'connect max-bundle',
      'channel media 0',
      'add audio',
      `send ${JSON.stringify({ audio: true, video: false, screen: false })}`,
      'channel close',
      'connection close',
      'release',
    ]);
  });
});
