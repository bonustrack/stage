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
 *  Phase 0 only needs `mediaDevices.getUserMedia` + the `RTCView` component to
 *  prove the module compiles into the dev APK and the local camera renders. */

import type {
  mediaDevices as MediaDevicesNS,
  RTCView as RTCViewComponent,
  MediaStream as MediaStreamClass,
} from 'react-native-webrtc';

/** The slice of react-native-webrtc Phase 0 consumes — typed precisely (no
 *  `any`) off the package's own declarations. */
export interface WebRTCModule {
  mediaDevices: typeof MediaDevicesNS;
  RTCView: typeof RTCViewComponent;
  MediaStream: typeof MediaStreamClass;
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
      mod.MediaStream
    ) {
      cached = {
        mediaDevices: mod.mediaDevices,
        RTCView: mod.RTCView,
        MediaStream: mod.MediaStream,
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
