/** Outbound call bookkeeping: per-train pending request map + timeout/cleanup helpers. */

import { errMsg } from '../log.js';
import { encodeCall, type TrainCallResponse } from './protocol.js';

export const CALL_TIMEOUT_MS = 60_000;

export type Pending = {
  resolve: (r: TrainCallResponse) => void; reject: (err: Error) => void;
  timer: ReturnType<typeof setTimeout>;
};

export type CallTarget = {
  name: string;
  pending: Map<string, Pending>;
  proc: { stdin?: unknown } & Record<string, unknown> | null;
};

export function mintCallId(seq: number): string {
  return `req_${seq}_${Math.random().toString(36).slice(2, 8)}`;
}

/** Reject + clear all pending calls on a train (used on shutdown/exit). */
export function failAllPending(pending: Map<string, Pending>, reason: string): void {
  for (const p of pending.values()) {
    clearTimeout(p.timer);
    p.reject(new Error(reason));
  }
  pending.clear();
}

/** Dispatch `action` to a train's stdin and register a pending entry; returns the awaitable. */
export function sendCall(
  t: CallTarget,
  id: string,
  action: string,
  args: unknown,
): Promise<TrainCallResponse> {
  return new Promise<TrainCallResponse>((resolve, reject) => {
    const timer = setTimeout(() => {
      t.pending.delete(id);
      reject(new Error(`train '${t.name}' call '${action}' timed out after ${CALL_TIMEOUT_MS}ms`));
    }, CALL_TIMEOUT_MS);
    t.pending.set(id, { resolve, reject, timer });
    try {
      const stdin = (t.proc as { stdin?: { write: (s: string) => void; flush: () => void } } | null)?.stdin;
      if (!stdin || typeof stdin === 'number') throw new Error('stdin not piped');
      stdin.write(encodeCall(id, action, args));
      stdin.flush();
    } catch (err) {
      clearTimeout(timer);
      t.pending.delete(id);
      reject(new Error(`train '${t.name}' stdin write failed: ${errMsg(err)}`));
    }
  });
}
