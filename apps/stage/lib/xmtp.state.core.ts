import type { HistoryEntry } from '@stage-labs/client/types';
import { clearAppDataWrites } from '@stage-labs/client/xmtp/labels';
import { makeListeners, makeValue } from './storeCore';
import { resetFeedLines } from './feedLines';
import { attempt } from './errorPolicy';

export const inboxEthCache = new Map<string, string>();

let feedGeneration = 0;
const feedSlices = new Map<string, HistoryEntry[]>();
const cachedFeedIds = new Map<string, ReadonlySet<string>>();
const feedChanges = makeListeners<{ line: string; slice: HistoryEntry[] | undefined }>();

function setFeedSlice(line: string, slice: HistoryEntry[]): void {
  feedSlices.set(line, slice);
  feedChanges.notify({ line, slice });
}

export const feedCache = {
  generation: (): number => feedGeneration,
  get: (line: string): HistoryEntry[] | undefined => feedSlices.get(line),
  set: setFeedSlice,
  showCached(line: string, slice: HistoryEntry[]): void {
    cachedFeedIds.set(line, new Set(slice.map(e => e.id)));
    setFeedSlice(line, slice);
  },
  cachedIds: (line: string): ReadonlySet<string> | undefined => cachedFeedIds.get(line),
  settleCached(line: string): void { cachedFeedIds.delete(line); },
  subscribeAll(cb: (line: string, slice: HistoryEntry[] | undefined) => void): () => void {
    return feedChanges.subscribe(({ line, slice }) => { cb(line, slice); });
  },
  clear(): void {
    feedGeneration += 1;
    const lines = [...feedSlices.keys()];
    feedSlices.clear();
    cachedFeedIds.clear();
    for (const line of lines) feedChanges.notify({ line, slice: undefined });
  },
};

export { activeFeedLines } from './feedLines';

const hiddenConvs = new Set<string>();

export function registerHiddenConv(convId: string): void {
  hiddenConvs.add(convId);
}

export function isHiddenConv(convId: string | null | undefined): boolean {
  return convId !== null && convId !== undefined && hiddenConvs.has(convId);
}

let activeConvId: string | null = null;

export function setActiveConvId(convId: string | null): void {
  activeConvId = convId ? convId.toLowerCase() : null;
}

export function isActiveConv(convId: string | null | undefined): boolean {
  if (!convId || !activeConvId) return false;
  return convId.toLowerCase() === activeConvId;
}

const bootstrap = makeValue<'idle' | 'registering'>('idle');

export const getXmtpBootstrapPhase = bootstrap.get;

export const useXmtpBootstrapPhase = bootstrap.use;

export async function whileRegistering<T>(work: () => Promise<T>): Promise<T> {
  bootstrap.set('registering');
  try { return await work(); } finally { bootstrap.set('idle'); }
}

let globalStreamTeardown: (() => void) | null = null;
export function registerGlobalStreamTeardown(fn: () => void): void { globalStreamTeardown = fn; }

export function resetSharedXmtpState(): void {
  clearAppDataWrites();
  globalStreamTeardown?.();
  resetFeedLines();
  feedCache.clear();
  inboxEthCache.clear();
}

const READY_CAP_MS = 60_000;

interface ClientSlot<C> {
  get: () => C | null;
  getOrCreate: (create: () => Promise<C>) => Promise<C>;
  waitForReady: () => Promise<boolean>;
  reset: () => void;
}

export function createClientSlot<C>(onReset: () => void, discard?: (client: C) => void): ClientSlot<C> {
  let cached: C | null = null;
  let inFlight: Promise<C> | null = null;
  let generation = 0;
  return {
    get: () => cached,
    getOrCreate: async (create) => {
      if (cached) return cached;
      if (inFlight) return inFlight;
      const started = generation;
      const pending = (async (): Promise<C> => {
        const client = await create();
        if (generation !== started) {
          if (discard) attempt(() => { discard(client); }, 'cleanup');
          throw new Error('The account changed while messaging was starting.');
        }
        cached = client;
        return client;
      })();
      inFlight = pending;
      try { return await pending; } finally { if (inFlight === pending) inFlight = null; }
    },
    waitForReady: async () => {
      const start = Date.now();
      while (cached === null && Date.now() - start < READY_CAP_MS) await new Promise((r) => setTimeout(r, 250));
      return cached !== null;
    },
    reset: () => {
      generation += 1;
      cached = null;
      inFlight = null;
      onReset();
    },
  };
}
