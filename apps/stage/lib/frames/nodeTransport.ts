import { createA2uiClient } from '@stage-labs/kit/a2ui/client';
import { loadNode, sendNodeMessage, type NodeRequest, type NodeResult } from '@stage-labs/client/nodes/protocol';
import type { FrameMessage } from '@stage-labs/client/xmtp/frame';

export const RENDERER_CAPABILITIES: Record<string, unknown> = { ...createA2uiClient().capabilities() };

export interface NodeSource {
  url: string;
  key: string;
}

type OnMessage = (message: FrameMessage) => void;

export interface NodeTransport {
  load: (node: NodeSource, options?: { signal?: AbortSignal; onMessage?: OnMessage }) => Promise<NodeResult>;
  send: (node: NodeSource, request: NodeRequest, onMessage: OnMessage) => Promise<NodeResult>;
}

export const frameNodes: NodeTransport = {
  load: (node, options = {}) => loadNode(node.url, node.key, { ...options, capabilities: RENDERER_CAPABILITIES }),
  send: (node, request, onMessage) => sendNodeMessage(node.url, node.key, request, { capabilities: RENDERER_CAPABILITIES, onMessage }),
};
