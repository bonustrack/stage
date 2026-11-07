import { randomUuid } from '@stage-labs/client/ids';
import { lineOfConv } from '@stage-labs/client/xmtp/line';
import { subscribeAllMessages } from './xmtp.stream';
import { xmtpSendJson } from './xmtp.messages';
import { sdk } from './xmtp.sdk';
import { capabilities } from './capabilities';
import { callView, setCallView } from './calls.store';
import { openPeer } from './calls.peer';
import { makeCallInbound } from './calls.inbound';
import { callMedia } from './calls.media';
import { makeCallSession } from './calls.session.core';

const session = makeCallSession({
  media: callMedia,
  openPeer,
  view: { get: callView, set: setCallView },
  inbound: makeCallInbound,
  clientInboxId: async () => sdk.inboxIdOf(await sdk.client()),
  sendJson: (convId, codec, content) => xmtpSendJson(lineOfConv(convId), codec, content),
  toast: (message) => {
    capabilities.toast(message);
  },
  newId: randomUuid,
  now: () => Date.now(),
  every: (ms, run) => {
    const timer = setInterval(run, ms);
    return () => {
      clearInterval(timer);
    };
  },
});

export const { startCall, joinCall, declineCall, leaveCall, toggleMic, toggleCamera, toggleScreen } = session;
export const { callsSupported, screenShareSupported, useAudioRoutes, toggleSpeaker } = callMedia;
export { canToggleSpeaker, speakerOn } from './calls.route.core';
export { setCallMinimized, useCallMinimized, useCallView, type CallLinkStatus, type CallMedia, type CallView } from './calls.store';
export type { CallStream, ScreenPicker } from './calls.types';

export function startCallService(): () => void {
  if (!callsSupported) return () => undefined;
  const unsubscribe = subscribeAllMessages(session.onMessage);
  const unwatch = callMedia.watchCallLifecycle(session.leaveIfJoined);
  return () => {
    unsubscribe();
    unwatch();
    session.reset();
  };
}

export function loadCallHistory(convId: string): Promise<void> {
  if (!callsSupported) return Promise.resolve();
  return session.loadHistory(convId);
}
