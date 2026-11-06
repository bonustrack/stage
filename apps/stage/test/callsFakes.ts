import { makePeer, type Peer, type PeerHooks } from '../lib/calls.peer.core';
import type { CallStream, CallToken, CallTrack, CapturedMedia, ScreenPicker } from '../lib/calls.types';

export class FakeTrack extends EventTarget implements MediaStreamTrack {
  contentHint = '';
  enabled = true;
  readonly id: string;
  readonly kind: string;
  readonly label = '';
  readonly muted = false;
  onended = null;
  onmute = null;
  onunmute = null;
  readyState: MediaStreamTrackState = 'live';
  stops = 0;

  constructor(kind: string, id: string) {
    super();
    this.kind = kind;
    this.id = id;
  }

  applyConstraints(): Promise<void> {
    return Promise.resolve();
  }

  clone(): FakeTrack {
    return new FakeTrack(this.kind, `${this.id}-clone`);
  }

  getCapabilities(): MediaTrackCapabilities {
    return {};
  }

  getConstraints(): MediaTrackConstraints {
    return {};
  }

  getSettings(): MediaTrackSettings {
    return {};
  }

  stop(): void {
    this.readyState = 'ended';
    this.stops += 1;
  }
}

export class FakeStream extends EventTarget implements MediaStream {
  readonly active = true;
  readonly id = 'stream';
  onaddtrack = null;
  onremovetrack = null;
  readonly tracks: MediaStreamTrack[];

  constructor(tracks: MediaStreamTrack[] = []) {
    super();
    this.tracks = tracks;
  }

  addTrack(track: MediaStreamTrack): void {
    this.tracks.push(track);
  }

  clone(): FakeStream {
    return new FakeStream([...this.tracks]);
  }

  getAudioTracks(): MediaStreamTrack[] {
    return this.tracks.filter((t) => t.kind === 'audio');
  }

  getVideoTracks(): MediaStreamTrack[] {
    return this.tracks.filter((t) => t.kind === 'video');
  }

  getTrackById(id: string): MediaStreamTrack | null {
    return this.tracks.find((t) => t.id === id) ?? null;
  }

  getTracks(): MediaStreamTrack[] {
    return [...this.tracks];
  }

  removeTrack(track: MediaStreamTrack): void {
    this.tracks.splice(this.tracks.indexOf(track), 1);
  }
}

export interface Gate {
  reached: Promise<void>;
  open: () => void;
  pass: () => Promise<void>;
}

export function gate(): Gate {
  let arrive: () => void = () => undefined;
  let release: () => void = () => undefined;
  const reached = new Promise<void>((resolve) => {
    arrive = resolve;
  });
  const opened = new Promise<void>((resolve) => {
    release = resolve;
  });
  return {
    reached,
    open: release,
    pass: () => {
      arrive();
      return opened;
    },
  };
}

type Step = 'prepare' | 'user' | 'start' | 'display' | 'self';

export function fakeTrackOf(track: CallTrack | null): FakeTrack | null {
  return track?.platform === 'web' && track.value instanceof FakeTrack ? track.value : null;
}

export function fakeMedia() {
  const log: string[] = [];
  const gates = new Map<Step, Gate>();
  const tracks: FakeTrack[] = [];
  const screenEnds: (() => void)[] = [];
  const tokens: CallToken[] = [];
  const pickers: (ScreenPicker | null)[] = [];
  const settings = { cameraRefused: false, micRefused: false, screenEnded: false };
  const failures = new Set<Step>();
  let count = 0;
  const pass = async (step: Step): Promise<void> => {
    const pending = gates.get(step);
    gates.delete(step);
    if (pending) await pending.pass();
    if (failures.delete(step)) throw new Error(`${step} failed`);
  };
  const track = (kind: string, ended = false): CallTrack => {
    count += 1;
    const value = new FakeTrack(kind, `${kind}-${count}`);
    if (ended) value.readyState = 'ended';
    tracks.push(value);
    return { platform: 'web', value };
  };
  return {
    log,
    tracks,
    screenEnds,
    tokens,
    pickers,
    settings,
    failures,
    hold(step: Step): Gate {
      const next = gate();
      gates.set(step, next);
      return next;
    },
    pass,
    async userMedia(video: boolean, audio: boolean): Promise<CapturedMedia | null> {
      log.push(video && audio ? 'camera+mic' : video ? 'camera' : 'mic');
      await pass('user');
      if ((video && settings.cameraRefused) || (audio && settings.micRefused)) return null;
      return { audio: audio ? track('audio') : null, video: video ? track('video') : null };
    },
    async displayMedia(token: CallToken, picker: ScreenPicker | null): Promise<CallTrack | null> {
      log.push('display');
      tokens.push(token);
      pickers.push(picker);
      await pass('display');
      return track('video', settings.screenEnded);
    },
    previewOf(video: CallTrack): CallStream {
      if (video.platform !== 'web') throw new Error('web tracks only');
      return { platform: 'web', value: new FakeStream([video.value]) };
    },
    watchScreenEnd(video: CallTrack, ended: () => void): void {
      log.push(`watch ${video.value.id}`);
      screenEnds.push(ended);
    },
    async prepareAudio(token: CallToken): Promise<void> {
      log.push('prepare');
      tokens.push(token);
      await pass('prepare');
    },
    async startAudio(video: boolean, token: CallToken): Promise<void> {
      log.push(video ? 'start video' : 'start audio');
      tokens.push(token);
      await pass('start');
    },
    stopAudio(): void {
      log.push('stop audio');
    },
    startRingtone(): () => void {
      log.push('ring');
      return () => {
        log.push('ring stop');
      };
    },
  };
}

export type FakeMedia = ReturnType<typeof fakeMedia>;

export interface FakePeer {
  peer: Peer;
  hooks: PeerHooks;
  sent: string[];
  replaced: number;
  closed: number;
  open: () => void;
  state: (state: string) => void;
}

export function fakePeers() {
  const opened: FakePeer[] = [];
  return {
    opened,
    openPeer(hooks: PeerHooks): Peer {
      let events: Parameters<Parameters<typeof makePeer>[0]['bind']>[0] | null = null;
      const entry: FakePeer = {
        peer: makePeer(
          {
            stream: { platform: 'web', value: new FakeStream() },
            bind: (bound) => {
              events = bound;
            },
            replace: async () => {
              entry.replaced += 1;
            },
            offer: async () => 'offer sdp',
            answer: async () => 'answer sdp',
            accept: async () => undefined,
            send: (data) => {
              entry.sent.push(data);
            },
            close: () => {
              entry.closed += 1;
            },
          },
          hooks,
        ),
        hooks,
        sent: [],
        replaced: 0,
        closed: 0,
        open: () => {
          events?.open();
        },
        state: (state) => {
          events?.state(state);
        },
      };
      opened.push(entry);
      return entry.peer;
    },
  };
}

export function fakeTimers() {
  const running = new Map<number, () => void>();
  let next = 0;
  return {
    running,
    every(ms: number, run: () => void): () => void {
      void ms;
      next += 1;
      const id = next;
      running.set(id, run);
      return () => {
        running.delete(id);
      };
    },
    fire(): void {
      for (const run of [...running.values()]) run();
    },
  };
}
