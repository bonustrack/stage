import { EMPTY_CALLS, type CallsState } from '@stage-labs/client/xmtp/callMachine';
import { makeListeners, useStoreValue } from './storeCore';
import type { CallStream } from './calls.types';

export interface CallMedia { audio: boolean; video: boolean; screen: boolean }

export type CallLinkStatus = 'connecting' | 'connected' | 'failed';

export interface CallPeerView {
  peerId: string;
  inboxId: string;
  stream: CallStream;
  media: CallMedia;
  status: CallLinkStatus;
}

export interface CallView {
  calls: CallsState;
  selfInboxId: string | null;
  preview: CallStream | null;
  media: CallMedia;
  peers: CallPeerView[];
}

export const NO_MEDIA: CallMedia = { audio: false, video: false, screen: false };

const listeners = makeListeners();

let view: CallView = { calls: EMPTY_CALLS, selfInboxId: null, preview: null, media: NO_MEDIA, peers: [] };

export function callView(): CallView {
  return view;
}

export function setCallView(patch: Partial<CallView>): void {
  view = { ...view, ...patch };
  listeners.notify();
}

export function useCallView(): CallView {
  return useStoreValue(listeners.subscribe, callView);
}

let minimizedPeerId: string | null = null;

function callMinimized(): boolean {
  const session = view.calls.session;
  return session?.phase === 'joined' && session.selfPeerId !== null && session.selfPeerId === minimizedPeerId;
}

export function setCallMinimized(minimized: boolean): void {
  minimizedPeerId = minimized ? view.calls.session?.selfPeerId ?? null : null;
  listeners.notify();
}

export function useCallMinimized(): boolean {
  return useStoreValue(listeners.subscribe, callMinimized);
}
