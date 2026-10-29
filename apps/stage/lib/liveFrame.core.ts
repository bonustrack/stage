import type { NodeRequest, NodeResult } from '@stage-labs/client/nodes/protocol';
import type { FrameContent, FrameMessage } from '@stage-labs/client/xmtp/frame';
import { nodeRequestOf, type FrameOut } from '../components/frame/frame.model';
import { EMPTY_LIVE, liveProblemText, liveStateAfter, type LiveState } from '../components/dashboard/liveWidget.model';
import { streamInto } from './frameSession';
import { makeListeners } from './storeCore';

type OnMessage = (message: FrameMessage) => void;

interface LiveFrameDeps {
  load: (url: string, key: string, onMessage: OnMessage) => Promise<NodeResult>;
  send: (url: string, key: string, request: NodeRequest, onMessage: OnMessage) => Promise<NodeResult>;
  newKey: () => string;
  now: () => number;
  toast: (message: string) => void;
}

interface LiveFrameEntry {
  key: string;
  state: LiveState;
  calls: number;
}

interface LiveFrames {
  frameOf: (id: string) => FrameContent | null;
  clear: () => void;
  subscribe: (listener: () => void) => () => void;
  refresh: (id: string, sent: FrameContent, url: string) => Promise<void>;
  send: (id: string, sent: FrameContent, url: string, out: FrameOut) => Promise<void>;
}

export function makeLiveFrames(deps: LiveFrameDeps): LiveFrames {
  const entries = new Map<string, LiveFrameEntry>();
  const { notify, subscribe } = makeListeners();
  const entryOf = (id: string, sent: FrameContent): LiveFrameEntry => {
    const known = entries.get(id);
    if (known !== undefined) return known;
    const entry = { key: deps.newKey(), state: { ...EMPTY_LIVE, frame: sent }, calls: 0 };
    entries.set(id, entry);
    return entry;
  };
  const call = async (
    id: string,
    sent: FrameContent,
    load: boolean,
    run: (key: string, onMessage: OnMessage) => Promise<NodeResult>,
  ): Promise<void> => {
    const entry = entryOf(id, sent);
    entry.calls += 1;
    const ticket = entry.calls;
    const { result, applied } = await streamInto(
      id,
      load,
      (frame) => {
        if (entries.get(id) !== entry) return;
        entry.state = { ...entry.state, frame };
        notify();
      },
      (onMessage) => run(entry.key, onMessage),
    );
    if (entries.get(id) !== entry) return;
    if (ticket !== entry.calls && (!result.ok || load)) return;
    const next = liveStateAfter(entry.state, result, deps.now(), applied);
    const problem = liveProblemText(next);
    if (problem !== null) {
      deps.toast(`${load ? 'Could not refresh' : 'Could not send'}: ${problem.toLowerCase()}`);
      return;
    }
    entry.state = next;
    notify();
  };
  return {
    frameOf: (id) => entries.get(id)?.state.frame ?? null,
    clear: () => {
      entries.clear();
      notify();
    },
    subscribe,
    refresh: (id, sent, url) => call(id, sent, true, (key, onMessage) => deps.load(url, key, onMessage)),
    send: (id, sent, url, out) => call(id, sent, false, (key, onMessage) => deps.send(url, key, nodeRequestOf(out), onMessage)),
  };
}
