import { useCallback, useMemo } from 'react';
import type { FrameContent } from '@stage-labs/client/xmtp/frame';
import { getAccountEpoch, useAccountEpoch } from '../accountEpoch';
import { useStoreValue } from '../storeCore';
import type { FrameOut } from './frame.model';
import { frameKeysOf, type FrameKeys } from './frameKeys';
import { chatFrames } from './runtime';

function chatFrameKeys(epoch: number, messageId: string): FrameKeys {
  return frameKeysOf({ kind: 'chat', epoch, messageId });
}

export function useChatFrameKeys(messageId: string): FrameKeys {
  const epoch = useAccountEpoch();
  return useMemo(() => chatFrameKeys(epoch, messageId), [epoch, messageId]);
}

export function useLiveFrame(sessionKey: string): FrameContent | null {
  const read = useCallback(() => chatFrames.frameOf(sessionKey), [sessionKey]);
  return useStoreValue(chatFrames.subscribe, read);
}

export function refreshLiveFrame(messageId: string, sent: FrameContent, url: string): Promise<void> {
  return chatFrames.refresh(chatFrameKeys(getAccountEpoch(), messageId).session, sent, url);
}

export function sendToLiveFrame(messageId: string, sent: FrameContent, url: string, out: FrameOut): Promise<void> {
  return chatFrames.send(chatFrameKeys(getAccountEpoch(), messageId).session, sent, url, out);
}
