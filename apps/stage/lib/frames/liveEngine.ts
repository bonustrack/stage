import type { NodeResult } from '@stage-labs/client/nodes/protocol';
import type { FrameContent, FrameMessage } from '@stage-labs/client/xmtp/frame';
import { nodeRequestOf, type FrameOut } from './frame.model';
import type { FrameSessions } from './frameSession';
import { liveProblemText, liveStateAfter, type LiveState } from './live.model';
import type { NodeSource, NodeTransport } from './nodeTransport';

export interface LiveSlot {
  sessionKey: string;
  node: NodeSource;
  read: () => LiveState;
  show: (frame: FrameContent) => void;
}

export type LiveCall = { load: true; signal?: AbortSignal } | { load: false; out: FrameOut };

export interface LiveStep {
  result: NodeResult;
  next: LiveState;
}

export interface LiveEngineDeps {
  sessions: Pick<FrameSessions, 'streamInto'>;
  transport: NodeTransport;
  now: () => number;
  toast: (message: string) => void;
}

export interface LiveEngine {
  run: (slot: LiveSlot, call: LiveCall) => Promise<LiveStep>;
  toastProblem: (next: LiveState, load: boolean) => boolean;
}

function requestOf(
  transport: NodeTransport,
  node: NodeSource,
  call: LiveCall,
  onMessage: (message: FrameMessage) => void,
): Promise<NodeResult> {
  if (call.load) return transport.load(node, { signal: call.signal, onMessage });
  return transport.send(node, nodeRequestOf(call.out), onMessage);
}

export function makeLiveEngine(deps: LiveEngineDeps): LiveEngine {
  return {
    run: async (slot, call) => {
      const { result, applied } = await deps.sessions.streamInto(slot.sessionKey, call.load, slot.show, (onMessage) =>
        requestOf(deps.transport, slot.node, call, onMessage),
      );
      return { result, next: liveStateAfter(slot.read(), result, deps.now(), applied) };
    },
    toastProblem: (next, load) => {
      const problem = liveProblemText(next);
      if (problem === null) return false;
      deps.toast(`${load ? 'Could not refresh' : 'Could not send'}: ${problem.toLowerCase()}`);
      return true;
    },
  };
}
