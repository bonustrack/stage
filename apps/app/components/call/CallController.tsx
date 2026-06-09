/** CallController — mounts the call state machine for one conversation and
 *  renders the right surface for the current phase (incoming sheet while
 *  ringing, full-screen CallScreen once accepted/dialing).
 *
 *  It exposes the outbound entry point (voice / video) via a render-prop so the
 *  conversation header can place the call buttons wherever it wants without
 *  threading the whole call API. One per open 1:1 conversation. */

import { useCall } from '../../lib/useCall';
import type { CallMedia } from '../../lib/call.types';
import { CallScreen } from './CallScreen';
import { IncomingCallSheet } from './IncomingCallSheet';

export interface CallControllerProps {
  /** Account-scoped conversation line (metro://xmtp/<account>/<conv>). */
  line: string;
  /** Display name for the peer (header title). */
  peerName: string;
  /** Render-prop for the call entry buttons. `available` is false until a
   *  WebRTC-capable APK is installed; gate the buttons on it. */
  children: (api: {
    available: boolean;
    startVoice: () => void;
    startVideo: () => void;
  }) => React.ReactNode;
}

export function CallController({ line, peerName, children }: CallControllerProps): React.ReactElement {
  const {
    state, available,
    startCall, accept, reject, hangup,
    toggleMic, toggleCam, toggleScreenshare,
  } = useCall(line);

  const startVoice = (): void => {
    const media: CallMedia = { audio: true, video: false };
    void startCall(media);
  };
  const startVideo = (): void => {
    const media: CallMedia = { audio: true, video: true };
    void startCall(media);
  };

  return (
    <>
      {children({ available, startVoice, startVideo })}
      <IncomingCallSheet
        state={state}
        peerName={peerName}
        onAccept={() => { void accept(); }}
        onReject={() => { void reject(); }}
      />
      <CallScreen
        state={state}
        peerName={peerName}
        onHangup={() => { void hangup(); }}
        onToggleMic={toggleMic}
        onToggleCam={toggleCam}
        onToggleScreenshare={() => { void toggleScreenshare(); }}
      />
    </>
  );
}
