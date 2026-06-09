/** Call UI state shape + initial value, split out of useCall.ts (file-size
 *  lint). Pure types + a const — no React, no WebRTC. */

import type { CallMedia, CallEndReason } from './call.types';

/** UI-facing call phases. */
export type CallPhase =
  | 'idle' | 'inviting' | 'ringing' | 'connecting' | 'connected' | 'ended';

export interface CallState {
  phase: CallPhase;
  callId: string | null;
  /** True when WE initiated (caller); false when the peer invited us (callee). */
  outgoing: boolean;
  media: CallMedia;
  micOn: boolean;
  camOn: boolean;
  sharingScreen: boolean;
  endReason: CallEndReason | null;
  /** Remote stream URL (RTCView.streamURL) once the remote track arrives. */
  remoteUrl: string | null;
  /** Local stream URL for the self-preview. */
  localUrl: string | null;
}

export const INITIAL_CALL_STATE: CallState = {
  phase: 'idle', callId: null, outgoing: false,
  media: { audio: true, video: true },
  micOn: true, camOn: true, sharingScreen: false,
  endReason: null, remoteUrl: null, localUrl: null,
};
