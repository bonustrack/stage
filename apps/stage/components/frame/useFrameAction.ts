import { useCallback, useMemo } from 'react';
import type { FrameContent } from '@stage-labs/client/xmtp/frame';
import { xmtpSendFrameAction } from '../../lib/xmtp.messages';
import { capabilities } from '../../lib/capabilities';
import { report } from '../../lib/errorPolicy';
import { refreshLiveFrame, sendToLiveFrame, useChatFrameKey, useLiveFrame } from '../../lib/liveFrame';
import { frameActionContent, frameNodeOf, type FrameMessageHandler, type FrameNodeLink, type FrameOut } from './frame.model';

export async function sendFrameActionToChat(line: string, messageId: string, out: FrameOut): Promise<boolean> {
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

async function toChat(line: string, messageId: string, out: FrameOut, onSent: (() => void) | undefined): Promise<void> {
  if ('error' in out.message) {
    report('frame.a2ui', new Error(`${out.message.error.code}: ${out.message.error.message}`));
    return;
  }
  if ('action' in out.message && await sendFrameActionToChat(line, messageId, out)) onSent?.();
}

export function useChatFrame(frame: FrameContent | null, line: string, messageId: string, onSent?: () => void): ChatFrame {
  const node = useMemo(() => (frame === null ? null : frameNodeOf(frame)), [frame]);
  const live = useLiveFrame(messageId);
  const sessionKey = useChatFrameKey(messageId);
  const onMessage = useCallback<FrameMessageHandler>(async (out) => {
    if (frame !== null && node !== null) await sendToLiveFrame(messageId, frame, node.url, out);
    else await toChat(line, messageId, out, onSent);
  }, [frame, node, line, messageId, onSent]);
  const refresh = useCallback(() => {
    if (frame !== null && node !== null) void refreshLiveFrame(messageId, frame, node.url);
  }, [frame, node, messageId]);
  return { frame: node === null ? frame : live ?? frame, node, sessionKey, onMessage, refresh };
}
