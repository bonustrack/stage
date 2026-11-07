import { VIDEO_OFF_ABOVE } from '@stage-labs/client/xmtp/call';
import { EMPTY_CALLS, type CallEvent } from '@stage-labs/client/xmtp/callMachine';
import { NO_MEDIA } from './calls.store';
import { stopMedia, stopTrack, type CallToken, type CallTrack, type CapturedMedia, type ScreenPicker } from './calls.types';
import {
  callsOf,
  captureToken,
  dispatch,
  joinedCallId,
  newCallState,
  pushMedia,
  releaseMedia,
  releaseVideo,
  selfInboxId,
  stopRingtone,
  syncTimers,
  type CallInbound,
  type CallSessionDeps,
  type CallState,
} from './calls.machine.core';
import type { StreamMsg } from './xmtp.types';
import { ignore } from './errorPolicy';

export interface CallSessionApi {
  onMessage: (message: StreamMsg) => void;
  loadHistory: (convId: string) => Promise<void>;
  reset: () => void;
  leaveIfJoined: () => void;
  startCall: (convId: string, dm: boolean, video: boolean) => Promise<void>;
  joinCall: (convId: string, dm: boolean) => Promise<void>;
  declineCall: () => void;
  leaveCall: () => void;
  toggleMic: () => void;
  toggleCamera: () => Promise<void>;
  toggleScreen: (picker: ScreenPicker | null) => Promise<void>;
}

export async function acquire<T>(
  token: CallToken,
  getMedia: () => Promise<T | null>,
  dispose: (media: T) => void,
  wanted: (media: T) => boolean = () => true,
): Promise<T | null> {
  const media = await getMedia();
  if (media === null) return null;
  if (token.live() && wanted(media)) return media;
  dispose(media);
  return null;
}

function startAudioWith(
  s: CallState,
  media: CapturedMedia,
  token: CallToken,
  dispose: (media: CapturedMedia) => void,
): () => Promise<CapturedMedia> {
  return async () => {
    try {
      await s.deps.media.startAudio(media.video !== null, token);
    } catch (error) {
      dispose(media);
      throw error;
    }
    return media;
  };
}

async function exclusive(s: CallState, run: () => Promise<void>): Promise<void> {
  if (s.busy) return;
  s.busy = true;
  try {
    await run();
  } finally {
    s.busy = false;
    syncTimers(s);
  }
}

async function openMedia(s: CallState, video: boolean, token: CallToken): Promise<CapturedMedia | null> {
  const { media, toast } = s.deps;
  stopRingtone(s);
  try {
    await media.prepareAudio(token);
  } catch (error) {
    media.stopAudio();
    throw error;
  }
  const captured = (video ? await media.userMedia(true, true) : null) ?? (await media.userMedia(false, true));
  if (!captured) {
    media.stopAudio();
    toast('Allow microphone access to join the call');
  }
  return captured;
}

async function enter(s: CallState, wanted: () => boolean, video: boolean, event: (self: string) => CallEvent): Promise<void> {
  const token = captureToken(s);
  const self = await selfInboxId(s, s.generation);
  if (!token.live() || !wanted()) return;
  const release = (media: CapturedMedia): void => {
    stopMedia(media);
    s.deps.media.stopAudio();
  };
  const media = await acquire(token, () => openMedia(s, video, token), release, wanted);
  if (!media) return;
  const started = event(self);
  const ready = await acquire(token, startAudioWith(s, media, token, release), release);
  if (!ready) return;
  s.mic = ready.audio;
  s.camera = ready.video;
  dispatch(s, started);
  if (joinedCallId(s) === null) releaseMedia(s);
}

function startCall(s: CallState, convId: string, dm: boolean, video: boolean): Promise<void> {
  return exclusive(s, async () => {
    if (callsOf(s).session) return;
    const idle = (): boolean => callsOf(s).session === null;
    await enter(s, idle, video, (self) => {
      const { newId, now } = s.deps;
      return { type: 'start', convId, dm, video, callId: newId(), peerId: newId(), selfInboxId: self, nowMs: now() };
    });
  });
}

function canJoin(s: CallState, convId: string): boolean {
  const session = callsOf(s).session;
  return session === null || (session.phase === 'ringing' && session.convId === convId);
}

function joinCall(s: CallState, convId: string, dm: boolean): Promise<void> {
  return exclusive(s, async () => {
    const info = callsOf(s).calls[convId];
    if (!info || !canJoin(s, convId)) return;
    const crowded = Object.keys(info.roster).length >= VIDEO_OFF_ABOVE;
    await enter(
      s,
      () => canJoin(s, convId),
      info.video && !crowded,
      (self) => ({ type: 'join', convId, dm, peerId: s.deps.newId(), selfInboxId: self, nowMs: s.deps.now() }),
    );
  });
}

function toggleMic(s: CallState): void {
  if (!s.mic || joinedCallId(s) === null) return;
  s.mic.value.enabled = !s.mic.value.enabled;
  ignore(pushMedia(s), 'ui');
}

async function cameraOff(s: CallState, camera: CallTrack, callId: string, token: CallToken): Promise<void> {
  s.camera = null;
  try {
    await pushMedia(s);
  } finally {
    releaseVideo(s, camera);
  }
  if (joinedCallId(s) === callId) await s.deps.media.startAudio(false, token);
}

async function cameraOn(s: CallState, callId: string, token: CallToken): Promise<void> {
  const inCall = (): boolean => joinedCallId(s) === callId;
  const camera = async (): Promise<CapturedMedia | null> => {
    const media = await s.deps.media.userMedia(true, false);
    if (!media) s.deps.toast('Allow camera access to turn on video');
    return media;
  };
  const media = await acquire(token, camera, stopMedia, inCall);
  if (!media) return;
  const ready = await acquire(token, startAudioWith(s, media, token, stopMedia), stopMedia, inCall);
  if (!ready) return;
  s.camera = ready.video;
  await pushMedia(s);
}

function toggleCamera(s: CallState): Promise<void> {
  return exclusive(s, async () => {
    const callId = joinedCallId(s);
    if (callId === null) return;
    const token = captureToken(s);
    await (s.camera ? cameraOff(s, s.camera, callId, token) : cameraOn(s, callId, token));
  });
}

async function stopSharing(s: CallState, track: CallTrack): Promise<void> {
  s.screen = null;
  try {
    await pushMedia(s);
  } finally {
    releaseVideo(s, track);
  }
}

function shareScreen(s: CallState, track: CallTrack): Promise<void> {
  s.screen = track;
  s.deps.media.watchScreenEnd(track, () => {
    if (s.screen === track) ignore(stopSharing(s, track), 'ui');
  });
  return pushMedia(s);
}

function toggleScreen(s: CallState, picker: ScreenPicker | null): Promise<void> {
  return exclusive(s, async () => {
    const callId = joinedCallId(s);
    if (callId === null) return;
    if (s.screen) {
      await stopSharing(s, s.screen);
      return;
    }
    const token = captureToken(s);
    const live = (track: CallTrack): boolean => joinedCallId(s) === callId && !track.ended && track.value.readyState !== 'ended';
    const track = await acquire(token, () => s.deps.media.displayMedia(token, picker), stopTrack, live);
    if (track) await shareScreen(s, track);
  });
}

function reset(s: CallState, inbound: CallInbound): void {
  s.generation += 1;
  releaseMedia(s);
  inbound.reset();
  s.deps.view.set({ calls: EMPTY_CALLS, selfInboxId: null, preview: null, media: NO_MEDIA, peers: [] });
  syncTimers(s);
}

export function makeCallSession(deps: CallSessionDeps): CallSessionApi {
  const s = newCallState(deps);
  const inbound = deps.inbound({
    generation: () => s.generation,
    selfInboxId: (epoch) => selfInboxId(s, epoch),
    dispatch: (event) => {
      dispatch(s, event);
    },
  });
  return {
    onMessage: inbound.onMessage,
    loadHistory: inbound.reload,
    reset: () => {
      reset(s, inbound);
    },
    leaveIfJoined: () => {
      if (joinedCallId(s) !== null) dispatch(s, { type: 'leave' });
    },
    startCall: (convId, dm, video) => startCall(s, convId, dm, video),
    joinCall: (convId, dm) => joinCall(s, convId, dm),
    declineCall: () => {
      dispatch(s, { type: 'decline' });
    },
    leaveCall: () => {
      dispatch(s, { type: 'leave' });
    },
    toggleMic: () => {
      toggleMic(s);
    },
    toggleCamera: () => toggleCamera(s),
    toggleScreen: (picker) => toggleScreen(s, picker),
  };
}
