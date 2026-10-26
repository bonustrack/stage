import { useCallback } from 'react';
import { loadNode, newNodeKey, sendNodeMessage } from '@stage-labs/client/nodes/protocol';
import type { FrameContent } from '@stage-labs/client/xmtp/frame';
import type { FrameOut } from '../components/frame/frame.model';
import { getAccountEpoch, subscribeAccountEpoch, useAccountEpoch } from './accountEpoch';
import { capabilities } from './capabilities';
import { applyToFrameSession, clearFrameSessions, RENDERER_CAPABILITIES } from './frameSession';
import { makeLiveFrames } from './liveFrame.core';
import { useStoreValue } from './storeCore';

const frames = makeLiveFrames({
  load: (url, key) => loadNode(url, key, { capabilities: RENDERER_CAPABILITIES }),
  send: (url, key, request) => sendNodeMessage(url, key, request, { capabilities: RENDERER_CAPABILITIES }),
  apply: applyToFrameSession,
  newKey: newNodeKey,
  now: () => Date.now(),
  toast: (message) => { capabilities.toast(message); },
});

subscribeAccountEpoch(() => {
  frames.clear();
  clearFrameSessions();
});

function slotOf(epoch: number, messageId: string): string {
  return `${epoch}:${messageId}`;
}

export function useChatFrameKey(messageId: string): string {
  return slotOf(useAccountEpoch(), messageId);
}

export function useLiveFrame(messageId: string): FrameContent | null {
  const epoch = useAccountEpoch();
  const read = useCallback(() => frames.frameOf(slotOf(epoch, messageId)), [epoch, messageId]);
  return useStoreValue(frames.subscribe, read);
}

export function refreshLiveFrame(messageId: string, sent: FrameContent, url: string): Promise<void> {
  return frames.refresh(slotOf(getAccountEpoch(), messageId), sent, url);
}

export function sendToLiveFrame(messageId: string, sent: FrameContent, url: string, out: FrameOut): Promise<void> {
  return frames.send(slotOf(getAccountEpoch(), messageId), sent, url, out);
}
