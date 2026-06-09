/** RTCPeerConnection wrapper for a 1:1 P2P call.
 *
 *  Thin imperative layer over react-native-webrtc's RTCPeerConnection that the
 *  useCall hook drives. Owns: the local capture stream (camera+mic), the peer
 *  connection, the remote stream, and the screenshare display track. Emits SDP
 *  + ICE outward via callbacks (the hook ships them over XMTP). All WebRTC types
 *  are reached through the lazy `getWebRTC()` guard so the module never throws
 *  on a binary without the native lib.
 *
 *  Pure mechanics — NO XMTP, NO React. Signaling glue lives in useCall.ts. */

import { getWebRTC, ICE_SERVERS, type WebRTCModule } from './webrtc';
import type { CallIce, CallMedia, CallSdp } from './call.types';

/** Minimal structural types — react-native-webrtc's classes, reached at runtime
 *  through the guard. We avoid importing the values (native) at module scope. */
type RTCPeerConnection = InstanceType<WebRTCModule['RTCPeerConnection']>;
type MediaStream = InstanceType<WebRTCModule['MediaStream']>;

export interface PeerCallbacks {
  /** A locally-generated SDP (offer or answer) ready to ship to the peer. */
  onLocalSdp: (sdp: CallSdp) => void;
  /** A locally-gathered ICE candidate ready to trickle to the peer. */
  onLocalIce: (ice: CallIce) => void;
  /** The remote media stream arrived / changed. */
  onRemoteStream: (stream: MediaStream | null) => void;
  /** Connection state moved (drives "connecting" -> "connected" -> "failed"). */
  onConnectionState: (state: string) => void;
}

/** The live WebRTC half of one call. Construct, `start(media)` to capture +
 *  build the peer connection, then drive the SDP/ICE handshake. `close()` tears
 *  everything down (tracks + connection). */
export class CallPeer {
  private rtc: WebRTCModule;
  private pc: RTCPeerConnection | null = null;
  private local: MediaStream | null = null;
  private screen: MediaStream | null = null;
  private cbs: PeerCallbacks;

  constructor(cbs: PeerCallbacks) {
    const rtc = getWebRTC();
    if (!rtc) throw new Error('WebRTC native module is unavailable (needs the dev build).');
    this.rtc = rtc;
    this.cbs = cbs;
  }

  /** Capture local media + create the RTCPeerConnection with our ICE servers,
   *  wiring the event handlers that surface SDP/ICE/remote-stream/state. */
  async start(media: CallMedia): Promise<MediaStream> {
    const local = (await this.rtc.mediaDevices.getUserMedia({
      audio: media.audio,
      video: media.video ? { facingMode: 'user' } : false,
    })) as unknown as MediaStream;
    this.local = local;

    const pc = new this.rtc.RTCPeerConnection({ iceServers: ICE_SERVERS as { urls: string }[] });
    this.pc = pc;
    local.getTracks().forEach((t) => pc.addTrack(t, local));

    // react-native-webrtc exposes events as assignable on* props.
    const anyPc = pc as unknown as Record<string, unknown>;
    anyPc.onicecandidate = (e: { candidate: CallIce | null }): void => {
      if (e?.candidate) {
        this.cbs.onLocalIce({
          candidate: e.candidate.candidate,
          sdpMid: e.candidate.sdpMid ?? null,
          sdpMLineIndex: e.candidate.sdpMLineIndex ?? null,
        });
      }
    };
    anyPc.ontrack = (e: { streams?: MediaStream[] }): void => {
      const remote = e?.streams?.[0] ?? null;
      this.cbs.onRemoteStream(remote);
    };
    anyPc.onconnectionstatechange = (): void => {
      const state = (pc as unknown as { connectionState?: string }).connectionState ?? 'unknown';
      this.cbs.onConnectionState(state);
    };
    return local;
  }

  /** Caller side: create + set + return the SDP offer (also fired via callback). */
  async createOffer(): Promise<void> {
    const pc = this.requirePc();
    const offer = await pc.createOffer({});
    await pc.setLocalDescription(offer);
    this.cbs.onLocalSdp({ type: 'offer', sdp: offer.sdp ?? '' });
  }

  /** Callee side: apply the remote offer, then create + set + emit the answer. */
  async acceptOffer(sdp: CallSdp): Promise<void> {
    const pc = this.requirePc();
    await pc.setRemoteDescription(new this.rtc.RTCSessionDescription({ type: 'offer', sdp: sdp.sdp }));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    this.cbs.onLocalSdp({ type: 'answer', sdp: answer.sdp ?? '' });
  }

  /** Caller side: apply the peer's answer to finish the handshake. */
  async applyAnswer(sdp: CallSdp): Promise<void> {
    const pc = this.requirePc();
    await pc.setRemoteDescription(new this.rtc.RTCSessionDescription({ type: 'answer', sdp: sdp.sdp }));
  }

  /** Add a trickled remote ICE candidate. */
  async addIce(ice: CallIce): Promise<void> {
    const pc = this.requirePc();
    await pc.addIceCandidate(new this.rtc.RTCIceCandidate(ice));
  }

  /** Toggle the local audio track(s) on/off. Returns the new enabled state. */
  setAudioEnabled(on: boolean): void {
    this.local?.getAudioTracks().forEach((t) => { t.enabled = on; });
  }

  /** Toggle the local video track(s) on/off. */
  setVideoEnabled(on: boolean): void {
    this.local?.getVideoTracks().forEach((t) => { t.enabled = on; });
  }

  /** Switch between front/back camera (no-op when there's no video track). */
  async switchCamera(): Promise<void> {
    const track = this.local?.getVideoTracks()[0] as unknown as { _switchCamera?: () => void } | undefined;
    track?._switchCamera?.();
  }

  /** Start screenshare: capture the display, replace the outgoing video track
   *  with the screen track via the existing sender (so the peer sees the screen
   *  without renegotiation). Returns true on success. Android needs the
   *  mediaProjection foreground-service permissions declared in app.config.js. */
  async startScreenshare(): Promise<boolean> {
    const md = this.rtc.mediaDevices as unknown as { getDisplayMedia?: () => Promise<MediaStream> };
    if (typeof md.getDisplayMedia !== 'function') return false;
    const display = await md.getDisplayMedia();
    this.screen = display;
    const screenTrack = display.getVideoTracks()[0];
    const pc = this.requirePc();
    const sender = (pc as unknown as {
      getSenders: () => { track: { kind: string } | null; replaceTrack: (t: unknown) => Promise<void> }[];
    }).getSenders().find((s) => s.track?.kind === 'video');
    if (sender && screenTrack) await sender.replaceTrack(screenTrack);
    return true;
  }

  /** Stop screenshare + restore the camera track on the video sender. */
  async stopScreenshare(): Promise<void> {
    this.screen?.getTracks().forEach((t) => t.stop());
    this.screen = null;
    const camTrack = this.local?.getVideoTracks()[0];
    if (!camTrack) return;
    const pc = this.requirePc();
    const sender = (pc as unknown as {
      getSenders: () => { track: { kind: string } | null; replaceTrack: (t: unknown) => Promise<void> }[];
    }).getSenders().find((s) => s.track?.kind === 'video');
    if (sender) await sender.replaceTrack(camTrack);
  }

  /** Tear down: stop every track + close the connection. Idempotent. */
  close(): void {
    try { this.local?.getTracks().forEach((t) => t.stop()); } catch { /* ignore */ }
    try { this.screen?.getTracks().forEach((t) => t.stop()); } catch { /* ignore */ }
    try { this.pc?.close(); } catch { /* ignore */ }
    this.local = null;
    this.screen = null;
    this.pc = null;
  }

  private requirePc(): RTCPeerConnection {
    if (!this.pc) throw new Error('CallPeer not started');
    return this.pc;
  }
}
