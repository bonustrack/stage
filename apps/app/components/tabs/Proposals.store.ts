/** @file Proposals.store — module-level singleton owning the pending-proposal queue, session skip set, and lazy/cache-driven rebuild, giving the Home banner an O(1) count and the Proposals screen the full shared queue. */

import { getCachedRows, subscribeCachedRows, type CachedRow } from '../../modules/messaging';
import { buildProposalQueue, type QueuedRequest } from './Proposals.queue';

/** Per-item keys skipped this session, filtered out of every rebuilt queue until a manual refresh/restart. Keyed by `QueuedRequest.key` (`kind:convId`) so distinct request kinds in the same channel skip independently. */
const skipped = new Set<string>();

let queue: QueuedRequest[] = [];
/** Cached visible (non-skipped) view plus the (queue, skip-size) it was built from; getQueue() is read every render by useSyncExternalStore which needs a reference-stable snapshot, so memoize and invalidate only when the queue or skip set changes (else "Maximum update depth exceeded"). */
let visibleCache: QueuedRequest[] = [];
let visibleQueue: QueuedRequest[] | null = null;
let visibleSkipSize = -1;
/** True once the first build has settled (lets the screen gate its spinner). */
let ready = false;
/** Guards against a stale async build landing after a newer one. */
let buildId = 0;
/** Debounce timer for cache-driven rebuilds (cache can churn during sync). */
let rebuildTimer: ReturnType<typeof setTimeout> | null = null;
/** Whether we've wired the (single) cache subscription yet. */
let wired = false;

const listeners = new Set<() => void>();

/** Visible queue = built queue minus session-skipped ids. Memoized on the (queue, skip-size) pair so repeated reads (every render) return a stable reference; see visibleCache note above. */
function visible(): QueuedRequest[] {
  if (visibleQueue === queue && visibleSkipSize === skipped.size) return visibleCache;
  visibleCache = skipped.size === 0 ? queue : queue.filter(p => !skipped.has(p.key));
  visibleQueue = queue;
  visibleSkipSize = skipped.size;
  return visibleCache;
}

/** Emit helper. */
function emit(): void {
  for (const l of listeners) l();
}

/** Apply Build. */
function applyBuild(id: number, q: QueuedRequest[]): void {
  if (id !== buildId) return; /** a newer build superseded this one */
  queue = q;
  ready = true;
  /** Always emit: the screen consumes the full queue (contents may change even when the count holds), and the banner cheaply re-reads its count. */
  emit();
}

/** Kick a fresh scan from the current cache. `clearSkips` resets session skips (manual refresh). The scan is bounded inside buildProposalQueue. */
function rebuild(rows: CachedRow[] | null, clearSkips: boolean): void {
  if (clearSkips) skipped.clear();
  const id = ++buildId;
  void buildProposalQueue(rows ?? []).then(q => { applyBuild(id, q); });
}

/** Debounced rebuild used by the cache subscription so a burst of cache writes during sync collapses into a single scan. */
function scheduleRebuild(rows: CachedRow[] | null): void {
  if (rebuildTimer) clearTimeout(rebuildTimer);
  rebuildTimer = setTimeout(() => { rebuildTimer = null; rebuild(rows, false); }, 250);
}

/** Lazily wire the single cache subscription + run the first build. Called from subscribe() so nothing scans until a surface actually mounts. */
function ensureWired(): void {
  if (wired) return;
  wired = true;
  rebuild(getCachedRows(), false);
  subscribeCachedRows(rows => { scheduleRebuild(rows); });
}

export const proposalsStore = {
  /** Subscribe to count/queue changes; returns an unsubscribe. First subscriber wires the cache listener + triggers the initial build. */
  subscribe: (listener: () => void): () => void => {
    ensureWired();
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  },
  /** Number of pending (non-skipped) proposals - O(1)-ish, no scan. */
  getCount: (): number => visible().length,
  /** The visible queue (non-skipped), oldest-first. */
  getQueue: (): QueuedRequest[] => visible(),
  /** True once the first scan has settled. */
  isReady: (): boolean => ready,
  /** Mark a request skipped for the session by its item key (advances both surfaces). Also used after a request is acted on (voted / paid / signed / accepted / blocked) so it drops out without waiting for a rescan. */
  skip(key: string): void {
    if (skipped.has(key)) return;
    skipped.add(key);
    emit();
  },
  /** Manual refresh: clear session skips + re-scan from the live cache. */
  refresh(): void {
    rebuild(getCachedRows(), true);
  },
};
