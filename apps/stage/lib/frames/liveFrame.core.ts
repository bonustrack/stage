import type { FrameContent } from '@stage-labs/client/xmtp/frame';
import type { FrameOut } from './frame.model';
import { EMPTY_LIVE, type LiveState } from './live.model';
import type { LiveCall, LiveEngine } from './liveEngine';
import { makeListeners } from '../storeCore';

interface LiveFrameEntry {
  key: string;
  state: LiveState;
  calls: number;
}

export interface LiveFrames {
  frameOf: (sessionKey: string) => FrameContent | null;
  clear: () => void;
  subscribe: (listener: () => void) => () => void;
  refresh: (sessionKey: string, sent: FrameContent, url: string) => Promise<void>;
  send: (sessionKey: string, sent: FrameContent, url: string, out: FrameOut) => Promise<void>;
}

export function makeLiveFrames(engine: LiveEngine, newKey: () => string): LiveFrames {
  const entries = new Map<string, LiveFrameEntry>();
  const { notify, subscribe } = makeListeners();
  const entryOf = (sessionKey: string, sent: FrameContent): LiveFrameEntry => {
    const known = entries.get(sessionKey);
    if (known !== undefined) return known;
    const entry = { key: newKey(), state: { ...EMPTY_LIVE, frame: sent }, calls: 0 };
    entries.set(sessionKey, entry);
    return entry;
  };
  const call = async (sessionKey: string, sent: FrameContent, url: string, live: LiveCall): Promise<void> => {
    const entry = entryOf(sessionKey, sent);
    entry.calls += 1;
    const ticket = entry.calls;
    const current = (): boolean => entries.get(sessionKey) === entry;
    const { result, next } = await engine.run(
      {
        sessionKey,
        node: { url, key: entry.key },
        read: () => entry.state,
        show: (frame) => {
          if (!current()) return;
          entry.state = { ...entry.state, frame };
          notify();
        },
      },
      live,
    );
    if (!current()) return;
    if (ticket !== entry.calls && (!result.ok || live.load)) return;
    if (engine.toastProblem(next, live.load)) return;
    entry.state = next;
    notify();
  };
  return {
    frameOf: (sessionKey) => entries.get(sessionKey)?.state.frame ?? null,
    clear: () => {
      entries.clear();
      notify();
    },
    subscribe,
    refresh: (sessionKey, sent, url) => call(sessionKey, sent, url, { load: true }),
    send: (sessionKey, sent, url, out) => call(sessionKey, sent, url, { load: false, out }),
  };
}
