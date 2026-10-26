import type { NodeRequest, NodeResult } from '@stage-labs/client/nodes/protocol';
import type { FrameContent, FrameMessage } from '@stage-labs/client/xmtp/frame';
import { nodeRequestOf, type FrameOut } from '../components/frame/frame.model';
import { EMPTY_LIVE, liveProblemText, liveStateAfter, type LiveState } from '../components/dashboard/liveWidget.model';
import type { FrameSink } from './frameSession';
import { makeListeners } from './storeCore';

type OnMessage = (message: FrameMessage) => void;

export interface FrameSessions {
  start: (id: string) => number;
  end: (id: string, token: number) => void;
  sink: (id: string, onFrame: (frame: FrameContent) => void, token?: number) => FrameSink;
}

interface LiveFrameDeps {
  load: (url: string, key: string, onMessage: OnMessage) => Promise<NodeResult>;
  send: (url: string, key: string, request: NodeRequest, onMessage: OnMessage) => Promise<NodeResult>;
  sessions: FrameSessions;
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
  send: (id: string, sent: FrameContent, url: string, out: FrameOut) => Promise<void>;
}

type Run = (key: string, onMessage: OnMessage) => Promise<NodeResult>;

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
  const call = async (id: string, sent: FrameContent, run: Run, failed: string, load: boolean): Promise<void> => {
    const entry = entryOf(id, sent);
    entry.calls += 1;
    const ticket = entry.calls;
    const token = load ? deps.sessions.start(id) : undefined;
    const sink = deps.sessions.sink(id, (frame) => {
      if (entries.get(id) !== entry) return;
      entry.state = { ...entry.state, frame };
      notify();
    }, token);
    const result = await run(entry.key, sink.onMessage);
    if (token !== undefined) deps.sessions.end(id, token);
    if (entries.get(id) !== entry) return;
    if (ticket !== entry.calls && (!result.ok || load)) return;
    const next = liveStateAfter(entry.state, result, deps.now(), () => sink.applied());
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
    refresh: (id, sent, url) => call(id, sent, (key, onMessage) => deps.load(url, key, onMessage), 'Could not refresh', true),
    send: (id, sent, url, out) => call(id, sent, (key, onMessage) => deps.send(url, key, nodeRequestOf(out), onMessage), 'Could not send', false),
  };
}
