import { EMPTY_CALLS, activeCall, type CallInfo, type CallsState } from '@stage-labs/client/xmtp/callMachine';
import { makeListeners, useStoreValue } from './storeCore';

export interface CallMedia { audio: boolean; video: boolean; screen: boolean }

export type CallLinkStatus = 'connecting' | 'connected' | 'failed';

export interface CallPeerView {
  peerId: string;
  inboxId: string;
  stream: MediaStream;
  media: CallMedia;
  status: CallLinkStatus;
}

export interface CallView {
  calls: CallsState;
  selfInboxId: string | null;
  preview: MediaStream | null;
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

export function joinableCall(v: CallView, convId: string): CallInfo | null {
  if (v.calls.session?.convId === convId) return null;
  return activeCall(v.calls, convId, Date.now());
}
