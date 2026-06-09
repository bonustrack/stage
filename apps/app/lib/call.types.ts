/** P2P call signaling content type - `metro.box/call:1.0`.
 *
 *  WebRTC signaling (the SDP offer/answer + trickled ICE candidates + the
 *  call-control verbs: invite/ringing/accept/reject/hangup) is carried as
 *  ordinary XMTP messages on the SAME conversation as the chat, using a
 *  dedicated JSContentCodec (see callCodec.ts). Pure-JS UTF-8 JSON body, so NO
 *  native module / dev-client rebuild is needed for the SIGNALING layer; the
 *  native dep (react-native-webrtc) is only for the MEDIA layer.
 *
 *  Every signal carries a `callId` (minted by the inviter) so concurrent /
 *  stale calls on one conversation never cross-talk, and a `kind` discriminant.
 *  The conversation `line` (account-scoped `metro://xmtp/<account>/<conv>`) is
 *  the transport - the same line the chat rides on - so signals are end-to-end
 *  encrypted by MLS like every other message and sync across the peer's devices.
 *
 *  These are CONTROL messages: the call layer consumes them off the global
 *  message stream and they are never rendered as chat bubbles. */

/** Full content-type id string, RN-SDK form. */
export const CALL_CONTENT_TYPE_ID = 'metro.box/call:1.0';

/** Content-type descriptor (structurally the RN SDK's ContentTypeId). */
export const CALL_CONTENT_TYPE = {
  authorityId: 'metro.box', typeId: 'call', versionMajor: 1, versionMinor: 0,
} as const;

/** What media the inviter is offering / the call currently carries. */
export interface CallMedia {
  audio: boolean;
  video: boolean;
}

/** Discriminated signal kinds for the call handshake state machine:
 *
 *    invite   -> caller rings callee (carries offered media)
 *    ringing  -> callee acks it is alerting the user (optional, for UI)
 *    accept   -> callee accepted; caller now creates the offer
 *    reject   -> callee declined (or busy / unsupported)
 *    offer    -> SDP offer (caller -> callee)
 *    answer   -> SDP answer (callee -> caller)
 *    ice      -> a trickled ICE candidate (either direction)
 *    media    -> a mid-call media-state change (mute / camera / screenshare)
 *    hangup   -> either side ended the call
 */
export type CallSignalKind =
  | 'invite' | 'ringing' | 'accept' | 'reject'
  | 'offer' | 'answer' | 'ice' | 'media' | 'hangup';

/** SDP description payload (subset of RTCSessionDescriptionInit). */
export interface CallSdp {
  type: 'offer' | 'answer';
  sdp: string;
}

/** Trickled ICE candidate payload (subset of RTCIceCandidateInit). */
export interface CallIce {
  candidate: string;
  sdpMid?: string | null;
  sdpMLineIndex?: number | null;
}

/** Why a call ended / was declined - drives the UI + call-log line. */
export type CallEndReason =
  | 'declined' | 'busy' | 'cancelled' | 'ended'
  | 'unsupported' | 'failed' | 'timeout';

/** The wire body for `metro.box/call:1.0`. One shape, `kind`-discriminated. */
export interface CallSignal {
  /** Stable id minted by the inviter; every signal of this call carries it. */
  callId: string;
  kind: CallSignalKind;
  /** Offered / current media (present on invite + media; optional elsewhere). */
  media?: CallMedia;
  /** Present on offer / answer. */
  sdp?: CallSdp;
  /** Present on ice. */
  ice?: CallIce;
  /** Present on reject / hangup. */
  reason?: CallEndReason;
  /** Monotonic-ish creation time (ms) for ordering / stale-call dedupe. */
  ts: number;
}

/** Mint a stable call id. Mirrors mintPollId (crypto.randomUUID with fallback). */
export function mintCallId(): string {
  const g = globalThis as { crypto?: { randomUUID?: () => string } };
  if (g.crypto?.randomUUID) return g.crypto.randomUUID();
  return `call_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

/** Plain-text rendering used as the EncodedContent.fallback so vanilla XMTP
 *  clients (and any Metro client missing this codec) show something readable
 *  instead of a blank/error bubble. Signals are control traffic, so the
 *  fallback is intentionally terse. */
export function callFallbackText(sig: CallSignal): string {
  switch (sig.kind) {
    case 'invite': {
      const m = sig.media;
      const label = m?.video ? 'video' : 'voice';
      return `📞 Incoming ${label} call`;
    }
    case 'accept': return '📞 Call accepted';
    case 'reject': return '📞 Call declined';
    case 'hangup': return '📞 Call ended';
    default: return '📞 Call signaling';
  }
}

/** Build the canonical invite signal. */
export function buildInvite(callId: string, media: CallMedia): CallSignal {
  return { callId, kind: 'invite', media, ts: Date.now() };
}
