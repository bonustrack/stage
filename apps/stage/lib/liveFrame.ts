import { useCallback } from 'react';
import { loadNode, newNodeKey, sendNodeAction, type NodeAction } from '@stage-labs/client/nodes/protocol';
import type { FrameContent } from '@stage-labs/client/xmtp/frame';
import { getAccountEpoch, useAccountEpoch } from './accountEpoch';
import { capabilities } from './capabilities';
import { makeLiveFrames } from './liveFrame.core';
import { useStoreValue } from './storeCore';

const frames = makeLiveFrames({
  load: (url, key) => loadNode(url, key),
  act: (url, key, action) => sendNodeAction(url, key, action),
  newKey: newNodeKey,
  now: () => Date.now(),
  toast: (message) => { capabilities.toast(message); },
});

function slotOf(epoch: number, messageId: string): string {
  return `${epoch}:${messageId}`;
}

export function useLiveFrame(messageId: string): FrameContent | null {
  const epoch = useAccountEpoch();
  const read = useCallback(() => frames.frameOf(slotOf(epoch, messageId)), [epoch, messageId]);
  return useStoreValue(frames.subscribe, read);
}

export function refreshLiveFrame(messageId: string, sent: FrameContent, url: string): Promise<void> {
  return frames.refresh(slotOf(getAccountEpoch(), messageId), sent, url);
}

export function actOnLiveFrame(messageId: string, sent: FrameContent, url: string, action: NodeAction): Promise<void> {
  return frames.act(slotOf(getAccountEpoch(), messageId), sent, url, action);
}
