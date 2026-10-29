import { useCallback, useMemo } from 'react';
import type { FrameContent } from '@stage-labs/client/xmtp/frame';
import { xmtpSendFrameAction } from '../../lib/xmtp.messages';
import { capabilities } from '../../lib/capabilities';
import { report } from '../../lib/errorPolicy';
import { engageFrameSession, rejectAgentCall } from '../../lib/frameSession';
import { refreshLiveFrame, sendToLiveFrame, useChatFrameKey, useLiveFrame } from '../../lib/liveFrame';
import { frameActionContent, frameNodeOf, type FrameMessageHandler, type FrameNodeLink, type FrameOut } from './frame.model';

async function sendFrameActionToChat(line: string, messageId: string, out: FrameOut): Promise<boolean> {
  const content = frameActionContent(messageId, out);
  if (content === null) {
    capabilities.toast('This answer is too long to send.');
    return false;
  }
  try {
    await xmtpSendFrameAction(line, content);
    return true;
  } catch (err) {
    report('frame.action', err);
    capabilities.toast('Could not send. Try again.');
    return false;
  }
}

export interface ChatFrame {
  frame: FrameContent | null;
  node: FrameNodeLink | null;
  sessionKey: string;
  onMessage: FrameMessageHandler;
  refresh: () => void;
}

export function useChatFrame(frame: FrameContent | null, line: string, messageId: string, onSent?: () => void): ChatFrame {
  const node = useMemo(() => (frame === null ? null : frameNodeOf(frame)), [frame]);
  const live = useLiveFrame(messageId);
  const sessionKey = useChatFrameKey(messageId);
  const onMessage = useCallback<FrameMessageHandler>(
    async (out) => {
      const { message } = out;
      if (frame !== null && node !== null) {
        if ('action' in message) engageFrameSession(sessionKey);
        await sendToLiveFrame(messageId, frame, node.url, out);
      } else if ('callAgentFunction' in message) rejectAgentCall(sessionKey, message.callAgentFunction.functionCallId);
      else if ('error' in message) report('frame.a2ui', new Error(`${message.error.code}: ${message.error.message}`));
      else if ('action' in message && (await sendFrameActionToChat(line, messageId, out))) onSent?.();
    },
    [frame, node, line, messageId, onSent, sessionKey],
  );
  const refresh = useCallback(() => {
    if (frame === null || node === null) return;
    engageFrameSession(sessionKey);
    void refreshLiveFrame(messageId, frame, node.url);
  }, [frame, node, messageId, sessionKey]);
  return { frame: node === null ? frame : (live ?? frame), node, sessionKey, onMessage, refresh };
}
