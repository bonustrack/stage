import { useCallback, useMemo } from 'react';
import type { FrameAction } from '@stage-labs/kit/frame';
import type { FrameActionHandler } from '@stage-labs/kit/react-native/frame';
import type { FrameContent } from '@stage-labs/client/xmtp/frame';
import { xmtpSendFrameAction } from '../../lib/xmtp.messages';
import { capabilities } from '../../lib/capabilities';
import { report } from '../../lib/errorPolicy';
import { actOnLiveFrame, refreshLiveFrame, useLiveFrame } from '../../lib/liveFrame';
import { frameActionContent, frameActionTarget, frameNodeOf, type FrameNodeLink } from './frame.model';

export async function sendFrameActionToChat(line: string, messageId: string, action: FrameAction, label: string | undefined): Promise<boolean> {
  const content = frameActionContent(messageId, action, label);
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
  onAction: FrameActionHandler;
  refresh: () => void;
}

export function useChatFrame(frame: FrameContent | null, line: string, messageId: string, onSent?: () => void): ChatFrame {
  const node = useMemo(() => (frame === null ? null : frameNodeOf(frame)), [frame]);
  const live = useLiveFrame(messageId);
  const onAction = useCallback<FrameActionHandler>(async (action, source) => {
    if (frame !== null && node !== null && frameActionTarget(action, true) === 'node') {
      await actOnLiveFrame(messageId, frame, node.url, action);
      return;
    }
    if (await sendFrameActionToChat(line, messageId, action, source.label)) onSent?.();
  }, [frame, node, line, messageId, onSent]);
  const refresh = useCallback(() => {
    if (frame !== null && node !== null) void refreshLiveFrame(messageId, frame, node.url);
  }, [frame, node, messageId]);
  return { frame: node === null ? frame : live ?? frame, node, onAction, refresh };
}
