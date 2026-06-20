
import { getCachedRows, subscribeCachedRows, type CachedRow } from '../../modules/messaging';
import { buildProposalQueue, type QueuedRequest } from './Proposals.queue';

const skipped = new Set<string>();

let queue: QueuedRequest[] = [];
let visibleCache: QueuedRequest[] = [];
let visibleQueue: QueuedRequest[] | null = null;
let visibleSkipSize = -1;
let ready = false;
let buildId = 0;
let rebuildTimer: ReturnType<typeof setTimeout> | null = null;
let wired = false;

const listeners = new Set<() => void>();

function visible(): QueuedRequest[] {
  if (visibleQueue === queue && visibleSkipSize === skipped.size) return visibleCache;
  visibleCache = skipped.size === 0 ? queue : queue.filter(p => !skipped.has(p.key));
  visibleQueue = queue;
  visibleSkipSize = skipped.size;
  return visibleCache;
}

function emit(): void {
  for (const l of listeners) l();
}

function applyBuild(id: number, q: QueuedRequest[]): void {
  if (id !== buildId) return;
  queue = q;
  ready = true;
  emit();
}

function rebuild(rows: CachedRow[] | null, clearSkips: boolean): void {
  if (clearSkips) skipped.clear();
  const id = ++buildId;
  void buildProposalQueue(rows ?? []).then(q => { applyBuild(id, q); });
}

function scheduleRebuild(rows: CachedRow[] | null): void {
  if (rebuildTimer) clearTimeout(rebuildTimer);
  rebuildTimer = setTimeout(() => { rebuildTimer = null; rebuild(rows, false); }, 250);
}

function ensureWired(): void {
  if (wired) return;
  wired = true;
  rebuild(getCachedRows(), false);
  subscribeCachedRows(rows => { scheduleRebuild(rows); });
}

export const proposalsStore = {
  subscribe: (listener: () => void): () => void => {
    ensureWired();
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  },
  getCount: (): number => visible().length,
  getQueue: (): QueuedRequest[] => visible(),
  isReady: (): boolean => ready,
  skip(key: string): void {
    if (skipped.has(key)) return;
    skipped.add(key);
    emit();
  },
  refresh(): void {
    rebuild(getCachedRows(), true);
  },
};
