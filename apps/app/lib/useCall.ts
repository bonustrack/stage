/** useCall — the 1:1 P2P call state machine + RTCPeerConnection lifecycle,
 *  signaled over XMTP.
 *
 *  Transport: every signal (invite/ringing/accept/reject/offer/answer/ice/
 *  media/hangup) is a `metro.box/call:1.0` XMTP message on the conversation
 *  `line` (account-scoped). Inbound signals are consumed off the single global
 *  message stream (subscribeAllMessages) and filtered to this call's `callId`.
 *
 *  Handshake (caller=inviter, callee=peer): invite -> callee rings; accept ->
 *  caller createOffer -> offer -> callee.acceptOffer -> answer ->
 *  caller.applyAnswer; ice trickled both ways -> connected; either side hangup
 *  -> close().
 *
 *  Scope: 1:1 only. Group (mesh) calls would need one CallPeer per remote peer
 *  (N-1 connections per device, O(N^2) total) — a deliberate later phase.
 *  Media + the RTCPeerConnection are NATIVE (react-native-webrtc): nothing here
 *  works until a dev/preview APK is built. `isWebRTCAvailable()` gates the UI. */

import { useCallback, useEffect, useRef, useState } from 'react';
import { getCachedXmtpClient } from './xmtp.client';
import { subscribeAllMessages } from './xmtp.stream';
import { xmtpSendCallSignal } from './xmtp.messages';
import { CallPeer } from './call.peer';
import { isWebRTCAvailable } from './webrtc';
import {
  type CallMedia, type CallSignal, type CallEndReason,
  CALL_CONTENT_TYPE_ID, mintCallId, buildInvite,
} from './call.types';
import { type CallState, INITIAL_CALL_STATE as INITIAL } from './call.state';

export type { CallState, CallPhase } from './call.state';

interface StreamMsgLike {
  convId: string | null;
  msg: { contentTypeId?: string; content: () => unknown; senderInboxId?: string };
}

/** Drive a 1:1 call on one conversation `line`. Returns the live call state +
 *  the control actions. Mount one per open conversation; it self-subscribes to
 *  call signals on that line and ignores everything else. */
export function useCall(line: string): {
  state: CallState;
  available: boolean;
  startCall: (media: CallMedia) => Promise<void>;
  accept: () => Promise<void>;
  reject: (reason?: CallEndReason) => Promise<void>;
  hangup: (reason?: CallEndReason) => Promise<void>;
  toggleMic: () => void;
  toggleCam: () => void;
  toggleScreenshare: () => Promise<void>;
} {
  const [state, setState] = useState<CallState>(INITIAL);
  const peerRef = useRef<CallPeer | null>(null);
  const callIdRef = useRef<string | null>(null);
  const pendingOfferRef = useRef<CallSignal | null>(null);
  const available = isWebRTCAvailable();

  const send = useCallback((sig: CallSignal) => {
    void xmtpSendCallSignal(line, sig).catch(() => { /* surfaced via state */ });
  }, [line]);

  const teardown = useCallback((reason: CallEndReason | null) => {
    peerRef.current?.close();
    peerRef.current = null;
    const ended = callIdRef.current;
    callIdRef.current = null;
    pendingOfferRef.current = null;
    setState({ ...INITIAL, phase: ended ? 'ended' : 'idle', endReason: reason });
  }, []);

  /** Build a CallPeer wired to ship SDP/ICE over XMTP + reflect remote/state. */
  const makePeer = useCallback((callId: string): CallPeer => {
    return new CallPeer({
      onLocalSdp: (sdp) => send({ callId, kind: sdp.type, sdp, ts: Date.now() }),
      onLocalIce: (ice) => send({ callId, kind: 'ice', ice, ts: Date.now() }),
      onRemoteStream: (stream) => {
        const url = (stream as unknown as { toURL?: () => string })?.toURL?.() ?? null;
        setState((s) => ({ ...s, remoteUrl: url }));
      },
      onConnectionState: (cs) => {
        if (cs === 'connected') setState((s) => ({ ...s, phase: 'connected' }));
        else if (cs === 'failed') teardown('failed');
      },
    });
  }, [send, teardown]);

  /** Caller: ring the peer. Captures media + sends the invite; the offer is
   *  created only once the peer accepts (saves camera until the call is live). */
  const startCall = useCallback(async (media: CallMedia) => {
    if (!available) return;
    const callId = mintCallId();
    callIdRef.current = callId;
    const peer = makePeer(callId);
    peerRef.current = peer;
    const local = await peer.start(media);
    const localUrl = (local as unknown as { toURL?: () => string })?.toURL?.() ?? null;
    setState({
      ...INITIAL, phase: 'inviting', callId, outgoing: true, media,
      micOn: media.audio, camOn: media.video, localUrl,
    });
    send(buildInvite(callId, media));
  }, [available, makePeer, send]);

  /** Callee: accept the incoming invite. Captures media, acks accept, then
   *  waits for the caller's offer (or applies a buffered early offer). */
  const accept = useCallback(async () => {
    const callId = callIdRef.current;
    if (!callId || !available) return;
    const media = state.media;
    const peer = makePeer(callId);
    peerRef.current = peer;
    const local = await peer.start(media);
    const localUrl = (local as unknown as { toURL?: () => string })?.toURL?.() ?? null;
    setState((s) => ({ ...s, phase: 'connecting', localUrl, micOn: media.audio, camOn: media.video }));
    send({ callId, kind: 'accept', media, ts: Date.now() });
    const buffered = pendingOfferRef.current;
    if (buffered?.sdp) { pendingOfferRef.current = null; await peer.acceptOffer(buffered.sdp); }
  }, [available, makePeer, send, state.media]);

  const reject = useCallback(async (reason: CallEndReason = 'declined') => {
    const callId = callIdRef.current;
    if (callId) send({ callId, kind: 'reject', reason, ts: Date.now() });
    teardown(reason);
  }, [send, teardown]);

  const hangup = useCallback(async (reason: CallEndReason = 'ended') => {
    const callId = callIdRef.current;
    if (callId) send({ callId, kind: 'hangup', reason, ts: Date.now() });
    teardown(reason);
  }, [send, teardown]);

  const toggleMic = useCallback(() => {
    setState((s) => { peerRef.current?.setAudioEnabled(!s.micOn); return { ...s, micOn: !s.micOn }; });
  }, []);
  const toggleCam = useCallback(() => {
    setState((s) => { peerRef.current?.setVideoEnabled(!s.camOn); return { ...s, camOn: !s.camOn }; });
  }, []);
  const toggleScreenshare = useCallback(async () => {
    const peer = peerRef.current;
    if (!peer) return;
    if (state.sharingScreen) { await peer.stopScreenshare(); setState((s) => ({ ...s, sharingScreen: false })); }
    else { const ok = await peer.startScreenshare(); if (ok) setState((s) => ({ ...s, sharingScreen: true })); }
  }, [state.sharingScreen]);

  /** Handle one inbound call signal addressed to this line. */
  const onSignal = useCallback(async (sig: CallSignal, fromSelf: boolean) => {
    if (fromSelf) return; // ignore our own echoed signals
    const active = callIdRef.current;
    switch (sig.kind) {
      case 'invite': {
        if (active) { send({ callId: sig.callId, kind: 'reject', reason: 'busy', ts: Date.now() }); return; }
        callIdRef.current = sig.callId;
        setState({
          ...INITIAL, phase: 'ringing', callId: sig.callId, outgoing: false,
          media: sig.media ?? INITIAL.media,
        });
        return;
      }
      case 'accept': {
        if (sig.callId !== active) return;
        setState((s) => ({ ...s, phase: 'connecting' }));
        await peerRef.current?.createOffer();
        return;
      }
      case 'reject': { if (sig.callId === active) teardown(sig.reason ?? 'declined'); return; }
      case 'offer': {
        if (sig.callId !== active || !sig.sdp) return;
        if (peerRef.current) await peerRef.current.acceptOffer(sig.sdp);
        else pendingOfferRef.current = sig; // early offer before accept() finished
        return;
      }
      case 'answer': { if (sig.callId === active && sig.sdp) await peerRef.current?.applyAnswer(sig.sdp); return; }
      case 'ice': { if (sig.callId === active && sig.ice) await peerRef.current?.addIce(sig.ice); return; }
      case 'hangup': { if (sig.callId === active) teardown(sig.reason ?? 'ended'); return; }
      default: return;
    }
  }, [send, teardown]);

  /** Subscribe to call signals on this line off the global message stream. */
  useEffect(() => {
    const myInbox = (getCachedXmtpClient() as { inboxId?: string } | null)?.inboxId ?? null;
    const unsub = subscribeAllMessages((m: StreamMsgLike) => {
      const msg = m.msg;
      if (msg.contentTypeId !== CALL_CONTENT_TYPE_ID) return;
      let sig: CallSignal | null = null;
      try { sig = msg.content() as CallSignal; } catch { sig = null; }
      if (!sig?.callId) return;
      const fromSelf = !!myInbox && msg.senderInboxId === myInbox;
      void onSignal(sig, fromSelf);
    });
    return () => { unsub(); };
  }, [onSignal]);

  useEffect(() => () => { peerRef.current?.close(); }, []);

  return { state, available, startCall, accept, reject, hangup, toggleMic, toggleCam, toggleScreenshare };
}
