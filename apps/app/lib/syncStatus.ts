/** App-wide "is background sync work in flight" counter.
 *
 *  WHY: when the app foregrounds, several invisible sync passes run before new
 *  messages appear (app-open inbox sync, conversation revalidation, the
 *  channels-list miss-refresher). The user saw a blank gap and waited, not
 *  knowing anything was happening. This tiny store lets those entry points
 *  mark themselves in-flight so a small pill can pulse while work is pending
 *  and vanish the instant it settles.
 *
 *  Plain module-level counter + a `useSyncExternalStore` snapshot — no React
 *  context, no extra deps, callable from non-React sync code (xmtp.stream,
 *  feedQuery, HomeScreen.sync) via `trackSync(fn)` / `beginSync()`. */

let inFlight = 0;
const listeners = new Set<() => void>();

function emit(): void {
  for (const l of listeners) { try { l(); } catch { /* ignore */ } }
}

/** Mark one unit of sync work as started. Returns the matching `end` fn; call
 *  it exactly once (idempotent — a double call won't drop the count below 0). */
export function beginSync(): () => void {
  inFlight += 1;
  emit();
  let ended = false;
  return () => {
    if (ended) return;
    ended = true;
    inFlight = Math.max(0, inFlight - 1);
    emit();
  };
}

/** Wrap an async sync pass so it's counted for its whole lifetime. The promise
 *  result/rejection is passed straight through (never swallowed). */
export function trackSync<T>(run: () => Promise<T>): Promise<T> {
  const end = beginSync();
  return run().finally(end);
}

/** useSyncExternalStore plumbing. */
export function subscribeSyncStatus(cb: () => void): () => void {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
}

export function getSyncInFlight(): number {
  return inFlight;
}
