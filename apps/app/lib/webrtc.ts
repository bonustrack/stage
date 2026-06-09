/** react-native-webrtc native-availability guard.
 *
 *  react-native-webrtc is a NATIVE module: a top-level `import` throws at
 *  module-eval time ("native module RTCVideoView could not be found") on any
 *  APK built without it, and the Metro bundler must resolve the package on the
 *  dev machine even though it can't link the native side there. So — mirroring
 *  lib/railgun/native.ts + components/VoiceMessage.decode.ts — we resolve it
 *  LAZILY + OPTIONALLY via `require` inside a try/catch and memoize the result.
 *  When unavailable (e.g. an APK built before this branch, or a web/Expo Go
 *  bundle) every accessor returns null and the caller degrades to a friendly
 *  "WebRTC needs the dev build" instead of crashing.
 *
 *  Exposes the full slice the call layer consumes: media capture
 *  (getUserMedia / getDisplayMedia), the RTCView renderer, and the peer
 *  connection + SDP/ICE constructors. */

import type {
  mediaDevices as MediaDevicesNS,
  RTCView as RTCViewComponent,
  MediaStream as MediaStreamClass,
  MediaStreamTrack as MediaStreamTrackClass,
  RTCPeerConnection as RTCPeerConnectionClass,
  RTCSessionDescription as RTCSessionDescriptionClass,
  RTCIceCandidate as RTCIceCandidateClass,
} from 'react-native-webrtc';

/** The slice of react-native-webrtc the call layer consumes — typed precisely
 *  (no `any`) off the package's own declarations. */
export interface WebRTCModule {
  mediaDevices: typeof MediaDevicesNS;
  RTCView: typeof RTCViewComponent;
  MediaStream: typeof MediaStreamClass;
  MediaStreamTrack: typeof MediaStreamTrackClass;
  RTCPeerConnection: typeof RTCPeerConnectionClass;
  RTCSessionDescription: typeof RTCSessionDescriptionClass;
  RTCIceCandidate: typeof RTCIceCandidateClass;
}

let resolved = false;
let cached: WebRTCModule | null = null;

/** Resolve react-native-webrtc once, lazily, behind a try/catch. Returns the
 *  module slice or null when the native module isn't present in the binary.
 *  Never throws. */
export function getWebRTC(): WebRTCModule | null {
  if (resolved) return cached;
  resolved = true;
  try {
    const mod = require('react-native-webrtc') as Partial<WebRTCModule>;
    if (
      mod &&
      typeof mod.mediaDevices?.getUserMedia === 'function' &&
      mod.RTCView &&
      mod.MediaStream &&
      mod.RTCPeerConnection &&
      mod.RTCSessionDescription &&
      mod.RTCIceCandidate
    ) {
      cached = {
        mediaDevices: mod.mediaDevices,
        RTCView: mod.RTCView,
        MediaStream: mod.MediaStream,
        MediaStreamTrack: mod.MediaStreamTrack as typeof MediaStreamTrackClass,
        RTCPeerConnection: mod.RTCPeerConnection,
        RTCSessionDescription: mod.RTCSessionDescription,
        RTCIceCandidate: mod.RTCIceCandidate,
      };
    } else {
      cached = null;
    }
  } catch {
    cached = null;
  }
  return cached;
}

/** True when the native WebRTC module linked into this binary. */
export function isWebRTCAvailable(): boolean {
  return getWebRTC() !== null;
}

/** ICE server configuration for RTCPeerConnection.
 *
 *  STUN-only by default — purest "fully P2P": STUN servers only help each peer
 *  discover its own public address (NAT reflexive candidate); media still flows
 *  directly peer-to-peer. They never relay media. The trade-off is that ~10-20%
 *  of NAT combinations (notably symmetric-NAT on both ends) fail to connect
 *  without a TURN relay — and a TURN relay, by definition, routes media through
 *  a server, so it is NOT pure P2P.
 *
 *  This is a product decision flagged for Less (STUN-only vs STUN + TURN
 *  fallback). For now we ship Google's public STUN; a TURN entry can be appended
 *  here later (or fed from a remote config) without touching call logic. */
export const ICE_SERVERS: ReadonlyArray<{ urls: string | string[] }> = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];
