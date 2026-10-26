import { useCallback } from 'react';
import { loadNode, newNodeKey, sendNodeMessage } from '@stage-labs/client/nodes/protocol';
import type { FrameContent } from '@stage-labs/client/xmtp/frame';
import type { FrameOut } from '../components/frame/frame.model';
import { getAccountEpoch, subscribeAccountEpoch, useAccountEpoch } from './accountEpoch';
import { capabilities } from './capabilities';
import { clearFrameSessions, endFrameLoad, frameSink, RENDERER_CAPABILITIES, startFrameLoad } from './frameSession';
import { makeLiveFrames } from './liveFrame.core';
import { useStoreValue } from './storeCore';

const frames = makeLiveFrames({
  load: (url, key, onMessage) => loadNode(url, key, { capabilities: RENDERER_CAPABILITIES, onMessage }),
  send: (url, key, request, onMessage) => sendNodeMessage(url, key, request, { capabilities: RENDERER_CAPABILITIES, onMessage }),
  sessions: { start: startFrameLoad, end: endFrameLoad, sink: frameSink },
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
