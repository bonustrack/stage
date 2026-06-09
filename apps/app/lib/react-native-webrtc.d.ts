/** Ambient stub for `react-native-webrtc`.
 *
 *  react-native-webrtc is a NATIVE dependency added to apps/app/package.json but
 *  NOT installed in this repo's shared node_modules (the install would pull the
 *  GB-scale native libs / fill the disk - see the DISK RULE). The real types
 *  ship with the package once the dev/preview APK build runs `npm install`.
 *
 *  Until then, this minimal ambient declaration lets `tsc` typecheck the call
 *  layer (lib/webrtc.ts, lib/call.peer.ts) against the exact surface we consume.
 *  It is intentionally a SUBSET; the published declarations supersede it at
 *  build time. Everything here is resolved lazily at runtime via require() in
 *  lib/webrtc.ts, so the stub never affects the bundle. */

declare module 'react-native-webrtc' {
  import type { ComponentType } from 'react';

  export class MediaStreamTrack {
    kind: string;
    enabled: boolean;
    stop(): void;
    _switchCamera?(): void;
  }

  export class MediaStream {
    toURL(): string;
    getTracks(): MediaStreamTrack[];
    getAudioTracks(): MediaStreamTrack[];
    getVideoTracks(): MediaStreamTrack[];
  }

  export interface RTCSessionDescriptionInit { type: string; sdp?: string }
  export interface RTCIceCandidateInit {
    candidate: string;
    sdpMid?: string | null;
    sdpMLineIndex?: number | null;
  }

  export class RTCSessionDescription {
    constructor(init: RTCSessionDescriptionInit);
    type: string;
    sdp?: string;
  }
  export class RTCIceCandidate {
    constructor(init: RTCIceCandidateInit);
  }

  export interface RTCRtpSender {
    track: MediaStreamTrack | null;
    replaceTrack(track: MediaStreamTrack | null): Promise<void>;
  }

  export class RTCPeerConnection {
    constructor(config?: { iceServers?: { urls: string | string[] }[] });
    connectionState?: string;
    addTrack(track: MediaStreamTrack, stream: MediaStream): void;
    getSenders(): RTCRtpSender[];
    createOffer(options?: object): Promise<RTCSessionDescriptionInit>;
    createAnswer(options?: object): Promise<RTCSessionDescriptionInit>;
    setLocalDescription(desc: RTCSessionDescriptionInit): Promise<void>;
    setRemoteDescription(desc: RTCSessionDescription): Promise<void>;
    addIceCandidate(candidate: RTCIceCandidate): Promise<void>;
    close(): void;
  }

  export const mediaDevices: {
    getUserMedia(constraints: object): Promise<MediaStream>;
    getDisplayMedia(): Promise<MediaStream>;
  };

  export const RTCView: ComponentType<{
    streamURL: string;
    style?: object;
    objectFit?: 'contain' | 'cover';
    mirror?: boolean;
    zOrder?: number;
  }>;
}
