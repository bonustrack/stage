import type { NodeAction, NodeResult } from '@stage-labs/client/nodes/protocol';
import type { FrameContent } from '@stage-labs/client/xmtp/frame';
import { EMPTY_LIVE, liveProblemText, liveStateAfter, type LiveState } from '../components/dashboard/liveWidget.model';
import { makeListeners } from './storeCore';

interface LiveFrameDeps {
  load: (url: string, key: string) => Promise<NodeResult>;
  act: (url: string, key: string, action: NodeAction) => Promise<NodeResult>;
  newKey: () => string;
  now: () => number;
  toast: (message: string) => void;
}

interface LiveFrameEntry { key: string; state: LiveState; calls: number }

export interface LiveFrames {
  frameOf: (id: string) => FrameContent | null;
  clear: () => void;
  subscribe: (listener: () => void) => () => void;
  refresh: (id: string, sent: FrameContent, url: string) => Promise<void>;
  act: (id: string, sent: FrameContent, url: string, action: NodeAction) => Promise<void>;
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
  const call = async (id: string, sent: FrameContent, request: (key: string) => Promise<NodeResult>, failed: string): Promise<void> => {
    const entry = entryOf(id, sent);
    entry.calls += 1;
    const ticket = entry.calls;
    const result = await request(entry.key);
    if (entries.get(id) !== entry || ticket !== entry.calls) return;
    const next = liveStateAfter(entry.state, result, deps.now());
    const problem = liveProblemText(next);
    if (problem !== null) {
      deps.toast(`${failed}: ${problem.toLowerCase()}`);
      return;
    }
    entry.state = next;
    notify();
  };
  return {
    frameOf: id => entries.get(id)?.state.frame ?? null,
    clear: () => {
      entries.clear();
      notify();
    },
    subscribe,
    refresh: (id, sent, url) => call(id, sent, key => deps.load(url, key), 'Could not refresh'),
    act: (id, sent, url, action) => call(id, sent, key => deps.act(url, key, action), 'Could not send'),
  };
}
