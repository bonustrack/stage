import type { NodeResult } from '@stage-labs/client/nodes/protocol';
import type { FrameContent } from '@stage-labs/client/xmtp/frame';
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

export function makeLiveEngine(deps: LiveEngineDeps): LiveEngine {
  return {
    run: async (slot, call) => {
      const { result, applied } = await deps.sessions.streamInto(slot.sessionKey, call.load, slot.show, (onMessage) =>
        call.load
          ? deps.transport.load(slot.node, { signal: call.signal, onMessage })
          : deps.transport.send(slot.node, nodeRequestOf(call.out), onMessage),
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
