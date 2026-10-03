import { useCallback } from 'react';
import type { FrameActionHandler } from '@stage-labs/kit/react-native/frame';
import { xmtpSendFrameAction } from '../../lib/xmtp.messages';
import { capabilities } from '../../lib/capabilities';
import { report } from '../../lib/errorPolicy';
import { frameActionContent } from './frame.model';

export function useFrameAction(line: string, messageId: string, onSent?: () => void): FrameActionHandler {
  return useCallback(async (action, source) => {
    const content = frameActionContent(messageId, action, source.label);
    if (content === null) {
      capabilities.toast('This answer is too long to send.');
      return;
    }
    try {
      await xmtpSendFrameAction(line, content);
      onSent?.();
    } catch (err) {
      report('frame.action', err);
      capabilities.toast('Could not send. Try again.');
    }
  }, [line, messageId, onSent]);
}
