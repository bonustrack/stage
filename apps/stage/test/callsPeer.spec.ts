import { describe, expect, test } from 'bun:test';
import { negotiateSdp, parseMedia, replaceOutgoing } from '../lib/calls.peer.core';

interface Track { kind: string }
type Connection = Parameters<typeof negotiateSdp<Track>>[0];

function fakeConnection() {
  const sent: (Track | null)[] = [];
  const listeners = new Set<() => void>();
  const transceivers: ReturnType<Connection['getTransceivers']> = [];
  const add = (kind: string): void => {
    transceivers.push({ receiver: { track: { kind } }, direction: 'recvonly', sender: { replaceTrack: async track => { sent.push(track); } } });
  };
  const pc: Connection = {
    iceGatheringState: 'new', localDescription: null,
    addTransceiver: kind => { add(kind); }, getTransceivers: () => transceivers,
    setRemoteDescription: async () => { add('audio'); add('video'); },
    setLocalDescription: async () => {
      pc.localDescription = { sdp: 'before gathering' };
      pc.iceGatheringState = 'gathering';
      setTimeout(() => {
        pc.localDescription = { sdp: 'sdp with direct candidates' };
        pc.iceGatheringState = 'complete';
        for (const listener of listeners) listener();
      }, 0);
    },
    addEventListener: (_, listener) => { listeners.add(listener); },
    removeEventListener: (_, listener) => { listeners.delete(listener); },
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
    expect(transceivers.every(t => t.direction === 'sendrecv')).toBe(true);
    expect(sent).toEqual([null, video]);
    await replaceOutgoing(pc, { audio: null, video: null });
    expect(sent).toEqual([null, video, null, null]);
  });

  test('only boolean media flags from JSON are enabled', () => {
    expect(parseMedia('{"audio":true,"video":1,"screen":"true"}')).toEqual({ audio: true, video: false, screen: false });
    for (const invalid of ['null', '3', 'bad JSON', 123]) expect(parseMedia(invalid)).toBeNull();
  });
});
