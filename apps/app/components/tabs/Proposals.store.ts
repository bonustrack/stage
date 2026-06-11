/** Shared proposal-queue store - one module-level singleton that owns the
 *  pending-poll queue, the session "skipped" set, and a lazy/cached rebuild.
 *
 *  WHY a singleton (not the hook's local state): the Home banner only needs the
 *  *count* of pending proposals, and the Proposals screen needs the full queue +
 *  the same skip set. Home re-renders constantly, so the count must be O(1) to
 *  read and the underlying scan must NOT run per render. This store builds the
 *  queue lazily - once on first access, then only when the channels-list cache
 *  actually changes (debounced) - caches the result, and notifies subscribers
 *  only when the visible count flips. Both surfaces read from here, sharing the
 *  session skip set so a poll skipped in the screen also drops out of the banner.
 *
 *  Skipped ids live for the session (a module Set) and reset on a manual
 *  refresh() / app restart, matching the original hook's semantics. */

import { getCachedRows, subscribeCachedRows, type CachedRow } from '../../modules/messaging';
import { buildProposalQueue, type QueuedProposal } from './Proposals.queue';

/** Conv ids skipped this session - filtered out of every rebuilt queue so a
 *  skipped poll never reappears (in the banner count or the screen) until a
 *  manual refresh / app restart. */
const skipped = new Set<string>();

let queue: QueuedProposal[] = [];
/** Cached visible (non-skipped) view + the (queue, skip-size) it was built from.
 *  getQueue() is read on EVERY render by useSyncExternalStore, which bails the
 *  re-render loop only when the snapshot is reference-stable. Recomputing the
 *  filtered array each call returns a fresh reference every time → React sees an
 *  ever-changing snapshot → "Maximum update depth exceeded". So memoize it and
 *  invalidate only when the underlying queue or skip set actually changes. */
let visibleCache: QueuedProposal[] = [];
let visibleQueue: QueuedProposal[] | null = null;
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

/** Visible queue = built queue minus session-skipped ids. Memoized on the
 *  (queue, skip-size) pair so repeated reads (every render) return a stable
 *  reference; see visibleCache note above. */
function visible(): QueuedProposal[] {
  if (visibleQueue === queue && visibleSkipSize === skipped.size) return visibleCache;
  visibleCache = skipped.size === 0 ? queue : queue.filter(p => !skipped.has(p.convId));
  visibleQueue = queue;
  visibleSkipSize = skipped.size;
  return visibleCache;
}

function emit(): void {
  for (const l of listeners) l();
}

function applyBuild(id: number, q: QueuedProposal[]): void {
  if (id !== buildId) return; // a newer build superseded this one
  queue = q;
  ready = true;
  // Always emit: the screen consumes the full queue (contents may change even
  // when the count holds), and the banner cheaply re-reads its count.
  emit();
}

/** Kick a fresh scan from the current cache. `clearSkips` resets session skips
 *  (manual refresh). The scan is bounded inside buildProposalQueue. */
function rebuild(rows: CachedRow[] | null, clearSkips: boolean): void {
  if (clearSkips) skipped.clear();
  const id = ++buildId;
  void buildProposalQueue(rows ?? []).then(q => applyBuild(id, q));
}

/** Debounced rebuild used by the cache subscription so a burst of cache writes
 *  during sync collapses into a single scan. */
function scheduleRebuild(rows: CachedRow[] | null): void {
  if (rebuildTimer) clearTimeout(rebuildTimer);
  rebuildTimer = setTimeout(() => { rebuildTimer = null; rebuild(rows, false); }, 250);
}

/** Lazily wire the single cache subscription + run the first build. Called from
 *  subscribe() so nothing scans until a surface actually mounts. */
function ensureWired(): void {
  if (wired) return;
  wired = true;
  rebuild(getCachedRows(), false);
  subscribeCachedRows(rows => scheduleRebuild(rows));
}

export const proposalsStore = {
  /** Subscribe to count/queue changes; returns an unsubscribe. First subscriber
   *  wires the cache listener + triggers the initial build. */
  subscribe(listener: () => void): () => void {
    ensureWired();
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  },
  /** Number of pending (non-skipped) proposals - O(1)-ish, no scan. */
  getCount(): number {
    return visible().length;
  },
  /** The visible queue (non-skipped), oldest-first. */
  getQueue(): QueuedProposal[] {
    return visible();
  },
  /** True once the first scan has settled. */
  isReady(): boolean {
    return ready;
  },
  /** Mark a proposal skipped for the session (advances both surfaces). */
  skip(convId: string): void {
    if (skipped.has(convId)) return;
    skipped.add(convId);
    emit();
  },
  /** Manual refresh: clear session skips + re-scan from the live cache. */
  refresh(): void {
    rebuild(getCachedRows(), true);
  },
};
