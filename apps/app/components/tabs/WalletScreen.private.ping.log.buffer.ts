/** Batched, capped log buffer for the Node-bridge ping probe.
 *
 *  The probe streams two HIGH-FREQUENCY sources into the on-screen log: the
 *  bridge lifecycle sink (setBridgeStatusListener) and the engine's live
 *  `event:scanDebug` events. Appending each line straight into React state
 *  (setLog(prev => [...prev, line])) re-rendered the whole probe AND grew an
 *  unbounded array on EVERY line - during a scan that fired constantly and made
 *  the phone laggy.
 *
 *  This hook fixes both: incoming lines land in a plain ref buffer (no render),
 *  capped to the last CAP entries (ring buffer), and are flushed into React
 *  state at most once per FLUSH_MS so a burst of N lines costs ONE re-render
 *  instead of N. `append` is render-free; `replace` swaps the visible log (used
 *  to clear at the start of a run). */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { LogLine } from './WalletScreen.private.ping.log';

/** Keep only the most recent lines - older lines scroll off, bounded memory. */
const CAP = 300;
/** Coalesce bursts: flush the buffer to state at most this often (ms). */
const FLUSH_MS = 350;

export interface BatchedLog {
  /** The currently-rendered (flushed) lines. */
  lines: LogLine[];
  /** Append a line to the ring buffer (render-free; flushed on the next tick). */
  append: (line: LogLine) => void;
  /** Replace the whole log immediately (e.g. clear to [] at the start of a run). */
  replace: (lines: LogLine[]) => void;
}

export function useBatchedLog(): BatchedLog {
  const [lines, setLines] = useState<LogLine[]>([]);
  const buf = useRef<LogLine[]>([]);
  const dirty = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flush = useCallback(() => {
    if (!dirty.current) return;
    dirty.current = false;
    setLines(buf.current.slice());
  }, []);

  // A self-rescheduling timeout coalesces all bursts into at most one render per
  // FLUSH_MS (setTimeout typing is portable across RN/node, unlike setInterval).
  useEffect(() => {
    let live = true;
    const tick = (): void => {
      if (!live) return;
      flush();
      timer.current = setTimeout(tick, FLUSH_MS);
    };
    timer.current = setTimeout(tick, FLUSH_MS);
    return () => {
      live = false;
      if (timer.current) clearTimeout(timer.current);
    };
  }, [flush]);

  const append = useCallback((line: LogLine) => {
    const next = buf.current;
    next.push(line);
    if (next.length > CAP) next.splice(0, next.length - CAP);
    dirty.current = true;
  }, []);

  const replace = useCallback((next: LogLine[]) => {
    buf.current = next.slice(-CAP);
    dirty.current = false;
    setLines(buf.current.slice());
  }, []);

  return { lines, append, replace };
}
